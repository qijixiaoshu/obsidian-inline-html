import type { InlineStyleConfig, StyleVariable } from '../types/settings';
import type { InlineRunNode, UnadaptedInlineType } from '../types/ir';
import { mergeInlineStyles } from '../style/cssMerger';

/**
 * 正文 HTML 实体安全转义（防止文本中的 &、<、> 破坏 HTML 标签结构）
 */
export function escapeHtmlText(raw: string): string {
  if (!raw) return '';
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * 安全转义放入 HTML 注释 <!-- ... --> 内部的文本：
 * - 将所有连续连字符 "--" 拆开为 "- -"（包括 "---" -> "- - -"），彻底杜绝提前闭合 HTML 注释
 * - 避免首尾紧贴 "-" 或 ">" 造成异常注释序列
 */
export function escapeHtmlCommentText(raw: string): string {
  if (!raw) return '';
  let safe = raw.replace(/-(?=-)/g, '- ');
  if (safe.startsWith('>')) {
    safe = ` ${safe}`;
  } else if (safe.startsWith('->')) {
    safe = ` ${safe}`;
  }
  if (safe.endsWith('-')) {
    safe = `${safe} `;
  }
  return safe;
}

export interface RenderedInlineResult {
  innerHtml: string;
  undefinedVars: string[];
  unadaptedInlineTypes: UnadaptedInlineType[];
  unadaptedInlineCount: number;
}

type CoalescePiece =
  | { type: 'styled_text'; escapedText: string; style: string }
  | { type: 'raw_html'; html: string };

/**
 * 将展平后的 InlineRunNode 序列渲染为 <p> 内部的 HTML 字符串：
 * - 前缀符号（如 "• "、"1. "）直接作为无样式普通文本拼在最前，继承 <p> 样式，不套 <span>
 * - 普通无格式文字直接裸放于 <p> 内，不套多余 <span>
 * - 格式化文字合并为单层 <span style="...">，相邻且最终 style 完全相同的片段自动归并为同一 <span>
 */
export function renderInlineRunsToHtml(
  runs: readonly InlineRunNode[],
  inlineConfig: InlineStyleConfig,
  variables: readonly StyleVariable[],
  leadingPlainPrefix = '',
): RenderedInlineResult {
  const pieces: CoalescePiece[] = [];
  const undefinedSet = new Set<string>();
  const unadaptedTypes: UnadaptedInlineType[] = [];
  let unadaptedInlineCount = 0;

  if (leadingPlainPrefix) {
    pieces.push({
      type: 'styled_text',
      escapedText: escapeHtmlText(leadingPlainPrefix),
      style: '',
    });
  }

  for (const run of runs) {
    if (run.kind === 'text') {
      if (!run.text) continue;
      const { style, undefinedVars } = mergeInlineStyles(
        run.marks,
        inlineConfig,
        variables,
      );
      for (const v of undefinedVars) {
        undefinedSet.add(v);
      }
      const escaped = escapeHtmlText(run.text);
      const last = pieces[pieces.length - 1];
      if (last && last.type === 'styled_text' && last.style === style) {
        last.escapedText += escaped;
      } else {
        pieces.push({
          type: 'styled_text',
          escapedText: escaped,
          style,
        });
      }
    } else if (run.kind === 'break') {
      pieces.push({ type: 'raw_html', html: '<br>' });
    } else if (run.kind === 'unadapted_inline') {
      unadaptedInlineCount += 1;
      unadaptedTypes.push(run.syntaxType);
      const commentAndText = `<!-- [Inline HTML 未适配语法: ${run.syntaxType}] -->${escapeHtmlText(run.text)}`;
      pieces.push({ type: 'raw_html', html: commentAndText });
    }
  }

  let innerHtml = '';
  for (const piece of pieces) {
    if (piece.type === 'raw_html') {
      innerHtml += piece.html;
    } else if (!piece.style) {
      innerHtml += piece.escapedText;
    } else {
      innerHtml += `<span style="${piece.style}">${piece.escapedText}</span>`;
    }
  }

  return {
    innerHtml,
    undefinedVars: Array.from(undefinedSet),
    unadaptedInlineTypes: unadaptedTypes,
    unadaptedInlineCount,
  };
}

/**
 * 为「转为 HTML 注释」模式提取元素纯文本内容：
 * - 剥离行内格式标记，仅保留可读纯文本
 * - 若含行内未适配语法（如链接、双链、行内代码），直接保留可读文本，绝不在注释内嵌套子注释
 */
export function extractPlainTextFromRuns(
  runs: readonly InlineRunNode[],
  leadingPlainPrefix = '',
): string {
  let out = leadingPlainPrefix;
  for (const run of runs) {
    if (run.kind === 'text') {
      out += run.text;
    } else if (run.kind === 'break') {
      out += '\n';
    } else if (run.kind === 'unadapted_inline') {
      out += run.text;
    }
  }
  return out;
}
