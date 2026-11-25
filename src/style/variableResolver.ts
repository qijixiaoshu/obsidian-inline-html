import type { StyleVariable } from '../types/settings';

const VARIABLE_PLACEHOLDER_RE = /\{([^{}\r\n]+)\}/g;
const HEX_COLOR_RE = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

export interface VariableResolveResult {
  resolved: string;
  undefinedVars: string[];
}

/**
 * 单次非递归解析 CSS 字符串中的 {变量名} 占位符。
 * - 命中变量表则替换为对应 value
 * - 未命中则保留原 {变量名} 文本并收集未定义变量名
 * - 不做递归二次展开，彻底杜绝循环引用死循环
 */
export function resolveStyleVariables(
  cssTemplate: string,
  variables: readonly StyleVariable[],
): VariableResolveResult {
  if (!cssTemplate || !cssTemplate.includes('{')) {
    return { resolved: cssTemplate ?? '', undefinedVars: [] };
  }

  const varMap = new Map<string, string>();
  for (const item of variables) {
    const trimmedName = item.name.trim();
    if (trimmedName) {
      varMap.set(trimmedName, item.value);
    }
  }

  const undefinedSet = new Set<string>();
  const resolved = cssTemplate.replace(
    VARIABLE_PLACEHOLDER_RE,
    (fullMatch, rawName: string) => {
      const key = rawName.trim();
      if (!key) {
        return fullMatch;
      }
      if (varMap.has(key)) {
        return varMap.get(key)!;
      }
      undefinedSet.add(key);
      return fullMatch;
    },
  );

  return {
    resolved,
    undefinedVars: Array.from(undefinedSet),
  };
}

/**
 * 判断字符串是否为合法的 3 位或 6 位 HEX 色值（如 #333、#1A73E8）
 */
export function isValidHexColor(value: string): boolean {
  return HEX_COLOR_RE.test((value ?? '').trim());
}

/**
 * 将 3 位或 6 位 HEX 转为原生 <input type="color"> 所需的 6 位小写 HEX（如 #369 -> #336699）
 */
export function toSixDigitHex(value: string): string {
  const trimmed = (value ?? '').trim();
  if (!HEX_COLOR_RE.test(trimmed)) {
    return '#000000';
  }
  if (trimmed.length === 4) {
    const r = trimmed[1];
    const g = trimmed[2];
    const b = trimmed[3];
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  return trimmed.toLowerCase();
}
