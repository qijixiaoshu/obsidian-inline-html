import {
  BLOCK_ELEMENT_ORDER,
  type BlockElementType,
  type BlockStyleConfig,
  type DividerStyleConfig,
  type InlineHtmlSettings,
  type InlineStyleConfig,
  type OrderedListSymbolConfig,
  type OrderedListSymbolStyle,
  type PresetExportPayload,
  type StylePreset,
  type StyleVariable,
  type TaskListSymbolConfig,
  type UnorderedListSymbolConfig,
} from '../types/settings';
import {
  ORDERED_STYLE_OPTIONS,
  getDefaultOrderedSuffix,
} from '../renderer/listMarkerFormatter';

export const CURRENT_SCHEMA_VERSION = 1;

const VALID_ORDERED_STYLES = new Set<OrderedListSymbolStyle>(
  ORDERED_STYLE_OPTIONS.map((o) => o.style),
);

export function clampBlankLines(value: unknown): number {
  const num = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(num) || num < 0) {
    return 0;
  }
  return Math.min(20, Math.floor(num));
}

export function clampNonNegativePx(value: unknown, fallback: number, max = 200): number {
  const num = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(num) || num < 0) {
    return fallback < 0 ? 0 : fallback;
  }
  return Math.min(max, Math.round(num * 100) / 100);
}

export function clampDividerHeight(value: unknown, fallback = 1): number {
  const num = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(num) || num <= 0) {
    return fallback;
  }
  return Math.min(50, Math.round(num * 100) / 100);
}

export function createEmptyInlineStyles(): InlineStyleConfig {
  return {
    bold: '',
    italic: '',
    boldItalic: '',
    strikethrough: '',
    highlight: '',
  };
}

export function createDefaultInlineStylesForBody(): InlineStyleConfig {
  return {
    bold: 'font-weight: 700; color: {标题色};',
    italic: 'font-style: italic;',
    boldItalic: 'font-weight: 700; font-style: italic; color: {标题色};',
    strikethrough: 'text-decoration: line-through; color: {辅助文字色};',
    highlight: 'background-color: {高亮底色}; padding: 2px 4px; border-radius: 3px;',
  };
}

export function createDefaultUnorderedSymbol(): UnorderedListSymbolConfig {
  return {
    prependSymbol: false,
    bulletSymbol: '•',
  };
}

export function createDefaultOrderedSymbol(): OrderedListSymbolConfig {
  return {
    prependSymbol: false,
    orderedStyle: 'decimal',
    orderedSuffix: '.',
  };
}

export function createDefaultTaskSymbol(): TaskListSymbolConfig {
  return {
    prependSymbol: false,
    uncheckedSymbol: '☐',
    checkedSymbol: '☑',
  };
}

export function createDefaultDividerStyle(): DividerStyleConfig {
  return {
    color: '{分割线色}',
    height: 1,
    paddingX: 0,
    marginY: 20,
  };
}

