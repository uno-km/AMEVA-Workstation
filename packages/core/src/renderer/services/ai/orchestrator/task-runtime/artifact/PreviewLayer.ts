/**
 * @file orchestrator/task-runtime/artifact/PreviewLayer.ts
 * @system AMEVA OS Desktop Workstation
 */

import type { IFileSystemAdapter } from './IFileSystemAdapter';
import * as path from 'path';

export interface FilePreview {
  path: string;
  exists: boolean;
  sizeBytes: number;
  mimeType: string;
  preview: string;
  isTruncated: boolean;
  isBinary: boolean;
}

export class PreviewLayer {
  private static readonly BINARY_EXTENSIONS = new Set([
    '.png', '.jpg', '.jpeg', '.gif', '.pdf', '.zip', '.tar', '.gz', '.exe', 
    '.dll', '.so', '.dylib', '.mp4', '.mp3', '.webm', '.bin', '.wasm'
  ]);

  /**
   * 안전한 파일 미리보기 객체를 생성합니다.
   * - 바이너리 파일은 내용을 주입하지 않음.
   * - 대용량 파일은 maxSize 기준으로 자름(Truncation).
   */
  public static async generatePreview(
    filePath: string,
    fsAdapter: IFileSystemAdapter,
    maxSize: number = 3000
  ): Promise<FilePreview> {
    const ext = path.extname(filePath).toLowerCase();
    const isBinary = this.BINARY_EXTENSIONS.has(ext);
    
    let mimeType = isBinary ? 'application/octet-stream' : 'text/plain';
    if (ext === '.json') mimeType = 'application/json';
    if (ext === '.md') mimeType = 'text/markdown';

    try {
      const stats = await fsAdapter.stat(filePath);
      if (!stats.exists) {
        return {
          path: filePath,
          exists: false,
          sizeBytes: 0,
          mimeType,
          preview: '',
          isTruncated: false,
          isBinary
        };
      }

      if (isBinary) {
        return {
          path: filePath,
          exists: true,
          sizeBytes: stats.size,
          mimeType,
          preview: '(바이너리 파일은 미리보기를 지원하지 않습니다)',
          isTruncated: true,
          isBinary: true
        };
      }

      // 너무 큰 파일(예: 500KB 이상)은 전체 읽기를 아예 생략하여 IPC 및 메모리 보호
      if (stats.size > 500 * 1024) {
        return {
          path: filePath,
          exists: true,
          sizeBytes: stats.size,
          mimeType,
          preview: `(파일이 너무 큽니다. 전체 크기: ${stats.size} Bytes. 미리보기가 생략되었습니다)`,
          isTruncated: true,
          isBinary: false
        };
      }

      const content = await fsAdapter.read(filePath);
      if (!content) {
        return {
          path: filePath,
          exists: true,
          sizeBytes: stats.size,
          mimeType,
          preview: '',
          isTruncated: false,
          isBinary: false
        };
      }

      if (content.length > maxSize) {
        return {
          path: filePath,
          exists: true,
          sizeBytes: Buffer.byteLength(content, 'utf-8'),
          mimeType,
          preview: content.substring(0, maxSize) + `\n\n... (파일 크기가 커서 ${maxSize}자까지만 표시됩니다. 전체 크기: ${stats.size} Bytes)`,
          isTruncated: true,
          isBinary: false
        };
      }

      return {
        path: filePath,
        exists: true,
        sizeBytes: Buffer.byteLength(content, 'utf-8'),
        mimeType,
        preview: content,
        isTruncated: false,
        isBinary: false
      };
    } catch (e: any) {
      return {
        path: filePath,
        exists: false,
        sizeBytes: 0,
        mimeType: 'unknown',
        preview: `(파일 접근 중 오류가 발생했습니다: ${e.message})`,
        isTruncated: false,
        isBinary: false
      };
    }
  }
}
