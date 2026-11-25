import type { InlineFormatType } from '../types/settings';
import type { InlineRunNode, RawInlineMark } from '../types/ir';
import type { IntermediateSegment } from './wikilinkDetector';

export const ESCAPED_STAR_SENTINEL = '\uE001';
export const ESCAPED_EQ_SENTINEL = '\uE002';
export const ESCAPED_TILDE_SENTINEL = '\uE003';
export const ESCAPED_UNDERSCORE_SENTINEL = '\uE004';

export function restoreEscapedSentinels(text: string): string {
  if (
    !text.includes(ESCAPED_STAR_SENTINEL) &&
    !text.includes(ESCAPED_EQ_SENTINEL) &&
    !text.includes(ESCAPED_TILDE_SENTINEL) &&
    !text.includes(ESCAPED_UNDERSCORE_SENTINEL)
  ) {
    return text;
  }
  return text
    .replace(/\uE001/g, '*')
    .replace(/\uE002/g, '=')
    .replace(/\uE003/g, '~')
    .replace(/\uE004/g, '_');
}

interface DelimiterPos {
  segIndex: number;
  charIndex: number;
}

interface DelimiterSpec {
  delim: string;
  ch: string;
  len: number;
  marksToAdd: readonly RawInlineMark[];
  disallowAsciiWordOutside?: boolean;
}

/**
 * 补充解析因 CommonMark 严格西文标点侧翼规则（如中文紧邻 `的**==重点==**效果`、`的**“引号”**效果`、`或~~***重点***~~`）
 * 而未被 remark-parse 消费的行内标记，并支持 Obsidian `==高亮==` 与任意格式的嵌套叠加。
 */
const DELIMITER_SPECS: readonly DelimiterSpec[] = [
  { delim: '==', ch: '=', len: 2, marksToAdd: ['highlight'] },
  { delim: '~~', ch: '~', len: 2, marksToAdd: ['strikethrough'] },
  { delim: '***', ch: '*', len: 3, marksToAdd: ['bold', 'italic'] },
  { delim: '**', ch: '*', len: 2, marksToAdd: ['bold'] },
  { delim: '*', ch: '*', len: 1, marksToAdd: ['italic'] },
  {
    delim: '___',
    ch: '_',
    len: 3,
    marksToAdd: ['bold', 'italic'],
    disallowAsciiWordOutside: true,
  },
  {
    delim: '__',
    ch: '_',
    len: 2,
    marksToAdd: ['bold'],
    disallowAsciiWordOutside: true,
  },
  {
    delim: '_',
    ch: '_',
    len: 1,
    marksToAdd: ['italic'],
    disallowAsciiWordOutside: true,
  },
];

/**
 * 在同一段落的行内片段序列上完成 `==高亮==` 及中文邻接强调/删除线补偿解析，
 * 随后执行粗斜体语义归约（bold + italic -> boldItalic）并还原转义字符。
 */
export function resolveHighlightsAndReduceMarks(
  segments: readonly IntermediateSegment[],
): InlineRunNode[] {
  if (segments.length === 0) {
    return [];
  }

  let working: IntermediateSegment[] = segments.map((seg) =>
    seg.kind === 'raw_text'
      ? { kind: 'raw_text', text: seg.text, rawMarks: new Set(seg.rawMarks) }
      : seg,
  );

  // 多轮扫描直至再无成对标记可剥离（每次匹配至少移除 2 个定界符字符，严格有限步终止）
  let changed = true;
  while (changed) {
    changed = false;

    for (const spec of DELIMITER_SPECS) {
      while (true) {
        const pair = findNextDelimiterPair(working, spec, false);
        if (!pair) break;
        working = applyDelimiterPair(
          working,
          pair.open,
          pair.close,
          spec.len,
          spec.marksToAdd,
        );
        changed = true;
      }
    }

    // 处理非对称三连星号场景（如 `文字的***甲* 乙**` 或 `文字的***甲** 乙*`）
    if (!changed) {
      for (const spec of DELIMITER_SPECS) {
        if (spec.ch !== '*' || (spec.len !== 2 && spec.len !== 1)) continue;
        const asymPair = findNextDelimiterPair(working, spec, true);
        if (asymPair) {
          working = applyDelimiterPair(
            working,
            asymPair.open,
            asymPair.close,
            spec.len,
            spec.marksToAdd,
          );
          changed = true;
          break;
        }
      }
    }
  }

  const output: InlineRunNode[] = [];
  for (const seg of working) {
    if (seg.kind === 'raw_text') {
      const restored = restoreEscapedSentinels(seg.text);
      if (restored.length === 0) continue;
      output.push({
        kind: 'text',
        text: restored,
        marks: reduceRawMarks(seg.rawMarks),
      });
    } else if (seg.kind === 'break') {
      output.push({ kind: 'break' });
    } else {
      output.push({
        kind: 'unadapted_inline',
        syntaxType: seg.syntaxType,
        text: restoreEscapedSentinels(seg.text),
      });
    }
  }

  return output;
}