export function createDefaultPreset(): StylePreset {
  const bodyInline = createDefaultInlineStylesForBody();
  const headingInline = (): InlineStyleConfig => ({
    bold: 'font-weight: 700;',
    italic: 'font-style: italic;',
    boldItalic: 'font-weight: 700; font-style: italic;',
    strikethrough: 'text-decoration: line-through; opacity: 0.75;',
    highlight: 'background-color: {高亮底色}; padding: 0 4px; border-radius: 3px;',
  });

  return {
    id: 'preset-default',
    name: '默认预设',
    variables: [
      { id: 'var-primary', name: '主色调', value: '#1A73E8' },
      { id: 'var-heading', name: '标题色', value: '#111111' },
      { id: 'var-text', name: '正文色', value: '#333333' },
      { id: 'var-muted', name: '辅助文字色', value: '#888888' },
      { id: 'var-highlight', name: '高亮底色', value: '#FFF3A3' },
      { id: 'var-quote-bg', name: '引用底色', value: '#F7F9FC' },
      { id: 'var-divider', name: '分割线色', value: '#E5E5E5' },
    ],
    elements: {
      paragraph: {
        exportAsComment: false,
        blankLinesBefore: 0,
        blankLinesAfter: 0,
        sectionStyle: 'margin: 0 0 16px 0; white-space: normal;',
        paragraphStyle:
          'margin: 0; font-size: 15px; line-height: 1.85; letter-spacing: 0.5px; color: {正文色}; text-align: justify;',
        inlineStyles: { ...bodyInline },
      },
      h1: {
        exportAsComment: false,
        blankLinesBefore: 1,
        blankLinesAfter: 0,
        sectionStyle: 'margin: 28px 0 18px 0; text-align: center;',
        paragraphStyle:
          'margin: 0; font-size: 22px; font-weight: 700; line-height: 1.45; color: {标题色}; letter-spacing: 1px;',
        inlineStyles: headingInline(),
      },
      h2: {
        exportAsComment: false,
        blankLinesBefore: 1,
        blankLinesAfter: 0,
        sectionStyle:
          'margin: 24px 0 14px 0; padding-left: 10px; border-left: 4px solid {主色调};',
        paragraphStyle:
          'margin: 0; font-size: 18px; font-weight: 700; line-height: 1.5; color: {标题色};',
        inlineStyles: headingInline(),
      },
      h3: {
        exportAsComment: false,
        blankLinesBefore: 0,
        blankLinesAfter: 0,
        sectionStyle: 'margin: 20px 0 12px 0;',
        paragraphStyle:
          'margin: 0; font-size: 16px; font-weight: 700; line-height: 1.55; color: {主色调};',
        inlineStyles: headingInline(),
      },
      h4: {
        exportAsComment: false,
        blankLinesBefore: 0,
        blankLinesAfter: 0,
        sectionStyle: 'margin: 16px 0 10px 0;',
        paragraphStyle:
          'margin: 0; font-size: 15px; font-weight: 700; line-height: 1.6; color: {标题色};',
        inlineStyles: headingInline(),
      },
      h5: {
        exportAsComment: false,
        blankLinesBefore: 0,
        blankLinesAfter: 0,
        sectionStyle: 'margin: 14px 0 8px 0;',
        paragraphStyle:
          'margin: 0; font-size: 14px; font-weight: 700; line-height: 1.6; color: {正文色};',
        inlineStyles: headingInline(),
      },
      h6: {
        exportAsComment: false,
        blankLinesBefore: 0,
        blankLinesAfter: 0,
        sectionStyle: 'margin: 12px 0 8px 0;',
        paragraphStyle:
          'margin: 0; font-size: 13px; font-weight: 700; line-height: 1.6; color: {辅助文字色};',
        inlineStyles: headingInline(),
      },
      unorderedList: {
        exportAsComment: false,
        blankLinesBefore: 0,
        blankLinesAfter: 0,
        unorderedSymbol: createDefaultUnorderedSymbol(),
        sectionStyle: 'margin: 0 0 8px 0;',
        paragraphStyle:
          'margin: 0; font-size: 15px; line-height: 1.8; color: {正文色}; text-align: justify;',
        inlineStyles: { ...bodyInline },
      },
      orderedList: {
        exportAsComment: false,
        blankLinesBefore: 0,
        blankLinesAfter: 0,
        orderedSymbol: createDefaultOrderedSymbol(),
        sectionStyle: 'margin: 0 0 8px 0;',
        paragraphStyle:
          'margin: 0; font-size: 15px; line-height: 1.8; color: {正文色}; text-align: justify;',
        inlineStyles: { ...bodyInline },
      },
      taskList: {
        exportAsComment: false,
        blankLinesBefore: 0,
        blankLinesAfter: 0,
        taskSymbol: createDefaultTaskSymbol(),
        sectionStyle: 'margin: 0 0 8px 0;',
        paragraphStyle:
          'margin: 0; font-size: 15px; line-height: 1.8; color: {正文色}; text-align: justify;',
        inlineStyles: { ...bodyInline },
      },
      blockquote: {
        exportAsComment: false,
        blankLinesBefore: 0,
        blankLinesAfter: 0,
        sectionStyle:
          'margin: 16px 0; padding: 12px 16px; background-color: {引用底色}; border-left: 3px solid {主色调}; border-radius: 4px;',
        paragraphStyle:
          'margin: 0; font-size: 14px; line-height: 1.8; color: {辅助文字色}; text-align: justify;',
        inlineStyles: {
          bold: 'font-weight: 700; color: {正文色};',
          italic: 'font-style: italic;',
          boldItalic: 'font-weight: 700; font-style: italic; color: {正文色};',
          strikethrough: 'text-decoration: line-through;',
          highlight: 'background-color: {高亮底色}; padding: 1px 3px;',
        },
      },
      divider: {
        exportAsComment: false,
        blankLinesBefore: 0,
        blankLinesAfter: 0,
        dividerStyle: createDefaultDividerStyle(),
        sectionStyle: '',
        paragraphStyle: '',
        inlineStyles: createEmptyInlineStyles(),
      },
    },
  };
}

export function createDefaultSettings(): InlineHtmlSettings {
  const defaultPreset = createDefaultPreset();
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    activePresetId: defaultPreset.id,
    exportLocationMode: 'same-folder',
    customExportDir: '',
    presets: [defaultPreset],
  };
}

