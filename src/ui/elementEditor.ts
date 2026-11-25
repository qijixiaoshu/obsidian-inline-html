import {
  BLOCK_ELEMENT_LABELS,
  BLOCK_ELEMENT_SHORT_LABELS,
  INLINE_FORMAT_LABELS,
  INLINE_FORMAT_PRIORITY,
  type BlockElementType,
  type OrderedListSymbolStyle,
  type StylePreset,
} from '../types/settings';
import {
  clampBlankLines,
  clampDividerHeight,
  clampNonNegativePx,
  createDefaultDividerStyle,
  createDefaultOrderedSymbol,
  createDefaultTaskSymbol,
  createDefaultUnorderedSymbol,
} from '../defaults/defaultPreset';
import {
  ORDERED_STYLE_OPTIONS,
  getDefaultOrderedSuffix,
} from '../renderer/listMarkerFormatter';
import { isValidHexColor, toSixDigitHex } from '../style/variableResolver';

interface ElementNavGroup {
  label: string;
  items: readonly BlockElementType[];
}

const ELEMENT_NAV_GROUPS: readonly ElementNavGroup[] = [
  { label: '正文', items: ['paragraph'] },
  { label: '标题', items: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'] },
  { label: '列表', items: ['unorderedList', 'orderedList', 'taskList'] },
  { label: '引用块', items: ['blockquote'] },
  { label: '分割线', items: ['divider'] },
];

export interface ElementEditorCallbacks {
  onSelectElement: (element: BlockElementType) => void;
  /** 字段编辑回调（触发未保存标记与 150ms 防抖预览刷新） */
  onMutatePreset: (immediate?: boolean) => void;
}

export function renderElementEditor(
  container: HTMLElement,
  preset: StylePreset,
  selectedElement: BlockElementType,
  callbacks: ElementEditorCallbacks,
): void {
  container.empty();
  container.addClass('inline-html-card', 'inline-html-element-editor');

  const header = container.createDiv({ cls: 'inline-html-card-header' });
  header.createSpan({ cls: 'inline-html-card-title', text: '元素样式编辑' });

  // 二级分组元素导航栏（一级：正文 / 标题 / 列表 / 引用块 / 分割线）
  const navBar = container.createDiv({ cls: 'inline-html-element-nav' });
  const primaryRow = navBar.createDiv({ cls: 'inline-html-element-nav-primary' });
  const activeGroup =
    ELEMENT_NAV_GROUPS.find((g) => g.items.includes(selectedElement)) ??
    ELEMENT_NAV_GROUPS[0];

  for (const group of ELEMENT_NAV_GROUPS) {
    const isSingle = group.items.length === 1;
    const isGroupActive = group === activeGroup;

    if (isSingle) {
      const key = group.items[0];
      const cfg = preset.elements[key];
      const btnText = cfg.exportAsComment ? `${group.label} (注释)` : group.label;
      const navBtn = primaryRow.createEl('button', {
        text: btnText,
        cls: `inline-html-nav-tab ${key === selectedElement ? 'is-active' : ''}`,
      });
      navBtn.dataset.elementKey = key;
      navBtn.addEventListener('click', () => {
        if (key !== selectedElement) {
          callbacks.onSelectElement(key);
        }
      });
    } else {
      const navBtn = primaryRow.createEl('button', {
        text: group.label,
        cls: `inline-html-nav-tab ${isGroupActive ? 'is-active' : ''}`,
      });
      navBtn.addEventListener('click', () => {
        if (!isGroupActive) {
          callbacks.onSelectElement(group.items[0]);
        }
      });
    }
  }

  if (activeGroup.items.length > 1) {
    const subRow = navBar.createDiv({ cls: 'inline-html-element-nav-sub' });
    for (const key of activeGroup.items) {
      const cfg = preset.elements[key];
      const btnText = cfg.exportAsComment
        ? `${BLOCK_ELEMENT_SHORT_LABELS[key]} (注释)`
        : BLOCK_ELEMENT_SHORT_LABELS[key];
      const subBtn = subRow.createEl('button', {
        text: btnText,
        cls: `inline-html-nav-tab inline-html-nav-sub-tab ${key === selectedElement ? 'is-active' : ''}`,
      });
      subBtn.dataset.elementKey = key;
      subBtn.addEventListener('click', () => {
        if (key !== selectedElement) {
          callbacks.onSelectElement(key);
        }
      });
    }
  }

  const blockCfg = preset.elements[selectedElement];
  const bodyWrap = container.createDiv({ cls: 'inline-html-element-body' });

  const sectionHeading = bodyWrap.createDiv({ cls: 'inline-html-element-heading' });
  sectionHeading.createSpan({
    cls: 'inline-html-element-heading-title',
    text: BLOCK_ELEMENT_LABELS[selectedElement],
  });

  // ── 一、单元素输出控制区（转 HTML 注释 + 源码上下空行 + 三类列表专属补入符号展开） ──
  const controlBox = bodyWrap.createDiv({ cls: 'inline-html-output-control-box' });
  controlBox.createDiv({ cls: 'inline-html-sub-title', text: '输出控制' });

  // 1. 转为 HTML 注释复选框
  const commentRow = controlBox.createDiv({ cls: 'inline-html-checkbox-row' });
  const commentId = `inline-html-comment-${selectedElement}`;
  const commentCheckbox = commentRow.createEl('input', {
    type: 'checkbox',
  });
  commentCheckbox.id = commentId;
  commentCheckbox.checked = blockCfg.exportAsComment;

  const commentLabel = commentRow.createEl('label', {
    text: '将该元素内容转为HTML注释',
  });
  commentLabel.htmlFor = commentId;

  // 2. HTML 源码上下空行数字输入框（标题与输入框分两行，永不合并为一行）
  const blankGroup = controlBox.createDiv({ cls: 'inline-html-blank-lines-group' });
  blankGroup.createDiv({
    cls: 'inline-html-field-label',
    text: 'HTML 源码空行',
  });

  const blankInputsRow = blankGroup.createDiv({
    cls: 'inline-html-blank-lines-inputs',
  });

  const beforeWrap = blankInputsRow.createDiv({
    cls: 'inline-html-inline-number-field',
  });
  beforeWrap.createSpan({ text: '上方空行' });
  const beforeInput = beforeWrap.createEl('input', {
    type: 'number',
    cls: 'inline-html-number-input',
    value: String(blockCfg.blankLinesBefore),
  });
  beforeInput.min = '0';
  beforeInput.max = '20';
  beforeInput.step = '1';
  beforeWrap.createSpan({ text: '行' });

  const afterWrap = blankInputsRow.createDiv({
    cls: 'inline-html-inline-number-field',
  });
  afterWrap.createSpan({ text: '下方空行' });
  const afterInput = afterWrap.createEl('input', {
    type: 'number',
    cls: 'inline-html-number-input',
    value: String(blockCfg.blankLinesAfter),
  });
  afterInput.min = '0';
  afterInput.max = '20';
  afterInput.step = '1';
  afterWrap.createSpan({ text: '行' });

  beforeInput.addEventListener('input', () => {
    const clamped = clampBlankLines(beforeInput.value);
    blockCfg.blankLinesBefore = clamped;
    callbacks.onMutatePreset();
  });
  beforeInput.addEventListener('change', () => {
    beforeInput.value = String(clampBlankLines(beforeInput.value));
  });

  afterInput.addEventListener('input', () => {
    const clamped = clampBlankLines(afterInput.value);
    blockCfg.blankLinesAfter = clamped;
    callbacks.onMutatePreset();
  });
  afterInput.addEventListener('change', () => {
    afterInput.value = String(clampBlankLines(afterInput.value));
  });

  // 3. 三类列表专属：可选补入符号动态展开区（未勾选时完全收起隐藏，勾选后展开）
  if (selectedElement === 'unorderedList') {
    if (!blockCfg.unorderedSymbol) {
      blockCfg.unorderedSymbol = createDefaultUnorderedSymbol();
    }
    const uCfg = blockCfg.unorderedSymbol;

    const listSymWrap = controlBox.createDiv({ cls: 'inline-html-list-symbol-box' });
    const toggleRow = listSymWrap.createDiv({ cls: 'inline-html-checkbox-row' });
    const chk = toggleRow.createEl('input', { type: 'checkbox' });
    chk.id = 'inline-html-ul-prepend';
    chk.checked = uCfg.prependSymbol;
    const lbl = toggleRow.createEl('label', {
      text: '补入无序列表符号',
    });
    lbl.htmlFor = chk.id;

    const expandedPanel = listSymWrap.createDiv({
      cls: `inline-html-list-symbol-expanded ${uCfg.prependSymbol ? '' : 'is-hidden'}`,
    });
    const fieldRow = expandedPanel.createDiv({ cls: 'inline-html-form-row' });
    fieldRow.createSpan({ cls: 'inline-html-field-label', text: '自定义符号：' });
    const symInput = fieldRow.createEl('input', {
      type: 'text',
      cls: 'inline-html-short-text-input',
      value: uCfg.bulletSymbol,
      placeholder: '默认 •',
    });
    fieldRow.createSpan({
      cls: 'inline-html-hint-text',
      text: '自动拼在 <p> 文本最前并隔 1 个空格',
    });

    chk.addEventListener('change', () => {
      uCfg.prependSymbol = chk.checked;
      expandedPanel.toggleClass('is-hidden', !chk.checked);
      callbacks.onMutatePreset(true);
    });
    symInput.addEventListener('input', () => {
      uCfg.bulletSymbol = symInput.value;
      callbacks.onMutatePreset();
    });
  } else if (selectedElement === 'orderedList') {
    if (!blockCfg.orderedSymbol) {
      blockCfg.orderedSymbol = createDefaultOrderedSymbol();
    }
    const oCfg = blockCfg.orderedSymbol;

    const listSymWrap = controlBox.createDiv({ cls: 'inline-html-list-symbol-box' });
    const toggleRow = listSymWrap.createDiv({ cls: 'inline-html-checkbox-row' });
    const chk = toggleRow.createEl('input', { type: 'checkbox' });
    chk.id = 'inline-html-ol-prepend';
    chk.checked = oCfg.prependSymbol;
    const lbl = toggleRow.createEl('label', {
      text: '补入有序列表编号',
    });
    lbl.htmlFor = chk.id;

    const expandedPanel = listSymWrap.createDiv({
      cls: `inline-html-list-symbol-expanded ${oCfg.prependSymbol ? '' : 'is-hidden'}`,
    });

    const styleRow = expandedPanel.createDiv({
      cls: 'inline-html-form-row inline-html-nowrap-row',
    });
    styleRow.createSpan({ cls: 'inline-html-field-label', text: '符号样式：' });

    const styleSelect = styleRow.createEl('select', {
      cls: 'dropdown inline-html-ordered-select',
    });
    // 严格遵循 PRD：下拉菜单仅展示前三个数字预览 + 省略号，不展示任何符号系列名称
    for (const optMeta of ORDERED_STYLE_OPTIONS) {
      const optEl = styleSelect.createEl('option', {
        value: optMeta.style,
        text: optMeta.previewLabel,
      });
      if (optMeta.style === oCfg.orderedStyle) {
        optEl.selected = true;
      }
    }

    const suffixRow = expandedPanel.createDiv({
      cls: 'inline-html-form-row inline-html-nowrap-row',
    });
    suffixRow.createSpan({ cls: 'inline-html-field-label', text: '序号后缀：' });
    const suffixInput = suffixRow.createEl('input', {
      type: 'text',
      cls: 'inline-html-tiny-text-input',
      value: oCfg.orderedSuffix,
      placeholder: '如 . 或 、',
    });

    chk.addEventListener('change', () => {
      oCfg.prependSymbol = chk.checked;
      expandedPanel.toggleClass('is-hidden', !chk.checked);
      callbacks.onMutatePreset(true);
    });

    styleSelect.addEventListener('change', () => {
      const nextStyle = styleSelect.value as OrderedListSymbolStyle;
      oCfg.orderedStyle = nextStyle;
      const recommendedSuffix = getDefaultOrderedSuffix(nextStyle);
      oCfg.orderedSuffix = recommendedSuffix;
      suffixInput.value = recommendedSuffix;
      callbacks.onMutatePreset(true);
    });

    suffixInput.addEventListener('input', () => {
      oCfg.orderedSuffix = suffixInput.value;
      callbacks.onMutatePreset();
    });
  } else if (selectedElement === 'taskList') {
    if (!blockCfg.taskSymbol) {
      blockCfg.taskSymbol = createDefaultTaskSymbol();
    }
    const tCfg = blockCfg.taskSymbol;

    const listSymWrap = controlBox.createDiv({ cls: 'inline-html-list-symbol-box' });
    const toggleRow = listSymWrap.createDiv({ cls: 'inline-html-checkbox-row' });
    const chk = toggleRow.createEl('input', { type: 'checkbox' });
    chk.id = 'inline-html-task-prepend';
    chk.checked = tCfg.prependSymbol;
    const lbl = toggleRow.createEl('label', {
      text: '补入任务状态符号',
    });
    lbl.htmlFor = chk.id;

    const expandedPanel = listSymWrap.createDiv({
      cls: `inline-html-list-symbol-expanded ${tCfg.prependSymbol ? '' : 'is-hidden'}`,
    });

    const taskRow = expandedPanel.createDiv({ cls: 'inline-html-form-row' });
    taskRow.createSpan({ cls: 'inline-html-field-label', text: '未完成：' });
    const uncheckedInput = taskRow.createEl('input', {
      type: 'text',
      cls: 'inline-html-tiny-text-input',
      value: tCfg.uncheckedSymbol,
      placeholder: '☐',
    });

    taskRow.createSpan({ cls: 'inline-html-field-label', text: '已完成：' });
    const checkedInput = taskRow.createEl('input', {
      type: 'text',
      cls: 'inline-html-tiny-text-input',
      value: tCfg.checkedSymbol,
      placeholder: '☑',
    });

    chk.addEventListener('change', () => {
      tCfg.prependSymbol = chk.checked;
      expandedPanel.toggleClass('is-hidden', !chk.checked);
      callbacks.onMutatePreset(true);
    });

    uncheckedInput.addEventListener('input', () => {
      tCfg.uncheckedSymbol = uncheckedInput.value;
      callbacks.onMutatePreset();
    });

    checkedInput.addEventListener('input', () => {
      tCfg.checkedSymbol = checkedInput.value;
      callbacks.onMutatePreset();
    });
  }

  // ── 二、样式输入区（勾选“转为 HTML 注释”时整体锁定不可编辑） ──
  const styleArea = bodyWrap.createDiv({ cls: 'inline-html-style-area' });
  const lockBanner = styleArea.createDiv({
    cls: `inline-html-lock-banner ${blockCfg.exportAsComment ? '' : 'is-hidden'}`,
    text: '🔒 已勾选「转为 HTML 注释」，下方样式输入已锁定为不可编辑模式以避免冲突（原填写值已保留，取消勾选即恢复）。',
  });

  const lockableInputs: Array<
    HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
  > = [];

  if (selectedElement === 'divider') {
    // 分割线专属 4 参数表单（不显示 section/p/span 纯 CSS 输入框）
    if (!blockCfg.dividerStyle) {
      blockCfg.dividerStyle = createDefaultDividerStyle();
    }
    const dCfg = blockCfg.dividerStyle;

    const divPanel = styleArea.createDiv({ cls: 'inline-html-divider-panel' });
    divPanel.createDiv({
      cls: 'inline-html-sub-title',
      text: '分割线样式参数',
    });

    // 1. 线条颜色 + 取色器
    const colorRow = divPanel.createDiv({ cls: 'inline-html-divider-row' });
    colorRow.createSpan({ cls: 'inline-html-divider-label', text: '线条颜色' });
    const colorControls = colorRow.createDiv({
      cls: 'inline-html-divider-control-wrap',
    });
    const colorInput = colorControls.createEl('input', {
      type: 'text',
      cls: 'inline-html-var-val-input',
      value: dCfg.color,
      placeholder: '如 #E5E5E5 或 {分割线色}',
    });
    const divColorPicker = colorControls.createEl('input', {
      type: 'color',
      cls: 'inline-html-color-picker',
    });
    const syncDividerPicker = (): void => {
      if (isValidHexColor(dCfg.color)) {
        divColorPicker.value = toSixDigitHex(dCfg.color);
        divColorPicker.removeClass('is-hidden');
      } else {
        divColorPicker.addClass('is-hidden');
      }
    };
    syncDividerPicker();

    colorInput.addEventListener('input', () => {
      dCfg.color = colorInput.value;
      syncDividerPicker();
      callbacks.onMutatePreset();
    });
    divColorPicker.addEventListener('input', () => {
      const hex = divColorPicker.value.toUpperCase();
      dCfg.color = hex;
      colorInput.value = hex;
      callbacks.onMutatePreset();
    });

    // 2. 线条高度
    const heightRow = divPanel.createDiv({ cls: 'inline-html-divider-row' });
    heightRow.createSpan({ cls: 'inline-html-divider-label', text: '线条高度' });
    const heightControls = heightRow.createDiv({
      cls: 'inline-html-divider-control-wrap',
    });
    const heightInput = heightControls.createEl('input', {
      type: 'number',
      cls: 'inline-html-number-input',
      value: String(dCfg.height),
    });
    heightInput.min = '0.5';
    heightInput.max = '50';
    heightInput.step = '0.5';
    heightControls.createSpan({ cls: 'inline-html-unit-suffix', text: 'px' });
    heightInput.addEventListener('input', () => {
      dCfg.height = clampDividerHeight(heightInput.value, 1);
      callbacks.onMutatePreset();
    });
    heightInput.addEventListener('change', () => {
      heightInput.value = String(clampDividerHeight(heightInput.value, 1));
    });

    // 3. 两侧内边距
    const padRow = divPanel.createDiv({ cls: 'inline-html-divider-row' });
    padRow.createSpan({
      cls: 'inline-html-divider-label',
      text: '两侧内边距',
    });
    const padControls = padRow.createDiv({
      cls: 'inline-html-divider-control-wrap',
    });
    const padInput = padControls.createEl('input', {
      type: 'number',
      cls: 'inline-html-number-input',
      value: String(dCfg.paddingX),
    });
    padInput.min = '0';
    padInput.max = '200';
    padInput.step = '1';
    padControls.createSpan({ cls: 'inline-html-unit-suffix', text: 'px' });
    padInput.addEventListener('input', () => {
      dCfg.paddingX = clampNonNegativePx(padInput.value, 0, 200);
      callbacks.onMutatePreset();
    });
    padInput.addEventListener('change', () => {
      padInput.value = String(clampNonNegativePx(padInput.value, 0, 200));
    });

    // 4. 上下外边距
    const marginRow = divPanel.createDiv({ cls: 'inline-html-divider-row' });
    marginRow.createSpan({
      cls: 'inline-html-divider-label',
      text: '上下外边距',
    });
    const marginControls = marginRow.createDiv({
      cls: 'inline-html-divider-control-wrap',
    });
    const marginInput = marginControls.createEl('input', {
      type: 'number',
      cls: 'inline-html-number-input',
      value: String(dCfg.marginY),
    });
    marginInput.min = '0';
    marginInput.max = '200';
    marginInput.step = '1';
    marginControls.createSpan({ cls: 'inline-html-unit-suffix', text: 'px' });
    marginInput.addEventListener('input', () => {
      dCfg.marginY = clampNonNegativePx(marginInput.value, 16, 200);
      callbacks.onMutatePreset();
    });
    marginInput.addEventListener('change', () => {
      marginInput.value = String(clampNonNegativePx(marginInput.value, 16, 200));
    });

    lockableInputs.push(
      colorInput,
      divColorPicker,
      heightInput,
      padInput,
      marginInput,
    );
  } else {
    // 11 类文本元素：三层纯 CSS 输入框（区块 / 段落 / 5 项独立行内容器）
    const secBlock = styleArea.createDiv({ cls: 'inline-html-css-group' });
    const secTitle = secBlock.createDiv({ cls: 'inline-html-css-label-row' });
    secTitle.createSpan({ cls: 'inline-html-sub-title', text: '1. 区块样式' });
    secTitle.createEl('code', { text: '<section style="...">' });
    const secTextarea = secBlock.createEl('textarea', {
      cls: 'inline-html-css-textarea',
      placeholder: '例如：margin: 0 0 16px 0; white-space: normal;',
    });
    secTextarea.rows = 2;
    secTextarea.value = blockCfg.sectionStyle;
    secTextarea.addEventListener('input', () => {
      blockCfg.sectionStyle = secTextarea.value;
      callbacks.onMutatePreset();
    });

    const pBlock = styleArea.createDiv({ cls: 'inline-html-css-group' });
    const pTitle = pBlock.createDiv({ cls: 'inline-html-css-label-row' });
    pTitle.createSpan({ cls: 'inline-html-sub-title', text: '2. 段落样式' });
    pTitle.createEl('code', { text: '<p style="...">' });
    const pTextarea = pBlock.createEl('textarea', {
      cls: 'inline-html-css-textarea',
      placeholder: '例如：margin: 0; font-size: 15px; line-height: 1.8; color: {正文色};',
    });
    pTextarea.rows = 2;
    pTextarea.value = blockCfg.paragraphStyle;
    pTextarea.addEventListener('input', () => {
      blockCfg.paragraphStyle = pTextarea.value;
      callbacks.onMutatePreset();
    });

    const inlineGroup = styleArea.createDiv({ cls: 'inline-html-css-group' });
    const inTitle = inlineGroup.createDiv({ cls: 'inline-html-css-label-row' });
    inTitle.createSpan({
      cls: 'inline-html-sub-title',
      text: '3. 行内容器样式',
    });
    inTitle.createEl('code', { text: '<span style="...">' });

    lockableInputs.push(secTextarea, pTextarea);

    for (const fmtKey of INLINE_FORMAT_PRIORITY) {
      const row = inlineGroup.createDiv({ cls: 'inline-html-inline-style-row' });
      row.createSpan({
        cls: 'inline-html-inline-style-label',
        text: `${INLINE_FORMAT_LABELS[fmtKey]}：`,
      });
      const input = row.createEl('input', {
        type: 'text',
        cls: 'inline-html-inline-css-input',
        value: blockCfg.inlineStyles[fmtKey],
        placeholder: `输入${INLINE_FORMAT_LABELS[fmtKey]}内联 CSS（留空则不附加样式）`,
      });
      input.addEventListener('input', () => {
        blockCfg.inlineStyles[fmtKey] = input.value;
        callbacks.onMutatePreset();
      });
      lockableInputs.push(input);
    }
  }

  // 同步锁定/解锁状态（保留已填数据不清空）
  const applyLockState = (locked: boolean): void => {
    styleArea.toggleClass('is-locked', locked);
    lockBanner.toggleClass('is-hidden', !locked);
    for (const inputEl of lockableInputs) {
      inputEl.disabled = locked;
    }
    // 同步当前激活元素导航标签文字中的 (注释) 提示
    const activeTabBtn = navBar.querySelector<HTMLButtonElement>(
      `[data-element-key="${selectedElement}"]`,
    );
    if (activeTabBtn) {
      activeTabBtn.setText(
        locked
          ? `${BLOCK_ELEMENT_SHORT_LABELS[selectedElement]} (注释)`
          : BLOCK_ELEMENT_SHORT_LABELS[selectedElement],
      );
    }
  };

  applyLockState(blockCfg.exportAsComment);

  commentCheckbox.addEventListener('change', () => {
    blockCfg.exportAsComment = commentCheckbox.checked;
    applyLockState(blockCfg.exportAsComment);
    callbacks.onMutatePreset(true);
  });
}
