import type { StylePreset } from '../types/settings';

export interface PresetBarCallbacks {
  onSelectPreset: (presetId: string, resetSelectEl: () => void) => void;
  onSavePreset: () => void;
  onCreatePreset: () => void;
  onDuplicatePreset: () => void;
  onRenamePreset: () => void;
  onDeletePreset: () => void;
  onImportPresetFile: (file: File) => void;
  onExportPresetJson: () => void;
}

export interface PresetBarController {
  updateDirtyIndicator: (isDirty: boolean, currentDraftName: string) => void;
}

export function renderPresetBar(
  container: HTMLElement,
  presets: readonly StylePreset[],
  activePresetId: string,
  isDirty: boolean,
  callbacks: PresetBarCallbacks,
): PresetBarController {
  container.empty();
  container.addClass('inline-html-card', 'inline-html-preset-bar');

  const headerRow = container.createDiv({ cls: 'inline-html-card-header' });
  const titleWrap = headerRow.createDiv({ cls: 'inline-html-card-title-wrap' });
  titleWrap.createSpan({ cls: 'inline-html-card-title', text: '样式预设管理' });

  const dirtyBadge = titleWrap.createSpan({
    cls: `inline-html-dirty-badge ${isDirty ? '' : 'is-hidden'}`,
    text: '● 未保存修改',
  });

  const controlsStack = container.createDiv({ cls: 'inline-html-preset-controls' });

  // 第一行：左侧【当前预设： + 下拉菜单 + 保存】，右侧对齐【导入 JSON + 导出 JSON】（窄屏时作为整体一组换行）
  const topRow = controlsStack.createDiv({ cls: 'inline-html-preset-top-row' });

  const mainGroup = topRow.createDiv({ cls: 'inline-html-preset-main-group' });
  mainGroup.createSpan({ cls: 'inline-html-field-label', text: '当前预设：' });

  const selectEl = mainGroup.createEl('select', {
    cls: 'dropdown inline-html-preset-select',
  });
  for (const p of presets) {
    const label = p.id === activePresetId && isDirty ? `${p.name} *` : p.name;
    const opt = selectEl.createEl('option', { value: p.id, text: label });
    if (p.id === activePresetId) {
      opt.selected = true;
    }
  }

  selectEl.addEventListener('change', () => {
    const nextId = selectEl.value;
    if (nextId === activePresetId) return;
    callbacks.onSelectPreset(nextId, () => {
      selectEl.value = activePresetId;
    });
  });

  const saveBtn = mainGroup.createEl('button', {
    text: '保存',
    cls: isDirty ? 'mod-cta' : '',
  });
  saveBtn.title = '将当前预设的所有修改写入配置文件';
  saveBtn.addEventListener('click', () => callbacks.onSavePreset());

  // 右侧：导入 JSON / 导出 JSON（文字 + 下划线样式，保持为不可拆分的一组）
  const ioGroup = topRow.createDiv({ cls: 'inline-html-preset-io-group' });

  const fileInput = ioGroup.createEl('input', {
    type: 'file',
    cls: 'is-hidden',
  });
  fileInput.accept = '.json,application/json';
  fileInput.addEventListener('change', () => {
    const file = fileInput.files?.[0];
    if (file) {
      callbacks.onImportPresetFile(file);
    }
    fileInput.value = '';
  });

  const importLink = ioGroup.createSpan({
    text: '导入 JSON',
    cls: 'inline-html-text-link',
  });
  importLink.setAttr('role', 'button');
  importLink.tabIndex = 0;
  importLink.addEventListener('click', () => fileInput.click());
  importLink.addEventListener('keydown', (evt: KeyboardEvent) => {
    if (evt.key === 'Enter' || evt.key === ' ') {
      evt.preventDefault();
      fileInput.click();
    }
  });

  const exportLink = ioGroup.createSpan({
    text: '导出 JSON',
    cls: 'inline-html-text-link',
  });
  exportLink.setAttr('role', 'button');
  exportLink.tabIndex = 0;
  exportLink.addEventListener('click', () => callbacks.onExportPresetJson());
  exportLink.addEventListener('keydown', (evt: KeyboardEvent) => {
    if (evt.key === 'Enter' || evt.key === ' ') {
      evt.preventDefault();
      callbacks.onExportPresetJson();
    }
  });

  // 第二行：【+新建】【复制】【重命名】【删除】
  const row2 = controlsStack.createDiv({ cls: 'inline-html-preset-row' });

  const createBtn = row2.createEl('button', { text: '+新建' });
  createBtn.addEventListener('click', () => callbacks.onCreatePreset());

  const dupBtn = row2.createEl('button', { text: '复制' });
  dupBtn.addEventListener('click', () => callbacks.onDuplicatePreset());

  const renameBtn = row2.createEl('button', { text: '重命名' });
  renameBtn.addEventListener('click', () => callbacks.onRenamePreset());

  const deleteBtn = row2.createEl('button', {
    text: '删除',
    cls: 'inline-html-btn-danger',
  });
  if (presets.length <= 1) {
    deleteBtn.disabled = true;
    deleteBtn.title = '至少需要保留 1 套样式预设';
  }
  deleteBtn.addEventListener('click', () => {
    if (presets.length > 1) {
      callbacks.onDeletePreset();
    }
  });

  return {
    updateDirtyIndicator(nextDirty: boolean, currentDraftName: string) {
      if (nextDirty) {
        dirtyBadge.removeClass('is-hidden');
        saveBtn.addClass('mod-cta');
      } else {
        dirtyBadge.addClass('is-hidden');
        saveBtn.removeClass('mod-cta');
      }
      for (let i = 0; i < selectEl.options.length; i++) {
        const opt = selectEl.options[i];
        if (opt.value === activePresetId) {
          opt.text = nextDirty ? `${currentDraftName} *` : currentDraftName;
        }
      }
    },
  };
}