export function clonePreset(preset: StylePreset): StylePreset {
  return JSON.parse(JSON.stringify(preset)) as StylePreset;
}

export function generateUniqueId(prefix = 'id'): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * 为任意可能缺省字段的 BlockStyleConfig 补全默认值（兼容旧版 JSON 导入或残缺配置）
 */
export function normalizeBlockConfig(
  elementType: BlockElementType,
  raw: unknown,
): BlockStyleConfig {
  const obj = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const rawInline = (
    obj.inlineStyles && typeof obj.inlineStyles === 'object' ? obj.inlineStyles : {}
  ) as Record<string, unknown>;

  const normalized: BlockStyleConfig = {
    exportAsComment: Boolean(obj.exportAsComment),
    blankLinesBefore: clampBlankLines(obj.blankLinesBefore),
    blankLinesAfter: clampBlankLines(obj.blankLinesAfter),
    sectionStyle: typeof obj.sectionStyle === 'string' ? obj.sectionStyle : '',
    paragraphStyle: typeof obj.paragraphStyle === 'string' ? obj.paragraphStyle : '',
    inlineStyles: {
      bold: typeof rawInline.bold === 'string' ? rawInline.bold : '',
      italic: typeof rawInline.italic === 'string' ? rawInline.italic : '',
      boldItalic: typeof rawInline.boldItalic === 'string' ? rawInline.boldItalic : '',
      strikethrough:
        typeof rawInline.strikethrough === 'string' ? rawInline.strikethrough : '',
      highlight: typeof rawInline.highlight === 'string' ? rawInline.highlight : '',
    },
  };

  if (elementType === 'unorderedList') {
    const u = (
      obj.unorderedSymbol && typeof obj.unorderedSymbol === 'object'
        ? obj.unorderedSymbol
        : {}
    ) as Record<string, unknown>;
    normalized.unorderedSymbol = {
      prependSymbol: Boolean(u.prependSymbol),
      bulletSymbol: typeof u.bulletSymbol === 'string' ? u.bulletSymbol : '•',
    };
  } else if (elementType === 'orderedList') {
    const o = (
      obj.orderedSymbol && typeof obj.orderedSymbol === 'object'
        ? obj.orderedSymbol
        : {}
    ) as Record<string, unknown>;
    const styleCandidate = o.orderedStyle as OrderedListSymbolStyle;
    const validStyle: OrderedListSymbolStyle = VALID_ORDERED_STYLES.has(styleCandidate)
      ? styleCandidate
      : 'decimal';
    normalized.orderedSymbol = {
      prependSymbol: Boolean(o.prependSymbol),
      orderedStyle: validStyle,
      orderedSuffix:
        typeof o.orderedSuffix === 'string'
          ? o.orderedSuffix
          : getDefaultOrderedSuffix(validStyle),
    };
  } else if (elementType === 'taskList') {
    const t = (
      obj.taskSymbol && typeof obj.taskSymbol === 'object' ? obj.taskSymbol : {}
    ) as Record<string, unknown>;
    normalized.taskSymbol = {
      prependSymbol: Boolean(t.prependSymbol),
      uncheckedSymbol:
        typeof t.uncheckedSymbol === 'string' ? t.uncheckedSymbol : '☐',
      checkedSymbol: typeof t.checkedSymbol === 'string' ? t.checkedSymbol : '☑',
    };
  } else if (elementType === 'divider') {
    const d = (
      obj.dividerStyle && typeof obj.dividerStyle === 'object' ? obj.dividerStyle : {}
    ) as Record<string, unknown>;
    const colorStr =
      typeof d.color === 'string' && d.color.trim() ? d.color.trim() : '#E5E5E5';
    normalized.dividerStyle = {
      color: colorStr,
      height: clampDividerHeight(d.height, 1),
      paddingX: clampNonNegativePx(d.paddingX, 0, 200),
      marginY: clampNonNegativePx(d.marginY, 16, 200),
    };
  }

  return normalized;
}

export function normalizeVariables(rawVars: unknown): StyleVariable[] {
  if (!Array.isArray(rawVars)) {
    return [];
  }
  const seenNames = new Set<string>();
  const result: StyleVariable[] = [];
  for (const item of rawVars) {
    if (!item || typeof item !== 'object') continue;
    const obj = item as Record<string, unknown>;
    const rawName = typeof obj.name === 'string' ? obj.name.replace(/[{}]/g, '').trim() : '';
    if (!rawName || seenNames.has(rawName)) continue;
    seenNames.add(rawName);
    result.push({
      id:
        typeof obj.id === 'string' && obj.id.trim()
          ? obj.id.trim()
          : generateUniqueId('var'),
      name: rawName,
      value: typeof obj.value === 'string' ? obj.value : '',
    });
  }
  return result;
}

