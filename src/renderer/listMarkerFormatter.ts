import type {
  BlockStyleConfig,
  OrderedListSymbolStyle,
} from '../types/settings';
import type { ListItemMeta } from '../types/ir';

export interface OrderedStyleMetaItem {
  style: OrderedListSymbolStyle;
  /** 下拉菜单展示文本：严格仅展示前三个数字预览 + 省略号，不展示系列名称 */
  previewLabel: string;
  /** 切换至该样式时自动匹配的推荐默认后缀 */
  defaultSuffix: string;
}

export const ORDERED_STYLE_OPTIONS: readonly OrderedStyleMetaItem[] = [
  { style: 'decimal', previewLabel: '1, 2, 3, ...', defaultSuffix: '.' },
  { style: 'decimal-leading-zero', previewLabel: '01, 02, 03, ...', defaultSuffix: '.' },
  { style: 'lower-latin', previewLabel: 'a, b, c, ...', defaultSuffix: '.' },
  { style: 'upper-latin', previewLabel: 'A, B, C, ...', defaultSuffix: '.' },
  { style: 'lower-roman', previewLabel: 'i, ii, iii, ...', defaultSuffix: '.' },
  { style: 'upper-roman', previewLabel: 'I, II, III, ...', defaultSuffix: '.' },
  { style: 'simp-chinese-informal', previewLabel: '一, 二, 三, ...', defaultSuffix: '、' },
  { style: 'simp-chinese-formal', previewLabel: '壹, 贰, 叁, ...', defaultSuffix: '、' },
  { style: 'circled-decimal', previewLabel: '①, ②, ③, ...', defaultSuffix: '' },
  { style: 'negative-circled-decimal', previewLabel: '❶, ❷, ❸, ...', defaultSuffix: '' },
  { style: 'parenthesized-lower-latin', previewLabel: '⒜, ⒝, ⒞, ...', defaultSuffix: '' },
  { style: 'parenthesized-upper-latin', previewLabel: '🄐, 🄑, 🄒, ...', defaultSuffix: '' },
  { style: 'emoji-keycap', previewLabel: '1️⃣, 2️⃣, 3️⃣, ...', defaultSuffix: '' },
];

export function getDefaultOrderedSuffix(style: OrderedListSymbolStyle): string {
  const found = ORDERED_STYLE_OPTIONS.find((item) => item.style === style);
  return found ? found.defaultSuffix : '.';
}

/**
 * 26 进制双射字母转换（1 -> a, 26 -> z, 27 -> aa, 28 -> ab）
 */
export function toBijectiveLatin(index: number, uppercase: boolean): string {
  if (!Number.isInteger(index) || index <= 0) {
    return String(index);
  }
  const baseCode = uppercase ? 65 : 97;
  let n = index;
  let out = '';
  while (n > 0) {
    n -= 1;
    out = String.fromCharCode(baseCode + (n % 26)) + out;
    n = Math.floor(n / 26);
  }
  return out;
}

const ROMAN_PAIRS: readonly [number, string][] = [
  [1000, 'M'],
  [900, 'CM'],
  [500, 'D'],
  [400, 'CD'],
  [100, 'C'],
  [90, 'XC'],
  [50, 'L'],
  [40, 'XL'],
  [10, 'X'],
  [9, 'IX'],
  [5, 'V'],
  [4, 'IV'],
  [1, 'I'],
];

export function toRomanNumeral(index: number, uppercase: boolean): string {
  if (!Number.isInteger(index) || index <= 0 || index > 3999) {
    return String(index);
  }
  let remaining = index;
  let result = '';
  for (const [val, sym] of ROMAN_PAIRS) {
    while (remaining >= val) {
      result += sym;
      remaining -= val;
    }
  }
  return uppercase ? result : result.toLowerCase();
}

const INFORMAL_DIGITS = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九'];
const INFORMAL_UNITS = ['', '十', '百', '千'];
const FORMAL_DIGITS = ['零', '壹', '贰', '叁', '肆', '伍', '陆', '柒', '捌', '玖'];
const FORMAL_UNITS = ['', '拾', '佰', '仟'];
const BIG_UNITS = ['', '万', '亿'];

/**
 * W3C CSS Counter Styles 简体中文数字转换（支持 simp-chinese-informal 与 simp-chinese-formal）
 */
