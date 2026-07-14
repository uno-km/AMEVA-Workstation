import type { IFileSystemAdapter } from './IFileSystemAdapter';

export class InMemoryFileSystemAdapter implements IFileSystemAdapter {
  private files: Map<string, string> = new Map();

  public async stat(path: string): Promise<{ exists: boolean; size: number; isDirectory: boolean }> {
    const content = this.files.get(path);
    if (content !== undefined) {
      return { exists: true, size: content.length, isDirectory: false };
    }
    // Very simple check for directories
    for (const key of this.files.keys()) {
      if (key.startsWith(path + '/')) {
        return { exists: true, size: 0, isDirectory: true };
      }
    }
    return { exists: false, size: 0, isDirectory: false };
  }

  public async read(path: string): Promise<string | null> {
    return this.files.get(path) ?? null;
  }

  public async write(path: string, content: string): Promise<void> {
    this.files.set(path, content);
  }

  public async move(sourcePath: string, destPath: string, backupPath?: string): Promise<void> {
    const content = this.files.get(sourcePath);
    if (content === undefined) {
      throw new Error(`Source file does not exist: ${sourcePath}`);
    }
    if (backupPath && this.files.has(destPath)) {
      this.files.set(backupPath, this.files.get(destPath)!);
    }
    this.files.set(destPath, content);
    this.files.delete(sourcePath);
  }

  public async hash(path: string): Promise<string | null> {
    const content = this.files.get(path);
    if (content === undefined) return null;
    // Simple mock hash
    return `hash-${content.length}-${content.slice(0, 10)}`;
  }

  public async remove(path: string): Promise<void> {
    this.files.delete(path);
  }
  
  // Test utility
  public setFile(path: string, content: string) {
    this.files.set(path, content);
  }
}
