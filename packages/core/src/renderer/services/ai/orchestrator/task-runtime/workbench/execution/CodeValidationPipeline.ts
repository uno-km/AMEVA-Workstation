import { CodeWorkbenchJob, CheckResult, CheckCommandClassification, CheckExecutionMode } from '../domain/WorkbenchTypes';
import { IWorkbenchHostAdapter } from '../adapter/IWorkbenchHostAdapter';
import { ICodeDiagnosticParser } from '../ast/ICodeDiagnosticParser';

export class CodeValidationPipeline {
  constructor(
    private hostAdapter: IWorkbenchHostAdapter,
    private parsers: Map<string, ICodeDiagnosticParser>
  ) {}

  public async runChecks(job: CodeWorkbenchJob): Promise<CheckResult[]> {
    const results: CheckResult[] = [];

    // Build execution graph. Simple sequential execution for now based on job.requiredChecks
    for (const check of job.requiredChecks) {
      const result = await this.executeCheck(job, check);
      results.push(result);

      if (result.status === 'FAIL' || result.status === 'BLOCKED' || result.status === 'INTERRUPTED') {
        // Halt subsequent required checks
        break;
      }
    }

    return results;
  }

  private async executeCheck(job: CodeWorkbenchJob, checkCmd: string): Promise<CheckResult> {
    const parts = checkCmd.split(' ');
    const executable = parts[0];
    const args = parts.slice(1);

    const checkId = `chk-${Date.now()}`;
    const classification = this.classifyCommand(executable, args);
    
    let status: CheckResult['status'] = 'NOT_RUN';
    let executionMode: CheckExecutionMode = 'BLOCKED_BY_POLICY';
    let exitCode = -1;
    let stdoutSummary = '';
    let stderrSummary = '';
    const diagnostics: any[] = [];
    
    if (classification === 'BLOCKED_BY_POLICY') {
      status = 'BLOCKED';
    } else if (classification === 'APPROVAL_REQUIRED') {
      status = 'BLOCKED';
      executionMode = 'BLOCKED_BY_APPROVAL_INTEGRATION';
    } else {
      // TRUSTED_LOCAL_CHECK
      executionMode = 'HOST_COMMAND_EXECUTED';
      status = 'RUNNING';

      try {
        const cmdResult = await this.hostAdapter.commandExecutor.execute({
          commandId: checkId,
          executable,
          arguments: args,
          workingDirectory: job.isolatedWorkspace,
          environmentKeys: {},
          timeoutMs: job.resourceLimits.timeoutMs,
          memoryLimitMb: job.resourceLimits.maxMemoryMb,
          cpuLimit: job.resourceLimits.maxCpuPercent,
          networkRequired: false,
          expectedExitCodes: [0],
          purpose: `Validation: ${checkCmd}`,
          riskLevel: 'MEDIUM',
          approvalRequired: false
        }, job.networkPolicy, job.resourceLimits.maxCommandOutputBytes);

        stdoutSummary = cmdResult.stdout.slice(0, 1000);
        stderrSummary = cmdResult.stderr.slice(0, 1000);
        exitCode = cmdResult.exitCode;

        if (cmdResult.status === 'COMPLETED' && exitCode === 0) {
          status = 'PASS';
        } else if (cmdResult.status === 'TIMED_OUT') {
          status = 'INTERRUPTED';
        } else {
          status = 'FAIL';
          // Parse diagnostics
          const parser = this.parsers.get(executable) || this.parsers.get('default');
          if (parser) {
            diagnostics.push(...parser.parse(cmdResult.stderr || cmdResult.stdout, checkCmd, executable));
          }
        }
      } catch (e: any) {
        status = 'FAIL';
        stderrSummary = e.message;
      }
    }

    return {
      checkId,
      checkType: executable,
      sourceOfCommand: 'package.json',
      commandPlan: {
        commandId: checkId,
        executable,
        arguments: args,
        workingDirectory: job.isolatedWorkspace,
        environmentKeys: {},
        timeoutMs: 30000,
        memoryLimitMb: 1024,
        cpuLimit: 1,
        networkRequired: false,
        expectedExitCodes: [0],
        purpose: checkCmd,
        riskLevel: 'MEDIUM',
        approvalRequired: false
      },
      required: true,
      capabilityStatus: classification === 'TRUSTED_LOCAL_CHECK' ? 'AVAILABLE' : 'BLOCKED_BY_APPROVAL_INTEGRATION',
      approvalStatus: 'PENDING',
      status,
      exitCode,
      startedAt: Date.now(),
      completedAt: Date.now(),
      durationMs: 0,
      stdoutSummary,
      stderrSummary,
      diagnostics,
      artifactReferences: [],
      affectedFiles: [],
      retryable: status === 'FAIL',
      executionMode,
      verifiedRevision: job.currentRevision,
      inputDigest: 'hash123'
    };
  }

  private classifyCommand(executable: string, args: string[]): CheckCommandClassification {
    const blockedCmds = ['install', 'publish', 'deploy', 'push', 'fetch', 'clone', 'curl', 'wget'];
    if (blockedCmds.includes(executable) || args.some(a => blockedCmds.includes(a))) {
      return 'BLOCKED_BY_POLICY';
    }

    if (['npm', 'yarn', 'pnpm', 'node', 'powershell'].includes(executable)) {
      return 'APPROVAL_REQUIRED';
    }

    return 'TRUSTED_LOCAL_CHECK';
  }
}
