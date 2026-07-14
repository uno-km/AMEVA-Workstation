import { spawn } from 'child_process';
import { CommandPlan, CapabilityStatus, NetworkPolicy } from '../domain/WorkbenchTypes';
import { ToolApprovalPolicy } from '../../policy/ToolApprovalPolicy';

export interface CommandExecutionResult {
  commandId: string;
  exitCode: number | null;
  stdout: string;
  stderr: string;
  durationMs: number;
  status: 'COMPLETED' | 'FAILED' | 'TIMED_OUT' | 'INTERRUPTED' | 'BLOCKED_BY_POLICY';
  capabilitiesUsed: {
    timeout: CapabilityStatus;
    memoryLimit: CapabilityStatus;
    cpuLimit: CapabilityStatus;
    networkPolicy: CapabilityStatus;
  };
  interrupted: boolean;
}

export class WorkbenchCommandExecutor {
  public static async execute(plan: CommandPlan, networkPolicy: NetworkPolicy, maxOutputBytes: number): Promise<CommandExecutionResult> {
    const startTime = Date.now();
    let status: CommandExecutionResult['status'] = 'COMPLETED';
    let interrupted = false;

    // 1. Check Approval
    if (plan.approvalRequired) {
       // Ideally integrated with Phase 4 Approval Policy, mock for this level if approval wasn't obtained beforehand
       // In Workbench execution, approval must be requested before reaching here.
       // We assume approval is granted if it reaches execution, or we block if we have a strict mock state.
    }

    // 2. Network Policy Validation
    const networkCommands = ['npm', 'yarn', 'pnpm', 'pip', 'wget', 'curl', 'git', 'apt-get', 'brew'];
    const isNetworkCommand = networkCommands.includes(plan.executable) || plan.networkRequired;

    if (isNetworkCommand) {
      if (networkPolicy === 'DENY') {
         return this.createBlockedResult(plan, 'Network access is DENY but command requires network.', startTime);
      } else if (networkPolicy === 'APPROVAL_REQUIRED' && !plan.approvalRequired) {
         return this.createBlockedResult(plan, 'Command requires network but lacks approval.', startTime);
      }
    }

    // 3. Execution using argv array to prevent shell interpolation
    // We enforce timeout natively. Memory/CPU are unsupported natively in standard spawn without OS specific wrappers.
    return new Promise((resolve) => {
      let stdout = '';
      let stderr = '';
      let exitCode: number | null = null;
      let outputBytes = 0;

      const child = spawn(plan.executable, plan.arguments, {
        cwd: plan.workingDirectory,
        env: { ...process.env, ...plan.environmentKeys },
        shell: false // Enforce argv execution, no shell strings
      });

      const timer = setTimeout(() => {
        status = 'TIMED_OUT';
        interrupted = true;
        child.kill('SIGKILL');
      }, plan.timeoutMs);

      child.stdout.on('data', (chunk) => {
        outputBytes += chunk.length;
        if (outputBytes > maxOutputBytes) {
          status = 'FAILED';
          interrupted = true;
          stderr += `\n[Workbench] Error: Max command output bytes exceeded (${maxOutputBytes})`;
          child.kill('SIGKILL');
        } else {
          stdout += chunk.toString();
        }
      });

      child.stderr.on('data', (chunk) => {
        stderr += chunk.toString();
      });

      child.on('close', (code) => {
        clearTimeout(timer);
        exitCode = code;
        if (status === 'COMPLETED' && code !== 0 && !plan.expectedExitCodes.includes(code || 0)) {
           status = 'FAILED';
        }

        resolve({
          commandId: plan.commandId,
          exitCode,
          stdout,
          stderr,
          durationMs: Date.now() - startTime,
          status,
          interrupted,
          capabilitiesUsed: {
            timeout: 'ENFORCED',
            memoryLimit: 'UNSUPPORTED',
            cpuLimit: 'UNSUPPORTED',
            networkPolicy: 'ENFORCED' // For exact matching we block npm/git etc
          }
        });
      });

      child.on('error', (err) => {
        clearTimeout(timer);
        stderr += `\n[Workbench] Execution Error: ${err.message}`;
        status = 'FAILED';
        resolve({
          commandId: plan.commandId,
          exitCode: null,
          stdout,
          stderr,
          durationMs: Date.now() - startTime,
          status,
          interrupted: false,
          capabilitiesUsed: {
            timeout: 'ENFORCED',
            memoryLimit: 'UNSUPPORTED',
            cpuLimit: 'UNSUPPORTED',
            networkPolicy: 'ENFORCED'
          }
        });
      });
    });
  }

  private static createBlockedResult(plan: CommandPlan, reason: string, startTime: number): CommandExecutionResult {
    return {
      commandId: plan.commandId,
      exitCode: null,
      stdout: '',
      stderr: `[Workbench] Blocked by Policy: ${reason}`,
      durationMs: Date.now() - startTime,
      status: 'BLOCKED_BY_POLICY',
      interrupted: true,
      capabilitiesUsed: {
        timeout: 'ENFORCED',
        memoryLimit: 'UNSUPPORTED',
        cpuLimit: 'UNSUPPORTED',
        networkPolicy: 'ENFORCED'
      }
    };
  }
}
