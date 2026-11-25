import { Notice } from 'obsidian';
import type { StyleVariable } from '../types/settings';
import { generateUniqueId } from '../defaults/defaultPreset';
import { isValidHexColor, toSixDigitHex } from '../style/variableResolver';

export interface VariableTableCallbacks {
  /** 变量发生变更（不重建整表，保证中文输入法不断焦，仅触发草稿脏状态与防抖预览） */
  onMutateVariables: () => void;
}

export function renderVariableTable(
  container: HTMLElement,
  variables: StyleVariable[],
  callbacks: VariableTableCallbacks,
): void {
  container.empty();
  container.addClass('inline-html-card', 'inline-html-variable-card');

  const header = container.createDiv({ cls: 'inline-html-card-header' });
  const titleWrap = header.createDiv({ cls: 'inline-html-card-title-wrap' });
  titleWrap.createSpan({
    cls: 'inline-html-card-title',
    text: '当前预设样式变量',
  });
  titleWrap.createSpan({
    cls: 'inline-html-card-subtitle',
    text: '在下方任意 CSS 输入框或分割线颜色中填写 {变量名} 即可全局复用，点击引用标签可复制',
  });

  const addBtn = header.createEl('button', {
    text: '+ 添加变量',
    cls: 'inline-html-btn-sm',
  });

  const tableBody = container.createDiv({ cls: 'inline-html-var-list' });

  const refreshDuplicateHighlights = (): void => {
    const counts = new Map<string, number>();
    for (const v of variables) {
      const k = v.name.trim();
      if (k) counts.set(k, (counts.get(k) ?? 0) + 1);
    }
    const rows = tableBody.querySelectorAll<HTMLElement>('.inline-html-var-row');
    rows.forEach((rowEl, idx) => {
      const v = variables[idx];
      const nameInput = rowEl.querySelector<HTMLInputElement>(
        '.inline-html-var-name-input',
      );
      if (!v || !nameInput) return;
      const k = v.name.trim();
      const invalid = !k || (counts.get(k) ?? 0) > 1;
      nameInput.toggleClass('is-invalid', invalid);
      nameInput.title = !k
        ? '变量名不能为空'
        : (counts.get(k) ?? 0) > 1
          ? `变量名「${k}」重复，同预设内变量名须唯一`
          : '';
    });
  };

  const renderRows = (): void => {
    tableBody.empty();

    if (variables.length === 0) {
      tableBody.createDiv({
        cls: 'inline-html-empty-hint',
        text: '当前预设暂无样式变量，点击右上角「+ 添加变量」可新增（如 主色调 = #1A73E8）。',
      });
      return;
    }

    const headRow = tableBody.createDiv({ cls: 'inline-html-var-head' });
    headRow.createSpan({ text: '变量名（不含 {}）' });
    headRow.createSpan({ text: '引用占位符' });
    headRow.createSpan({ text: '变量值（色值 / 字号 / 字体等）' });
    headRow.createSpan({ text: '取色辅助' });
    headRow.createSpan({ text: '操作' });

    variables.forEach((item, index) => {
      const row = tableBody.createDiv({ cls: 'inline-html-var-row' });

      // 1. 变量名输入框
      const nameInput = row.createEl('input', {
        type: 'text',
        cls: 'inline-html-var-name-input',
        value: item.name,
        placeholder: '如：主色调',
      });

      // 2. 引用示例徽章（点击可复制）
      const tokenText = () => (item.name.trim() ? `{${item.name.trim()}}` : '{未命名}');
      const tokenBadge = row.createEl('code', {
        cls: 'inline-html-var-badge',
        text: tokenText(),
      });
      tokenBadge.title = '点击复制占位符';
      tokenBadge.addEventListener('click', () => {
        if (!item.name.trim()) return;
        const placeholder = `{${item.name.trim()}}`;
        void navigator.clipboard?.writeText(placeholder);
        new Notice(`已复制占位符：${placeholder}`);
      });

      // 3. 变量值输入框
      const valInput = row.createEl('input', {
        type: 'text',
        cls: 'inline-html-var-val-input',
        value: item.value,
        placeholder: '如：#1A73E8 或 15px',
      });

      // 4. 颜色辅助取色器（合法 3/6 位 HEX 时激活，否则显示非色值提示）
      const colorCell = row.createDiv({ cls: 'inline-html-var-color-cell' });
      const colorPicker = colorCell.createEl('input', {
        type: 'color',
        cls: 'inline-html-color-picker',
      });
      const nonColorHint = colorCell.createSpan({
        cls: 'inline-html-non-color-hint',
        text: '非色值',
      });

      const syncColorAssist = (): void => {
        if (isValidHexColor(item.value)) {
          colorPicker.value = toSixDigitHex(item.value);
          colorPicker.removeClass('is-hidden');
          nonColorHint.addClass('is-hidden');
        } else {
          colorPicker.addClass('is-hidden');
          nonColorHint.removeClass('is-hidden');
        }
      };
      syncColorAssist();

      nameInput.addEventListener('input', () => {
        const cleaned = nameInput.value.replace(/[{}]/g, '');
        if (cleaned !== nameInput.value) {
          nameInput.value = cleaned;
        }
        item.name = cleaned;
        tokenBadge.setText(tokenText());
        refreshDuplicateHighlights();
        callbacks.onMutateVariables();
      });

      valInput.addEventListener('input', () => {
        item.value = valInput.value;
        syncColorAssist();
        callbacks.onMutateVariables();
      });

      colorPicker.addEventListener('input', () => {
        const hex = colorPicker.value.toUpperCase();
        item.value = hex;
        valInput.value = hex;
        callbacks.onMutateVariables();
      });

      // 5. 删除按钮
      const delBtn = row.createEl('button', {
        text: '删除',
        cls: 'inline-html-btn-sm inline-html-btn-danger',
      });
      delBtn.addEventListener('click', () => {
        variables.splice(index, 1);
        renderRows();
        callbacks.onMutateVariables();
      });
    });

    refreshDuplicateHighlights();
  };

  addBtn.addEventListener('click', () => {
    let idx = variables.length + 1;
    const existing = new Set(variables.map((v) => v.name.trim()));
    while (existing.has(`变量${idx}`)) {
      idx++;
    }
    variables.push({
      id: generateUniqueId('var'),
      name: `变量${idx}`,
      value: '#1A73E8',
    });
    renderRows();
    callbacks.onMutateVariables();
  });

  renderRows();
}
