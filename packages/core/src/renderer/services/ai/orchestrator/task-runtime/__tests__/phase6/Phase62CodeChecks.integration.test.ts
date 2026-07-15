import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CodeValidationPipeline } from '../../workbench/execution/CodeValidationPipeline';
import { IWorkbenchHostAdapter } from '../../workbench/adapter/IWorkbenchHostAdapter';
import { ICodeDiagnosticParser } from '../../workbench/ast/ICodeDiagnosticParser';

describe('Phase 6.2: Code Checks Validation Pipeline', () => {
  let mockAdapter: IWorkbenchHostAdapter;
  let pipeline: CodeValidationPipeline;

  beforeEach(() => {
    mockAdapter = {
      commandExecutor: {
        execute: vi.fn(),
      } as any,
    } as any;

    const parsers = new Map<string, ICodeDiagnosticParser>();
    pipeline = new CodeValidationPipeline(mockAdapter, parsers);
  });

  it('1. Executes TRUSTED_LOCAL_CHECK successfully', async () => {
    vi.mocked(mockAdapter.commandExecutor.execute).mockResolvedValue({
      status: 'COMPLETED', exitCode: 0, stdout: 'ok', stderr: '', interrupted: false, capabilitiesUsed: {}
    });

    const job = {
      isolatedWorkspace: '/iso',
      requiredChecks: ['eslint src/'],
      resourceLimits: { timeoutMs: 1000, maxMemoryMb: 512, maxCpuPercent: 1, maxCommandOutputBytes: 1024 },
      networkPolicy: 'DENY',
      currentRevision: 'r-1'
    } as any;

    const results = await pipeline.runChecks(job);
    expect(results[0].executionMode).toBe('HOST_COMMAND_EXECUTED');
    expect(results[0].status).toBe('PASS');
    expect(mockAdapter.commandExecutor.execute).toHaveBeenCalled();
  });

  it('2. Blocks APPROVAL_REQUIRED commands', async () => {
    const job = {
      isolatedWorkspace: '/iso',
      requiredChecks: ['npm list'],
      resourceLimits: { timeoutMs: 1000, maxMemoryMb: 512, maxCpuPercent: 1, maxCommandOutputBytes: 1024 },
      networkPolicy: 'DENY',
      currentRevision: 'r-1'
    } as any;

    const results = await pipeline.runChecks(job);
    expect(results[0].executionMode).toBe('BLOCKED_BY_APPROVAL_INTEGRATION');
    expect(results[0].status).toBe('BLOCKED');
    expect(mockAdapter.commandExecutor.execute).not.toHaveBeenCalled();
  });

  it('3. Blocks BLOCKED_BY_POLICY commands', async () => {
    const job = {
      isolatedWorkspace: '/iso',
      requiredChecks: ['curl http://example.com'],
      resourceLimits: { timeoutMs: 1000, maxMemoryMb: 512, maxCpuPercent: 1, maxCommandOutputBytes: 1024 },
      networkPolicy: 'DENY',
      currentRevision: 'r-1'
    } as any;

    const results = await pipeline.runChecks(job);
    expect(results[0].executionMode).toBe('BLOCKED_BY_POLICY');
    expect(results[0].status).toBe('BLOCKED');
    expect(mockAdapter.commandExecutor.execute).not.toHaveBeenCalled();
  });
});
