import { WorkbenchSession, WorkbenchSessionStatus, WorkContract, WorkbenchDiff, DiffFileInfo } from '../domain/WorkbenchTypes';
import { IWorkbenchHostAdapter } from '../adapter/IWorkbenchHostAdapter';

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
      isolatedWorkspace: `${sourceWorkspace}/.workbench/${attemptId}/working`,
      baseRevision: '1',
      currentRevision: '1',
      allowedPaths: contract.allowedFiles,
      protectedPaths: contract.protectedFiles,
      allowedCommands: contract.allowedTools,
      networkPolicy: 'DENY',
      resourceLimits: {
        timeoutMs: 300000,
        maxMemoryMb: 1024,
        maxCpuPercent: 100,
        maxSingleFileBytes: 10 * 1024 * 1024,
        maxWorkspaceBytes: 500 * 1024 * 1024,
        maxFileCount: 10000,
        maxArtifactBytes: 50 * 1024 * 1024,
        maxCommandOutputBytes: 1024 * 1024,
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

  public static async prepare(session: WorkbenchSession, hostAdapter: IWorkbenchHostAdapter): Promise<void> {
    this.assertState(session, 'DECLARED', 'PREPARING');
    session.status = 'PREPARING';
    session.updatedAt = Date.now();

    try {
      if (hostAdapter.bindSession) {
        await hostAdapter.bindSession(session);
      }
      await hostAdapter.createSnapshot(
        session.sourceWorkspace,
        session.isolatedWorkspace,
        session.allowedPaths,
        session.resourceLimits,
        // @ts-ignore - contract needs requiredInputs mapped or extracted, using default empty array if not in session
        []
      );
      session.status = 'READY';
    } catch (error: any) {
      if (error.message.includes('WAITING_USER')) {
        session.status = 'WAITING_USER';
      } else {
        session.status = 'FAILED';
      }
      throw new Error(`Failed to prepare workspace: ${error.message}`);
    }
    session.updatedAt = Date.now();
  }

  public static start(session: WorkbenchSession): void {
    if (session.status === 'FAILED' || session.status === 'WAITING_USER') {
      throw new Error('Cannot transition to RUNNING from ' + session.status);
    }
    this.assertState(session, 'READY', 'RUNNING');
    session.status = 'RUNNING';
    session.updatedAt = Date.now();
  }

  public static async verify(session: WorkbenchSession, hostAdapter: IWorkbenchHostAdapter): Promise<WorkbenchDiff> {
    this.assertState(session, 'RUNNING', 'VERIFYING');
    session.status = 'VERIFYING';
    session.updatedAt = Date.now();

    const diff = await this.computeDiff(session.sourceWorkspace, session.isolatedWorkspace, hostAdapter);

    for (const mod of [...diff.modifiedFiles, ...diff.deletedFiles]) {
      if (session.protectedPaths.includes(mod.logicalPath)) {
        session.status = 'FAILED';
        throw new Error(`Verification failed: Protected file modified or deleted (${mod.logicalPath})`);
      }
    }

    return diff;
  }

  public static async commit(
    session: WorkbenchSession, 
    diff: WorkbenchDiff, 
    checkResults: Record<string, boolean>,
    hasMissingArtifacts: boolean,
    hasWaitingApprovals: boolean
  ): Promise<void> {
    this.assertState(session, 'VERIFYING', 'COMMITTING');

    for (const check of session.requiredChecks) {
      if (checkResults[check] === undefined) {
        session.status = 'FAILED';
        throw new Error(`Verification check NOT_RUN: ${check}`);
      }
      if (!checkResults[check]) {
        session.status = 'FAILED';
        throw new Error(`Verification check failed: ${check}`);
      }
    }

    if (hasMissingArtifacts) {
      session.status = 'FAILED';
      throw new Error('Verification failed: required artifacts are not committed');
    }

    if (hasWaitingApprovals) {
       session.status = 'WAITING_USER';
       throw new Error('Waiting for user approval');
    }

    session.status = 'COMMITTING';
    session.updatedAt = Date.now();

    // Source Apply is NOT_IMPLEMENTED in Phase 6.1
    // We only commit artifacts, we do not modify the source workspace here.
    
    session.status = 'COMPLETED';
    session.updatedAt = Date.now();
  }

  private static assertState(session: WorkbenchSession, requiredState: WorkbenchSessionStatus, targetState: WorkbenchSessionStatus) {
    if (session.status !== requiredState) {
      throw new Error(`Invalid state transition: ${session.status} -> ${targetState} (Expected ${requiredState})`);
    }
  }

  public static async computeDiff(baseDir: string, workingDir: string, hostAdapter: IWorkbenchHostAdapter): Promise<WorkbenchDiff> {
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

    const scanDir = async (dir: string, base: string, map: Map<string, any>) => {
      let listOutput = '';
      try {
        listOutput = await hostAdapter.fileSystem.list(dir);
      } catch {
        return;
      }
      
      const lines = listOutput.split('\n');
      if (lines.length < 2 || lines[0].startsWith('(디렉토리가')) return;

      for (let i = 2; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        const parts = line.split('\t');
        const name = parts[0];
        const isDir = parts[1] === '<DIR>';
        const fullPath = `${dir}/${name}`;
        const relPath = fullPath.replace(`${base}/`, '');

        if (name === '.workbench') continue;

        if (isDir) {
          await scanDir(fullPath, base, map);
        } else {
          const stat = await hostAdapter.fileSystem.stat(fullPath);
          const hash = await hostAdapter.fileSystem.hash(fullPath);
          const isBinary = this.isBinaryFile(name);
          map.set(relPath, { path: fullPath, hash, size: stat.size, isBinary });
        }
      }
    };

    const baseFiles = new Map<string, any>();
    const workingFiles = new Map<string, any>();

    await scanDir(baseDir, baseDir, baseFiles);
    await scanDir(workingDir, workingDir, workingFiles);

    // Track for rename detection (ADDED + DELETED with same hash)
    const addedCandidates: any[] = [];
    const deletedCandidates: any[] = [];

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
        isProtected: false
      };

      if (!baseInfo) {
        addedCandidates.push(fileInfo);
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
        deletedCandidates.push({
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

    // Rename detection (RENAMED_CANDIDATE)
    for (let i = addedCandidates.length - 1; i >= 0; i--) {
      const added = addedCandidates[i];
      const delIdx = deletedCandidates.findIndex(d => d.previousHash === added.newHash && added.newHash !== null);
      if (delIdx !== -1) {
        const deleted = deletedCandidates.splice(delIdx, 1)[0];
        // Only mark as candidate since we don't have explicit move events
        diff.addedFiles.push(added);
        diff.deletedFiles.push(deleted);
        diff.summary += `RENAMED_CANDIDATE: ${deleted.logicalPath} -> ${added.logicalPath}\n`;
        addedCandidates.splice(i, 1);
      }
    }

    diff.addedFiles.push(...addedCandidates);
    diff.deletedFiles.push(...deletedCandidates);

    return diff;
  }

  private static isBinaryFile(fileName: string): boolean {
    const ext = fileName.split('.').pop()?.toLowerCase();
    const binaryExts = ['png', 'jpg', 'jpeg', 'gif', 'pdf', 'exe', 'dll', 'so', 'dylib', 'zip', 'tar', 'gz'];
    return ext ? binaryExts.includes(ext) : false;
  }
}
