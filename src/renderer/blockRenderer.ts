import type { StylePreset } from '../types/settings';
import type { DocumentBlockNode, RenderWarnings } from '../types/ir';
import {
  clampBlankLines,
  clampDividerHeight,
  clampNonNegativePx,
  createDefaultDividerStyle,
} from '../defaults/defaultPreset';
import {
  resolveBlockStyleString,
  sanitizeCssValueForStyleAttr,
} from '../style/cssMerger';
import { resolveStyleVariables } from '../style/variableResolver';
import { formatListItemPrefix } from './listMarkerFormatter';
import {
  escapeHtmlCommentText,
  escapeHtmlText,
  extractPlainTextFromRuns,
  renderInlineRunsToHtml,
} from './inlineFlattener';

export interface RenderedBlocksOutput {
  sectionsHtml: string;
  warnings: RenderWarnings;
}

interface FormattedChunk {
  blankLinesBefore: number;
  blankLinesAfter: number;
  html: string;
}

/**
 * 将内部标准化块级 IR 序列按照给定 StylePreset 渲染为正文 HTML 片段序列
 */
export function renderIrBlocksToHtml(
  blocks: readonly DocumentBlockNode[],
  preset: StylePreset,
): RenderedBlocksOutput {
  const chunks: FormattedChunk[] = [];
  const undefinedVarsSet = new Set<string>();
  const unadaptedTypesSet = new Set<string>();
  let unadaptedCount = 0;

  for (const block of blocks) {
    if (block.kind === 'frontmatter') {
      unadaptedCount += 1;
      unadaptedTypesSet.add('frontmatter');
      const safeYaml = escapeHtmlCommentText(block.rawText.trim());
      const commentHtml = safeYaml
        ? `<!-- [Inline HTML 未适配语法: frontmatter]\n${safeYaml}\n-->`
        : `<!-- [Inline HTML 未适配语法: frontmatter] -->`;
      chunks.push({
        blankLinesBefore: 0,
        blankLinesAfter: 0,
        html: commentHtml,
      });
      continue;
    }

    if (block.kind === 'unadapted_block') {
      unadaptedCount += 1;
      unadaptedTypesSet.add(block.syntaxType);

      const fallbackCfg = preset.elements.paragraph;
      const secRes = resolveBlockStyleString(
        fallbackCfg.sectionStyle,
        preset.variables,
      );
      const pRes = resolveBlockStyleString(
        fallbackCfg.paragraphStyle,
        preset.variables,
      );
      const localUndefined = new Set<string>([
        ...secRes.undefinedVars,
        ...pRes.undefinedVars,
      ]);
      for (const v of localUndefined) undefinedVarsSet.add(v);

      const secAttr = secRes.style ? ` style="${secRes.style}"` : '';
      const pAttr = pRes.style ? ` style="${pRes.style}"` : '';

      const renderedParagraphs = block.paragraphs.map((paraText) => {
        const escapedLines = paraText
          .split(/\r?\n/)
          .map((l) => escapeHtmlText(l))
          .join('<br>');
        return `<section${secAttr}>\n  <p${pAttr}>${escapedLines}</p>\n</section>`;
      });

      const warningLines: string[] = [];
      for (const uv of localUndefined) {
        warningLines.push(`<!-- [Inline HTML 警告: 未定义样式变量 {${escapeHtmlCommentText(uv)}}] -->`);
      }
      warningLines.push(`<!-- [Inline HTML 未适配语法: ${block.syntaxType}] -->`);

      chunks.push({
        blankLinesBefore: clampBlankLines(fallbackCfg.blankLinesBefore),
        blankLinesAfter: clampBlankLines(fallbackCfg.blankLinesAfter),
        html: [...warningLines, ...renderedParagraphs].join('\n'),
      });
      continue;
    }

    if (block.kind === 'divider') {
      const divConfig = preset.elements.divider;
      const before = clampBlankLines(divConfig.blankLinesBefore);
      const after = clampBlankLines(divConfig.blankLinesAfter);

      if (divConfig.exportAsComment) {
        chunks.push({
          blankLinesBefore: before,
          blankLinesAfter: after,
          html: '<!-- -->',
        });
        continue;
      }

      const dStyle = divConfig.dividerStyle ?? createDefaultDividerStyle();
      const rawColor = dStyle.color?.trim() || '#E5E5E5';
      const colorResolved = resolveStyleVariables(rawColor, preset.variables);
      for (const v of colorResolved.undefinedVars) {
        undefinedVarsSet.add(v);
      }

      const safeColor =
        sanitizeCssValueForStyleAttr(colorResolved.resolved) || '#E5E5E5';
      const heightPx = clampDividerHeight(dStyle.height, 1);
      const paddingXPx = clampNonNegativePx(dStyle.paddingX, 0, 200);
      const marginYPx = clampNonNegativePx(dStyle.marginY, 16, 200);

      const outerStyle = `margin: ${marginYPx}px 0; padding: 0 ${paddingXPx}px; box-sizing: border-box;`;
      const innerStyle = `height: ${heightPx}px; background-color: ${safeColor}; font-size: 0; line-height: 0;`;
      const divHtml = `<section style="${outerStyle}">\n  <section style="${innerStyle}"></section>\n</section>`;

      const prefixWarnings = colorResolved.undefinedVars.map(
        (uv) =>
          `<!-- [Inline HTML 警告: 未定义样式变量 {${escapeHtmlCommentText(uv)}}] -->`,
      );

      chunks.push({
        blankLinesBefore: before,
        blankLinesAfter: after,
        html:
          prefixWarnings.length > 0
            ? `${prefixWarnings.join('\n')}\n${divHtml}`
            : divHtml,
      });
      continue;
    }

    // 11 类已适配文本类块级元素
    const elemConfig = preset.elements[block.elementType];
    const before = clampBlankLines(elemConfig.blankLinesBefore);
    const after = clampBlankLines(elemConfig.blankLinesAfter);

    const listPrefix =
      block.elementType === 'unorderedList' ||
      block.elementType === 'orderedList' ||
      block.elementType === 'taskList'
        ? formatListItemPrefix(block.elementType, elemConfig, block.listMeta)
        : '';

    if (elemConfig.exportAsComment) {
      const plainBody = extractPlainTextFromRuns(block.runs, listPrefix);
      const safeComment = escapeHtmlCommentText(plainBody);
      chunks.push({
        blankLinesBefore: before,
        blankLinesAfter: after,
        html: safeComment.length > 0 ? `<!-- ${safeComment} -->` : '<!-- -->',
      });
      continue;
    }

    const secRes = resolveBlockStyleString(
      elemConfig.sectionStyle,
      preset.variables,
    );
    const pRes = resolveBlockStyleString(
      elemConfig.paragraphStyle,
      preset.variables,
    );
    const inlineRes = renderInlineRunsToHtml(
      block.runs,
      elemConfig.inlineStyles,
      preset.variables,
      listPrefix,
    );

    const blockUndefinedSet = new Set<string>([
      ...secRes.undefinedVars,
      ...pRes.undefinedVars,
      ...inlineRes.undefinedVars,
    ]);
    for (const v of blockUndefinedSet) {
      undefinedVarsSet.add(v);
    }

    if (inlineRes.unadaptedInlineCount > 0) {
      unadaptedCount += inlineRes.unadaptedInlineCount;
      for (const t of inlineRes.unadaptedInlineTypes) {
        unadaptedTypesSet.add(t);
      }
    }

    const secAttr = secRes.style ? ` style="${secRes.style}"` : '';
    const pAttr = pRes.style ? ` style="${pRes.style}"` : '';
    const sectionTag = `<section${secAttr}>\n  <p${pAttr}>${inlineRes.innerHtml}</p>\n</section>`;

    const warningComments = Array.from(blockUndefinedSet).map(
      (uv) =>
        `<!-- [Inline HTML 警告: 未定义样式变量 {${escapeHtmlCommentText(uv)}}] -->`,
    );

    chunks.push({
      blankLinesBefore: before,
      blankLinesAfter: after,
      html:
        warningComments.length > 0
          ? `${warningComments.join('\n')}\n${sectionTag}`
          : sectionTag,
    });
  }

  // 按 PRD 3.4 公式精确拼接源码上下空行（纯换行符 \n，严禁生成 <br> 或空 <p>）
  const renderedSections = chunks
    .map(
      (c) =>
        `${'\n'.repeat(c.blankLinesBefore)}${c.html}${'\n'.repeat(c.blankLinesAfter)}`,
    )
    .join('\n');

  return {
    sectionsHtml: renderedSections,
    warnings: {
      undefinedVariables: Array.from(undefinedVarsSet),
      unadaptedCount,
      unadaptedTypes: Array.from(unadaptedTypesSet),
    },
  };
}
