import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { WorkbenchSessionManager } from '../../workbench/session/WorkbenchSessionManager';
import { WorkContract } from '../../workbench/domain/WorkbenchTypes';

describe('Phase6.1 SnapshotRollback', () => {
  const tmpBase = path.join(process.cwd(), 'tmp-phase6-rollback');
  const sourceDir = path.join(tmpBase, 'source');

  beforeEach(() => {
    if (fs.existsSync(tmpBase)) {
      fs.rmSync(tmpBase, { recursive: true, force: true });
    }
    fs.mkdirSync(sourceDir, { recursive: true });
    fs.writeFileSync(path.join(sourceDir, 'main.ts'), 'console.log("hello");');
    fs.writeFileSync(path.join(sourceDir, 'protected.ts'), 'secret');
  });

  afterEach(() => {
    if (fs.existsSync(tmpBase)) {
      fs.rmSync(tmpBase, { recursive: true, force: true });
    }
  });

  const baseContract: WorkContract = {
    objective: 'Test rollback',
    workbenchType: 'CODE',
    requiredInputs: [],
    expectedOutputs: ['out.txt'],
    acceptanceCriteria: ['pass'],
    requiredChecks: ['TEST'],
    allowedFiles: ['*'],
    protectedFiles: ['protected.ts'],
    allowedTools: [],
    approvalRequirements: [],
    executionPolicy: '',
    completionPolicy: ''
  };

  it('should compute diff correctly and catch protected file changes', async () => {
    const session = WorkbenchSessionManager.createSession('m1', 't1', 'a1', baseContract, sourceDir);
    await WorkbenchSessionManager.prepare(session);
    WorkbenchSessionManager.start(session);

    // Modify working directory
    const isolatedDir = session.isolatedWorkspace;
    fs.writeFileSync(path.join(isolatedDir, 'main.ts'), 'console.log("changed");');
    fs.writeFileSync(path.join(isolatedDir, 'new_file.ts'), 'new');

    const diff = await WorkbenchSessionManager.computeDiff(sourceDir, isolatedDir);
    
    expect(diff.modifiedFiles.length).toBe(1);
    expect(diff.modifiedFiles[0].logicalPath).toBe('main.ts');
    expect(diff.addedFiles.length).toBe(1);
    expect(diff.addedFiles[0].logicalPath).toBe('new_file.ts');
  });

  it('should block verification if protected file is modified', async () => {
    const session = WorkbenchSessionManager.createSession('m1', 't1', 'a2', baseContract, sourceDir);
    await WorkbenchSessionManager.prepare(session);
    WorkbenchSessionManager.start(session);

    // Modify protected file
    const isolatedDir = session.isolatedWorkspace;
    fs.writeFileSync(path.join(isolatedDir, 'protected.ts'), 'hacked');

    await expect(WorkbenchSessionManager.verify(session)).rejects.toThrow(/Protected file modified/);
    expect(session.status).toBe('FAILED');
  });

  it('should prevent COMMITTING if required check fails', async () => {
    const session = WorkbenchSessionManager.createSession('m1', 't1', 'a3', baseContract, sourceDir);
    await WorkbenchSessionManager.prepare(session);
    WorkbenchSessionManager.start(session);

    const diff = await WorkbenchSessionManager.verify(session);
    
    // Simulate failed check
    const checkResults = { 'TEST': false };
    
    await expect(WorkbenchSessionManager.commit(session, diff, checkResults)).rejects.toThrow(/Verification check failed/);
    expect(session.status).toBe('FAILED');
  });
});
