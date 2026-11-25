# Inline HTML

Export Markdown notes as standalone HTML documents with customizable inline CSS styles and reusable presets, tailored for rich-text publishing platforms such as WeChat Official Accounts (微信公众号).

---

## English Overview

**Inline HTML** converts your Markdown notes (including extended syntax such as `==highlight==` and task lists) into clean, self-contained HTML documents using `<section>`, `<p>`, and single-layer `<span>` inline styles.

### Key Features

- **Style Presets & JSON Import/Export**: Create, duplicate, rename, and manage multiple style presets with unsaved-change protection, or share presets via `.inline-html-preset.json` files.
- **Reusable Style Variables**: Define global variables (e.g., `{主色调}`, `{正文色}`) with a built-in color picker and click-to-copy variable placeholders.
- **Granular Element & Inline CSS Controls**: Customize `<section>`, `<p>`, and inline `<span>` styles (`bold`, `italic`, `boldItalic`, `strikethrough`, `highlight`) for paragraphs, headings (`H1`–`H6`), unordered lists, ordered lists (13 numbering formats including Latin, Roman, Chinese numerals, and circled numbers), task lists, blockquotes, and dividers.
- **Shadow DOM Live Preview**: Inspect both isolated visual rendering and formatted HTML source output side by side in the plugin settings tab.
- **Flexible Export Destinations**: Export `.html` files directly alongside the source note inside your vault or to a unified custom directory (vault-relative or desktop OS absolute path).

> **Note (`isDesktopOnly: true`)**: Desktop-only because exporting to custom directories outside the vault utilizes Node.js `node:fs/promises` and `node:path`.

---

## 中文文档

**Inline HTML** 是一款面向排版发布工作流（如微信公众号等不支持外链样式表的富文本平台）的插件。它能够识别 Markdown 常用及扩展语法，按照你在设置工作台中自定义的内联 CSS 样式与预设方案，将笔记一键导出为结构干净的独立 `.html` 文档。

### 核心功能

1. **多套样式预设管理与分享**
   - 支持新建、复制、重命名、删除多套样式预设，内置未保存修改提醒与切换保护弹窗。
   - 支持一键**导入 / 导出 JSON**（`.inline-html-preset.json`），方便在不同知识库或团队成员之间复用排版规范。
2. **预设级全局样式变量**
   - 支持自定义样式变量（例如 `{主色调}`、`{标题色}`、`{正文色}`），在任意 CSS 输入框或分割线颜色中引用即可全局生效。
   - 内置可视化取色器（自动识别 HEX 色值）与点击复制 `{变量名}` 标签功能，并对未定义变量给出醒目提示。
3. **精细化元素与行内样式配置**
   - **覆盖 12 类块级元素**：正文段落、一级至六级标题（`H1`–`H6`）、无序列表、有序列表、任务列表、引用块、分割线。
   - **三层纯净标签结构**：每个文本块采用 `<section style="..."><p style="...">...</p></section>` 结构，行内修饰自动拍平合并为单层 `<span style="...">`，避免嵌套样式冲突。
   - **5 类行内样式与叠加合并**：支持为每个块级元素独立设置**粗体**、**斜体**、**粗斜体**、**删除线**、**高亮（`==...==`）**的内联 CSS，同一处文字叠加多种修饰时自动按优先级合并样式。
   - **丰富的列表前缀与编号方案**：无序列表支持自定义项目符号；任务列表支持自定义未完成/已完成符号；有序列表内置 **13 种编号样式**（阿拉伯数字、前导零、大小写拉丁字母、大小写罗马数字、`一/二/三`、`壹/贰/叁`、带圈数字、反白带圈数字、括号字母、数字键帽 Emoji）及自定义后缀。
   - **输出控制与安全降级**：支持将指定元素单独设为「转为 HTML 注释」并配置源码上下空行数；对 Frontmatter、Callout、代码块、表格、双链 `[[...]]`、行内公式等未适配语法自动降级或附带 HTML 注释提示。
4. **双栏工作台与实时预览**
   - 设置页采用左栏编辑、右栏实时预览布局，基于 Shadow DOM 隔离宿主的界面样式，同时实时展示格式化后的 HTML 源代码。
5. **灵活的导出路径**
   - 支持导出至**笔记同级目录**，或**指定统一导出目录**（同时支持库内相对路径与电脑本机绝对路径；同名 `.html` 文件导出时自动覆盖更新）。

---

### 使用方法

你可以通过以下任意一种方式将 `.md` 笔记导出为 HTML：

1. **文件列表右键菜单**：在左侧文件资源管理器中右键任意 Markdown 笔记，点击 **「导出为 HTML」**。
2. **编辑器正文右键菜单**：在正在编辑的笔记正文中点击鼠标右键，选择 **「导出为 HTML」**（会优先读取编辑器中尚未落盘的最新内容）。
3. **命令面板 / 快捷键**：按 `Ctrl + P`（macOS 为 `Cmd + P`）打开命令面板，执行 **「Inline HTML: 导出当前笔记为 HTML」**，也可在快捷键设置中为其绑定专属快捷键。

导出完成后，可在浏览器中打开生成的 `.html` 文件，全选（`Ctrl/Cmd + A`）并复制到微信公众号后台或其他富文本编辑器中。

---

### 安装方式

#### 方式一：社区插件市场安装（审核通过后）
1. 打开 **设置 → 第三方插件**，关闭安全模式。
2. 点击 **浏览**，搜索 `Inline HTML`，点击安装并启用。

#### 方式二：通过 BRAT 插件安装
1. 安装并启用 **BRAT** 插件。
2. 选择 **Add a beta plugin**，填入本仓库的 GitHub 地址并启用。

#### 方式三：手动安装
1. 前往本仓库的 **Releases** 页面，下载最新版本的 `main.js`、`manifest.json`、`styles.css` 三个文件。
2. 在你的知识库目录 `.obsidian/plugins/` 下新建文件夹 `inline-html`，将上述 3 个文件放入其中。
3. 重载插件并在 **设置 → 第三方插件** 中启用 **Inline HTML**。

---

### 开发与构建 (Development)

```bash
# 安装依赖
npm install

# 运行单元测试
npm test

# 开发监听模式
npm run dev

# 类型检查与生产环境打包（生成压缩后的 main.js）
npm run build
```

---

## License

Released under the [MIT License](LICENSE). Copyright © 2026 qijixiaoshu.
