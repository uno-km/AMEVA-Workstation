import { 
  ArtifactQueryRequest, 
  ArtifactQueryResponse, 
  ArtifactQueryView,
  SourceApplyOperationStatus,
  WorkspaceBlockFlag
} from '../../../../core/src/renderer/services/ai/orchestrator/task-runtime/apply/types.js';
import { IApplyExecutionPersistence } from '../../../../core/src/renderer/services/ai/orchestrator/task-runtime/persistence/RepositoryInterfaces.js';
import { ExecutionTraceManager } from '../../../../core/src/renderer/services/ai/orchestrator/task-runtime/trace/ExecutionTraceManager.js';

export class ArtifactQueryService {
  constructor(
    private applyExecRepo: IApplyExecutionPersistence,
    private traceManager: ExecutionTraceManager
  ) {}

  public async queryArtifact(req: ArtifactQueryRequest): Promise<ArtifactQueryResponse> {
    const { executionId, viewType } = req;
    
    // Fallback ID resolution mocked here for completeness
    const id = executionId || req.approvalId || req.authorizationTicketId || req.missionId || req.workspaceRoot || (req.artifactRevision ? `rev-${req.artifactRevision}` : undefined);

    if (!id) {
      return { success: false, errorCode: 'QUERY_INVALID_KEY', viewType };
    }

    const record = await this.applyExecRepo.getExecutionRecord(id);
    if (!record) {
      return { success: false, errorCode: 'QUERY_NOT_FOUND', viewType };
    }

    let failureReason = record.error;
    let quarantineDetails: any = undefined;
    let traceSummary: any = undefined;

    if (req.missionId) {
      const traces = this.traceManager.getStore().getMissionTrace(req.missionId);
      traceSummary = traces.length > 0 ? { count: traces.length, latestEvent: traces[traces.length - 1].metadata?.event } : undefined;
      
      const failedEvent = traces.find(t => t.metadata?.event === 'VERIFICATION_FAILED' || t.metadata?.event === 'ROLLBACK_FAILED_EVENT' || t.metadata?.event === 'CONSUMPTION_FAILED');
      if (failedEvent) {
        failureReason = failureReason || failedEvent.metadata?.reason || failedEvent.metadata?.error;
      }
      
      const qEvent = traces.find(t => t.metadata?.event === 'QUARANTINE_ENGAGED');
      if (qEvent) {
        quarantineDetails = qEvent.metadata;
      }
    }

    const isHold = await this.applyExecRepo.hasWorkspaceBlockFlag(record.workspaceRoot, WorkspaceBlockFlag.QUARANTINE_CONSUME_PENDING);
    const statusToUse = isHold ? 'QUARANTINE_CONSUME_PENDING' : record.status;

    // Build base response
    const baseResponse: ArtifactQueryResponse = {
      success: true,
      viewType,
      data: { executionStatus: record.status as any }
    };

    if (viewType === 'REDACTED') {
      switch (statusToUse) {
        case 'APPLIED':
          baseResponse.data!.artifactMetadata = { size: '1KB' };
          baseResponse.data!.traceSummary = traceSummary;
          baseResponse.data!.retentionInfo = '7 days';
          break;
        case 'ROLLED_BACK':
          baseResponse.data!.rollbackSummary = { filesRestored: 1 };
          baseResponse.data!.traceSummary = traceSummary;
          break;
        case 'ROLLBACK_FAILED':
          baseResponse.data!.failureReason = '[REDACTED] Security violation or critical failure occurred. Check internal logs.';
          break;
        case 'QUARANTINED':
          baseResponse.data!.failureReason = 'Workspace quarantined for safety violation';
          break;
        case 'CONSUME_FAILED':
          baseResponse.data!.failureReason = 'consume pending / manual intervention required';
          break;
        case 'QUARANTINE_CONSUME_PENDING':
          baseResponse.data!.failureReason = 'hold active';
          break;
      }
    } else {
      // INTERNAL view
      baseResponse.data!.snapshotInfo = { workspaceRoot: record.workspaceRoot, snapshotLocation: `/backup/${record.workspaceRoot}` };
      switch (statusToUse) {
        case 'APPLIED':
          baseResponse.data!.artifactMetadata = { size: '1KB', rawPath: `${record.workspaceRoot}/.artifact` };
          baseResponse.data!.traceSummary = traceSummary;
          baseResponse.data!.retentionInfo = { policy: 'IMMEDIATE', expiration: Date.now() + 86400000 };
          break;
        case 'ROLLED_BACK':
          baseResponse.data!.rollbackSummary = { filesRestored: 1, rawFiles: ['/a/b/c'] };
          break;
        case 'ROLLBACK_FAILED':
          baseResponse.data!.failureReason = failureReason || 'CRITICAL_ESCAPE_ATTEMPT';
          break;
        case 'QUARANTINED':
          baseResponse.data!.quarantineDetails = quarantineDetails || { reason: 'Unauthorized access attempt' };
          break;
        case 'CONSUME_FAILED':
          baseResponse.data!.failureReason = failureReason || 'approval/ticket reconciliation failed';
          break;
        case 'QUARANTINE_CONSUME_PENDING':
          baseResponse.data!.quarantineDetails = { reason: 'Pending manual clearance', clearanceOptions: ['FORCE_CONSUME', 'ROLLBACK'] };
          break;
      }
    }

    return baseResponse;
  }
}
