import { describe, expect, it } from 'vitest';
import {
  createDefaultPreset,
  parseAndValidatePresetJson,
  serializePresetToJson,
} from '../src/defaults/defaultPreset';
import { convertMarkdownToInlineHtml } from '../src/renderer/documentWrapper';

describe('End-to-End HTML Export & PRD Acceptance Cases', () => {
  it('TC-01 & TC-02: splits every paragraph, list item, and divider into independent top-level <section> blocks without symbols by default', () => {
    const preset = createDefaultPreset();
    preset.elements.h1.blankLinesBefore = 0;
    const md = `第一段正文

第二段正文

- 无序一
- 无序二
- 无序三

1. 有序一
- [ ] 待办项
- [x] 完成项

---`;
    const { sectionsHtml } = convertMarkdownToInlineHtml(md, preset, '测试');
    const topSections = sectionsHtml.match(/<section\b[\s\S]*?<\/section>$/gm);
    expect(sectionsHtml).toContain('  <p style="');
    expect(sectionsHtml).toContain('>无序一</p>\n</section>');
    expect(sectionsHtml).not.toContain('•');
    expect(sectionsHtml).toContain('>有序一</p>\n</section>');
    expect(sectionsHtml).toContain('>待办项</p>\n</section>');
    expect(sectionsHtml).toContain('>完成项</p>\n</section>');
    // 共 8 个文本单层 section + 1 个分割线双层 section = 10 个开标签 / 10 个闭标签
    expect(sectionsHtml.match(/<section\b/g)?.length).toBe(10);
    expect(topSections).not.toBeNull();
    // 分割线为缩进双层 <section>，不含 <p>
    expect(sectionsHtml).toMatch(
      /<section style="[^"]*">\n {2}<section style="[^"]*"><\/section>\n<\/section>$/,
    );
  });

  it('TC-06: enforces strictly independent inline styles per block element (no inheritance)', () => {
    const preset = createDefaultPreset();
    preset.elements.paragraph.inlineStyles.bold = 'font-weight: 700; color: #111;';
    preset.elements.h2.inlineStyles.bold = '';
    preset.elements.h2.blankLinesBefore = 0;

    const { sectionsHtml } = convertMarkdownToInlineHtml(
      '正文**加粗**\n\n## 标题**不加粗**',
      preset,
    );
    expect(sectionsHtml).toContain(
      '<span style="font-weight: 700; color: #111;">加粗</span></p>\n</section>',
    );
    expect(sectionsHtml).toContain('>标题不加粗</p>\n</section>');
    const h2Part = sectionsHtml.slice(sectionsHtml.indexOf('标题'));
    expect(h2Part).not.toContain('<span');
  });

  it('TC-08: emits warning comment and preserves literal placeholder for undefined variables', () => {
    const preset = createDefaultPreset();
    preset.elements.paragraph.paragraphStyle = 'color: {未知色};';
    const res = convertMarkdownToInlineHtml('测试文本', preset);
    expect(res.warnings.undefinedVariables).toEqual(['未知色']);
    expect(res.sectionsHtml).toContain(
      '<!-- [Inline HTML 警告: 未定义样式变量 {未知色}] -->',
    );
    expect(res.sectionsHtml).toContain('color: {未知色};');
  });

  it('TC-09 & TC-10: handles unadapted syntax (frontmatter, code_block, table, image, callout, inline_code, link, wikilink) and escapes HTML entities', () => {
    const preset = createDefaultPreset();
    const md = `---
title: 测试 -- 标题
---

正文含特殊字符 a < b && c > d，含 \`const x = 1\`、[官网](https://example.com) 与 [[目标笔记|别名显示]]。

\`\`\`ts
console.log("<tag>");
\`\`\`

| 列A | 列B |
| --- | --- |
| 1 | 2 |

![[cover.png]]

> [!note] 提示标题
> 提示正文`;

    const res = convertMarkdownToInlineHtml(md, preset);
    expect(res.sectionsHtml).toContain(
      '<!-- [Inline HTML 未适配语法: frontmatter]\ntitle: 测试 - - 标题\n-->',
    );
    expect(res.sectionsHtml).toContain('a &lt; b &amp;&amp; c &gt; d');
    expect(res.sectionsHtml).toContain(
      '<!-- [Inline HTML 未适配语法: inline_code] -->const x = 1',
    );
    expect(res.sectionsHtml).toContain(
      '<!-- [Inline HTML 未适配语法: link] -->官网',
    );
    expect(res.sectionsHtml).toContain(
      '<!-- [Inline HTML 未适配语法: wikilink] -->别名显示',
    );
    expect(res.sectionsHtml).toContain('<!-- [Inline HTML 未适配语法: code_block] -->');
    expect(res.sectionsHtml).toContain('&lt;tag&gt;');
    expect(res.sectionsHtml).toContain('<!-- [Inline HTML 未适配语法: table] -->');
    expect(res.sectionsHtml).toContain('<!-- [Inline HTML 未适配语法: image] -->');
    expect(res.sectionsHtml).toContain('<!-- [Inline HTML 未适配语法: callout] -->');
    expect(res.warnings.unadaptedCount).toBeGreaterThanOrEqual(8);
  });

  it('TC-11 & TC-12: supports per-element exportAsComment (escaping -- and ---) and exact pure \\n source blank lines with zero <br> tags', () => {
    const preset = createDefaultPreset();
    preset.elements.h1.exportAsComment = true;
    preset.elements.h1.blankLinesBefore = 1;
    preset.elements.h1.blankLinesAfter = 2;

    preset.elements.paragraph.blankLinesBefore = 1;
    preset.elements.paragraph.blankLinesAfter = 0;
    preset.elements.paragraph.sectionStyle = '';
    preset.elements.paragraph.paragraphStyle = '';

    preset.elements.divider.exportAsComment = true;
    preset.elements.divider.blankLinesBefore = 0;
    preset.elements.divider.blankLinesAfter = 0;

    const md = `# **章节** --- 导语\n\n正文内容\n\n---`;
    const { sectionsHtml } = convertMarkdownToInlineHtml(md, preset);

    // H1 上方 1 个 \n，H1 与正文之间 2 + 1 + 1 = 4 个 \n（即 3 行空行），绝不含 <br>
    expect(sectionsHtml).toBe(
      '\n<!-- 章节 - - - 导语 -->\n\n\n\n<section>\n  <p>正文内容</p>\n</section>\n<!-- -->',
    );
    expect(sectionsHtml).not.toContain('<br>');
  });

  it('TC-13 & TC-14: prepends unordered, ordered (with reset & start), and task symbols directly inside <p> without extra <span>', () => {
    const preset = createDefaultPreset();
    preset.elements.unorderedList.sectionStyle = '';
    preset.elements.unorderedList.paragraphStyle = '';
    preset.elements.unorderedList.unorderedSymbol = {
      prependSymbol: true,
      bulletSymbol: '▸',
    };

    preset.elements.orderedList.sectionStyle = '';
    preset.elements.orderedList.paragraphStyle = '';
    preset.elements.orderedList.orderedSymbol = {
      prependSymbol: true,
      orderedStyle: 'circled-decimal',
      orderedSuffix: '',
    };

    preset.elements.taskList.sectionStyle = '';
    preset.elements.taskList.paragraphStyle = '';
    preset.elements.taskList.taskSymbol = {
      prependSymbol: true,
      uncheckedSymbol: '○',
      checkedSymbol: '✔',
    };

    const md = `- 无序条目

3. 从三开始
4. 第四条

正文隔开

1. 新列表重置为一

- [ ] 待完成
- [x] 已完成`;

    const { sectionsHtml } = convertMarkdownToInlineHtml(md, preset);
    expect(sectionsHtml).toContain('<section>\n  <p>▸ 无序条目</p>\n</section>');
    expect(sectionsHtml).toContain('<section>\n  <p>③ 从三开始</p>\n</section>');
    expect(sectionsHtml).toContain('<section>\n  <p>④ 第四条</p>\n</section>');
    expect(sectionsHtml).toContain('<section>\n  <p>① 新列表重置为一</p>\n</section>');
    expect(sectionsHtml).toContain('<section>\n  <p>○ 待完成</p>\n</section>');
    expect(sectionsHtml).toContain('<section>\n  <p>✔ 已完成</p>\n</section>');
  });

  it('TC-15: auto-generates double-<section> divider from 4 parameters with variable resolution', () => {
    const preset = createDefaultPreset();
    preset.elements.divider.dividerStyle = {
      color: '{主色调}',
      height: 2,
      paddingX: 24,
      marginY: 12,
    };
    const { sectionsHtml, fullHtml } = convertMarkdownToInlineHtml(
      '---',
      preset,
      '分割线测试',
    );
    expect(sectionsHtml).toBe(
      '<section style="margin: 12px 0; padding: 0 24px; box-sizing: border-box;">\n  <section style="height: 2px; background-color: #1A73E8; font-size: 0; line-height: 0;"></section>\n</section>',
    );
    // 验证完整 HTML5 外壳不包含对 section/p/span 的全局样式污染
    expect(fullHtml).toContain('<!DOCTYPE html>');
    expect(fullHtml).toContain('.inline-html-preview-shell');
    const styleBlock = /<style>([\s\S]*?)<\/style>/.exec(fullHtml)?.[1] ?? '';
    expect(styleBlock).not.toMatch(/^\s*(section|p|span)\s*\{/m);
  });

  it('TC-22: exports and re-imports preset JSON cleanly, filling backward-compatible defaults and deduplicating names', () => {
    const preset = createDefaultPreset();
    preset.elements.h3.exportAsComment = true;
    preset.elements.h3.blankLinesBefore = 2;
    preset.elements.orderedList.orderedSymbol = {
      prependSymbol: true,
      orderedStyle: 'emoji-keycap',
      orderedSuffix: '',
    };
    preset.elements.divider.dividerStyle = {
      color: '#FF5500',
      height: 3,
      paddingX: 30,
      marginY: 18,
    };

    const json = serializePresetToJson(preset);
    const reimported = parseAndValidatePresetJson(json, ['默认预设']);
    expect(reimported.name).toBe('默认预设 (导入)');
    expect(reimported.elements.h3.exportAsComment).toBe(true);
    expect(reimported.elements.h3.blankLinesBefore).toBe(2);
    expect(reimported.elements.orderedList.orderedSymbol?.orderedStyle).toBe(
      'emoji-keycap',
    );
    expect(reimported.elements.divider.dividerStyle).toEqual({
      color: '#FF5500',
      height: 3,
      paddingX: 30,
      marginY: 18,
    });
  });
});
