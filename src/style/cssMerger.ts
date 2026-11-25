import {
  INLINE_FORMAT_PRIORITY,
  type InlineFormatType,
  type InlineStyleConfig,
  type StyleVariable,
} from '../types/settings';
import { resolveStyleVariables } from './variableResolver';

/**
 * 将内联 CSS 字符串拆分为有序的 <property, value> 映射表。
 * - 正确跳过单引号、双引号及圆括号内部的分号与冒号（如 url("data:image/svg+xml;utf8,...")）
 * - 同名属性后出现的覆盖先出现的
 */
export function parseCssDeclarations(css: string): Map<string, string> {
  const result = new Map<string, string>();
  if (!css || !css.trim()) {
    return result;
  }

  const declarations: string[] = [];
  let start = 0;
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let parenDepth = 0;

  for (let i = 0; i < css.length; i++) {
    const ch = css[i];
    const prev = i > 0 ? css[i - 1] : '';

    if (ch === "'" && !inDoubleQuote && prev !== '\\') {
      inSingleQuote = !inSingleQuote;
    } else if (ch === '"' && !inSingleQuote && prev !== '\\') {
      inDoubleQuote = !inDoubleQuote;
    } else if (!inSingleQuote && !inDoubleQuote) {
      if (ch === '(') {
        parenDepth++;
      } else if (ch === ')' && parenDepth > 0) {
        parenDepth--;
      } else if (ch === ';' && parenDepth === 0) {
        declarations.push(css.slice(start, i));
        start = i + 1;
      }
    }
  }
  if (start < css.length) {
    declarations.push(css.slice(start));
  }

  for (const rawDecl of declarations) {
    const trimmed = rawDecl.trim();
    if (!trimmed) continue;

    const colonIndex = findFirstTopLevelColon(trimmed);
    if (colonIndex <= 0) continue;

    const prop = trimmed.slice(0, colonIndex).trim().toLowerCase();
    const val = trimmed.slice(colonIndex + 1).trim();
    if (!prop || !val) continue;

    result.set(prop, val);
  }

  return result;
}

function findFirstTopLevelColon(decl: string): number {
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let parenDepth = 0;

  for (let i = 0; i < decl.length; i++) {
    const ch = decl[i];
    const prev = i > 0 ? decl[i - 1] : '';

    if (ch === "'" && !inDoubleQuote && prev !== '\\') {
      inSingleQuote = !inSingleQuote;
    } else if (ch === '"' && !inSingleQuote && prev !== '\\') {
      inDoubleQuote = !inDoubleQuote;
    } else if (!inSingleQuote && !inDoubleQuote) {
      if (ch === '(') {
        parenDepth++;
      } else if (ch === ')' && parenDepth > 0) {
        parenDepth--;
      } else if (ch === ':' && parenDepth === 0) {
        return i;
      }
    }
  }

  return -1;
}

/**
 * 将 CSS 属性值安全化以放入 style="..." 双引号属性内：
 * - 双引号统一替换为单引号（如 font-family: "微软雅黑" -> font-family: '微软雅黑'）
 * - 转义 &、<、> 避免破坏 HTML 标签边界
 */
export function sanitizeCssValueForStyleAttr(val: string): string {
  return val
    .replace(/"/g, "'")
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/[\r\n]+/g, ' ')
    .trim();
}

export function serializeCssDeclarations(props: Map<string, string>): string {
  if (props.size === 0) {
    return '';
  }
  const parts: string[] = [];
  for (const [prop, val] of props.entries()) {
    const cleanVal = sanitizeCssValueForStyleAttr(val);
    if (prop && cleanVal) {
      parts.push(`${prop}: ${cleanVal};`);
    }
  }
  return parts.join(' ');
}

export interface StyleComputeResult {
  style: string;
  undefinedVars: string[];
}

/**
 * 解析单个区块/段落样式字符串（替换 {变量名} + 规范化属性去重 + 安全转义）
 */
export function resolveBlockStyleString(
  cssTemplate: string,
  variables: readonly StyleVariable[],
): StyleComputeResult {
  if (!cssTemplate || !cssTemplate.trim()) {
    return { style: '', undefinedVars: [] };
  }
  const { resolved, undefinedVars } = resolveStyleVariables(cssTemplate, variables);
  const decls = parseCssDeclarations(resolved);
  return {
    style: serializeCssDeclarations(decls),
    undefinedVars,
  };
}

/**
 * 按固定优先级（bold < italic < boldItalic < strikethrough < highlight）
 * 将多个叠加行内样式合并为单一 style 字符串，严禁嵌套多层 <span>。
 */
export function mergeInlineStyles(
  marks: ReadonlySet<InlineFormatType>,
  inlineConfig: InlineStyleConfig,
  variables: readonly StyleVariable[],
): StyleComputeResult {
  if (marks.size === 0) {
    return { style: '', undefinedVars: [] };
  }

  const mergedProps = new Map<string, string>();
  const undefinedSet = new Set<string>();

  for (const formatKey of INLINE_FORMAT_PRIORITY) {
    if (!marks.has(formatKey)) continue;
    const rawCss = inlineConfig[formatKey];
    if (!rawCss || !rawCss.trim()) continue;

    const { resolved, undefinedVars } = resolveStyleVariables(rawCss, variables);
    for (const v of undefinedVars) {
      undefinedSet.add(v);
    }

    const decls = parseCssDeclarations(resolved);
    for (const [prop, val] of decls.entries()) {
      mergedProps.set(prop, val);
    }
  }

  return {
    style: serializeCssDeclarations(mergedProps),
    undefinedVars: Array.from(undefinedSet),
  };
}
