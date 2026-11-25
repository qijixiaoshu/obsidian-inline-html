import { MarkdownView, Notice, Plugin, TFile } from 'obsidian';
import type { InlineHtmlSettings, StylePreset } from './types/settings';
import {
  createDefaultPreset,
  createDefaultSettings,
  normalizeSettings,
} from './defaults/defaultPreset';
import { convertMarkdownToInlineHtml } from './renderer/documentWrapper';
import { exportHtmlFile } from './exporter/fileExporter';
import { InlineHtmlSettingTab } from './ui/settingsTab';

export default class InlineHtmlPlugin extends Plugin {
  settings: InlineHtmlSettings = createDefaultSettings();

  async onload(): Promise<void> {
    await this.loadSettings();

    // 1. 文件资源管理器右键菜单：显示“导出为 HTML”
    this.registerEvent(
      this.app.workspace.on('file-menu', (menu, file) => {
        if (file instanceof TFile && file.extension.toLowerCase() === 'md') {
          menu.addItem((item) => {
            item
              .setTitle('导出为 HTML')
              .setIcon('file-code')
              .onClick(() => {
                void this.handleExportMarkdownFile(file);
              });
          });
        }
      }),
    );

    // 2. 编辑器正文右键菜单：显示“导出为 HTML”，优先读取当前编辑器最新未保存缓存
    this.registerEvent(
      this.app.workspace.on('editor-menu', (menu, editor, info) => {
        const file = info.file;
        if (file instanceof TFile && file.extension.toLowerCase() === 'md') {
          menu.addItem((item) => {
            item
              .setTitle('导出为 HTML')
              .setIcon('file-code')
              .onClick(() => {
                void this.handleExportMarkdownFile(file, editor.getValue());
              });
          });
        }
      }),
    );

    // 3. 命令面板辅助入口（便于用户绑定快捷键）
    this.addCommand({
      id: 'export-current-note-to-html',
      name: '导出当前笔记为 HTML',
      checkCallback: (checking: boolean) => {
        const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
        const file = activeView?.file;
        if (!file || file.extension.toLowerCase() !== 'md') {
          return false;
        }
        if (!checking) {
          void this.handleExportMarkdownFile(file, activeView.editor.getValue());
        }
        return true;
      },
    });

    // 4. 挂载插件设置页
    this.addSettingTab(new InlineHtmlSettingTab(this.app, this));
  }

  async loadSettings(): Promise<void> {
    const raw = await this.loadData();
    this.settings = normalizeSettings(raw);
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }

  getActivePreset(): StylePreset {
    const found = this.settings.presets.find(
      (p) => p.id === this.settings.activePresetId,
    );
    if (found) return found;
    if (this.settings.presets.length > 0) {
      this.settings.activePresetId = this.settings.presets[0].id;
      return this.settings.presets[0];
    }
    const fallback = createDefaultPreset();
    this.settings.presets = [fallback];
    this.settings.activePresetId = fallback.id;
    return fallback;
  }

  private async readLatestMarkdownContent(
    file: TFile,
    editorOverride?: string,
  ): Promise<string> {
    if (typeof editorOverride === 'string') {
      return editorOverride;
    }
    // 若该文件正处于打开的 Markdown 视图中，优先取编辑器缓存
    const leaves = this.app.workspace.getLeavesOfType('markdown');
    for (const leaf of leaves) {
      const view = leaf.view;
      if (view instanceof MarkdownView && view.file?.path === file.path) {
        return view.editor.getValue();
      }
    }
    return this.app.vault.read(file);
  }

  async handleExportMarkdownFile(
    file: TFile,
    editorContentOverride?: string,
  ): Promise<void> {
    try {
      const preset = this.getActivePreset();
      const markdown = await this.readLatestMarkdownContent(
        file,
        editorContentOverride,
      );
      const { fullHtml, warnings } = convertMarkdownToInlineHtml(
        markdown,
        preset,
        file.basename,
      );

      const exportRes = await exportHtmlFile({
        sourceVaultPath: file.path,
        sourceBaseName: file.basename,
        htmlContent: fullHtml,
        settings: this.settings,
        vaultAdapter: this.app.vault.adapter,
      });

      const warnDetails: string[] = [];
      if (warnings.undefinedVariables.length > 0) {
        warnDetails.push(
          `含 ${warnings.undefinedVariables.length} 个未定义变量`,
        );
      }
      if (warnings.unadaptedCount > 0) {
        warnDetails.push(`${warnings.unadaptedCount} 处未适配语法已注释保留`);
      }

      if (warnDetails.length > 0) {
        new Notice(
          `⚠️ 导出完成（${warnDetails.join(' / ')}）\n预设：${preset.name}\n路径：${exportRes.outputPath}`,
          6500,
        );
      } else {
        new Notice(
          `✅ Inline HTML 导出成功（预设：${preset.name}）\n路径：${exportRes.outputPath}`,
          4500,
        );
      }
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      new Notice(`❌ 导出失败：${reason}`, 6500);
    }
  }
}
