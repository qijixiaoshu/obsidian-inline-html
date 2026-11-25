import { App, Notice, PluginSettingTab } from 'obsidian';
import type InlineHtmlPlugin from '../main';
import type { BlockElementType, StylePreset } from '../types/settings';
import {
  clonePreset,
  createDefaultPreset,
  deduplicatePresetName,
  generateUniqueId,
  parseAndValidatePresetJson,
  serializePresetToJson,
} from '../defaults/defaultPreset';
import { renderPresetBar, type PresetBarController } from './presetBar';
import { renderVariableTable } from './variableTable';
import { renderElementEditor } from './elementEditor';
import { createLivePreview, type LivePreviewController } from './livePreview';
import {
  ConfirmDeletePresetModal,
  PresetNameModal,
  UnsavedPresetSwitchModal,
} from './modals';

export class InlineHtmlSettingTab extends PluginSettingTab {
  private readonly plugin: InlineHtmlPlugin;
  private selectedElement: BlockElementType = 'paragraph';
  private draftPreset: StylePreset;
  private isDirty = false;
  private presetBarCtrl: PresetBarController | null = null;
  private previewCtrl: LivePreviewController | null = null;

  constructor(app: App, plugin: InlineHtmlPlugin) {
    super(app, plugin);
    this.plugin = plugin;
    this.draftPreset = clonePreset(this.plugin.getActivePreset());
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.addClass('inline-html-settings');

    // 重新同步当前激活预设（若当前没有未保存草稿）
    if (!this.isDirty) {
      this.draftPreset = clonePreset(this.plugin.getActivePreset());
    }

    const pageHeader = containerEl.createDiv({ cls: 'inline-html-page-header' });
    pageHeader.createEl('h2', { text: 'Inline HTML 设置' });
    pageHeader.createEl('p', {
      cls: 'inline-html-page-desc',
      text: '按自定义内联 CSS 与样式预设将 Markdown 导出为完整 HTML 文档。',
    });

    // 1. 导出路径设置卡片（全局立即持久化）
    this.renderExportLocationCard(containerEl);

    // 2. 预设管理卡片
    const presetContainer = containerEl.createDiv();
    // 3. 变量表卡片
    const variableContainer = containerEl.createDiv();
    // 4. 下方双栏核心工作台（左：12类元素编辑 | 右：实时预览）
    const workbench = containerEl.createDiv({ cls: 'inline-html-workbench' });
    const editorCol = workbench.createDiv({ cls: 'inline-html-workbench-left' });
    const previewCol = workbench.createDiv({ cls: 'inline-html-workbench-right' });

    const mountAllPresetViews = (): void => {
      this.presetBarCtrl = renderPresetBar(
        presetContainer,
        this.plugin.settings.presets,
        this.plugin.settings.activePresetId,
        this.isDirty,
        {
          onSelectPreset: (nextId, resetSelect) => {
            this.guardUnsavedBeforeAction(
              () => {
                this.plugin.settings.activePresetId = nextId;
                void this.plugin.saveSettings();
                this.draftPreset = clonePreset(this.plugin.getActivePreset());
                this.isDirty = false;
                mountAllPresetViews();
              },
              () => resetSelect(),
            );
          },
          onSavePreset: () => {
            void this.commitDraftPreset();
          },
          onCreatePreset: () => {
            this.guardUnsavedBeforeAction(() => {
              const existingNames = this.plugin.settings.presets.map((p) => p.name);
              new PresetNameModal(this.app, {
                title: '新建样式预设',
                initialName: deduplicatePresetName('新样式预设', existingNames, '新建'),
                existingNames,
                onSubmit: (name) => {
                  const fresh = createDefaultPreset();
                  fresh.id = generateUniqueId('preset');
                  fresh.name = name;
                  this.plugin.settings.presets.push(fresh);
                  this.plugin.settings.activePresetId = fresh.id;
                  void this.plugin.saveSettings();
                  this.draftPreset = clonePreset(fresh);
                  this.isDirty = false;
                  mountAllPresetViews();
                  new Notice(`✅ 已新建并切换至预设「${name}」`);
                },
              }).open();
            });
          },
          onDuplicatePreset: () => {
            const existingNames = this.plugin.settings.presets.map((p) => p.name);
            const copied = clonePreset(this.draftPreset);
            copied.id = generateUniqueId('preset');
            copied.name = deduplicatePresetName(
              `${this.draftPreset.name}`,
              existingNames,
              '副本',
            );
            this.plugin.settings.presets.push(copied);
            this.plugin.settings.activePresetId = copied.id;
            void this.plugin.saveSettings();
            this.draftPreset = clonePreset(copied);
            this.isDirty = false;
            mountAllPresetViews();
            new Notice(`✅ 已复制生成预设「${copied.name}」`);
          },
          onRenamePreset: () => {
            const existingNames = this.plugin.settings.presets.map((p) => p.name);
            new PresetNameModal(this.app, {
              title: '重命名当前预设',
              initialName: this.draftPreset.name,
              existingNames,
              allowSameInitial: true,
              onSubmit: (newName) => {
                this.draftPreset.name = newName;
                const savedTarget = this.plugin.settings.presets.find(
                  (p) => p.id === this.draftPreset.id,
                );
                if (savedTarget) {
                  savedTarget.name = newName;
                  void this.plugin.saveSettings();
                }
                mountAllPresetViews();
                new Notice(`✅ 预设已重命名为「${newName}」`);
              },
            }).open();
          },
          onDeletePreset: () => {
            if (this.plugin.settings.presets.length <= 1) {
              new Notice('至少需要保留 1 套预设，无法删除。');
              return;
            }
            new ConfirmDeletePresetModal(
              this.app,
              this.draftPreset.name,
              () => {
                const deletedName = this.draftPreset.name;
                this.plugin.settings.presets = this.plugin.settings.presets.filter(
                  (p) => p.id !== this.draftPreset.id,
                );
                this.plugin.settings.activePresetId =
                  this.plugin.settings.presets[0].id;
                void this.plugin.saveSettings();
                this.draftPreset = clonePreset(this.plugin.getActivePreset());
                this.isDirty = false;
                mountAllPresetViews();
                new Notice(`🗑️ 已删除预设「${deletedName}」`);
              },
            ).open();
          },
          onImportPresetFile: (file) => {
            void this.handleImportPresetFile(file, mountAllPresetViews);
          },
          onExportPresetJson: () => {
            this.downloadDraftPresetJson();
          },
        },
      );

      renderVariableTable(variableContainer, this.draftPreset.variables, {
        onMutateVariables: () => {
          this.markDirty();
          this.previewCtrl?.scheduleRefresh(this.draftPreset, this.selectedElement);
        },
      });

      const mountEditorOnly = (): void => {
        renderElementEditor(editorCol, this.draftPreset, this.selectedElement, {
          onSelectElement: (nextElem) => {
            this.selectedElement = nextElem;
            mountEditorOnly();
            this.previewCtrl?.refreshNow(this.draftPreset, this.selectedElement);
          },
          onMutatePreset: (immediate) => {
            this.markDirty();
            if (immediate) {
              this.previewCtrl?.refreshNow(this.draftPreset, this.selectedElement);
            } else {
              this.previewCtrl?.scheduleRefresh(
                this.draftPreset,
                this.selectedElement,
              );
            }
          },
        });
      };

      mountEditorOnly();

      this.previewCtrl?.destroy();
      this.previewCtrl = createLivePreview(
        previewCol,
        this.draftPreset,
        this.selectedElement,
      );
    };

    mountAllPresetViews();
  }

