import { describe, expect, it } from 'vitest';
import { parseMarkdownToIr } from '../src/parser/markdownParser';
import { renderInlineRunsToHtml } from '../src/renderer/inlineFlattener';
import {
  ELEMENT_PREVIEW_SAMPLES,
  FULL_COMPREHENSIVE_SAMPLE,
} from '../src/defaults/previewSamples';
import { createDefaultPreset } from '../src/defaults/defaultPreset';
import { convertMarkdownToInlineHtml } from '../src/renderer/documentWrapper';
import type { InlineStyleConfig } from '../src/types/settings';

describe('inlineFlattener & highlightExtension', () => {
  const inlineStyles: InlineStyleConfig = {
    bold: 'font-weight: 700; color: #222;',
    italic: 'font-style: italic;',
    boldItalic: 'font-weight: 900; font-style: italic; color: #b00;',
    strikethrough: 'text-decoration: line-through;',
    highlight: 'background: #ff0; color: #000;',
  };

  it('outputs plain text directly without wrapping extra <span> (TC-03)', () => {
    const blocks = parseMarkdownToIr('这是一句纯文字，且 a == 1 && b == 2 不会误触发高亮');
    expect(blocks.length).toBe(1);
    const b = blocks[0];
    expect(b.kind).toBe('adapted');
    if (b.kind === 'adapted') {
      const rendered = renderInlineRunsToHtml(b.runs, inlineStyles, []);
      expect(rendered.innerHtml).toBe(
        '这是一句纯文字，且 a == 1 &amp;&amp; b == 2 不会误触发高亮',
      );
      expect(rendered.innerHtml.includes('<span')).toBe(false);
    }
  });

  it('reduces nested bold + italic into single boldItalic mark (TC-05)', () => {
    const blocks = parseMarkdownToIr('**甲 *乙* 丙** 与 ***丁***');
    const b = blocks[0];
    expect(b.kind).toBe('adapted');
    if (b.kind === 'adapted') {
      const rendered = renderInlineRunsToHtml(b.runs, inlineStyles, []);
      expect(rendered.innerHtml).toBe(
        '<span style="font-weight: 700; color: #222;">甲 </span>' +
          '<span style="font-weight: 900; font-style: italic; color: #b00;">乙</span>' +
          '<span style="font-weight: 700; color: #222;"> 丙</span>' +
          ' 与 ' +
          '<span style="font-weight: 900; font-style: italic; color: #b00;">丁</span>',
      );
    }
  });

  it('merges **==重点==**, ==**重点**==, and ==甲 **乙** 丙== into flat single-layer <span> (TC-04)', () => {
    const blocks = parseMarkdownToIr('**==正嵌套==** | ==**反嵌套**== | ==甲 **乙** 丙==');
    const b = blocks[0];
    expect(b.kind).toBe('adapted');
    if (b.kind === 'adapted') {
      const rendered = renderInlineRunsToHtml(b.runs, inlineStyles, []);
      expect(rendered.innerHtml).not.toMatch(/<span[^>]*>[^<]*<span/);
      expect(rendered.innerHtml).toContain(
        '<span style="font-weight: 700; color: #000; background: #ff0;">正嵌套</span>',
      );
      expect(rendered.innerHtml).toContain(
        '<span style="font-weight: 700; color: #000; background: #ff0;">反嵌套</span>',
      );
      expect(rendered.innerHtml).toContain(
        '<span style="background: #ff0; color: #000;">甲 </span>' +
          '<span style="font-weight: 700; color: #000; background: #ff0;">乙</span>' +
          '<span style="background: #ff0; color: #000;"> 丙</span>',
      );
    }
  });

  it('handles CJK-adjacent **==...==**, ~~***...***~~, **“引号”**, and preview samples with zero leftover ** or ~~', () => {
    const preset = createDefaultPreset();

    // 1. 验证设置页内置的当前元素示例与全文综合示例绝无残留 ** / ~~ / ==
    const elemRes = convertMarkdownToInlineHtml(
      ELEMENT_PREVIEW_SAMPLES.paragraph,
      preset,
    );
    expect(elemRes.sectionsHtml).not.toContain('**');
    expect(elemRes.sectionsHtml).not.toContain('==');
    expect(elemRes.sectionsHtml).toContain(
      '<span style="font-weight: 700; color: #111111; background-color: #FFF3A3; padding: 2px 4px; border-radius: 3px;">加粗与高亮叠加合并</span>',
    );

    const fullRes = convertMarkdownToInlineHtml(FULL_COMPREHENSIVE_SAMPLE, preset);
    expect(fullRes.sectionsHtml).not.toContain('**');
    expect(fullRes.sectionsHtml).not.toContain('~~');
    expect(fullRes.sectionsHtml).not.toContain('==');

    // 2. 验证同一句中连续多个 CJK 邻接组合与中文引号加粗，且不会误伤 snake_case 变量或转义星号
    const cjkMd =
      '文字的**==甲==**与**==乙==**以及**“中文引号加粗”**和~~***粗斜删除***~~，保留 foo_bar_baz 与 \\*\\*转义星号\\*\\*。';
    const blocks = parseMarkdownToIr(cjkMd);
    const b = blocks[0];
    expect(b.kind).toBe('adapted');
    if (b.kind === 'adapted') {
      const rendered = renderInlineRunsToHtml(b.runs, inlineStyles, []);
      expect(rendered.innerHtml).toBe(
        '文字的<span style="font-weight: 700; color: #000; background: #ff0;">甲</span>' +
          '与<span style="font-weight: 700; color: #000; background: #ff0;">乙</span>' +
          '以及<span style="font-weight: 700; color: #222;">“中文引号加粗”</span>' +
          '和<span style="font-weight: 900; font-style: italic; color: #b00; text-decoration: line-through;">粗斜删除</span>' +
          '，保留 foo_bar_baz 与 **转义星号**。',
      );
    }
  });
});
