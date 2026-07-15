import { describe, it, expect, vi } from 'vitest';
import { ArtifactQueryService } from '../ArtifactQueryService';
import { RetentionManager } from '../RetentionManager';
import { FinalReleaseGateAuditor } from '../FinalReleaseGateAuditor';
import { SourceApplyBenchmarkCollector } from '../SourceApplyBenchmarkCollector';
import { 
  SourceApplyRepositoryInMemory, 
  ApplyExecutionPersistenceInMemory 
} from '../../../../../core/src/renderer/services/ai/orchestrator/task-runtime/persistence/InMemoryRepositories.js';
import { ExecutionTraceManager } from '../../../../../core/src/renderer/services/ai/orchestrator/task-runtime/trace/ExecutionTraceManager.js';
import { WorkspaceBlockFlag } from '../../../../../core/src/renderer/services/ai/orchestrator/task-runtime/apply/types.js';

describe('Phase 6.4.3 Final Release Gate & Query/Retention tests', () => {
  it('should handle Artifact Query for APPLIED (Redacted vs Internal)', async () => {
    const traceManager = new ExecutionTraceManager();
    const applyRepo = new SourceApplyRepositoryInMemory();
    const applyExecRepo = new ApplyExecutionPersistenceInMemory(applyRepo);
    
    await applyExecRepo.saveExecutionRecord({
      executionId: 'exec-1',
      authorizationTicketId: 'tick-1',
      workspaceRoot: '/mock/workspace/root',
      status: 'APPLIED',
      startedAt: Date.now(),
      updatedAt: Date.now()
    });
    
    traceManager.getStore().appendEvent({
      missionId: 'mission-1',
      traceId: 'mission-1',
      eventId: 'ev1',
      eventType: 'custom',
      timestamp: Date.now(),
      metadata: { event: 'VERIFICATION_PASSED' }
    } as any);

    const querySvc = new ArtifactQueryService(applyExecRepo, traceManager);
    
    const redactedRes = await querySvc.queryArtifact({
      executionId: 'exec-1',
      missionId: 'mission-1',
      viewType: 'REDACTED'
    });
    expect(redactedRes.success).toBe(true);
    expect(redactedRes.data?.snapshotInfo).toBeUndefined(); // Redacted
    
    const internalRes = await querySvc.queryArtifact({
      executionId: 'exec-1',
      missionId: 'mission-1',
      viewType: 'INTERNAL'
    });
    expect(internalRes.success).toBe(true);
    expect(internalRes.data?.snapshotInfo?.workspaceRoot).toBe('/mock/workspace/root'); // Internal view exposes raw path
  });

  it('should redact ROLLBACK_FAILED and QUARANTINED failure reasons', async () => {
    const traceManager = new ExecutionTraceManager();
    const applyRepo = new SourceApplyRepositoryInMemory();
    const applyExecRepo = new ApplyExecutionPersistenceInMemory(applyRepo);
    
    await applyExecRepo.saveExecutionRecord({
      executionId: 'exec-q',
      authorizationTicketId: 'tick-q',
      workspaceRoot: '/mock/workspace/root',
      status: 'QUARANTINED',
      error: 'CRITICAL_ESCAPE_ATTEMPT',
      startedAt: Date.now(),
      updatedAt: Date.now()
    });

    const querySvc = new ArtifactQueryService(applyExecRepo, traceManager);
    const res = await querySvc.queryArtifact({
      executionId: 'exec-q',
      missionId: 'mission-1',
      viewType: 'REDACTED'
    });

    expect(res.data?.failureReason).toContain('[REDACTED]');
    expect(res.data?.failureReason).not.toContain('CRITICAL_ESCAPE_ATTEMPT');
  });

  it('should manage Retention properly for COMPLETED vs QUARANTINED', async () => {
    const applyRepo = new SourceApplyRepositoryInMemory();
    const applyExecRepo = new ApplyExecutionPersistenceInMemory(applyRepo);
    const retentionMgr = new RetentionManager(applyExecRepo);

    // APPLIED
    await applyExecRepo.saveExecutionRecord({
      executionId: 'exec-applied',
      authorizationTicketId: 'tick-1',
      workspaceRoot: '/ws1',
      status: 'APPLIED',
      startedAt: Date.now(),
      updatedAt: Date.now()
    });
    
    const resApplied = await retentionMgr.evaluateRetention('exec-applied');
    expect(resApplied.shouldCleanupSnapshot).toBe(true); // Should cleanup

    // CONSUME_FAILED
    await applyExecRepo.saveExecutionRecord({
      executionId: 'exec-fail',
      authorizationTicketId: 'tick-2',
      workspaceRoot: '/ws2',
      status: 'CONSUME_FAILED',
      startedAt: Date.now(),
      updatedAt: Date.now()
    });
    
    const resFail = await retentionMgr.evaluateRetention('exec-fail');
    expect(resFail.shouldCleanupSnapshot).toBe(false); // Do NOT cleanup snapshot
    expect(resFail.reason).toBe('FAILED_OR_QUARANTINED_STATE');

    // QUARANTINE_CONSUME_PENDING hold
    await applyExecRepo.setWorkspaceBlockFlag('/ws3', WorkspaceBlockFlag.QUARANTINE_CONSUME_PENDING);
    await applyExecRepo.saveExecutionRecord({
      executionId: 'exec-hold',
      authorizationTicketId: 'tick-3',
      workspaceRoot: '/ws3',
      status: 'CONSUMING_APPROVAL',
      startedAt: Date.now(),
      updatedAt: Date.now()
    });
    
    const resHold = await retentionMgr.evaluateRetention('exec-hold');
    expect(resHold.shouldCleanupSnapshot).toBe(false); 
    expect(resHold.reason).toBe('QUARANTINE_CONSUME_PENDING_HOLD');
  });

  it('should run benchmark and generate trace report', () => {
    const bench = new SourceApplyBenchmarkCollector();
    bench.start();
    // simulate work
    const benchResult = bench.stop(true, undefined, 2);
    expect(benchResult.success).toBe(true);
    expect(benchResult.durationMs).toBeGreaterThanOrEqual(0);

    const traceManager = new ExecutionTraceManager();
    traceManager.getStore().appendEvent({
      missionId: 'mission-bench',
      traceId: 'mission-bench',
      eventId: 'evbench',
      eventType: 'custom',
      timestamp: Date.now(),
      metadata: { event: 'VERIFICATION_PASSED' }
    } as any);

    const auditor = new FinalReleaseGateAuditor(traceManager);
    const report = auditor.generateReport(
      'mission-bench',
      'APPLIED',
      benchResult.success,
      true,
      true
    );

    expect(report.isCleanExecution).toBe(true);
    expect(report.canonicalJson.executionStatus).toBe('APPLIED');
    expect(report.summaryMarkdown).toContain('Final Release Gate Report: Mission mission-bench');
    expect(report.summaryMarkdown).toContain('PASS');
  });

  it('Final Release Gate fails if quarantine is triggered', () => {
    const traceManager = new ExecutionTraceManager();
    traceManager.getStore().appendEvent({
      missionId: 'mission-fail',
      traceId: 'mission-fail',
      eventId: 'evfail',
      eventType: 'custom',
      timestamp: Date.now(),
      metadata: { event: 'QUARANTINE_ENGAGED' }
    } as any);

    const auditor = new FinalReleaseGateAuditor(traceManager);
    const report = auditor.generateReport(
      'mission-fail',
      'QUARANTINED',
      true,
      true,
      true
    );

    expect(report.isCleanExecution).toBe(false);
    expect(report.containsQuarantine).toBe(true);
    expect(report.summaryMarkdown).toContain('Yes (WARNING)');
  });
});