  hide(): void {
    this.previewCtrl?.destroy();
    this.previewCtrl = null;
  }

  private markDirty(): void {
    this.isDirty = true;
    this.presetBarCtrl?.updateDirtyIndicator(true, this.draftPreset.name);
  }

  private async commitDraftPreset(silent = false): Promise<void> {
    const idx = this.plugin.settings.presets.findIndex(
      (p) => p.id === this.draftPreset.id,
    );
    if (idx >= 0) {
      this.plugin.settings.presets[idx] = clonePreset(this.draftPreset);
    } else {
      this.plugin.settings.presets.push(clonePreset(this.draftPreset));
      this.plugin.settings.activePresetId = this.draftPreset.id;
    }
    await this.plugin.saveSettings();
    this.isDirty = false;
    this.presetBarCtrl?.updateDirtyIndicator(false, this.draftPreset.name);
    if (!silent) {
      new Notice(`✅ 已保存预设「${this.draftPreset.name}」`);
    }
  }

  private guardUnsavedBeforeAction(
    proceed: () => void,
    onCancel?: () => void,
  ): void {
    if (!this.isDirty) {
      proceed();
      return;
    }

    new UnsavedPresetSwitchModal(this.app, this.draftPreset.name, (choice) => {
      if (choice === 'save') {
        void this.commitDraftPreset(true).then(() => {
          new Notice(`✅ 已保存预设「${this.draftPreset.name}」`);
          proceed();
        });
      } else if (choice === 'discard') {
        this.isDirty = false;
        proceed();
      } else {
        onCancel?.();
      }
    }).open();
  }

