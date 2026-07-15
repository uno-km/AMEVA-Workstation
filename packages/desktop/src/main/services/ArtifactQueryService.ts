import { 
  ArtifactQueryRequest, 
  ArtifactQueryResponse, 
  ArtifactQueryView,
  SourceApplyOperationStatus
} from '../../../../core/src/renderer/services/ai/orchestrator/task-runtime/apply/types.js';
import { IApplyExecutionPersistence } from '../../../../core/src/renderer/services/ai/orchestrator/task-runtime/persistence/RepositoryInterfaces';
import { ExecutionTraceManager } from '../../../../core/src/renderer/services/ai/orchestrator/task-runtime/trace/ExecutionTraceManager';

export class ArtifactQueryService {
  constructor(
    private applyExecRepo: IApplyExecutionPersistence,
    private traceManager: ExecutionTraceManager
  ) {}

  public async queryArtifact(req: ArtifactQueryRequest): Promise<ArtifactQueryResponse> {
    const { executionId, viewType } = req;
    
    if (!executionId) {
      return { success: false, errorCode: 'MISSING_EXECUTION_ID', viewType };
    }

    const record = await this.applyExecRepo.getExecutionRecord(executionId);
    if (!record) {
      return { success: false, errorCode: 'NOT_FOUND', viewType };
    }

    let failureReason = record.error;
    let quarantineDetails: any = undefined;

    if (req.missionId) {
      const traces = this.traceManager.getStore().getMissionTrace(req.missionId);
      const failedEvent = traces.find(t => t.metadata?.event === 'VERIFICATION_FAILED' || t.metadata?.event === 'ROLLBACK_FAILED_EVENT' || t.metadata?.event === 'CONSUMPTION_FAILED');
      if (failedEvent) {
        failureReason = failureReason || failedEvent.metadata?.reason || failedEvent.metadata?.error;
      }
      
      const qEvent = traces.find(t => t.metadata?.event === 'QUARANTINE_ENGAGED');
      if (qEvent) {
        quarantineDetails = qEvent.metadata;
      }
    }

    if (viewType === 'REDACTED') {
      return {
        success: true,
        viewType: 'REDACTED',
        data: {
          executionStatus: record.status,
          failureReason: this.redactFailureReason(failureReason, record.status),
          quarantineDetails: this.redactQuarantineDetails(quarantineDetails)
        }
      };
    } else {
      // INTERNAL
      return {
        success: true,
        viewType: 'INTERNAL',
        data: {
          executionStatus: record.status,
          snapshotInfo: { workspaceRoot: record.workspaceRoot },
          failureReason: failureReason,
          quarantineDetails: quarantineDetails
        }
      };
    }
  }

  private redactFailureReason(reason?: string, status?: string): string | undefined {
    if (!reason) return undefined;
    if (status === 'QUARANTINED' || status === 'ROLLBACK_FAILED') {
      return '[REDACTED] Security violation or critical failure occurred. Check internal logs.';
    }
    return reason;
  }

  private redactQuarantineDetails(details?: any): any {
    if (!details) return undefined;
    return {
      alert: 'Quarantine Engaged',
      message: 'System isolated the operation due to safety violations.'
    };
  }
}
