import type { BlockElementType, StylePreset } from '../types/settings';
import { ELEMENT_PREVIEW_SAMPLES } from '../defaults/previewSamples';
import {
  PREVIEW_SHELL_STYLESHEET,
  convertMarkdownToInlineHtml,
} from '../renderer/documentWrapper';

export interface LivePreviewController {
  scheduleRefresh: (preset: StylePreset, selectedElement: BlockElementType) => void;
  refreshNow: (preset: StylePreset, selectedElement: BlockElementType) => void;
  destroy: () => void;
}

/**
 * 将生成的 HTML 片段做缩进美化用于源码面板展示，清晰呈现 `<section>` -> `<p>` -> `<span> / <br> / 文本` 三层嵌套关系，
 * 同时完整保留配置的上下源码空行与 HTML 注释。
 */
export function formatHtmlForSourcePreview(sectionsHtml: string): string {
  if (!sectionsHtml) return '';

  // 匹配 <section...>\n  <p...>inner</p>\n</section>，将 <p> 内部的行内节点按 4 空格缩进展开
  return sectionsHtml.replace(
    /(<section\b[^>]*>\n)( {2}<p\b[^>]*>)([\s\S]*?)(<\/p>\n<\/section>)/g,
    (_full, secOpen: string, pOpen: string, inner: string, closePart: string) => {
      if (!inner) {
        return `${secOpen}${pOpen}${closePart}`;
      }

      const tokenRe = /(<span\b[^>]*>[\s\S]*?<\/span>|<br\s*\/?>|<!--[\s\S]*?-->)/g;
      const lines: string[] = [];
      let lastIdx = 0;
      let match: RegExpExecArray | null;

      while ((match = tokenRe.exec(inner)) !== null) {
        if (match.index > lastIdx) {
          const textSlice = inner.slice(lastIdx, match.index);
          if (textSlice) {
            lines.push(`    ${textSlice}`);
          }
        }
        lines.push(`    ${match[0]}`);
        lastIdx = match.index + match[0].length;
      }

      if (lastIdx < inner.length) {
        const tail = inner.slice(lastIdx);
        if (tail) {
          lines.push(`    ${tail}`);
        }
      }

      if (lines.length === 0) {
        return `${secOpen}${pOpen}${closePart}`;
      }

      return `${secOpen}${pOpen}\n${lines.join('\n')}\n  ${closePart}`;
    },
  );
}

export function createLivePreview(
  container: HTMLElement,
  initialPreset: StylePreset,
  initialElement: BlockElementType,
): LivePreviewController {
  container.empty();
  container.addClass('inline-html-card', 'inline-html-live-preview');

  let showSource = true;
  let debounceTimer: number | null = null;
  let currentPreset = initialPreset;
  let currentElement = initialElement;

  const header = container.createDiv({ cls: 'inline-html-card-header' });
  header.createSpan({ cls: 'inline-html-card-title', text: '元素实时预览' });

  const toolbar = header.createDiv({ cls: 'inline-html-preview-toolbar' });
  const toggleCodeBtn = toolbar.createEl('button', {
    text: '隐藏源码',
    cls: 'inline-html-btn-sm',
  });

  // 未定义变量告警条
  const warningBar = container.createDiv({
    cls: 'inline-html-preview-warning is-hidden',
  });

  // 注释模式空渲染提示
  const commentOnlyHint = container.createDiv({
    cls: 'inline-html-comment-only-hint is-hidden',
    text: '当前预览内容仅输出 HTML 注释，请在下方 HTML 源码区查看输出。',
  });

  // 渲染效果画布宿主（采用 Shadow DOM 隔离 Obsidian 自身主题对 section/p/span 的样式干扰）
  const renderViewport = container.createDiv({
    cls: 'inline-html-render-viewport',
  });
  const shadowHost = renderViewport.createDiv({ cls: 'inline-html-shadow-host' });
  const shadowRoot = shadowHost.attachShadow
    ? shadowHost.attachShadow({ mode: 'open' })
    : null;

  // HTML 源码预览面板
  const sourcePanel = container.createDiv({ cls: 'inline-html-source-panel' });
  sourcePanel.createDiv({
    cls: 'inline-html-source-header',
    text: '实时生成的 HTML 源码',
  });
  const codePre = sourcePanel.createEl('pre', { cls: 'inline-html-source-pre' });
  const codeEl = codePre.createEl('code');

  const doRender = (): void => {
    const sampleMd = ELEMENT_PREVIEW_SAMPLES[currentElement];
    const result = convertMarkdownToInlineHtml(
      sampleMd,
      currentPreset,
      '实时预览示例',
    );

    // 1. 告警栏
    if (result.warnings.undefinedVariables.length > 0) {
      const listText = result.warnings.undefinedVariables
        .map((v) => `{${v}}`)
        .join('、');
      warningBar.setText(`⚠️ 检测到未定义的样式变量：${listText}`);
      warningBar.removeClass('is-hidden');
    } else {
      warningBar.addClass('is-hidden');
    }

    // 2. 检测是否全为注释/无可见标签
    const strippedComments = result.sectionsHtml
      .replace(/<!--[\s\S]*?-->/g, '')
      .trim();
    const isCommentOnly =
      result.sectionsHtml.trim().length > 0 && strippedComments.length === 0;
    commentOnlyHint.toggleClass('is-hidden', !isCommentOnly);

    // 3. 更新隔离预览视图
    const previewStyleCss = `
${PREVIEW_SHELL_STYLESHEET}
.inline-html-preview-shell {
  margin: 0 auto;
  padding: 20px 18px;
  box-shadow: none;
  min-height: 60px;
}
`;
    const parsedDoc = new DOMParser().parseFromString(
      result.sectionsHtml,
      'text/html',
    );
    const shellEl = shadowHost.createDiv({ cls: 'inline-html-preview-shell' });
    shellEl.remove();
    for (const child of Array.from(parsedDoc.body.childNodes)) {
      shellEl.appendChild(document.importNode(child, true));
    }
    if (shadowRoot) {
      const styleEl = shadowHost.createEl('style', { text: previewStyleCss });
      styleEl.remove();
      shadowRoot.replaceChildren(styleEl, shellEl);
    } else {
      shadowHost.replaceChildren(shellEl);
    }

    // 4. 更新源码区（展开嵌套层级，使 section / p / span 结构清晰分明）
    codeEl.setText(formatHtmlForSourcePreview(result.sectionsHtml));
  };

  toggleCodeBtn.addEventListener('click', () => {
    showSource = !showSource;
    sourcePanel.toggleClass('is-hidden', !showSource);
    toggleCodeBtn.setText(showSource ? '隐藏源码' : 'HTML源码');
  });

  doRender();

  return {
    scheduleRefresh(preset: StylePreset, selectedElement: BlockElementType) {
      currentPreset = preset;
      currentElement = selectedElement;
      if (debounceTimer !== null) {
        window.clearTimeout(debounceTimer);
      }
      debounceTimer = window.setTimeout(() => {
        debounceTimer = null;
        doRender();
      }, 150);
    },
    refreshNow(preset: StylePreset, selectedElement: BlockElementType) {
      currentPreset = preset;
      currentElement = selectedElement;
      if (debounceTimer !== null) {
        window.clearTimeout(debounceTimer);
        debounceTimer = null;
      }
      doRender();
    },
    destroy() {
      if (debounceTimer !== null) {
        window.clearTimeout(debounceTimer);
        debounceTimer = null;
      }
    },
  };
}
