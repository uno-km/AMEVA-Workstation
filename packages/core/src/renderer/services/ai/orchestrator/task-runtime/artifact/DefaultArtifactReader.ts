import type { IArtifactReader } from './IArtifactReader';
import { executeTerminal } from '../../../../ipc/electronApiAdapter';
import { PathSanitizer } from '../policy/PathSanitizer';

export class DefaultArtifactReader implements IArtifactReader {
  public async read(path: string): Promise<string | null> {
    try {
      const safePath = PathSanitizer.sanitizePath(path, 'read');
      const result = await executeTerminal(`Get-Content -Path "${safePath}" -Raw -Encoding UTF8`, undefined);
      return result.stdout || null;
    } catch (e) {
      console.error(`[DefaultArtifactReader] Error reading file: ${path}`, e);
      return null;
    }
  }

  public async exists(path: string): Promise<boolean> {
    try {
      const safePath = PathSanitizer.sanitizePath(path, 'read');
      const result = await executeTerminal(`Test-Path -Path "${safePath}"`, undefined);
      return result.stdout?.trim() === 'True';
    } catch (e) {
      console.error(`[DefaultArtifactReader] Error checking existence: ${path}`, e);
      return false;
    }
  }

  public async getSize(path: string): Promise<number> {
    try {
      const safePath = PathSanitizer.sanitizePath(path, 'read');
      const result = await executeTerminal(`(Get-Item -Path "${safePath}").Length`, undefined);
      return parseInt(result.stdout?.trim() || '0', 10);
    } catch (e) {
      console.error(`[DefaultArtifactReader] Error getting size: ${path}`, e);
      return 0;
    }
  }

  public async getHash(path: string): Promise<string | null> {
    try {
      const safePath = PathSanitizer.sanitizePath(path, 'read');
      const result = await executeTerminal(`(Get-FileHash -Path "${safePath}" -Algorithm SHA256).Hash`, undefined);
      return result.stdout?.trim() || null;
    } catch (e) {
      console.error(`[DefaultArtifactReader] Error getting hash: ${path}`, e);
      return null;
    }
  }
}
