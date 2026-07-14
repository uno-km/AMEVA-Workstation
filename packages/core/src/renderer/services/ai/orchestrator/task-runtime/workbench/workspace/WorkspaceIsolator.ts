import * as fs from 'fs';
import * as path from 'path';
import crypto from 'crypto';
import { ResourceLimits, LargeFilePolicy } from '../domain/WorkbenchTypes';

export interface WorkspaceSnapshotInfo {
  totalFiles: number;
  totalBytes: number;
  excludedFiles: string[];
  referenceOnlyFiles: string[];
  failedFiles: string[];
}

export class WorkspaceIsolator {
  private static readonly DEFAULT_EXCLUDES = [
    'node_modules',
    '.git',
    'dist',
    'build',
    '.cache',
    'tmp',
    'temp'
  ];

  public static async createIsolatedWorkspace(
    sourcePath: string,
    destPath: string,
    allowedFiles: string[] | null,
    limits: ResourceLimits
  ): Promise<WorkspaceSnapshotInfo> {
    const info: WorkspaceSnapshotInfo = {
      totalFiles: 0,
      totalBytes: 0,
      excludedFiles: [],
      referenceOnlyFiles: [],
      failedFiles: []
    };

    if (sourcePath === destPath || destPath.startsWith(sourcePath) || sourcePath.startsWith(destPath)) {
      throw new Error(`Source and destination paths cannot be identical or nested.`);
    }

    await fs.promises.mkdir(destPath, { recursive: true });

    // Ensure we don't blindly follow symlinks
    const visitedInodes = new Set<string>();

    await this.processDirectory(
      sourcePath,
      destPath,
      sourcePath,
      allowedFiles,
      limits,
      info,
      visitedInodes,
      0
    );

    return info;
  }

  private static async processDirectory(
    sourceDir: string,
    destDir: string,
    baseSourceDir: string,
    allowedFiles: string[] | null,
    limits: ResourceLimits,
    info: WorkspaceSnapshotInfo,
    visitedInodes: Set<string>,
    depth: number
  ) {
    if (depth > 50) {
      throw new Error('Max directory depth exceeded');
    }

    const entries = await fs.promises.readdir(sourceDir, { withFileTypes: true });

    for (const entry of entries) {
      if (this.DEFAULT_EXCLUDES.includes(entry.name)) {
        info.excludedFiles.push(path.join(sourceDir, entry.name));
        continue;
      }

      const sourceFilePath = path.join(sourceDir, entry.name);
      const destFilePath = path.join(destDir, entry.name);
      const relativePath = path.relative(baseSourceDir, sourceFilePath).replace(/\\/g, '/');

      if (sourceFilePath.includes('\0')) {
        throw new Error('Null bytes not allowed in path');
      }

      let stat: fs.Stats;
      try {
        stat = await fs.promises.lstat(sourceFilePath);
      } catch {
        continue;
      }

      if (stat.isSymbolicLink()) {
        try {
          const target = await fs.promises.readlink(sourceFilePath);
          const absoluteTarget = path.resolve(sourceDir, target);
          if (!absoluteTarget.startsWith(path.resolve(baseSourceDir))) {
            // Path traversal or pointing outside workspace
            throw new Error(`Symlink points outside workspace: ${sourceFilePath} -> ${absoluteTarget}`);
          }
          // Do not follow symlinks, we can just copy the link if needed, but the rule says 
          // "Symlink과 경로 탈출 방어: 무조건 따라가지 마라... 반드시 차단 또는 정책 처리".
          // We will just recreate the symlink to the relative path or skip.
          // To be safe, skip symlinks and warn or fail. 
          throw new Error(`Symlinks are blocked by policy: ${sourceFilePath}`);
        } catch (err: any) {
          info.failedFiles.push(sourceFilePath);
          continue; // Skip invalid symlinks or block
        }
      }

      const inodeKey = `${stat.dev}:${stat.ino}`;
      if (visitedInodes.has(inodeKey)) {
        throw new Error(`Symlink cycle or hardlink loop detected at: ${sourceFilePath}`);
      }
      if (!stat.isDirectory()) {
        visitedInodes.add(inodeKey);
      }

      if (stat.isDirectory()) {
        await fs.promises.mkdir(destFilePath, { recursive: true });
        await this.processDirectory(sourceFilePath, destFilePath, baseSourceDir, allowedFiles, limits, info, visitedInodes, depth + 1);
        continue;
      }

      // File handling
      if (allowedFiles && allowedFiles.length > 0 && !allowedFiles.includes(relativePath) && !allowedFiles.includes('*')) {
        info.excludedFiles.push(sourceFilePath);
        continue;
      }

      if (info.totalFiles >= limits.maxFileCount) {
        throw new Error('RESOURCE_LIMIT_EXCEEDED: maxFileCount');
      }

      if (info.totalBytes + stat.size > limits.maxWorkspaceBytes) {
        throw new Error('RESOURCE_LIMIT_EXCEEDED: maxWorkspaceBytes');
      }

      if (stat.size > limits.maxSingleFileBytes) {
        if (limits.largeFilePolicy === 'FAIL') {
          throw new Error(`RESOURCE_LIMIT_EXCEEDED: File ${relativePath} size ${stat.size} exceeds maxSingleFileBytes`);
        } else if (limits.largeFilePolicy === 'EXCLUDE') {
          info.excludedFiles.push(sourceFilePath);
          continue;
        } else if (limits.largeFilePolicy === 'REFERENCE_ONLY') {
          info.referenceOnlyFiles.push(sourceFilePath);
          // Don't copy, just record
          continue;
        } else if (limits.largeFilePolicy === 'REQUIRE_APPROVAL') {
          throw new Error('WAITING_USER: Large file requires approval');
        }
      }

      // Try copy-on-write (reflink) first
      try {
        await fs.promises.copyFile(sourceFilePath, destFilePath, fs.constants.COPYFILE_FICLONE);
        info.totalFiles++;
        info.totalBytes += stat.size;
      } catch {
        // Fallback to streaming copy
        try {
          await this.streamCopy(sourceFilePath, destFilePath);
          info.totalFiles++;
          info.totalBytes += stat.size;
        } catch {
          info.failedFiles.push(sourceFilePath);
        }
      }
    }
  }

  private static streamCopy(source: string, dest: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const readStream = fs.createReadStream(source);
      const writeStream = fs.createWriteStream(dest);
      readStream.on('error', reject);
      writeStream.on('error', reject);
      writeStream.on('finish', resolve);
      readStream.pipe(writeStream);
    });
  }
}