/**
 * 粗斜体语义归约：同时拥有 bold 与 italic 时归约为单一 boldItalic
 */
export function reduceRawMarks(
  rawMarks: ReadonlySet<RawInlineMark>,
): Set<InlineFormatType> {
  const result = new Set<InlineFormatType>();
  const hasBold = rawMarks.has('bold');
  const hasItalic = rawMarks.has('italic');

  if (hasBold && hasItalic) {
    result.add('boldItalic');
  } else if (hasBold) {
    result.add('bold');
  } else if (hasItalic) {
    result.add('italic');
  }

  if (rawMarks.has('strikethrough')) {
    result.add('strikethrough');
  }
  if (rawMarks.has('highlight')) {
    result.add('highlight');
  }

  return result;
}

function getRunBounds(
  text: string,
  pos: number,
  ch: string,
): { start: number; end: number; length: number } {
  let start = pos;
  while (start > 0 && text[start - 1] === ch) {
    start--;
  }
  let end = pos;
  while (end < text.length && text[end] === ch) {
    end++;
  }
  return { start, end, length: end - start };
}

function getAdjacentNextChar(
  segments: readonly IntermediateSegment[],
  segIndex: number,
  afterCharIndex: number,
): string | null {
  const cur = segments[segIndex];
  if (cur.kind === 'raw_text' && afterCharIndex < cur.text.length) {
    return cur.text[afterCharIndex];
  }
  for (let i = segIndex + 1; i < segments.length; i++) {
    const s = segments[i];
    if (s.kind === 'break') return null;
    if (s.text.length > 0) return s.text[0];
  }
  return null;
}

function getAdjacentPrevChar(
  segments: readonly IntermediateSegment[],
  segIndex: number,
  beforeCharIndex: number,
): string | null {
  const cur = segments[segIndex];
  if (cur.kind === 'raw_text' && beforeCharIndex > 0) {
    return cur.text[beforeCharIndex - 1];
  }
  for (let i = segIndex - 1; i >= 0; i--) {
    const s = segments[i];
    if (s.kind === 'break') return null;
    if (s.text.length > 0) return s.text[s.text.length - 1];
  }
  return null;
}

function isAsciiWordChar(ch: string | null): boolean {
  return ch !== null && /[a-zA-Z0-9]/.test(ch);
}

function findNextDelimiterPair(
  segments: readonly IntermediateSegment[],
  spec: DelimiterSpec,
  allowTripleSplit: boolean,
): { open: DelimiterPos; close: DelimiterPos } | null {
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    if (seg.kind !== 'raw_text') continue;

    let c = 0;
    while (c <= seg.text.length - spec.len) {
      if (seg.text[c] !== spec.ch) {
        c++;
        continue;
      }

      const bounds = getRunBounds(seg.text, c, spec.ch);
      let candidateOpenChar: number | null = null;

      if (bounds.length === spec.len) {
        candidateOpenChar = bounds.start;
      } else if (allowTripleSplit && spec.ch === '*' && bounds.length === 3) {
        // 非对称 `***` 开启符：优先使用靠内侧的定界切片，外侧剩余星号留给下一轮匹配
        candidateOpenChar = bounds.end - spec.len;
      }

      if (candidateOpenChar !== null) {
        const prevOutside = getAdjacentPrevChar(segments, i, bounds.start);
        const nextInside = getAdjacentNextChar(
          segments,
          i,
          candidateOpenChar + spec.len,
        );

        const outsideOk =
          !spec.disallowAsciiWordOutside || !isAsciiWordChar(prevOutside);
        const insideOk =
          nextInside !== null &&
          !/\s/.test(nextInside) &&
          nextInside !== spec.ch;

        if (outsideOk && insideOk) {
          const closePos = findClosingDelimiter(
            segments,
            i,
            candidateOpenChar + spec.len,
            spec,
            allowTripleSplit,
          );
          if (closePos) {
            return {
              open: { segIndex: i, charIndex: candidateOpenChar },
              close: closePos,
            };
          }
        }
      }

      c = bounds.end;
    }
  }

  return null;
}

