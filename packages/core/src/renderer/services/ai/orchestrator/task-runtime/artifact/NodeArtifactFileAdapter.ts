import * as fs from 'fs';
import * as path from 'path';
import crypto from 'crypto';
import type { IFileSystemAdapter } from './IFileSystemAdapter';

export class NodeArtifactFileAdapter implements IFileSystemAdapter {
  constructor(private readonly basePath: string = process.cwd()) {}

  private validatePath(filePath: string): void {
    if (!filePath) throw new Error('Path is empty');
    if (filePath.includes('\0')) throw new Error('Path contains null bytes');
    if (/[\r\n&;|$\x60\x22\x27<>]/.test(filePath)) {
      throw new Error(`Path contains invalid shell meta-characters or newlines: ${filePath}`);
    }
    // Simple traversal check, though resolvePath handles relative, we should block explicit explicit '..' if requested
    if (filePath.includes('..')) {
      throw new Error(`Path traversal is not allowed: ${filePath}`);
    }
  }

  private resolvePath(filePath: string): string {
    this.validatePath(filePath);
    // Strip leading slashes to treat all paths as relative to basePath
    const normalizedPath = filePath.replace(/^[\/\\]+/, '');
    const finalPath = path.join(this.basePath, normalizedPath);
    // Extra safety: ensure final path is within base path
    if (!finalPath.startsWith(this.basePath)) {
      throw new Error(`Path traversal blocked: ${filePath}`);
    }
    return finalPath;
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

  public async stat(filePath: string): Promise<{ exists: boolean; size: number; isDirectory: boolean }> {
    const p = this.resolvePath(filePath);
    try {
      const st = await fs.promises.stat(p);
      return { exists: true, size: st.size, isDirectory: st.isDirectory() };
    } catch {
      return { exists: false, size: 0, isDirectory: false };
    }
  }

  public async hash(filePath: string): Promise<string | null> {
    const p = this.resolvePath(filePath);
    if (!fs.existsSync(p)) return null;
    const content = await fs.promises.readFile(p);
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  public async list(filePath: string): Promise<string> {
    const p = this.resolvePath(filePath);
    if (!fs.existsSync(p)) return '(디렉토리가 존재하지 않습니다)';
    const st = await fs.promises.stat(p);
    if (!st.isDirectory()) return '(디렉토리가 아닙니다)';
    
    const files = await fs.promises.readdir(p, { withFileTypes: true });
    if (files.length === 0) return '(디렉토리가 비어있습니다)';
    
    const lines = ['Name\tLength\tLastWriteTime', '----\t------\t-------------'];
    for (const f of files) {
      const fPath = path.join(p, f.name);
      try {
        const fSt = await fs.promises.stat(fPath);
        lines.push(`${f.name}\t${f.isDirectory() ? '<DIR>' : fSt.size}\t${fSt.mtime.toISOString()}`);
      } catch {
        lines.push(`${f.name}\t<ERROR>\t<ERROR>`);
      }
    }
    return lines.join('\n');
  }
}