export function toSimpChineseNumber(index: number, formal: boolean): string {
  if (!Number.isInteger(index) || index <= 0 || index >= 1_0000_0000_0000) {
    return String(index);
  }

  const digits = formal ? FORMAL_DIGITS : INFORMAL_DIGITS;
  const units = formal ? FORMAL_UNITS : INFORMAL_UNITS;

  // 将整数按 4 位一组拆分（个级、万级、亿级）
  const groups: number[] = [];
  let temp = index;
  while (temp > 0) {
    groups.push(temp % 10000);
    temp = Math.floor(temp / 10000);
  }

  let result = '';
  let needZero = false;

  for (let g = groups.length - 1; g >= 0; g--) {
    const groupVal = groups[g];
    if (groupVal === 0) {
      if (result.length > 0) {
        needZero = true;
      }
      continue;
    }

    if (needZero || (g < groups.length - 1 && groupVal < 1000 && result.length > 0)) {
      result += digits[0];
      needZero = false;
    }

    let groupStr = '';
    let zeroInGroup = false;
    for (let pos = 3; pos >= 0; pos--) {
      const d = Math.floor(groupVal / Math.pow(10, pos)) % 10;
      if (d === 0) {
        if (groupStr.length > 0) {
          zeroInGroup = true;
        }
      } else {
        if (zeroInGroup) {
          groupStr += digits[0];
          zeroInGroup = false;
        }
        groupStr += digits[d] + units[pos];
      }
    }

    // W3C simp-chinese-informal 规约：10~19（或最高位万/亿组为 10~19）省去前导“一”
    if (!formal && g === groups.length - 1 && groupVal >= 10 && groupVal < 20) {
      groupStr = groupStr.slice(1);
    }

    result += groupStr + BIG_UNITS[g];
  }

  return result;
}

/**
 * 按 13 套编号规约生成对应序号字符串（不含后缀与空格）
 */
export function formatOrderedNumber(
  style: OrderedListSymbolStyle,
  index: number,
): string {
  const n = Number.isInteger(index) && index > 0 ? index : 1;

  switch (style) {
    case 'decimal':
      return String(n);

    case 'decimal-leading-zero':
      return n < 10 ? `0${n}` : String(n);

    case 'lower-latin':
      return toBijectiveLatin(n, false);

    case 'upper-latin':
      return toBijectiveLatin(n, true);

    case 'lower-roman':
      return toRomanNumeral(n, false);

    case 'upper-roman':
      return toRomanNumeral(n, true);

    case 'simp-chinese-informal':
      return toSimpChineseNumber(n, false);

    case 'simp-chinese-formal':
      return toSimpChineseNumber(n, true);

    case 'circled-decimal':
      if (n >= 1 && n <= 20) {
        return String.fromCodePoint(0x2460 + (n - 1));
      }
      if (n >= 21 && n <= 35) {
        return String.fromCodePoint(0x3251 + (n - 21));
      }
      if (n >= 36 && n <= 50) {
        return String.fromCodePoint(0x32b1 + (n - 36));
      }
      return String(n);

    case 'negative-circled-decimal':
      if (n >= 1 && n <= 10) {
        return String.fromCodePoint(0x2776 + (n - 1));
      }
      if (n >= 11 && n <= 20) {
        return String.fromCodePoint(0x24eb + (n - 11));
      }
      return String(n);

    case 'parenthesized-lower-latin':
      if (n >= 1 && n <= 26) {
        return String.fromCodePoint(0x249c + (n - 1));
      }
      return `(${toBijectiveLatin(n, false)})`;

    case 'parenthesized-upper-latin':
      if (n >= 1 && n <= 26) {
        // U+1F110..U+1F129 位于非 BMP 平面，必须使用 String.fromCodePoint
        return String.fromCodePoint(0x1f110 + (n - 1));
      }
      return `(${toBijectiveLatin(n, true)})`;

    case 'emoji-keycap':
      if (n >= 1 && n <= 9) {
        return `${n}\uFE0F\u20E3`;
      }
      if (n === 10) {
        return '\u{1F51F}';
      }
      return String(n);

    default:
      return String(n);
  }
}

/**
 * 为三类列表项计算最终需要拼接在 <p> 开头的前缀字符串（含尾部 1 个半角空格；未开启或为空时返回 ""）
 */
export function formatListItemPrefix(
  elementType: 'unorderedList' | 'orderedList' | 'taskList',
  blockConfig: BlockStyleConfig,
  listMeta?: ListItemMeta,
): string {
  if (elementType === 'unorderedList') {
    const cfg = blockConfig.unorderedSymbol;
    if (!cfg?.prependSymbol) return '';
    return cfg.bulletSymbol.length > 0 ? `${cfg.bulletSymbol} ` : '';
  }

  if (elementType === 'orderedList') {
    const cfg = blockConfig.orderedSymbol;
    if (!cfg?.prependSymbol) return '';
    const numStr = formatOrderedNumber(cfg.orderedStyle, listMeta?.orderIndex ?? 1);
    const combined = `${numStr}${cfg.orderedSuffix ?? ''}`;
    return combined.length > 0 ? `${combined} ` : '';
  }

  if (elementType === 'taskList') {
    const cfg = blockConfig.taskSymbol;
    if (!cfg?.prependSymbol) return '';
    const sym = listMeta?.checked ? cfg.checkedSymbol : cfg.uncheckedSymbol;
    return sym.length > 0 ? `${sym} ` : '';
  }

  return '';
}
