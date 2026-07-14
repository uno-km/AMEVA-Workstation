import { spawn } from 'child_process';
import { CommandPlan, CommandExecutionResult } from '../domain/WorkbenchTypes';
import { ICommandExecutorAdapter } from './ICommandExecutorAdapter';

export class NodeCommandExecutorAdapter implements ICommandExecutorAdapter {
  private activeCommands: Map<string, any> = new Map();

  public async execute(plan: CommandPlan, networkPolicy: string, maxOutputBytes: number): Promise<CommandExecutionResult> {
    return new Promise((resolve) => {
      let stdout = '';
      let stderr = '';
      let exitCode: number | null = null;
      let outputBytes = 0;
      let status: CommandExecutionResult['status'] = 'COMPLETED';
      let interrupted = false;

      const child = spawn(plan.executable, plan.arguments, {
        cwd: plan.workingDirectory,
        env: { ...process.env, ...plan.environmentKeys },
        shell: false
      });

      this.activeCommands.set(plan.commandId, child);

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
        this.activeCommands.delete(plan.commandId);
        exitCode = code;
        if (status === 'COMPLETED' && code !== 0 && !plan.expectedExitCodes.includes(code || 0)) {
           status = 'FAILED';
        }

        resolve({
          status,
          exitCode: exitCode || 0,
          stdout,
          stderr,
          interrupted,
          capabilitiesUsed: this.getCapabilities()
        });
      });

      child.on('error', (err) => {
        clearTimeout(timer);
        this.activeCommands.delete(plan.commandId);
        stderr += `\n[Workbench] Execution Error: ${err.message}`;
        status = 'FAILED';
        resolve({
          status,
          exitCode: -1,
          stdout,
          stderr,
          interrupted: false,
          capabilitiesUsed: this.getCapabilities()
        });
      });
    });
  }

  public async cancel(commandId: string): Promise<void> {
    const child = this.activeCommands.get(commandId);
    if (child) {
      child.kill('SIGKILL');
      this.activeCommands.delete(commandId);
    }
  }

  public async getStatus(commandId: string): Promise<'RUNNING' | 'COMPLETED' | 'FAILED' | 'INTERRUPTED'> {
    return this.activeCommands.has(commandId) ? 'RUNNING' : 'COMPLETED';
  }

  public getCapabilities(): Record<string, string> {
    return {
      timeout: 'ENFORCED',
      memoryLimit: 'UNSUPPORTED',
      cpuLimit: 'UNSUPPORTED',
      networkPolicy: 'UNENFORCED'
    };
  }
}
