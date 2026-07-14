import { describe, it, expect } from 'vitest';
import { WorkbenchCommandExecutor } from '../../workbench/execution/WorkbenchCommandExecutor';
import { CommandPlan } from '../../workbench/domain/WorkbenchTypes';
import * as os from 'os';

describe('Phase6.1 CommandPolicy', () => {
  const isWindows = os.platform() === 'win32';
  
  const createPlan = (overrides: Partial<CommandPlan> = {}): CommandPlan => ({
    commandId: 'cmd1',
    executable: isWindows ? 'cmd.exe' : 'echo',
    arguments: isWindows ? ['/c', 'echo', 'test'] : ['test'],
    workingDirectory: process.cwd(),
    environmentKeys: {},
    timeoutMs: 5000,
    memoryLimitMb: 1024,
    cpuLimit: 100,
    networkRequired: false,
    expectedExitCodes: [0],
    purpose: 'Test',
    riskLevel: 'LOW',
    approvalRequired: false,
    ...overrides
  });

  it('should execute command and return exitCode 0', async () => {
    const plan = createPlan();
    const result = await WorkbenchCommandExecutor.execute(plan, 'DENY', 1024);

    expect(result.status).toBe('COMPLETED');
    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toContain('test');
    expect(result.capabilitiesUsed.memoryLimit).toBe('UNSUPPORTED');
  });

  it('should enforce timeout and terminate process', async () => {
    const plan = createPlan({
      executable: isWindows ? 'ping' : 'sleep',
      arguments: isWindows ? ['127.0.0.1', '-n', '10'] : ['10'],
      timeoutMs: 100
    });

    const result = await WorkbenchCommandExecutor.execute(plan, 'DENY', 1024 * 1024);
    
    expect(result.status).toBe('TIMED_OUT');
    expect(result.interrupted).toBe(true);
    expect(result.capabilitiesUsed.timeout).toBe('ENFORCED');
  });

  it('should block network commands when NetworkPolicy is DENY', async () => {
    const plan = createPlan({
      executable: 'npm',
      arguments: ['install'],
      networkRequired: true
    });

    const result = await WorkbenchCommandExecutor.execute(plan, 'DENY', 1024);
    
    expect(result.status).toBe('BLOCKED_BY_POLICY');
    expect(result.stderr).toContain('DENY');
  });

  it('should block unapproved network commands when APPROVAL_REQUIRED', async () => {
    const plan = createPlan({
      executable: 'curl',
      arguments: ['http://example.com'],
      networkRequired: true,
      approvalRequired: false // simulating missing approval
    });

    const result = await WorkbenchCommandExecutor.execute(plan, 'APPROVAL_REQUIRED', 1024);
    
    expect(result.status).toBe('BLOCKED_BY_POLICY');
    expect(result.stderr).toContain('approval');
  });
});
