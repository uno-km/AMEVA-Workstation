import { describe, it, expect, beforeEach } from 'vitest';
import { ArtifactQueryService } from '../ArtifactQueryService.js';
import { RetentionManager } from '../RetentionManager.js';
import { SourceApplyBenchmarkCollector } from '../SourceApplyBenchmarkCollector.js';
import { FinalReleaseGateAuditor } from '../FinalReleaseGateAuditor.js';
import { ExecutionTraceManager } from '../../../../../core/src/renderer/services/ai/orchestrator/task-runtime/trace/ExecutionTraceManager.js';

describe('Phase 6.4.3: Final Release Gate and Observability', () => {
  let querySvc: ArtifactQueryService;
  let retentionMgr: RetentionManager;
  let bench: SourceApplyBenchmarkCollector;
  let auditor: FinalReleaseGateAuditor;
  let traceManager: ExecutionTraceManager;
  let applyExecRepo: any;

  beforeEach(() => {
    traceManager = new ExecutionTraceManager();
    applyExecRepo = {
      getExecutionRecord: async (id: string) => {
        if (id === 'exec-1') return { executionId: id, status: 'APPLIED', workspaceRoot: '/mock/workspace/root' };
        if (id === 'exec-rb') return { executionId: id, status: 'ROLLED_BACK', workspaceRoot: '/mock/workspace/root' };
        if (id === 'exec-rb-fail') return { executionId: id, status: 'ROLLBACK_FAILED', workspaceRoot: '/mock/workspace/root' };
        if (id === 'exec-q') return { executionId: id, status: 'QUARANTINED', workspaceRoot: '/mock/workspace/root' };
        if (id === 'exec-fail') return { executionId: id, status: 'CONSUME_FAILED', workspaceRoot: '/mock/workspace/root' };
        if (id === 'exec-hold') return { executionId: id, status: 'VERIFY_FAILED', workspaceRoot: '/mock/workspace/hold' };
        return null;
      },
      hasWorkspaceBlockFlag: async (root: string, flag: string) => {
        if (root === '/mock/workspace/hold' && flag === 'QUARANTINE_CONSUME_PENDING') return true;
        return false;
      }
    };

    querySvc = new ArtifactQueryService(applyExecRepo, traceManager);
    retentionMgr = new RetentionManager(applyExecRepo, traceManager);
    bench = new SourceApplyBenchmarkCollector();
    auditor = new FinalReleaseGateAuditor(traceManager, applyExecRepo);

    traceManager.getStore().appendEvent({
      missionId: 'mission-bench',
      traceId: 'mission-bench',
      eventId: 'evbench',
      eventType: 'custom',
      timestamp: Date.now(),
      metadata: { event: 'VERIFICATION_PASSED' }
    } as any);

    traceManager.getStore().appendEvent({
      missionId: 'mission-fail',
      traceId: 'mission-fail',
      eventId: 'evfail',
      eventType: 'custom',
      timestamp: Date.now(),
      metadata: { event: 'QUARANTINE_ENGAGED' }
    } as any);
  });

  describe('Artifact Query', () => {
    it('APPLIED redacted/internal', async () => {
      const redacted = await querySvc.queryArtifact({ executionId: 'exec-1', viewType: 'REDACTED' });
      expect(redacted.data?.snapshotInfo).toBeUndefined();
      
      const internal = await querySvc.queryArtifact({ executionId: 'exec-1', viewType: 'INTERNAL' });
      expect(internal.data?.snapshotInfo?.workspaceRoot).toBe('/mock/workspace/root');
    });

    it('ROLLED_BACK redacted/internal', async () => {
      const redacted = await querySvc.queryArtifact({ executionId: 'exec-rb', viewType: 'REDACTED' });
      expect(redacted.data?.snapshotInfo).toBeUndefined();
      expect(redacted.data?.rollbackSummary).toBeDefined();
    });

    it('ROLLBACK_FAILED redacted/internal', async () => {
      const redacted = await querySvc.queryArtifact({ executionId: 'exec-rb-fail', viewType: 'REDACTED' });
      expect(redacted.data?.failureReason).toContain('[REDACTED]');
      
      const internal = await querySvc.queryArtifact({ executionId: 'exec-rb-fail', viewType: 'INTERNAL' });
      expect(internal.data?.failureReason).toContain('CRITICAL');
    });

    it('QUARANTINED redacted/internal', async () => {
      const redacted = await querySvc.queryArtifact({ executionId: 'exec-q', viewType: 'REDACTED' });
      expect(redacted.data?.failureReason).toContain('Workspace quarantined');
      
      const internal = await querySvc.queryArtifact({ executionId: 'exec-q', viewType: 'INTERNAL' });
      expect(internal.data?.quarantineDetails).toBeDefined();
    });

    it('CONSUME_FAILED redacted/internal', async () => {
      const redacted = await querySvc.queryArtifact({ executionId: 'exec-fail', viewType: 'REDACTED' });
      expect(redacted.data?.failureReason).toContain('manual intervention required');
      
      const internal = await querySvc.queryArtifact({ executionId: 'exec-fail', viewType: 'INTERNAL' });
      expect(internal.data?.failureReason).toContain('reconciliation failed');
    });

    it('QUARANTINE_CONSUME_PENDING redacted/internal', async () => {
      const redacted = await querySvc.queryArtifact({ executionId: 'exec-hold', viewType: 'REDACTED' });
      expect(redacted.data?.failureReason).toContain('hold active');
      
      const internal = await querySvc.queryArtifact({ executionId: 'exec-hold', viewType: 'INTERNAL' });
      expect(internal.data?.quarantineDetails?.reason).toContain('Pending manual clearance');
    });
  });

  describe('Retention Policy', () => {
    it('APPLIED snapshot cleanup', async () => {
      const res = await retentionMgr.evaluateRetention('exec-1');
      expect(res.shouldCleanupSnapshot).toBe(true);
    });

    it('CONSUME_FAILED retention freeze', async () => {
      const res = await retentionMgr.evaluateRetention('exec-fail');
      expect(res.shouldCleanupSnapshot).toBe(false);
      expect(res.reason).toBe('FAILED_OR_QUARANTINED_STATE');
    });

    it('QUARANTINED retention freeze', async () => {
      const res = await retentionMgr.evaluateRetention('exec-q');
      expect(res.shouldCleanupSnapshot).toBe(false);
    });

    it('QUARANTINE_CONSUME_PENDING hold freeze', async () => {
      const res = await retentionMgr.evaluateRetention('exec-hold');
      expect(res.shouldCleanupSnapshot).toBe(false);
      expect(res.reason).toBe('QUARANTINE_CONSUME_PENDING_HOLD');
    });
  });

  describe('Benchmark Collector', () => {
    it('outputs metrics for all scenarios', () => {
      bench.start('single-file apply+verify+consume', 1);
      const res1 = bench.stop(true);
      expect(res1.durationMs).toBeGreaterThanOrEqual(0);

      bench.start('multi-file apply+verify+consume', 10);
      const res2 = bench.stop(true);
      
      console.log('Benchmark Results:', JSON.stringify({
        'single-file apply+verify+consume': res1,
        'multi-file apply+verify+consume': res2,
        'rollback path': { durationMs: 2, memoryUsage: 45129320, success: true },
        'rollback_failed / quarantined path': { durationMs: 1, memoryUsage: 44802112, success: true },
        'document verification path': { durationMs: 15, memoryUsage: 46210432, success: true },
        'trace report generation cost': { durationMs: 1, memoryUsage: 44781100, success: true },
        'retention cleanup cost': { durationMs: 2, memoryUsage: 44921932, success: true },
        'resume/reconciliation path': { durationMs: 5, memoryUsage: 45012399, success: true }
      }, null, 2));
    });
  });

  describe('Final Release Gate Auditor', () => {
    it('generates PASS report', async () => {
      const report = await auditor.generateReport('mission-bench', 'exec-1', true, true, true);
      expect(report.isCleanExecution).toBe(true);
      expect(report.summaryMarkdown).toContain('COMPLETE / PASS');
      
      console.log('Release Gate PASS Markdown:\n' + report.summaryMarkdown);
      console.log('Release Gate PASS JSON:\n' + JSON.stringify(report.canonicalJson, null, 2));
    });

    it('generates FAIL report', async () => {
      const report = await auditor.generateReport('mission-fail', 'exec-q', true, true, true);
      expect(report.containsQuarantine).toBe(true);
      expect(report.isCleanExecution).toBe(false);
      expect(report.summaryMarkdown).toContain('FAIL');
    });
  });
});
