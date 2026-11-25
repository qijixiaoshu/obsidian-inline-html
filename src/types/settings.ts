export type BlockElementType =
  | 'paragraph'
  | 'h1'
  | 'h2'
  | 'h3'
  | 'h4'
  | 'h5'
  | 'h6'
  | 'unorderedList'
  | 'orderedList'
  | 'taskList'
  | 'blockquote'
  | 'divider';

export const BLOCK_ELEMENT_ORDER: readonly BlockElementType[] = [
  'paragraph',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'unorderedList',
  'orderedList',
  'taskList',
  'blockquote',
  'divider',
];

export const BLOCK_ELEMENT_LABELS: Record<BlockElementType, string> = {
  paragraph: '正文段落',
  h1: '一级标题 (H1)',
  h2: '二级标题 (H2)',
  h3: '三级标题 (H3)',
  h4: '四级标题 (H4)',
  h5: '五级标题 (H5)',
  h6: '六级标题 (H6)',
  unorderedList: '无序列表',
  orderedList: '有序列表',
  taskList: '任务列表',
  blockquote: '引用块',
  divider: '分割线',
};

export const BLOCK_ELEMENT_SHORT_LABELS: Record<BlockElementType, string> = {
  paragraph: '正文',
  h1: 'H1',
  h2: 'H2',
  h3: 'H3',
  h4: 'H4',
  h5: 'H5',
  h6: 'H6',
  unorderedList: '无序列表',
  orderedList: '有序列表',
  taskList: '任务列表',
  blockquote: '引用块',
  divider: '分割线',
};

export type InlineFormatType =
  | 'bold'
  | 'italic'
  | 'boldItalic'
  | 'strikethrough'
  | 'highlight';

/** 固定合并优先级：由低到高，高优先级同名 CSS 属性覆盖低优先级 */
export const INLINE_FORMAT_PRIORITY: readonly InlineFormatType[] = [
  'bold',
  'italic',
  'boldItalic',
  'strikethrough',
  'highlight',
];

export const INLINE_FORMAT_LABELS: Record<InlineFormatType, string> = {
  bold: '粗体',
  italic: '斜体',
  boldItalic: '粗斜体',
  strikethrough: '删除线',
  highlight: '高亮',
};

export type OrderedListSymbolStyle =
  | 'decimal'
  | 'decimal-leading-zero'
  | 'lower-latin'
  | 'upper-latin'
  | 'lower-roman'
  | 'upper-roman'
  | 'simp-chinese-informal'
  | 'simp-chinese-formal'
  | 'circled-decimal'
  | 'negative-circled-decimal'
  | 'parenthesized-lower-latin'
  | 'parenthesized-upper-latin'
  | 'emoji-keycap';

export interface StyleVariable {
  /** 唯一 ID，用于 UI 列表渲染 */
  id: string;
  /** 变量名（不含大括号），如 "主色调" */
  name: string;
  /** 变量值（任意 CSS 值片段），如 "#1A73E8" 或 "16px" */
  value: string;
}

export interface InlineStyleConfig {
  bold: string;
  italic: string;
  boldItalic: string;
  strikethrough: string;
  highlight: string;
}

export interface UnorderedListSymbolConfig {
  /** 是否补入无序列表符号，默认 false */
  prependSymbol: boolean;
  /** 自定义符号，默认 "•" */
  bulletSymbol: string;
}

export interface OrderedListSymbolConfig {
  /** 是否补入有序列表序号，默认 false */
  prependSymbol: boolean;
  /** 13 套有序编号样式枚举，默认 "decimal" */
  orderedStyle: OrderedListSymbolStyle;
  /** 序号后缀，切换样式时自动匹配默认后缀（如 "."、"、" 或 ""），支持用户修改 */
  orderedSuffix: string;
}

export interface TaskListSymbolConfig {
  /** 是否补入任务列表状态符号，默认 false */
  prependSymbol: boolean;
  /** 未完成 (- [ ]) 符号，默认 "☐" */
  uncheckedSymbol: string;
  /** 已完成 (- [x]) 符号，默认 "☑" */
  checkedSymbol: string;
}

export interface DividerStyleConfig {
  /** 线条颜色（支持 CSS 色值或 {变量名}，默认 "#E5E5E5"） */
  color: string;
  /** 线条高度（px，默认 1） */
  height: number;
  /** 两侧内边距 padding（px，默认 0） */
  paddingX: number;
  /** 上下外边距 margin（px，默认 16） */
  marginY: number;
}

export interface BlockStyleConfig {
  /** 是否将该元素内容转为 HTML 注释（<!-- 纯文本内容 -->），默认 false */
  exportAsComment: boolean;
  /** 该元素在 HTML 源码中上方的额外空行数（非负整数，默认 0） */
  blankLinesBefore: number;
  /** 该元素在 HTML 源码中下方的额外空行数（非负整数，默认 0） */
  blankLinesAfter: number;
  /** 仅 unorderedList 生效：无序列表可选符号补入配置 */
  unorderedSymbol?: UnorderedListSymbolConfig;
  /** 仅 orderedList 生效：有序列表可选编号补入配置 */
  orderedSymbol?: OrderedListSymbolConfig;
  /** 仅 taskList 生效：任务列表可选状态符号补入配置 */
  taskSymbol?: TaskListSymbolConfig;
  /** 仅 divider 生效：分割线 4 项参数配置（自动生成双层 <section>，不使用 sectionStyle/paragraphStyle/inlineStyles） */
  dividerStyle?: DividerStyleConfig;
  /** 替换 <section style="..."> 中的内容（divider 不使用） */
  sectionStyle: string;
  /** 替换 <p style="..."> 中的内容（divider 不使用） */
  paragraphStyle: string;
  /** 该块级元素专属的 5 种行内样式（互不继承；divider 不使用） */
  inlineStyles: InlineStyleConfig;
}

export interface StylePreset {
  id: string;
  name: string;
  /** 该预设独立的样式变量表 */
  variables: StyleVariable[];
  /** 12 类块级元素的样式映射表 */
  elements: Record<BlockElementType, BlockStyleConfig>;
}

export type ExportLocationMode = 'same-folder' | 'custom-folder';

export interface InlineHtmlSettings {
  /** 配置结构版本号，便于后续无痛迁移 */
  schemaVersion: number;
  /** 当前激活（右键导出默认使用）的预设 ID */
  activePresetId: string;
  /** 导出保存模式 */
  exportLocationMode: ExportLocationMode;
  /** 当 exportLocationMode === 'custom-folder' 时生效（支持 Vault 相对路径或本机绝对路径） */
  customExportDir: string;
  /** 所有样式预设集合（至少包含 1 项） */
  presets: StylePreset[];
}

export interface PresetExportPayload {
  format: 'inline-html-preset';
  schemaVersion: number;
  exportedAt: string;
  preset: StylePreset;
}
