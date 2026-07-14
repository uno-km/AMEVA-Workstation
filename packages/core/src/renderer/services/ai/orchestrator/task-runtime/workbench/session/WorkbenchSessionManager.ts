import { WorkbenchSession, WorkbenchSessionStatus, WorkContract, WorkbenchDiff, DiffFileInfo } from '../domain/WorkbenchTypes';
import { WorkspaceIsolator } from '../workspace/WorkspaceIsolator';
import * as fs from 'fs';
import * as path from 'path';
import crypto from 'crypto';

export class WorkbenchSessionManager {
  
  public static createSession(
    missionId: string, 
    taskId: string, 
    attemptId: string, 
    contract: WorkContract, 
    sourceWorkspace: string
  ): WorkbenchSession {
    this.validateContract(contract);

    return {
      workbenchSessionId: `wb-${attemptId}`,
      missionId,
      taskId,
      attemptId,
      workbenchType: contract.workbenchType,
      sourceWorkspace,
      isolatedWorkspace: path.resolve(sourceWorkspace, '../../workbench', attemptId, 'working'),
      baseRevision: '1',
      currentRevision: '1',
      allowedPaths: contract.allowedFiles,
      protectedPaths: contract.protectedFiles,
      allowedCommands: contract.allowedTools,
      networkPolicy: 'DENY', // Default
      resourceLimits: {
        timeoutMs: 300000, // 5 min
        maxMemoryMb: 1024,
        maxCpuPercent: 100,
        maxSingleFileBytes: 10 * 1024 * 1024, // 10MB
        maxWorkspaceBytes: 500 * 1024 * 1024,
        maxFileCount: 10000,
        maxArtifactBytes: 50 * 1024 * 1024,
        maxCommandOutputBytes: 1024 * 1024, // 1MB
        largeFilePolicy: 'EXCLUDE'
      },
      requiredChecks: contract.requiredChecks,
      expectedArtifacts: contract.expectedOutputs,
      status: 'DECLARED',
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
  }

  private static validateContract(contract: WorkContract) {
    if (!contract.objective || contract.objective.trim() === '') {
      throw new Error('WorkContract validation failed: objective cannot be empty');
    }
    if (!contract.expectedOutputs || contract.expectedOutputs.length === 0) {
      throw new Error('WorkContract validation failed: expectedOutputs must be defined');
    }
    if (!contract.acceptanceCriteria || contract.acceptanceCriteria.length === 0) {
      throw new Error('WorkContract validation failed: acceptanceCriteria must be defined');
    }
    if (!contract.requiredChecks || contract.requiredChecks.length === 0) {
      throw new Error('WorkContract validation failed: requiredChecks must be defined');
    }
    
    const overlap = contract.allowedFiles.filter(f => contract.protectedFiles.includes(f));
    if (overlap.length > 0) {
      throw new Error(`WorkContract validation failed: Conflict between allowed and protected files (${overlap.join(',')})`);
    }
  }

  public static async prepare(session: WorkbenchSession): Promise<void> {
    this.assertState(session, 'DECLARED', 'PREPARING');
    session.status = 'PREPARING';
    session.updatedAt = Date.now();

    try {
      await WorkspaceIsolator.createIsolatedWorkspace(
        session.sourceWorkspace,
        session.isolatedWorkspace,
        session.allowedPaths,
        session.resourceLimits
      );
      session.status = 'READY';
    } catch (error: any) {
      session.status = 'FAILED';
      throw new Error(`Failed to prepare workspace: ${error.message}`);
    }
    session.updatedAt = Date.now();
  }

  public static start(session: WorkbenchSession): void {
    this.assertState(session, 'READY', 'RUNNING');
    session.status = 'RUNNING';
    session.updatedAt = Date.now();
  }

  public static async verify(session: WorkbenchSession): Promise<WorkbenchDiff> {
    this.assertState(session, 'RUNNING', 'VERIFYING');
    session.status = 'VERIFYING';
    session.updatedAt = Date.now();

    const diff = await this.computeDiff(session.sourceWorkspace, session.isolatedWorkspace);

    // Check protected files modification
    for (const mod of [...diff.modifiedFiles, ...diff.deletedFiles, ...diff.renamedFiles]) {
      if (session.protectedPaths.includes(mod.logicalPath)) {
        session.status = 'FAILED';
        throw new Error(`Verification failed: Protected file modified or deleted (${mod.logicalPath})`);
      }
    }

    return diff;
  }

  public static async commit(session: WorkbenchSession, diff: WorkbenchDiff, checkResults: Record<string, boolean>): Promise<void> {
    this.assertState(session, 'VERIFYING', 'COMMITTING');

    // Rule 6: 필수 Check가 하나라도 실패·누락·실행 불가하면 COMPLETED를 금지하라.
    for (const check of session.requiredChecks) {
      if (!checkResults[check]) {
        session.status = 'FAILED';
        throw new Error(`Verification check failed or missing: ${check}`);
      }
    }

    session.status = 'COMMITTING';
    session.updatedAt = Date.now();

    // In a real commit, ArtifactTransactionManager is used. We simulate atomic commit or failure here.
    try {
      // Commit logic goes here: copy isolated files back to source (if permitted) or push via artifact manager.
      // But rule says sourceWorkspace is read-only implicitly until final Artifact Transaction.
      session.status = 'COMPLETED';
    } catch (e: any) {
      session.status = 'ROLLED_BACK';
      throw new Error(`Commit failed: ${e.message}`);
    }
    session.updatedAt = Date.now();
  }

  private static assertState(session: WorkbenchSession, requiredState: WorkbenchSessionStatus, targetState: WorkbenchSessionStatus) {
    if (session.status !== requiredState) {
      throw new Error(`Invalid state transition: ${session.status} -> ${targetState} (Expected ${requiredState})`);
    }
  }

  public static async computeDiff(baseDir: string, workingDir: string): Promise<WorkbenchDiff> {
    const diff: WorkbenchDiff = {
      addedFiles: [],
      modifiedFiles: [],
      deletedFiles: [],
      renamedFiles: [],
      unchangedFiles: [],
      artifactChanges: {},
      changedRanges: {},
      baseRevision: '1',
      newRevision: '2',
      summary: ''
    };

    const scanDir = async (dir: string, base: string, isWorking: boolean, map: Map<string, any>) => {
      if (!fs.existsSync(dir)) return;
      const entries = await fs.promises.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        // Skip .workbench itself
        if (entry.name === '.workbench') continue;

        const fullPath = path.join(dir, entry.name);
        const relPath = path.relative(base, fullPath).replace(/\\/g, '/');

        if (entry.isDirectory()) {
          await scanDir(fullPath, base, isWorking, map);
        } else {
          const stat = await fs.promises.stat(fullPath);
          const hash = crypto.createHash('sha256').update(await fs.promises.readFile(fullPath)).digest('hex');
          
          const isBinary = this.isBinaryFile(fullPath);
          map.set(relPath, { path: fullPath, hash, size: stat.size, isBinary });
        }
      }
    };

    const baseFiles = new Map<string, any>();
    const workingFiles = new Map<string, any>();

    await scanDir(baseDir, baseDir, false, baseFiles);
    await scanDir(workingDir, workingDir, true, workingFiles);

    for (const [relPath, workingInfo] of workingFiles.entries()) {
      const baseInfo = baseFiles.get(relPath);
      
      const fileInfo: DiffFileInfo = {
        logicalPath: relPath,
        previousHash: baseInfo?.hash || '',
        newHash: workingInfo.hash,
        previousSize: baseInfo?.size || 0,
        newSize: workingInfo.size,
        changedRanges: [],
        isBinary: workingInfo.isBinary,
        isProtected: false // to be mapped with protected files later
      };

      if (!baseInfo) {
        diff.addedFiles.push(fileInfo);
      } else {
        if (baseInfo.hash !== workingInfo.hash) {
          diff.modifiedFiles.push(fileInfo);
        } else {
          diff.unchangedFiles.push(fileInfo);
        }
      }
    }

    for (const [relPath, baseInfo] of baseFiles.entries()) {
      if (!workingFiles.has(relPath)) {
        diff.deletedFiles.push({
          logicalPath: relPath,
          previousHash: baseInfo.hash,
          newHash: '',
          previousSize: baseInfo.size,
          newSize: 0,
          changedRanges: [],
          isBinary: baseInfo.isBinary,
          isProtected: false
        });
      }
    }

    return diff;
  }

  private static isBinaryFile(filePath: string): boolean {
    const ext = path.extname(filePath).toLowerCase();
    const binaryExts = ['.png', '.jpg', '.jpeg', '.gif', '.pdf', '.exe', '.dll', '.so', '.dylib', '.zip', '.tar', '.gz'];
    return binaryExts.includes(ext);
  }
}
