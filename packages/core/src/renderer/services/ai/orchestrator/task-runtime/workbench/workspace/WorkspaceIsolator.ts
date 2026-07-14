import { ResourceLimits, SnapshotManifest, SnapshotManifestItem } from '../domain/WorkbenchTypes';
import { IFileSystemAdapter } from '../../artifact/IFileSystemAdapter';

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

  constructor(private readonly fsAdapter: IFileSystemAdapter) {}

  public async createIsolatedWorkspace(
    sourcePath: string,
    destPath: string,
    allowedFiles: string[] | null,
    requiredInputs: string[],
    limits: ResourceLimits
  ): Promise<SnapshotManifest> {
    const info: SnapshotManifest = {
      totalFiles: 0,
      totalBytes: 0,
      copiedFiles: [],
      excludedFiles: [],
      referenceOnlyFiles: [],
      approvalRequiredFiles: [],
      failedFiles: []
    };

    const realSource = await this.fsAdapter.realpath(sourcePath);
    const realDest = await this.fsAdapter.realpath(destPath).catch(() => destPath);

    if (realSource === realDest || realDest.startsWith(realSource + '/') || realSource.startsWith(realDest + '/')) {
      throw new Error(`Source and destination paths cannot be identical or nested.`);
    }

    try {
      await this.processDirectory(
        sourcePath,
        destPath,
        sourcePath,
        allowedFiles,
        requiredInputs,
        limits,
        info,
        new Set<string>(),
        0
      );
    } catch (e: any) {
      if (e.message.includes('WAITING_USER') || e.message.includes('RESOURCE_LIMIT_EXCEEDED')) {
        throw e;
      }
      info.failedFiles.push({ path: sourcePath, reason: e.message });
      throw e;
    }

    return info;
  }

  private async processDirectory(
    sourceDir: string,
    destDir: string,
    baseSourceDir: string,
    allowedFiles: string[] | null,
    requiredInputs: string[],
    limits: ResourceLimits,
    info: SnapshotManifest,
    visitedPaths: Set<string>,
    depth: number
  ) {
    if (depth > 50) {
      throw new Error('Max directory depth exceeded');
    }

    let listOutput: string;
    try {
      listOutput = await this.fsAdapter.list(sourceDir);
    } catch {
      return;
    }

    const lines = listOutput.split('\n');
    if (lines.length < 2 || lines[0].startsWith('(디렉토리가')) {
      return;
    }

    for (let i = 2; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const parts = line.split('\t');
      const name = parts[0];
      const isDir = parts[1] === '<DIR>';

      const sourceFilePath = `${sourceDir}/${name}`;
      const destFilePath = `${destDir}/${name}`;
      const relativePath = sourceFilePath.replace(`${baseSourceDir}/`, '');
      const isRequired = requiredInputs.includes(relativePath);

      if (WorkspaceIsolator.DEFAULT_EXCLUDES.includes(name)) {
        info.excludedFiles.push({ path: sourceFilePath, reason: 'DEFAULT_EXCLUDE' });
        continue;
      }

      if (sourceFilePath.includes('\0')) {
        throw new Error('Null bytes not allowed in path');
      }

      const isLink = await this.fsAdapter.isSymlink(sourceFilePath);
      if (isLink) {
        info.failedFiles.push({ path: sourceFilePath, reason: 'Symlinks are blocked by policy' });
        throw new Error(`Symlinks are blocked by policy: ${sourceFilePath}`);
      }

      const realPath = await this.fsAdapter.realpath(sourceFilePath);
      if (!realPath.startsWith(await this.fsAdapter.realpath(baseSourceDir))) {
        throw new Error(`Path traversal detected: ${sourceFilePath}`);
      }

      if (visitedPaths.has(realPath)) {
        throw new Error(`Loop detected at: ${sourceFilePath}`);
      }
      visitedPaths.add(realPath);

      if (isDir) {
        await this.processDirectory(sourceFilePath, destFilePath, baseSourceDir, allowedFiles, requiredInputs, limits, info, visitedPaths, depth + 1);
        continue;
      }

      // File handling
      if (allowedFiles && allowedFiles.length > 0 && !allowedFiles.includes(relativePath) && !allowedFiles.includes('*')) {
        if (isRequired) {
          throw new Error(`WAITING_USER: Required input file ${relativePath} is not in allowed files`);
        }
        info.excludedFiles.push({ path: sourceFilePath, reason: 'NOT_IN_ALLOWED_FILES' });
        continue;
      }

      const stat = await this.fsAdapter.stat(sourceFilePath);

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
          if (isRequired) {
             throw new Error(`RESOURCE_LIMIT_EXCEEDED: Required input ${relativePath} is too large and cannot be EXCLUDED quietly.`);
          }
          info.excludedFiles.push({ path: sourceFilePath, reason: 'EXCEEDS_SINGLE_FILE_LIMIT' });
          continue;
        } else if (limits.largeFilePolicy === 'REFERENCE_ONLY') {
          if (isRequired) {
             throw new Error(`WAITING_USER: Required input ${relativePath} is too large and REFERENCE_ONLY is not sufficient for execution.`);
          }
          info.referenceOnlyFiles.push({ path: sourceFilePath, reason: 'EXCEEDS_SINGLE_FILE_LIMIT' });
          continue;
        } else if (limits.largeFilePolicy === 'REQUIRE_APPROVAL') {
          info.approvalRequiredFiles.push({ path: sourceFilePath, reason: 'EXCEEDS_SINGLE_FILE_LIMIT' });
          throw new Error('WAITING_USER: Large file requires approval');
        }
      }

      try {
        await this.fsAdapter.copy(sourceFilePath, destFilePath);
        info.copiedFiles.push({ path: sourceFilePath, reason: 'SUCCESS' });
        info.totalFiles++;
        info.totalBytes += stat.size;
      } catch (err: any) {
        info.failedFiles.push({ path: sourceFilePath, reason: err.message });
      }
    }
  }
}
