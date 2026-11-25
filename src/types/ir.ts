import type { BlockElementType, InlineFormatType } from './settings';

export type RawInlineMark = 'bold' | 'italic' | 'strikethrough' | 'highlight';

export type UnadaptedInlineType =
  | 'inline_code'
  | 'link'
  | 'wikilink'
  | 'inline_image'
  | 'inline_math'
  | 'inline_html';

export type UnadaptedBlockType =
  | 'frontmatter'
  | 'code_block'
  | 'table'
  | 'image'
  | 'callout'
  | 'html_block'
  | 'math_block'
  | 'footnote';

export type InlineRunNode =
  | {
      kind: 'text';
      text: string;
      /** 已经过粗斜体语义归约后的格式集合 */
      marks: Set<InlineFormatType>;
    }
  | {
      kind: 'break';
    }
  | {
      kind: 'unadapted_inline';
      syntaxType: UnadaptedInlineType;
      text: string;
    };

export interface ListItemMeta {
  /** orderedList 专属：当前项在列表中的编号（从 start 起算） */
  orderIndex?: number;
  /** taskList 专属：是否已完成 */
  checked?: boolean;
}

export type DocumentBlockNode =
  | {
      kind: 'adapted';
      elementType: Exclude<BlockElementType, 'divider'>;
      runs: InlineRunNode[];
      listMeta?: ListItemMeta;
    }
  | {
      kind: 'divider';
    }
  | {
      kind: 'frontmatter';
      rawText: string;
    }
  | {
      kind: 'unadapted_block';
      syntaxType: Exclude<UnadaptedBlockType, 'frontmatter'>;
      /** 降级保留的可读纯文本段落列表（段内换行用 \n 表示） */
      paragraphs: string[];
    };

export interface RenderWarnings {
  /** 去重后的未定义样式变量名称列表 */
  undefinedVariables: string[];
  /** 未适配语法出现总次数 */
  unadaptedCount: number;
  /** 去重后的未适配语法类型列表 */
  unadaptedTypes: string[];
}

export interface RenderDocumentResult {
  /** 仅正文片段（不含 html/head/body 外壳，供源码预览或测试断言使用） */
  sectionsHtml: string;
  /** 完整 HTML5 文档 */
  fullHtml: string;
  /** 转换告警统计 */
  warnings: RenderWarnings;
}
