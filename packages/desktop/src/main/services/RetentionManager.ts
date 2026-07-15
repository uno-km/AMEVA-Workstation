import { 
  SourceApplyOperationStatus,
  WorkspaceBlockFlag,
  RetentionPolicy
} from '../../../../core/src/renderer/services/ai/orchestrator/task-runtime/apply/types.js';
import { IApplyExecutionPersistence } from '../../../../core/src/renderer/services/ai/orchestrator/task-runtime/persistence/RepositoryInterfaces';

export class RetentionManager {
  constructor(
    private applyExecRepo: IApplyExecutionPersistence
  ) {}

  public async evaluateRetention(executionId: string): Promise<{
    shouldCleanupSnapshot: boolean;
    reason: string;
  }> {
    const record = await this.applyExecRepo.getExecutionRecord(executionId);
    if (!record) {
      return { shouldCleanupSnapshot: false, reason: 'NOT_FOUND' };
    }

    // Check workspace block flags
    const isHold = await this.applyExecRepo.hasWorkspaceBlockFlag(record.workspaceRoot, WorkspaceBlockFlag.QUARANTINE_CONSUME_PENDING);
    if (isHold) {
      return { shouldCleanupSnapshot: false, reason: 'QUARANTINE_CONSUME_PENDING_HOLD' };
    }

    switch (record.status) {
      case 'APPLIED':
      case 'ROLLED_BACK':
        // Safe to cleanup snapshots
        return { shouldCleanupSnapshot: true, reason: 'COMPLETED_STATE' };
      
      case 'ROLLBACK_FAILED':
      case 'QUARANTINED':
      case 'CONSUME_FAILED':
        // Must preserve snapshot for manual recovery or audit
        return { shouldCleanupSnapshot: false, reason: 'FAILED_OR_QUARANTINED_STATE' };

      default:
        // In-progress states, keep snapshot
        return { shouldCleanupSnapshot: false, reason: 'IN_PROGRESS' };
    }
  }

  public async executeCleanup(executionId: string): Promise<boolean> {
    const { shouldCleanupSnapshot } = await this.evaluateRetention(executionId);
    if (!shouldCleanupSnapshot) {
      return false;
    }

    // Abstract implementation: this is where we'd do fs.rmdir on the snapshot
    // For now we just return true to signify successful cleanup logic firing
    return true;
  }
}
