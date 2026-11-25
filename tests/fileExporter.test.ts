import * as os from 'node:os';
import * as path from 'node:path';
import * as fs from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { exportHtmlFile } from '../src/exporter/fileExporter';

function createMemoryVaultAdapter() {
  const files = new Map<string, string>();
  const dirs = new Set<string>();

  return {
    files,
    dirs,
    adapter: {
      async exists(p: string): Promise<boolean> {
        return dirs.has(p) || files.has(p);
      },
      async mkdir(p: string): Promise<void> {
        dirs.add(p);
      },
      async write(p: string, data: string): Promise<void> {
        files.set(p, data);
      },
    },
  };
}

describe('fileExporter (same-folder, custom-folder, and direct overwrite)', () => {
  it('TC-17: directly overwrites existing same-name .html file without generating (1) copies', async () => {
    const mem = createMemoryVaultAdapter();

    await exportHtmlFile({
      sourceVaultPath: '公众号/推文.md',
      sourceBaseName: '推文',
      htmlContent: '<html>v1</html>',
      settings: { exportLocationMode: 'same-folder', customExportDir: '' },
      vaultAdapter: mem.adapter,
    });

    await exportHtmlFile({
      sourceVaultPath: '公众号/推文.md',
      sourceBaseName: '推文',
      htmlContent: '<html>v2</html>',
      settings: { exportLocationMode: 'same-folder', customExportDir: '' },
      vaultAdapter: mem.adapter,
    });

    await exportHtmlFile({
      sourceVaultPath: '公众号/推文.md',
      sourceBaseName: '推文',
      htmlContent: '<html>v3-latest</html>',
      settings: { exportLocationMode: 'same-folder', customExportDir: '' },
      vaultAdapter: mem.adapter,
    });

    expect(Array.from(mem.files.keys())).toEqual(['公众号/推文.html']);
    expect(mem.files.get('公众号/推文.html')).toBe('<html>v3-latest</html>');
  });

  it('TC-18: exports to Vault-relative custom folder and auto-creates nested directories', async () => {
    const mem = createMemoryVaultAdapter();

    const res = await exportHtmlFile({
      sourceVaultPath: '推文.md',
      sourceBaseName: '推文',
      htmlContent: '<html>custom-rel</html>',
      settings: {
        exportLocationMode: 'custom-folder',
        customExportDir: 'Exports/WeChat/2026',
      },
      vaultAdapter: mem.adapter,
    });

    expect(res.isInsideVault).toBe(true);
    expect(res.outputPath).toBe('Exports/WeChat/2026/推文.html');
    expect(mem.dirs.has('Exports/WeChat/2026')).toBe(true);
    expect(mem.files.get('Exports/WeChat/2026/推文.html')).toBe(
      '<html>custom-rel</html>',
    );
  });

  it('TC-18: exports to OS absolute directory, auto-creates directory, and directly overwrites', async () => {
    const mem = createMemoryVaultAdapter();
    const tmpBase = await fs.mkdtemp(path.join(os.tmpdir(), 'inline-html-test-'));
    const nestedOutDir = path.join(tmpBase, 'nested-export');

    try {
      const res1 = await exportHtmlFile({
        sourceVaultPath: '推文.md',
        sourceBaseName: '推文',
        htmlContent: '<html>abs-1</html>',
        settings: {
          exportLocationMode: 'custom-folder',
          customExportDir: nestedOutDir,
        },
        vaultAdapter: mem.adapter,
      });

      const res2 = await exportHtmlFile({
        sourceVaultPath: '推文.md',
        sourceBaseName: '推文',
        htmlContent: '<html>abs-2</html>',
        settings: {
          exportLocationMode: 'custom-folder',
          customExportDir: nestedOutDir,
        },
        vaultAdapter: mem.adapter,
      });

      expect(res1.isInsideVault).toBe(false);
      expect(res2.outputPath).toBe(path.join(nestedOutDir, '推文.html'));
      const entries = await fs.readdir(nestedOutDir);
      expect(entries).toEqual(['推文.html']);
      const saved = await fs.readFile(res2.outputPath, 'utf8');
      expect(saved).toBe('<html>abs-2</html>');
    } finally {
      await fs.rm(tmpBase, { recursive: true, force: true });
    }
  });
});
