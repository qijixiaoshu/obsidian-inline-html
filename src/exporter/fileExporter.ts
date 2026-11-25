import * as path from 'node:path';
import * as fs from 'node:fs/promises';
import type { DataAdapter } from 'obsidian';
import type { InlineHtmlSettings } from '../types/settings';

export interface FileExportContext {
  /** 源 Markdown 文件在 Vault 内的相对路径（如 "文章/推文.md"） */
  sourceVaultPath: string;
  /** 不含扩展名的笔记文件名（如 "推文"） */
  sourceBaseName: string;
  /** 要写入的完整 UTF-8 HTML 文本 */
  htmlContent: string;
  /** 插件导出位置配置 */
  settings: Pick<InlineHtmlSettings, 'exportLocationMode' | 'customExportDir'>;
  /** Obsidian Vault 数据适配器 */
  vaultAdapter: Pick<DataAdapter, 'exists' | 'mkdir' | 'write'>;
}

export interface FileExportResult {
  /** 最终写入的目标路径展示字符串 */
  outputPath: string;
  /** 是否写入在 Vault 内部 */
  isInsideVault: boolean;
}

/**
 * 判断路径是否为操作系统绝对路径（兼容 Windows 盘符/UNC 与 POSIX 根路径）
 */
export function isSystemAbsolutePath(targetPath: string): boolean {
  const trimmed = targetPath.trim();
  if (!trimmed) return false;
  return (
    /^[a-zA-Z]:[\\/]/.test(trimmed) ||
    trimmed.startsWith('\\\\') ||
    trimmed.startsWith('/')
  );
}

/**
 * 规范化 Vault 内部相对路径（统一正斜杠、去除首尾多余斜杠）
 */
export function normalizeVaultRelativeDir(rawDir: string): string {
  return rawDir
    .trim()
    .replace(/\\/g, '/')
    .replace(/^\/+|\/+$/g, '');
}

/**
 * 递归创建 Vault 内部目录（若尚不存在）
 */
export async function ensureVaultDirectoryExists(
  adapter: Pick<DataAdapter, 'exists' | 'mkdir'>,
  vaultDir: string,
): Promise<void> {
  const normalized = normalizeVaultRelativeDir(vaultDir);
  if (!normalized) return;

  const segments = normalized.split('/').filter(Boolean);
  let current = '';
  for (const seg of segments) {
    current = current ? `${current}/${seg}` : seg;
    const exists = await adapter.exists(current);
    if (!exists) {
      await adapter.mkdir(current);
    }
  }
}

/**
 * 解析目标输出路径并直接覆盖写入同名 .html 文件（不自动追加 (1)/(2) 编号）
 */
export async function exportHtmlFile(
  ctx: FileExportContext,
): Promise<FileExportResult> {
  const fileName = `${ctx.sourceBaseName}.html`;

  if (ctx.settings.exportLocationMode === 'same-folder') {
    const normalizedSource = ctx.sourceVaultPath.replace(/\\/g, '/');
    const lastSlash = normalizedSource.lastIndexOf('/');
    const parentDir = lastSlash >= 0 ? normalizedSource.slice(0, lastSlash) : '';
    const targetVaultPath = parentDir ? `${parentDir}/${fileName}` : fileName;

    if (parentDir) {
      await ensureVaultDirectoryExists(ctx.vaultAdapter, parentDir);
    }
    // DataAdapter.write 默认直接覆盖已有同名文件
    await ctx.vaultAdapter.write(targetVaultPath, ctx.htmlContent);

    return {
      outputPath: targetVaultPath,
      isInsideVault: true,
    };
  }

  // custom-folder 统一导出目录模式
  const rawCustomDir = ctx.settings.customExportDir.trim();
  if (!rawCustomDir) {
    throw new Error('未填写统一导出目录路径，请在 Inline HTML 插件设置中配置路径。');
  }

  if (isSystemAbsolutePath(rawCustomDir)) {
    await fs.mkdir(rawCustomDir, { recursive: true });
    const fullTargetPath = path.join(rawCustomDir, fileName);
    await fs.writeFile(fullTargetPath, ctx.htmlContent, 'utf8');
    return {
      outputPath: fullTargetPath,
      isInsideVault: false,
    };
  }

  // Vault 内部相对路径（如 "Exports/HTML"）
  const vaultRelDir = normalizeVaultRelativeDir(rawCustomDir);
  if (vaultRelDir) {
    await ensureVaultDirectoryExists(ctx.vaultAdapter, vaultRelDir);
  }
  const targetVaultPath = vaultRelDir ? `${vaultRelDir}/${fileName}` : fileName;
  await ctx.vaultAdapter.write(targetVaultPath, ctx.htmlContent);

  return {
    outputPath: targetVaultPath,
    isInsideVault: true,
  };
}