export function normalizePreset(
  raw: unknown,
  fallbackName = '未命名预设',
): StylePreset {
  const obj = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const rawElements = (
    obj.elements && typeof obj.elements === 'object' ? obj.elements : {}
  ) as Record<string, unknown>;

  const elements = {} as Record<BlockElementType, BlockStyleConfig>;
  for (const key of BLOCK_ELEMENT_ORDER) {
    elements[key] = normalizeBlockConfig(key, rawElements[key]);
  }

  const name =
    typeof obj.name === 'string' && obj.name.trim() ? obj.name.trim() : fallbackName;
  const id =
    typeof obj.id === 'string' && obj.id.trim()
      ? obj.id.trim()
      : generateUniqueId('preset');

  return {
    id,
    name,
    variables: normalizeVariables(obj.variables),
    elements,
  };
}

export function normalizeSettings(raw: unknown): InlineHtmlSettings {
  const defaults = createDefaultSettings();
  if (!raw || typeof raw !== 'object') {
    return defaults;
  }

  const obj = raw as Record<string, unknown>;
  const presets: StylePreset[] = Array.isArray(obj.presets)
    ? obj.presets
        .filter((p) => p && typeof p === 'object')
        .map((p, idx) => normalizePreset(p, `预设 ${idx + 1}`))
    : [];

  if (presets.length === 0) {
    presets.push(createDefaultPreset());
  }

  const requestedActiveId =
    typeof obj.activePresetId === 'string' ? obj.activePresetId : '';
  const activePresetId = presets.some((p) => p.id === requestedActiveId)
    ? requestedActiveId
    : presets[0].id;

  const exportLocationMode =
    obj.exportLocationMode === 'custom-folder' ? 'custom-folder' : 'same-folder';
  const customExportDir =
    typeof obj.customExportDir === 'string' ? obj.customExportDir : '';

  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    activePresetId,
    exportLocationMode,
    customExportDir,
    presets,
  };
}

export function deduplicatePresetName(
  desiredName: string,
  existingNames: readonly string[],
  suffixLabel = '导入',
): string {
  const trimmed = desiredName.trim() || '未命名预设';
  const nameSet = new Set(existingNames.map((n) => n.trim()));
  if (!nameSet.has(trimmed)) {
    return trimmed;
  }
  const firstCandidate = `${trimmed} (${suffixLabel})`;
  if (!nameSet.has(firstCandidate)) {
    return firstCandidate;
  }
  let counter = 2;
  while (nameSet.has(`${trimmed} (${suffixLabel} ${counter})`)) {
    counter++;
  }
  return `${trimmed} (${suffixLabel} ${counter})`;
}

export function serializePresetToJson(preset: StylePreset): string {
  const payload: PresetExportPayload = {
    format: 'inline-html-preset',
    schemaVersion: CURRENT_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    preset: clonePreset(preset),
  };
  return JSON.stringify(payload, null, 2);
}

/**
 * 校验并解析导入的预设 JSON 文本：
 * - 校验合法 JSON、format === "inline-html-preset" 与 preset.elements 对象结构
 * - 自动补全缺省字段默认值
 * - 若与现有预设重名，自动追加 "(导入)" 后缀避免覆盖
 */
export function parseAndValidatePresetJson(
  jsonText: string,
  existingPresetNames: readonly string[],
): StylePreset {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    throw new Error('JSON 语法解析失败，请确认文件是合法的 JSON 格式。');
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('无效的预设文件：顶层必须为 JSON 对象。');
  }

  const root = parsed as Record<string, unknown>;
  if (root.format !== 'inline-html-preset') {
    throw new Error(
      '无效的预设文件：缺少或无法识别 format 标识（需为 "inline-html-preset"）。',
    );
  }

  if (!root.preset || typeof root.preset !== 'object') {
    throw new Error('无效的预设文件：缺少 preset 配置主体。');
  }

  const presetRaw = root.preset as Record<string, unknown>;
  if (!presetRaw.elements || typeof presetRaw.elements !== 'object') {
    throw new Error('无效的预设文件：preset.elements 缺失或格式不正确。');
  }

  const normalized = normalizePreset(presetRaw, '导入预设');
  normalized.id = generateUniqueId('preset');
  normalized.name = deduplicatePresetName(normalized.name, existingPresetNames, '导入');

  return normalized;
}
