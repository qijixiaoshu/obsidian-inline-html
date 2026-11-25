import { App, Modal, Setting } from 'obsidian';

export class PresetNameModal extends Modal {
  private readonly modalTitle: string;
  private readonly initialName: string;
  private readonly existingNames: Set<string>;
  private readonly allowSameInitial: boolean;
  private readonly onSubmitName: (name: string) => void;

  constructor(
    app: App,
    options: {
      title: string;
      initialName?: string;
      existingNames: readonly string[];
      allowSameInitial?: boolean;
      onSubmit: (name: string) => void;
    },
  ) {
    super(app);
    this.modalTitle = options.title;
    this.initialName = options.initialName ?? '';
    this.existingNames = new Set(options.existingNames.map((n) => n.trim()));
    this.allowSameInitial = Boolean(options.allowSameInitial);
    this.onSubmitName = options.onSubmit;
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass('inline-html-modal');
    contentEl.createEl('h3', { text: this.modalTitle });

    let currentVal = this.initialName;
    const errorEl = contentEl.createDiv({
      cls: 'inline-html-modal-error is-hidden',
    });

    const trySubmit = (): void => {
      const trimmed = currentVal.trim();
      if (!trimmed) {
        errorEl.setText('预设名称不能为空。');
        errorEl.removeClass('is-hidden');
        return;
      }
      const isUnchanged =
        this.allowSameInitial && trimmed === this.initialName.trim();
      if (!isUnchanged && this.existingNames.has(trimmed)) {
        errorEl.setText(`已存在同名预设「${trimmed}」，请换一个名称。`);
        errorEl.removeClass('is-hidden');
        return;
      }
      this.close();
      this.onSubmitName(trimmed);
    };

    new Setting(contentEl).setName('预设名称').addText((text) => {
      text
        .setPlaceholder('例如：品牌推文风格')
        .setValue(this.initialName)
        .onChange((val) => {
          currentVal = val;
          errorEl.addClass('is-hidden');
        });
      text.inputEl.addEventListener('keydown', (evt: KeyboardEvent) => {
        if (evt.key === 'Enter') {
          evt.preventDefault();
          trySubmit();
        }
      });
      window.setTimeout(() => {
        text.inputEl.focus();
        text.inputEl.select();
      }, 20);
    });

    const footer = contentEl.createDiv({ cls: 'inline-html-modal-footer' });
    const cancelBtn = footer.createEl('button', { text: '取消' });
    cancelBtn.addEventListener('click', () => this.close());

    const confirmBtn = footer.createEl('button', {
      text: '确认',
      cls: 'mod-cta',
    });
    confirmBtn.addEventListener('click', () => trySubmit());
  }

  onClose(): void {
    this.contentEl.empty();
  }
}

export class ConfirmDeletePresetModal extends Modal {
  private readonly presetName: string;
  private readonly onConfirmDelete: () => void;

  constructor(app: App, presetName: string, onConfirm: () => void) {
    super(app);
    this.presetName = presetName;
    this.onConfirmDelete = onConfirm;
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass('inline-html-modal');
    contentEl.createEl('h3', { text: '确认删除样式预设' });
    contentEl.createEl('p', {
      text: `确定要删除预设「${this.presetName}」吗？此操作无法撤销。`,
    });

    const footer = contentEl.createDiv({ cls: 'inline-html-modal-footer' });
    const cancelBtn = footer.createEl('button', { text: '取消' });
    cancelBtn.addEventListener('click', () => this.close());

    const deleteBtn = footer.createEl('button', {
      text: '确认删除',
      cls: 'mod-warning',
    });
    deleteBtn.addEventListener('click', () => {
      this.close();
      this.onConfirmDelete();
    });
  }

  onClose(): void {
    this.contentEl.empty();
  }
}

export type UnsavedSwitchChoice = 'save' | 'discard' | 'cancel';

export class UnsavedPresetSwitchModal extends Modal {
  private readonly presetName: string;
  private readonly resolveChoice: (choice: UnsavedSwitchChoice) => void;
  private settled = false;

  constructor(
    app: App,
    presetName: string,
    onChoice: (choice: UnsavedSwitchChoice) => void,
  ) {
    super(app);
    this.presetName = presetName;
    this.resolveChoice = onChoice;
  }

  private finish(choice: UnsavedSwitchChoice): void {
    if (this.settled) return;
    this.settled = true;
    this.resolveChoice(choice);
    this.close();
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass('inline-html-modal');
    contentEl.createEl('h3', { text: '存在未保存的预设修改' });
    contentEl.createEl('p', {
      text: `当前预设「${this.presetName}」有尚未保存的修改，切换前希望如何处理？`,
    });

    const footer = contentEl.createDiv({ cls: 'inline-html-modal-footer' });

    const cancelBtn = footer.createEl('button', { text: '取消' });
    cancelBtn.addEventListener('click', () => this.finish('cancel'));

    const discardBtn = footer.createEl('button', {
      text: '放弃修改并切换',
      cls: 'mod-warning',
    });
    discardBtn.addEventListener('click', () => this.finish('discard'));

    const saveBtn = footer.createEl('button', {
      text: '保存并切换',
      cls: 'mod-cta',
    });
    saveBtn.addEventListener('click', () => this.finish('save'));
  }

  onClose(): void {
    this.contentEl.empty();
    if (!this.settled) {
      this.settled = true;
      this.resolveChoice('cancel');
    }
  }
}
