import * as fs from 'fs';
import * as path from 'path';
import crypto from 'crypto';
import type { IFileSystemAdapter } from './IFileSystemAdapter';

export class NodeArtifactFileAdapter implements IFileSystemAdapter {
  constructor(private readonly basePath: string = process.cwd()) {}

  private resolvePath(filePath: string): string {
    if (path.isAbsolute(filePath)) {
      return filePath; // Or prefix with basePath if simulating root
    }
    return path.join(this.basePath, filePath);
  }

  public async read(filePath: string): Promise<string | null> {
    const p = this.resolvePath(filePath);
    if (!fs.existsSync(p)) return null;
    return fs.promises.readFile(p, 'utf-8');
  }

  public async write(filePath: string, content: string): Promise<void> {
    const p = this.resolvePath(filePath);
    await fs.promises.mkdir(path.dirname(p), { recursive: true });
    await fs.promises.writeFile(p, content, 'utf-8');
  }

  public async move(fromPath: string, toPath: string, backupPath?: string): Promise<void> {
    const f = this.resolvePath(fromPath);
    const t = this.resolvePath(toPath);
    
    if (!fs.existsSync(f)) throw new Error(`Source file missing: ${f}`);

    if (backupPath) {
      const b = this.resolvePath(backupPath);
      if (fs.existsSync(t)) {
        await fs.promises.rename(t, b);
      }
    } else {
      if (fs.existsSync(t)) {
        await fs.promises.unlink(t);
      }
    }
    await fs.promises.mkdir(path.dirname(t), { recursive: true });
    await fs.promises.rename(f, t);
  }

  public async copy(fromPath: string, toPath: string): Promise<void> {
    const f = this.resolvePath(fromPath);
    const t = this.resolvePath(toPath);
    await fs.promises.mkdir(path.dirname(t), { recursive: true });
    await fs.promises.copyFile(f, t);
  }

  public async remove(filePath: string): Promise<void> {
    const p = this.resolvePath(filePath);
    if (fs.existsSync(p)) {
      await fs.promises.unlink(p);
    }
  }

  public async stat(filePath: string): Promise<{ exists: boolean; size: number; mtime: number }> {
    const p = this.resolvePath(filePath);
    try {
      const st = await fs.promises.stat(p);
      return { exists: true, size: st.size, mtime: st.mtimeMs };
    } catch {
      return { exists: false, size: 0, mtime: 0 };
    }
  }

  public async hash(filePath: string): Promise<string | null> {
    const p = this.resolvePath(filePath);
    if (!fs.existsSync(p)) return null;
    const content = await fs.promises.readFile(p);
    return crypto.createHash('sha256').update(content).digest('hex');
  }
}
