import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkFrontmatter from 'remark-frontmatter';
import type {
  Blockquote,
  List,
  Paragraph,
  PhrasingContent,
  Root,
  RootContent,
  Table,
} from 'mdast';
import type {
  DocumentBlockNode,
  InlineRunNode,
  RawInlineMark,
} from '../types/ir';
import {
  extractWikilinkDisplay,
  tokenizeObsidianInlineText,
  type IntermediateSegment,
} from './wikilinkDetector';
import {
  ESCAPED_EQ_SENTINEL,
  ESCAPED_STAR_SENTINEL,
  ESCAPED_TILDE_SENTINEL,
  ESCAPED_UNDERSCORE_SENTINEL,
  resolveHighlightsAndReduceMarks,
} from './highlightExtension';
import { extractPlainTextFromRuns } from '../renderer/inlineFlattener';

const CALLOUT_HEADER_RE = /^\[!([a-zA-Z0-9_-]+)\]([+-])?(?:[ \t]+([^\r\n]*))?/;
const STANDALONE_OBSIDIAN_EMBED_RE = /^!\[\[([^\]\r\n]+)\]\]$/;
const BLOCK_MATH_RE = /^\$\$[\r\n]*([\s\S]*?)[\r\n]*\$\$$/;

const processor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkFrontmatter, ['yaml']);

// 禁用 micromark 默认的西文侧翼标点强调/删除线解析器（它在中文紧邻 `的**==甲==**与**==乙==**`、
// `**“中文引号”**和` 时会跨词错误配对），统一交由 highlightExtension 按 Obsidian/中文友好规则解析。
{
  const procData = processor.data() as Record<string, unknown>;
  const exts = (procData.micromarkExtensions ??
    (procData.micromarkExtensions = [])) as Array<{
    disable?: { null?: string[] };
  }>;
  exts.push({
    disable: {
      null: ['attention', 'strikethrough'],
    },
  });
}

/**
 * 将 Markdown / Obsidian 笔记源码解析为标准化的内部块级 IR 序列
 */
export function parseMarkdownToIr(markdown: string): DocumentBlockNode[] {
  if (!markdown || !markdown.trim()) {
    return [];
  }

  // 预处理独立跨行 $$...$$ 公式块，确保即使内部有空行也不会被拆成多个普通段落
  const normalizedMd = preprocessMultilineMathBlocks(markdown);
  const tree: Root = processor.parse(normalizedMd);
  const blocks: DocumentBlockNode[] = [];

  for (const node of tree.children) {
    processBlockNode(node, normalizedMd, blocks);
  }

  return blocks;
}

/**
 * 将顶层多行 $$ ... $$ 数学块保护为单段 $$...$$，不干扰代码块与行内内容
 */
