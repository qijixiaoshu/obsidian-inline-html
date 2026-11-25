import type { RawInlineMark, UnadaptedInlineType } from '../types/ir';

export type IntermediateSegment =
  | {
      kind: 'raw_text';
      text: string;
      rawMarks: Set<RawInlineMark>;
    }
  | {
      kind: 'break';
    }
  | {
      kind: 'unadapted_inline';
      syntaxType: UnadaptedInlineType;
      text: string;
    };

/**
 * 匹配单行文本中的 Obsidian 嵌入 ![[...]]、双链 [[...]] 与行内公式 $...$
 * - ![[target|alias]] -> inline_image
 * - [[target|alias]]  -> wikilink（取 alias 或 target 作为可读文本）
 * - $expr$            -> inline_math（单美元符号包裹且首尾非空白，不匹配 $$）
 */
const OBSIDIAN_INLINE_RE =
  /!\[\[([^\]\r\n]+)\]\]|\[\[([^\]\r\n]+)\]\]|(?<!\$)\$(?!\$)(\S(?:[^$\r\n]*?\S)?)\$(?!\$)/g;

export function tokenizeObsidianInlineText(
  text: string,
  inheritedMarks: ReadonlySet<RawInlineMark>,
): IntermediateSegment[] {
  if (!text) {
    return [];
  }

  const segments: IntermediateSegment[] = [];
  let lastIndex = 0;
  OBSIDIAN_INLINE_RE.lastIndex = 0;

  let match: RegExpExecArray | null;
  while ((match = OBSIDIAN_INLINE_RE.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({
        kind: 'raw_text',
        text: text.slice(lastIndex, match.index),
        rawMarks: new Set(inheritedMarks),
      });
    }

    const [, embedInner, wikilinkInner, mathInner] = match;
    if (embedInner !== undefined) {
      const display = extractWikilinkDisplay(embedInner, true);
      segments.push({
        kind: 'unadapted_inline',
        syntaxType: 'inline_image',
        text: display,
      });
    } else if (wikilinkInner !== undefined) {
      const display = extractWikilinkDisplay(wikilinkInner, false);
      segments.push({
        kind: 'unadapted_inline',
        syntaxType: 'wikilink',
        text: display,
      });
    } else if (mathInner !== undefined) {
      segments.push({
        kind: 'unadapted_inline',
        syntaxType: 'inline_math',
        text: mathInner,
      });
    }

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    segments.push({
      kind: 'raw_text',
      text: text.slice(lastIndex),
      rawMarks: new Set(inheritedMarks),
    });
  }

  return segments;
}

export function extractWikilinkDisplay(rawInner: string, isEmbed: boolean): string {
  const pipeIndex = rawInner.indexOf('|');
  if (pipeIndex !== -1) {
    const target = rawInner.slice(0, pipeIndex).trim();
    const alias = rawInner.slice(pipeIndex + 1).trim();
    if (isEmbed) {
      // 如 ![[cover.png|600]]，若右侧为纯数字尺寸则保留文件名，否则使用别名
      if (alias && !/^\d+(x\d+)?$/i.test(alias)) {
        return alias;
      }
      return target || rawInner.trim();
    }
    return alias || target || rawInner.trim();
  }
  return rawInner.trim();
}
