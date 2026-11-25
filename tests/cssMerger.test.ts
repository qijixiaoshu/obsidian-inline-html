import { describe, expect, it } from 'vitest';
import {
  mergeInlineStyles,
  parseCssDeclarations,
  resolveBlockStyleString,
} from '../src/style/cssMerger';
import type { InlineStyleConfig, StyleVariable } from '../src/types/settings';

describe('cssMerger', () => {
  const vars: StyleVariable[] = [
    { id: 'v1', name: '高亮底色', value: '#FFF3A3' },
  ];

  const inlineCfg: InlineStyleConfig = {
    bold: 'font-weight: 700; color: #222222;',
    italic: 'font-style: italic; color: #444444;',
    boldItalic: 'font-weight: 700; font-style: italic; color: #555555;',
    strikethrough: 'text-decoration: line-through; color: #999999;',
    highlight: 'background-color: {高亮底色}; color: #000000; padding: 0 3px;',
  };

  it('parses semicolons inside quotes and url(...) safely', () => {
    const map = parseCssDeclarations(
      'background-image: url("data:image/svg+xml;utf8,<svg/>"); font-family: "微软雅黑", sans-serif; color: #333;',
    );
    expect(map.get('background-image')).toBe(
      'url("data:image/svg+xml;utf8,<svg/>")',
    );
    expect(map.get('font-family')).toBe('"微软雅黑", sans-serif');
    expect(map.get('color')).toBe('#333');
  });

  it('converts double quotes to single quotes for safe HTML style="..." attributes (TC-10)', () => {
    const res = resolveBlockStyleString(
      'font-family: "微软雅黑", "PingFang SC"; color: #333;',
      [],
    );
    expect(res.style).toBe("font-family: '微软雅黑', 'PingFang SC'; color: #333;");
    expect(res.style.includes('"')).toBe(false);
  });

  it('merges overlapping inline styles in fixed priority order: highlight > strikethrough > boldItalic > italic > bold (TC-04)', () => {
    const boldAndHighlight = mergeInlineStyles(
      new Set(['bold', 'highlight']),
      inlineCfg,
      vars,
    );
    expect(boldAndHighlight.style).toBe(
      'font-weight: 700; color: #000000; background-color: #FFF3A3; padding: 0 3px;',
    );

    const triple = mergeInlineStyles(
      new Set(['bold', 'strikethrough', 'highlight']),
      inlineCfg,
      vars,
    );
    expect(triple.style).toBe(
      'font-weight: 700; color: #000000; text-decoration: line-through; background-color: #FFF3A3; padding: 0 3px;',
    );

    const strikeOverBoldItalic = mergeInlineStyles(
      new Set(['boldItalic', 'strikethrough']),
      inlineCfg,
      vars,
    );
    expect(strikeOverBoldItalic.style).toBe(
      'font-weight: 700; font-style: italic; color: #999999; text-decoration: line-through;',
    );
  });
});
