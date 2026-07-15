import { 
  SourceApplyOperationStatus,
  WorkspaceBlockFlag,
  RetentionPolicy,
  RetentionEvaluationResult
} from '../../../../core/src/renderer/services/ai/orchestrator/task-runtime/apply/types.js';
import { IApplyExecutionPersistence } from '../../../../core/src/renderer/services/ai/orchestrator/task-runtime/persistence/RepositoryInterfaces.js';
import { ExecutionTraceManager } from '../../../../core/src/renderer/services/ai/orchestrator/task-runtime/trace/ExecutionTraceManager.js';

export class RetentionManager {
  constructor(
    private applyExecRepo: IApplyExecutionPersistence,
    private traceManager?: ExecutionTraceManager
  ) {}

  public async evaluateRetention(executionId: string): Promise<RetentionEvaluationResult> {
    const record = await this.applyExecRepo.getExecutionRecord(executionId);
    if (!record) {
      return this.buildResult(false, false, false, false, 'NOT_FOUND');
    }

    const isHold = await this.applyExecRepo.hasWorkspaceBlockFlag(record.workspaceRoot, WorkspaceBlockFlag.QUARANTINE_CONSUME_PENDING);
    if (isHold) {
      return this.buildResult(false, false, false, true, 'QUARANTINE_CONSUME_PENDING_HOLD');
    }

    switch (record.status) {
      case 'APPLIED':
      case 'ROLLED_BACK':
        return this.buildResult(true, true, false, false, 'COMPLETED_STATE', Date.now() + 7 * 86400000);
      
      case 'ROLLBACK_FAILED':
      case 'QUARANTINED':
      case 'CONSUME_FAILED':
        return this.buildResult(false, false, true, true, 'FAILED_OR_QUARANTINED_STATE');

      default:
        // In-progress states
        return this.buildResult(false, false, false, false, 'IN_PROGRESS');
    }
  }

  private buildResult(
    shouldCleanupSnapshot: boolean,
    shouldArchive: boolean,
    shouldPreserveIndefinitely: boolean,
    requiresManualIntervention: boolean,
    reason: string,
    nextReviewAt?: number
  ): RetentionEvaluationResult {
    return {
      shouldCleanupSnapshot,
      shouldArchive,
      shouldPreserveIndefinitely,
      requiresManualIntervention,
      reason,
      nextReviewAt
    };
  }

  public async executeCleanup(executionId: string): Promise<boolean> {
    const result = await this.evaluateRetention(executionId);
    if (!result.shouldCleanupSnapshot) {
      return false;
    }

    try {
      // Abstract implementation: fs.rmdir on snapshot
      return true;
    } catch (e) {
      if (this.traceManager) {
        // Trace warning
        this.traceManager.getStore().appendEvent({
          missionId: 'system',
          traceId: 'system',
          eventId: 'cleanup-' + executionId,
          eventType: 'SNAPSHOT_CLEANUP_WARNING',
          timestamp: Date.now(),
          metadata: { executionId, error: e }
        } as any);
      }
      return false; // Does not revert APPLIED
    }
  }
}
