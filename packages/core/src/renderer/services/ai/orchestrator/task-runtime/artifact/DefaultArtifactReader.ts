import type { IArtifactReader } from './IArtifactReader';
import type { IFileSystemAdapter } from './IFileSystemAdapter';

export class DefaultArtifactReader implements IArtifactReader {
  constructor(private readonly fsAdapter: IFileSystemAdapter) {}

  public async read(path: string): Promise<string | null> {
    try {
      const content = await this.fsAdapter.read(path);
      return content ?? null;
    } catch (e) {
      console.error(`[DefaultArtifactReader] Error reading file: ${path}`, e);
      return null;
    }
  }

  public async readBytes(path: string): Promise<Uint8Array | null> {
    try {
      const bytes = await this.fsAdapter.readBytes(path);
      return bytes ?? null;
    } catch (e) {
      console.error(`[DefaultArtifactReader] Error reading bytes: ${path}`, e);
      return null;
    }
  }

  public async exists(path: string): Promise<boolean> {
    try {
      const stat = await this.fsAdapter.stat(path);
      return stat !== null;
    } catch (e) {
      console.error(`[DefaultArtifactReader] Error checking existence: ${path}`, e);
      return false;
    }
  }

  public async getSize(path: string): Promise<number> {
    try {
      const stat = await this.fsAdapter.stat(path);
      return stat?.size ?? 0;
    } catch (e) {
      console.error(`[DefaultArtifactReader] Error getting size: ${path}`, e);
      return 0;
    }
  }

  public async getHash(path: string): Promise<string | null> {
    try {
      const hash = await this.fsAdapter.hash(path);
      return hash ?? null;
    } catch (e) {
      console.error(`[DefaultArtifactReader] Error getting hash: ${path}`, e);
      return null;
    }
  }
}
