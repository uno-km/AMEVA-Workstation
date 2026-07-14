import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { WorkspaceIsolator } from '../../workbench/workspace/WorkspaceIsolator';
import { ResourceLimits } from '../../workbench/domain/WorkbenchTypes';
import { NodeArtifactFileAdapter } from '../../artifact/NodeArtifactFileAdapter';

describe('Phase6.1 WorkspaceIsolation', () => {
  const tmpBase = path.join(process.cwd(), 'tmp-phase6-isolation');
  const sourceDir = path.join(tmpBase, 'source');
  const destDir = path.join(tmpBase, 'dest');
  const fsAdapter = new NodeArtifactFileAdapter();
  const isolator = new WorkspaceIsolator(fsAdapter);

  beforeEach(() => {
    if (fs.existsSync(tmpBase)) {
      fs.rmSync(tmpBase, { recursive: true, force: true });
    }
    fs.mkdirSync(sourceDir, { recursive: true });
  });

  afterEach(() => {
    if (fs.existsSync(tmpBase)) {
      fs.rmSync(tmpBase, { recursive: true, force: true });
    }
  });

  const defaultLimits: ResourceLimits = {
    timeoutMs: 10000,
    maxMemoryMb: 512,
    maxCpuPercent: 100,
    maxSingleFileBytes: 1024 * 1024,
    maxWorkspaceBytes: 10 * 1024 * 1024,
    maxFileCount: 100,
    maxArtifactBytes: 10 * 1024 * 1024,
    maxCommandOutputBytes: 1024 * 1024,
    largeFilePolicy: 'EXCLUDE'
  };

  it('should exclude node_modules and other default excludes', async () => {
    fs.mkdirSync(path.join(sourceDir, 'node_modules'));
    fs.writeFileSync(path.join(sourceDir, 'node_modules', 'test.js'), 'code');
    fs.writeFileSync(path.join(sourceDir, 'valid.txt'), 'text');

    const info = await isolator.createIsolatedWorkspace(sourceDir, destDir, null, [], defaultLimits);

    expect(info.totalFiles).toBe(1);
    expect(fs.existsSync(path.join(destDir, 'node_modules'))).toBe(false);
    expect(fs.existsSync(path.join(destDir, 'valid.txt'))).toBe(true);
  });

  it('should prevent source modification by isolating', async () => {
    fs.writeFileSync(path.join(sourceDir, 'original.txt'), 'data');
    await isolator.createIsolatedWorkspace(sourceDir, destDir, null, [], defaultLimits);

    fs.writeFileSync(path.join(destDir, 'original.txt'), 'changed');
    const sourceContent = fs.readFileSync(path.join(sourceDir, 'original.txt'), 'utf-8');
    
    expect(sourceContent).toBe('data');
  });

  it('should handle large file policies (FAIL)', async () => {
    const limits = { ...defaultLimits, maxSingleFileBytes: 5, largeFilePolicy: 'FAIL' as const };
    fs.writeFileSync(path.join(sourceDir, 'large.txt'), '123456'); // 6 bytes

    await expect(isolator.createIsolatedWorkspace(sourceDir, destDir, null, [], limits))
      .rejects.toThrow(/RESOURCE_LIMIT_EXCEEDED/);
  });

  it('should handle large file policies (EXCLUDE)', async () => {
    const limits = { ...defaultLimits, maxSingleFileBytes: 5, largeFilePolicy: 'EXCLUDE' as const };
    fs.writeFileSync(path.join(sourceDir, 'large.txt'), '123456'); // 6 bytes

    const info = await isolator.createIsolatedWorkspace(sourceDir, destDir, null, [], limits);
    expect(info.totalFiles).toBe(0);
    expect(info.excludedFiles.length).toBe(1);
    expect(fs.existsSync(path.join(destDir, 'large.txt'))).toBe(false);
  });

  it('should handle large file policies (REFERENCE_ONLY)', async () => {
    const limits = { ...defaultLimits, maxSingleFileBytes: 5, largeFilePolicy: 'REFERENCE_ONLY' as const };
    fs.writeFileSync(path.join(sourceDir, 'large.txt'), '123456');

    const info = await isolator.createIsolatedWorkspace(sourceDir, destDir, null, [], limits);
    expect(info.referenceOnlyFiles.length).toBe(1);
    expect(fs.existsSync(path.join(destDir, 'large.txt'))).toBe(false);
  });

  it('should handle large file policies (REQUIRE_APPROVAL)', async () => {
    const limits = { ...defaultLimits, maxSingleFileBytes: 5, largeFilePolicy: 'REQUIRE_APPROVAL' as const };
    fs.writeFileSync(path.join(sourceDir, 'large.txt'), '123456');

    await expect(isolator.createIsolatedWorkspace(sourceDir, destDir, null, [], limits))
      .rejects.toThrow(/WAITING_USER/);
  });

  it('should block symlink pointing outside workspace', async () => {
    const outsideDir = path.join(tmpBase, 'outside');
    fs.mkdirSync(outsideDir);
    fs.writeFileSync(path.join(outsideDir, 'secret.txt'), 'secret');

    // Make a symlink
    try {
      fs.symlinkSync(path.join(outsideDir, 'secret.txt'), path.join(sourceDir, 'link.txt'));
    } catch {
      // If symlink creation fails due to Windows privileges, skip the test
      return;
    }

    await expect(isolator.createIsolatedWorkspace(sourceDir, destDir, null, [], defaultLimits))
      .rejects.toThrow(/Symlink/);
  });
});

