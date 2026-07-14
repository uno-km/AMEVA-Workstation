import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { NodeArtifactFileAdapter } from '../NodeArtifactFileAdapter';

describe('NodeArtifactFileAdapter Contract & Security', () => {
  let tmpDir: string;
  let adapter: NodeArtifactFileAdapter;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ameva-fs-test-'));
    adapter = new NodeArtifactFileAdapter(tmpDir);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('1. Basic file operations (write, read, stat, hash, exists, remove)', async () => {
    const testPath = 'test/dir/file.txt';
    const content = 'Hello AMEVA';

    await adapter.write(testPath, content);
    
    const readBack = await adapter.read(testPath);
    expect(readBack).toBe(content);

    const stat = await adapter.stat(testPath);
    expect(stat.exists).toBe(true);
    expect(stat.size).toBe(content.length);
    expect(stat.isDirectory).toBe(false);

    const hash = await adapter.hash(testPath);
    expect(hash).toBeTruthy();

    await adapter.remove(testPath);
    const statAfter = await adapter.stat(testPath);
    expect(statAfter.exists).toBe(false);
  });

  it('2. Move operations (staging -> final) with backup', async () => {
    const src = 'staged.txt';
    const dest = 'final.txt';
    const backup = 'final.txt.bak';

    // Setup existing final file
    await adapter.write(dest, 'old content');
    
    // Setup new staged file
    await adapter.write(src, 'new content');

    // Move with backup
    await adapter.move(src, dest, backup);

    // Assert final is updated
    expect(await adapter.read(dest)).toBe('new content');
    
    // Assert old is backed up
    expect(await adapter.read(backup)).toBe('old content');

    // Assert staged is gone
    const srcStat = await adapter.stat(src);
    expect(srcStat.exists).toBe(false);
  });

  it('3. Korean and space path support', async () => {
    const testPath = '한글 폴더/공백 파일 명.txt';
    const content = '테스트 내용';

    await adapter.write(testPath, content);
    expect(await adapter.read(testPath)).toBe(content);
    
    const stat = await adapter.stat(testPath);
    expect(stat.exists).toBe(true);
  });

  it('4. Path validation: blocks traversal and null bytes', async () => {
    await expect(adapter.write('../outside.txt', 'test')).rejects.toThrow('traversal');
    await expect(adapter.read('test\0.txt')).rejects.toThrow('null bytes');
  });

  it('5. Path validation: blocks shell meta characters and newlines', async () => {
    await expect(adapter.write('test\nfile.txt', 'x')).rejects.toThrow('shell meta-characters or newlines');
    await expect(adapter.write('test"file.txt', 'x')).rejects.toThrow('shell meta-characters or newlines');
    await expect(adapter.write('test|file.txt', 'x')).rejects.toThrow('shell meta-characters or newlines');
    await expect(adapter.write('test>file.txt', 'x')).rejects.toThrow('shell meta-characters or newlines');
    await expect(adapter.write('test&file.txt', 'x')).rejects.toThrow('shell meta-characters or newlines');
  });

  it('6. Move rollback manually works', async () => {
    const dest = 'final.txt';
    const backup = 'final.txt.bak';

    await adapter.write(dest, 'old final');
    await adapter.write(backup, 'original backup');

    // Manually simulate rollback
    await adapter.move(backup, dest);

    expect(await adapter.read(dest)).toBe('original backup');
    const backupStat = await adapter.stat(backup);
    expect(backupStat.exists).toBe(false);
  });
});
