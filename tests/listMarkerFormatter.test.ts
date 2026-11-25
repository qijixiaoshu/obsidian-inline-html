import { describe, expect, it } from 'vitest';
import {
  ORDERED_STYLE_OPTIONS,
  formatOrderedNumber,
  getDefaultOrderedSuffix,
} from '../src/renderer/listMarkerFormatter';

describe('listMarkerFormatter (13 ordered styles & preview labels)', () => {
  it('ensures dropdown preview labels show ONLY first 3 items + ellipsis with no series names (TC-21)', () => {
    expect(ORDERED_STYLE_OPTIONS.length).toBe(13);
    const labels = ORDERED_STYLE_OPTIONS.map((o) => o.previewLabel);
    expect(labels).toEqual([
      '1, 2, 3, ...',
      '01, 02, 03, ...',
      'a, b, c, ...',
      'A, B, C, ...',
      'i, ii, iii, ...',
      'I, II, III, ...',
      '一, 二, 三, ...',
      '壹, 贰, 叁, ...',
      '①, ②, ③, ...',
      '❶, ❷, ❸, ...',
      '⒜, ⒝, ⒞, ...',
      '🄐, 🄑, 🄒, ...',
      '1️⃣, 2️⃣, 3️⃣, ...',
    ]);
    for (const label of labels) {
      expect(label.endsWith(', ...')).toBe(true);
      expect(label).not.toMatch(/decimal|latin|roman|chinese|Unicode|阿拉伯|中文|罗马/i);
    }
  });

  it('provides accurate smart default suffixes per style', () => {
    expect(getDefaultOrderedSuffix('decimal')).toBe('.');
    expect(getDefaultOrderedSuffix('upper-roman')).toBe('.');
    expect(getDefaultOrderedSuffix('simp-chinese-informal')).toBe('、');
    expect(getDefaultOrderedSuffix('simp-chinese-formal')).toBe('、');
    expect(getDefaultOrderedSuffix('circled-decimal')).toBe('');
    expect(getDefaultOrderedSuffix('emoji-keycap')).toBe('');
  });

  it('formats all 13 numbering styles and handles boundary/overflow fallbacks (TC-14)', () => {
    expect(formatOrderedNumber('decimal', 12)).toBe('12');
    expect(formatOrderedNumber('decimal-leading-zero', 3)).toBe('03');
    expect(formatOrderedNumber('decimal-leading-zero', 10)).toBe('10');

    expect(formatOrderedNumber('lower-latin', 1)).toBe('a');
    expect(formatOrderedNumber('lower-latin', 26)).toBe('z');
    expect(formatOrderedNumber('lower-latin', 27)).toBe('aa');
    expect(formatOrderedNumber('upper-latin', 28)).toBe('AB');

    expect(formatOrderedNumber('lower-roman', 4)).toBe('iv');
    expect(formatOrderedNumber('upper-roman', 9)).toBe('IX');
    expect(formatOrderedNumber('upper-roman', 4000)).toBe('4000');

    expect(formatOrderedNumber('simp-chinese-informal', 1)).toBe('一');
    expect(formatOrderedNumber('simp-chinese-informal', 10)).toBe('十');
    expect(formatOrderedNumber('simp-chinese-informal', 11)).toBe('十一');
    expect(formatOrderedNumber('simp-chinese-informal', 20)).toBe('二十');
    expect(formatOrderedNumber('simp-chinese-informal', 101)).toBe('一百零一');

    expect(formatOrderedNumber('simp-chinese-formal', 1)).toBe('壹');
    expect(formatOrderedNumber('simp-chinese-formal', 10)).toBe('壹拾');
    expect(formatOrderedNumber('simp-chinese-formal', 11)).toBe('壹拾壹');
    expect(formatOrderedNumber('simp-chinese-formal', 101)).toBe('壹佰零壹');

    expect(formatOrderedNumber('circled-decimal', 1)).toBe('①');
    expect(formatOrderedNumber('circled-decimal', 20)).toBe('⑳');
    expect(formatOrderedNumber('circled-decimal', 21)).toBe('㉑');
    expect(formatOrderedNumber('circled-decimal', 36)).toBe('㊱');
    expect(formatOrderedNumber('circled-decimal', 50)).toBe('㊿');
    expect(formatOrderedNumber('circled-decimal', 51)).toBe('51');

    expect(formatOrderedNumber('negative-circled-decimal', 1)).toBe('❶');
    expect(formatOrderedNumber('negative-circled-decimal', 10)).toBe('❿');
    expect(formatOrderedNumber('negative-circled-decimal', 11)).toBe('⓫');
    expect(formatOrderedNumber('negative-circled-decimal', 20)).toBe('⓴');
    expect(formatOrderedNumber('negative-circled-decimal', 21)).toBe('21');

    expect(formatOrderedNumber('parenthesized-lower-latin', 1)).toBe('⒜');
    expect(formatOrderedNumber('parenthesized-lower-latin', 26)).toBe('⒵');
    expect(formatOrderedNumber('parenthesized-lower-latin', 27)).toBe('(aa)');

    // 非 BMP 平面代理对完整性验证
    expect(formatOrderedNumber('parenthesized-upper-latin', 1)).toBe('🄐');
    expect(formatOrderedNumber('parenthesized-upper-latin', 26)).toBe('🄩');
    expect(formatOrderedNumber('parenthesized-upper-latin', 27)).toBe('(AA)');

    expect(formatOrderedNumber('emoji-keycap', 1)).toBe('1️⃣');
    expect(formatOrderedNumber('emoji-keycap', 9)).toBe('9️⃣');
    expect(formatOrderedNumber('emoji-keycap', 10)).toBe('🔟');
    expect(formatOrderedNumber('emoji-keycap', 11)).toBe('11');
  });
});
