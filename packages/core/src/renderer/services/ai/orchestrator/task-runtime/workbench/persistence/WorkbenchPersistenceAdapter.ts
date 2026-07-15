import { IRuntimePersistenceAdapter } from '../../persistence/RuntimePersistenceAdapter';
import { WorkbenchSession, CommandPlan, WorkbenchDiff, WorkContract } from '../domain/WorkbenchTypes';

export interface WorkbenchPersistenceData {
  session: WorkbenchSession;
  contract: WorkContract;
  commandState: Record<string, 'RUNNING' | 'COMPLETED' | 'FAILED' | 'INTERRUPTED'>;
  diff: WorkbenchDiff | null;
  approvalWaitingState: string | null;
  idempotencyKeys: string[];
}

export class WorkbenchPersistenceAdapter {
  constructor(private readonly baseAdapter: IRuntimePersistenceAdapter) {}

  private getPersistenceKey(attemptId: string): string {
    return `workbench_v1_${attemptId}`;
  }

  public async saveSession(data: WorkbenchPersistenceData): Promise<void> {
    await this.baseAdapter.saveCheckpointData(
      data.session.missionId,
      this.getPersistenceKey(data.session.attemptId),
      data
    );
  }

  public async loadSession(missionId: string, attemptId: string): Promise<WorkbenchPersistenceData | null> {
    const data = await this.baseAdapter.loadCheckpointData(missionId, this.getPersistenceKey(attemptId));
    if (!data) return null;

    const parsedData = data as WorkbenchPersistenceData;

    // Rule 10: Resume ??RUNNING Commandë¥??±ê³µ?¼ë¡œ ì¶”ì •?˜ì? ë§ˆë¼.
    // RUNNING -> INTERRUPTED
    if (parsedData.commandState) {
      for (const [cmdId, state] of Object.entries(parsedData.commandState)) {
        if (state === 'RUNNING') {
          parsedData.commandState[cmdId] = 'INTERRUPTED';
        }
      }
    }

    if (parsedData.session.status === 'RUNNING') {
       // Command is interrupted, so session is technically back to READY or remains RUNNING with interrupted commands.
       // The exact transition is left to the session manager, but we update the command state.
    }

    return parsedData;
  }

  public async deleteSession(missionId: string, attemptId: string): Promise<void> {
    // If deleteCheckpoint is not supported, we overwrite with null or empty object
    // Assuming we can't easily delete a single checkpoint key without extending IRuntimePersistenceAdapter.
    // Overwrite with empty data to signify deletion.
    await this.baseAdapter.saveCheckpointData(
      missionId,
      this.getPersistenceKey(attemptId),
      { _deleted: true }
    );
  }

  public async preventDuplicateCommandExecution(missionId: string, cmdId: string, idempotencyKey: string): Promise<boolean> {
     const existing = await this.baseAdapter.loadIdempotencyRecord(idempotencyKey);
     if (existing) return true;

     await this.baseAdapter.saveIdempotencyRecord({
       idempotencyKey,
       missionId,
       cmdId,
       timestamp: Date.now()
     });
     return false;
  }
}