function preprocessMultilineMathBlocks(src: string): string {
  const lines = src.split(/\r?\n/);
  const out: string[] = [];
  let inFence = false;
  let fenceMarker = '';
  let inMath = false;
  let mathBuffer: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!inMath) {
      const fenceMatch = /^(`{3,}|~{3,})/.exec(trimmed);
      if (fenceMatch) {
        if (!inFence) {
          inFence = true;
          fenceMarker = fenceMatch[1][0];
        } else if (trimmed.startsWith(fenceMarker.repeat(3))) {
          inFence = false;
          fenceMarker = '';
        }
        out.push(line);
        continue;
      }

      if (!inFence && trimmed === '$$') {
        inMath = true;
        mathBuffer = [];
        continue;
      }

      out.push(line);
    } else {
      if (trimmed === '$$') {
        inMath = false;
        // 用特殊的单段包裹使 remark 识别为单个段落（内部空行用 \u2028 暂存并在提取时还原为 \n）
        const encoded = mathBuffer.join('\u2028');
        out.push('');
        out.push(`$$${encoded}$$`);
        out.push('');
        mathBuffer = [];
      } else {
        mathBuffer.push(line);
      }
    }
  }

  if (inMath) {
    out.push('$$');
    out.push(...mathBuffer);
  }

  return out.join('\n');
}

function sliceNodeSource(node: RootContent, source: string): string {
  const start = node.position?.start.offset;
  const end = node.position?.end.offset;
  if (typeof start === 'number' && typeof end === 'number') {
    return source.slice(start, end);
  }
  return '';
}

function processBlockNode(
  node: RootContent,
  source: string,
  out: DocumentBlockNode[],
): void {
  switch (node.type) {
    case 'yaml': {
      out.push({
        kind: 'frontmatter',
        rawText: node.value ?? '',
      });
      return;
    }

    case 'heading': {
      const depth = Math.min(6, Math.max(1, node.depth)) as 1 | 2 | 3 | 4 | 5 | 6;
      const elementType = `h${depth}` as const;
      out.push({
        kind: 'adapted',
        elementType,
        runs: parsePhrasingToRuns(node.children, source),
      });
      return;
    }

    case 'thematicBreak': {
      out.push({ kind: 'divider' });
      return;
    }

    case 'paragraph': {
      processParagraphNode(node, source, out);
      return;
    }

    case 'list': {
      processListNode(node, source, out);
      return;
    }

    case 'blockquote': {
      processBlockquoteNode(node, source, out);
      return;
    }

    case 'code': {
      out.push({
        kind: 'unadapted_block',
        syntaxType: 'code_block',
        paragraphs: [node.value ?? ''],
      });
      return;
    }

    case 'table': {
      out.push({
        kind: 'unadapted_block',
        syntaxType: 'table',
        paragraphs: [extractTablePlainText(node, source)],
      });
      return;
    }

    case 'html': {
      out.push({
        kind: 'unadapted_block',
        syntaxType: 'html_block',
        paragraphs: [node.value ?? ''],
      });
      return;
    }

    case 'footnoteDefinition': {
      const texts: string[] = [];
      for (const child of node.children) {
        const plain = extractNodePlainText(child, source).trim();
        if (plain) texts.push(plain);
      }
      out.push({
        kind: 'unadapted_block',
        syntaxType: 'footnote',
        paragraphs: [
          `[^${node.identifier}]: ${texts.join('\n')}`.trim(),
        ],
      });
      return;
    }

    default: {
      const raw = sliceNodeSource(node, source).trim();
      if (raw) {
        out.push({
          kind: 'unadapted_block',
          syntaxType: 'html_block',
          paragraphs: [raw],
        });
      }
    }
  }
}

function processParagraphNode(
  node: Paragraph,
  source: string,
  out: DocumentBlockNode[],
): void {
  const rawTrimmed = sliceNodeSource(node, source).trim();

  // 1. 检查是否为独立数学公式块 $$...$$
  const mathMatch = BLOCK_MATH_RE.exec(rawTrimmed);
  if (mathMatch) {
    const formula = mathMatch[1].replace(/\u2028/g, '\n').trim();
    out.push({
      kind: 'unadapted_block',
      syntaxType: 'math_block',
      paragraphs: [formula || rawTrimmed.replace(/\u2028/g, '\n')],
    });
    return;
  }

  // 2. 检查是否为独立标准 Markdown 图片段落 ![alt](url)
  if (node.children.length === 1 && node.children[0].type === 'image') {
    const img = node.children[0];
    const label = img.alt
      ? `[图片: ${img.alt} (${img.url})]`
      : `[图片: ${img.url}]`;
    out.push({
      kind: 'unadapted_block',
      syntaxType: 'image',
      paragraphs: [label],
    });
    return;
  }

  // 3. 检查是否为独立 Obsidian 图片/嵌入段落 ![[a.png]]
  const embedMatch = STANDALONE_OBSIDIAN_EMBED_RE.exec(rawTrimmed);
  if (embedMatch) {
    const display = extractWikilinkDisplay(embedMatch[1], true);
    out.push({
      kind: 'unadapted_block',
      syntaxType: 'image',
      paragraphs: [`[图片: ${display}]`],
    });
    return;
  }

  // 4. 常规正文段落
  out.push({
    kind: 'adapted',
    elementType: 'paragraph',
    runs: parsePhrasingToRuns(node.children, source),
  });
}

function processListNode(
  listNode: List,
  source: string,
  out: DocumentBlockNode[],
): void {
  let orderCounter =
    typeof listNode.start === 'number' && listNode.start > 0
      ? Math.floor(listNode.start)
      : 1;

  for (const item of listNode.children) {
    const isTask = typeof item.checked === 'boolean';
    const itemType = isTask
      ? 'taskList'
      : listNode.ordered
        ? 'orderedList'
        : 'unorderedList';

    const itemMeta = isTask
      ? { checked: Boolean(item.checked) }
      : listNode.ordered
        ? { orderIndex: orderCounter++ }
        : undefined;

    if (item.children.length === 0) {
      out.push({
        kind: 'adapted',
        elementType: itemType,
        runs: [],
        listMeta: itemMeta,
      });
      continue;
    }

    let firstParagraphEmitted = false;
    for (const child of item.children) {
      if (child.type === 'paragraph') {
        out.push({
          kind: 'adapted',
          elementType: itemType,
          runs: parsePhrasingToRuns(child.children, source),
          listMeta: !firstParagraphEmitted ? itemMeta : undefined,
        });
        firstParagraphEmitted = true;
      } else if (child.type === 'list') {
        // 深度优先按阅读顺序展平子列表，子列表各自独立重新计数
        processListNode(child, source, out);
      } else {
        processBlockNode(child, source, out);
      }
    }
  }
}

function processBlockquoteNode(
  bqNode: Blockquote,
  source: string,
  out: DocumentBlockNode[],
): void {
  // 1. 识别 Obsidian Callout (> [!note] 标题)
  if (bqNode.children.length > 0 && bqNode.children[0].type === 'paragraph') {
    const firstParaPlain = extractNodePlainText(bqNode.children[0], source);
    const calloutMatch = CALLOUT_HEADER_RE.exec(firstParaPlain.trim());
    if (calloutMatch) {
      const calloutType = calloutMatch[1];
      const customTitle = calloutMatch[3]?.trim();
      const firstLines = firstParaPlain.trim().split(/\r?\n/);
      const restFirstPara = firstLines.slice(1).join('\n').trim();

      const paragraphs: string[] = [];
      const headerLabel = customTitle || calloutType.toUpperCase();
      if (restFirstPara) {
        paragraphs.push(`${headerLabel}\n${restFirstPara}`);
      } else {
        paragraphs.push(headerLabel);
      }

      for (let i = 1; i < bqNode.children.length; i++) {
        const plain = extractNodePlainText(bqNode.children[i], source).trim();
        if (plain) paragraphs.push(plain);
      }

      out.push({
        kind: 'unadapted_block',
        syntaxType: 'callout',
        paragraphs,
      });
      return;
    }
  }

  // 2. 普通引用块：内部每段独立输出一个 blockquote <section>
  for (const child of bqNode.children) {
    if (child.type === 'paragraph') {
      out.push({
        kind: 'adapted',
        elementType: 'blockquote',
        runs: parsePhrasingToRuns(child.children, source),
      });
    } else {
      processBlockNode(child, source, out);
    }
  }
}

function protectBackslashEscapes(rawSlice: string, fallbackDecoded: string): string {
  if (!rawSlice || !/\\[*=~_\\]/.test(rawSlice)) {
    return fallbackDecoded;
  }
  return rawSlice.replace(
    /\\([!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~])/g,
    (_m, ch: string) => {
      if (ch === '*') return ESCAPED_STAR_SENTINEL;
      if (ch === '=') return ESCAPED_EQ_SENTINEL;
      if (ch === '~') return ESCAPED_TILDE_SENTINEL;
      if (ch === '_') return ESCAPED_UNDERSCORE_SENTINEL;
      return ch;
    },
  );
}

function parsePhrasingToRuns(
  children: readonly PhrasingContent[],
  source: string,
): InlineRunNode[] {
  const segments: IntermediateSegment[] = [];
  collectPhrasingSegments(children, source, new Set<RawInlineMark>(), segments);
  return resolveHighlightsAndReduceMarks(segments);
}

function collectPhrasingSegments(
  nodes: readonly PhrasingContent[],
  source: string,
  activeMarks: ReadonlySet<RawInlineMark>,
  out: IntermediateSegment[],
): void {
  for (const node of nodes) {
    switch (node.type) {
      case 'text': {
        const rawSlice = sliceNodeSource(node, source);
        const textWithSentinels = protectBackslashEscapes(rawSlice, node.value);
        // 段内单回车（软换行）转为 break -> <br>
        const cleanVal = textWithSentinels.replace(/\u2028/g, '\n');
        const lines = cleanVal.split(/\r?\n/);
        for (let i = 0; i < lines.length; i++) {
          if (i > 0) {
            out.push({ kind: 'break' });
          }
          if (lines[i].length > 0) {
            out.push(...tokenizeObsidianInlineText(lines[i], activeMarks));
          }
        }
        break;
      }

      case 'strong': {
        const nextMarks = new Set(activeMarks);
        nextMarks.add('bold');
        collectPhrasingSegments(node.children, source, nextMarks, out);
        break;
      }

      case 'emphasis': {
        const nextMarks = new Set(activeMarks);
        nextMarks.add('italic');
        collectPhrasingSegments(node.children, source, nextMarks, out);
        break;
      }

      case 'delete': {
        const nextMarks = new Set(activeMarks);
        nextMarks.add('strikethrough');
        collectPhrasingSegments(node.children, source, nextMarks, out);
        break;
      }

      case 'break': {
        out.push({ kind: 'break' });
        break;
      }

      case 'inlineCode': {
        out.push({
          kind: 'unadapted_inline',
          syntaxType: 'inline_code',
          text: node.value ?? '',
        });
        break;
      }

      case 'link': {
        const text =
          extractPhrasingPlainText(node.children, source) || node.url || '';
        out.push({
          kind: 'unadapted_inline',
          syntaxType: 'link',
          text,
        });
        break;
      }

      case 'image': {
        const text = node.alt || node.url || '';
        out.push({
          kind: 'unadapted_inline',
          syntaxType: 'inline_image',
          text,
        });
        break;
      }

      case 'html': {
        out.push({
          kind: 'unadapted_inline',
          syntaxType: 'inline_html',
          text: node.value ?? '',
        });
        break;
      }

      case 'footnoteReference': {
        out.push({
          kind: 'unadapted_inline',
          syntaxType: 'link',
          text: `[^${node.identifier}]`,
        });
        break;
      }

      default:
        break;
    }
  }
}

function extractTablePlainText(table: Table, source: string): string {
  const rowTexts: string[] = [];
  for (const row of table.children) {
    const cellTexts = row.children.map((cell) =>
      extractPhrasingPlainText(cell.children, source).replace(/\r?\n/g, ' ').trim(),
    );
    rowTexts.push(cellTexts.join(' | '));
  }
  return rowTexts.join('\n');
}

function extractPhrasingPlainText(
  nodes: readonly PhrasingContent[],
  source: string,
): string {
  return extractPlainTextFromRuns(parsePhrasingToRuns(nodes, source));
}

function extractNodePlainText(node: RootContent, source: string): string {
  switch (node.type) {
    case 'paragraph':
    case 'heading':
      return extractPhrasingPlainText(node.children, source);
    case 'code':
    case 'html':
    case 'yaml':
      return node.value ?? '';
    case 'table':
      return extractTablePlainText(node, source);
    case 'blockquote':
    case 'listItem':
      return node.children.map((c) => extractNodePlainText(c, source)).join('\n');
    case 'list':
      return node.children.map((c) => extractNodePlainText(c, source)).join('\n');
    default:
      return '';
  }
}