function findClosingDelimiter(
  segments: readonly IntermediateSegment[],
  startSegIndex: number,
  startCharIndex: number,
  spec: DelimiterSpec,
  allowTripleSplit: boolean,
): DelimiterPos | null {
  let hasContent = false;

  for (let j = startSegIndex; j < segments.length; j++) {
    const seg = segments[j];
    if (seg.kind === 'break') {
      continue;
    }
    if (seg.kind !== 'raw_text') {
      if (seg.text.length > 0) hasContent = true;
      continue;
    }

    const fromChar = j === startSegIndex ? startCharIndex : 0;
    let k = fromChar;
    while (k <= seg.text.length - spec.len) {
      if (seg.text[k] !== spec.ch) {
        hasContent = true;
        k++;
        continue;
      }

      const bounds = getRunBounds(seg.text, k, spec.ch);
      // 若起始点落在一个更长同字符序列的内部，跳过该序列
      if (bounds.start < fromChar) {
        k = bounds.end;
        continue;
      }

      let candidateCloseChar: number | null = null;
      if (bounds.length === spec.len) {
        candidateCloseChar = bounds.start;
      } else if (allowTripleSplit && spec.ch === '*' && bounds.length === 3) {
        candidateCloseChar = bounds.start;
      }

      if (candidateCloseChar !== null && hasContent) {
        const prevInside = getAdjacentPrevChar(segments, j, candidateCloseChar);
        const nextOutside = getAdjacentNextChar(segments, j, bounds.end);

        const insideOk =
          prevInside !== null &&
          !/\s/.test(prevInside) &&
          prevInside !== spec.ch;
        const outsideOk =
          !spec.disallowAsciiWordOutside || !isAsciiWordChar(nextOutside);

        if (insideOk && outsideOk) {
          return { segIndex: j, charIndex: candidateCloseChar };
        }
      }

      hasContent = true;
      k = bounds.end;
    }

    if (fromChar < seg.text.length) {
      hasContent = true;
    }
  }

  return null;
}

function applyDelimiterPair(
  segments: readonly IntermediateSegment[],
  open: DelimiterPos,
  close: DelimiterPos,
  delimLen: number,
  marksToAdd: readonly RawInlineMark[],
): IntermediateSegment[] {
  const result: IntermediateSegment[] = [];

  const withAddedMarks = (base: ReadonlySet<RawInlineMark>): Set<RawInlineMark> => {
    const next = new Set(base);
    for (const m of marksToAdd) {
      next.add(m);
    }
    return next;
  };

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];

    if (i < open.segIndex || i > close.segIndex) {
      result.push(seg);
      continue;
    }

    if (seg.kind !== 'raw_text') {
      result.push(seg);
      continue;
    }

    if (open.segIndex === close.segIndex) {
      const before = seg.text.slice(0, open.charIndex);
      const inner = seg.text.slice(open.charIndex + delimLen, close.charIndex);
      const after = seg.text.slice(close.charIndex + delimLen);

      if (before) {
        result.push({
          kind: 'raw_text',
          text: before,
          rawMarks: new Set(seg.rawMarks),
        });
      }
      if (inner) {
        result.push({
          kind: 'raw_text',
          text: inner,
          rawMarks: withAddedMarks(seg.rawMarks),
        });
      }
      if (after) {
        result.push({
          kind: 'raw_text',
          text: after,
          rawMarks: new Set(seg.rawMarks),
        });
      }
    } else if (i === open.segIndex) {
      const before = seg.text.slice(0, open.charIndex);
      const inner = seg.text.slice(open.charIndex + delimLen);
      if (before) {
        result.push({
          kind: 'raw_text',
          text: before,
          rawMarks: new Set(seg.rawMarks),
        });
      }
      if (inner) {
        result.push({
          kind: 'raw_text',
          text: inner,
          rawMarks: withAddedMarks(seg.rawMarks),
        });
      }
    } else if (i === close.segIndex) {
      const inner = seg.text.slice(0, close.charIndex);
      const after = seg.text.slice(close.charIndex + delimLen);
      if (inner) {
        result.push({
          kind: 'raw_text',
          text: inner,
          rawMarks: withAddedMarks(seg.rawMarks),
        });
      }
      if (after) {
        result.push({
          kind: 'raw_text',
          text: after,
          rawMarks: new Set(seg.rawMarks),
        });
      }
    } else {
      result.push({
        kind: 'raw_text',
        text: seg.text,
        rawMarks: withAddedMarks(seg.rawMarks),
      });
    }
  }

  return result;
}