  private async handleImportPresetFile(
    file: File,
    remount: () => void,
  ): Promise<void> {
    let text: string;
    try {
      text = await file.text();
    } catch {
      new Notice('❌ 读取 JSON 文件失败。');
      return;
    }

    let importedPreset: StylePreset;
    try {
      const existingNames = this.plugin.settings.presets.map((p) => p.name);
      importedPreset = parseAndValidatePresetJson(text, existingNames);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      new Notice(`❌ 导入预设失败：${msg}`);
      return;
    }

    this.guardUnsavedBeforeAction(() => {
      this.plugin.settings.presets.push(importedPreset);
      this.plugin.settings.activePresetId = importedPreset.id;
      void this.plugin.saveSettings();
      this.draftPreset = clonePreset(importedPreset);
      this.isDirty = false;
      remount();
      new Notice(`✅ 成功导入并激活预设「${importedPreset.name}」`);
    });
  }

  private downloadDraftPresetJson(): void {
    const jsonContent = serializePresetToJson(this.draftPreset);
    const blob = new Blob([jsonContent], {
      type: 'application/json;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const safeFileName = this.draftPreset.name.replace(/[\\/:*?"<>|]/g, '_');
    a.href = url;
    a.download = `${safeFileName || 'preset'}.inline-html-preset.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    new Notice(`✅ 已导出预设 JSON：「${this.draftPreset.name}」`);
  }

  private renderExportLocationCard(parent: HTMLElement): void {
    const card = parent.createDiv({
      cls: 'inline-html-card inline-html-export-card',
    });
    const header = card.createDiv({ cls: 'inline-html-card-header' });
    const titleWrap = header.createDiv({ cls: 'inline-html-card-title-wrap' });
    titleWrap.createSpan({ cls: 'inline-html-card-title', text: '导出设置' });
    titleWrap.createSpan({
      cls: 'inline-html-card-subtitle',
      text: '右键导出同名 HTML 文件时将直接覆盖原文件',
    });

    const modeRow = card.createDiv({ cls: 'inline-html-export-mode-row' });
    modeRow.createSpan({ cls: 'inline-html-field-label', text: '导出位置：' });

    const sameLabel = modeRow.createEl('label', { cls: 'inline-html-radio-label' });
    const sameRadio = sameLabel.createEl('input', {
      type: 'radio',
    });
    sameRadio.name = 'inline-html-export-mode';
    sameRadio.checked = this.plugin.settings.exportLocationMode === 'same-folder';
    sameLabel.createSpan({ text: '笔记同级目录' });

    const customLabel = modeRow.createEl('label', {
      cls: 'inline-html-radio-label',
    });
    const customRadio = customLabel.createEl('input', {
      type: 'radio',
    });
    customRadio.name = 'inline-html-export-mode';
    customRadio.checked =
      this.plugin.settings.exportLocationMode === 'custom-folder';
    customLabel.createSpan({ text: '指定统一导出目录' });

    const pathRow = card.createDiv({ cls: 'inline-html-export-path-row' });
    pathRow.createSpan({ cls: 'inline-html-field-label', text: '统一导出路径：' });
    const pathInput = pathRow.createEl('input', {
      type: 'text',
      cls: 'inline-html-export-path-input',
      value: this.plugin.settings.customExportDir,
      placeholder: '支持 Vault 相对路径或本机绝对路径',
    });

    const syncPathInputState = (): void => {
      const isCustom =
        this.plugin.settings.exportLocationMode === 'custom-folder';
      pathInput.disabled = !isCustom;
      pathRow.toggleClass('is-disabled', !isCustom);
    };
    syncPathInputState();

    sameRadio.addEventListener('change', () => {
      if (sameRadio.checked) {
        this.plugin.settings.exportLocationMode = 'same-folder';
        syncPathInputState();
        void this.plugin.saveSettings();
      }
    });

    customRadio.addEventListener('change', () => {
      if (customRadio.checked) {
        this.plugin.settings.exportLocationMode = 'custom-folder';
        syncPathInputState();
        void this.plugin.saveSettings();
        pathInput.focus();
      }
    });

    pathInput.addEventListener('change', () => {
      this.plugin.settings.customExportDir = pathInput.value.trim();
      pathInput.value = this.plugin.settings.customExportDir;
      void this.plugin.saveSettings();
    });
  }
}
