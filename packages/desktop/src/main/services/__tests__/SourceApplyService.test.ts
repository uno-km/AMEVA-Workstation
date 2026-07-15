import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as fsp from 'fs/promises';
import * as path from 'path';
import crypto from 'crypto';
import { SourceApplyService } from '../SourceApplyService';

describe('SourceApplyService', () => {
  let service: SourceApplyService;
  let testRoot: string;
  let allowedWorkspaceRoot: string;
  let artifactStorageRef: string;

  beforeEach(async () => {
    service = new SourceApplyService();
    testRoot = path.join(__dirname, 'test-temp-' + crypto.randomUUID());
    allowedWorkspaceRoot = path.join(testRoot, 'workspace');
    artifactStorageRef = path.join(testRoot, 'artifacts', 'test-artifact.ts');

    await fsp.mkdir(allowedWorkspaceRoot, { recursive: true });
    await fsp.mkdir(path.dirname(artifactStorageRef), { recursive: true });
    await fsp.writeFile(artifactStorageRef, 'console.log("hello new world");', 'utf8');
  });

  afterEach(async () => {
    if (fs.existsSync(testRoot)) {
      await fsp.rm(testRoot, { recursive: true, force: true });
    }
  });

  it('1. should create a preview for a new file addition', async () => {
    const preview = await service.createPreview({
      requestId: 'req1',
      missionId: 'm1',
      taskId: 't1',
      workbenchSessionId: 'ws1',
      sourceWorkspaceDigest: 'src_digest',
      targetArtifact: {
        repositoryArtifactId: 'art1',
        revision: 1,
        logicalPath: 'src/index.ts',
        contentHash: 'art_digest',
        // Mocking other properties safely
        storageReference: artifactStorageRef
      } as any
    }, allowedWorkspaceRoot);

    expect(preview.addedFiles).toContain('src/index.ts');
    expect(preview.modifiedFiles.length).toBe(0);
  });

  it('2. should execute apply, create snapshot, and copy the artifact', async () => {
    // pre-create the file to simulate modification
    const targetFile = path.join(allowedWorkspaceRoot, 'src', 'index.ts');
    await fsp.mkdir(path.dirname(targetFile), { recursive: true });
    await fsp.writeFile(targetFile, 'console.log("hello old world");', 'utf8');

    const preview = await service.createPreview({
      requestId: 'req1',
      missionId: 'm1',
      taskId: 't1',
      workbenchSessionId: 'ws1',
      sourceWorkspaceDigest: 'src_digest',
      targetArtifact: {
        repositoryArtifactId: 'art1',
        revision: 1,
        logicalPath: 'src/index.ts',
        contentHash: 'art_digest',
        storageReference: artifactStorageRef
      } as any
    }, allowedWorkspaceRoot);

    const operation = await service.executeApply(
      'op1',
      {
        sourceApplyRequestId: 'req1',
        missionId: 'm1',
      } as any,
      preview,
      {
        logicalPath: 'src/index.ts',
        storageReference: artifactStorageRef
      } as any,
      allowedWorkspaceRoot
    );

    expect(operation.status).toBe('APPLIED');
    expect(operation.rollbackSnapshotId).toBe('op1');

    const content = await fsp.readFile(targetFile, 'utf8');
    expect(content).toBe('console.log("hello new world");');
  });

  it('3. should reject operations that attempt path traversal outside workspace', async () => {
    await expect(service.createPreview({
      requestId: 'req1',
      missionId: 'm1',
      taskId: 't1',
      workbenchSessionId: 'ws1',
      sourceWorkspaceDigest: 'src_digest',
      targetArtifact: {
        logicalPath: '../../etc/passwd',
      } as any
    }, allowedWorkspaceRoot)).rejects.toThrow('INVALID_PATH');
  });
});
