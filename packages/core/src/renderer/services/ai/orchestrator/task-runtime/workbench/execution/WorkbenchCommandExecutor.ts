import { CommandPlan, CapabilityStatus, NetworkPolicy, CommandExecutionResult } from '../domain/WorkbenchTypes';
import { ICommandExecutorAdapter } from '../adapter/ICommandExecutorAdapter';

export class WorkbenchCommandExecutor {
  constructor(private readonly executorAdapter: ICommandExecutorAdapter) {}

  public async execute(plan: CommandPlan, networkPolicy: NetworkPolicy, maxOutputBytes: number): Promise<CommandExecutionResult> {
    const startTime = Date.now();

    // 1. Check Approval
    if (plan.approvalRequired) {
       // Mock for now, assuming approval was required but maybe not granted if we are strict.
       // The actual orchestrator handles approval gathering before reaching here.
    }

    // 2. Network Policy Validation
    const isNetworkCommand = this.isNetworkCommand(plan);

    if (isNetworkCommand) {
      if (networkPolicy === 'DENY') {
         return this.createBlockedResult(plan, 'Network access is DENY but command requires network.', startTime);
      } else if (networkPolicy === 'APPROVAL_REQUIRED' && !plan.approvalRequired) {
         return this.createBlockedResult(plan, 'Command requires network but lacks approval.', startTime);
      } else if (plan.riskLevel === 'MEDIUM' || plan.riskLevel === 'HIGH') {
         // UNENFORCED environment safety catch: medium/high network commands must be approved
         if (!plan.approvalRequired) {
             return this.createBlockedResult(plan, `Network command with risk ${plan.riskLevel} requires approval in UNENFORCED network isolation.`, startTime);
         }
      }
    }

    // 3. Delegate Execution to Adapter
    return await this.executorAdapter.execute(plan, networkPolicy, maxOutputBytes);
  }

  private isNetworkCommand(plan: CommandPlan): boolean {
    if (plan.networkRequired) return true;

    const exe = plan.executable.toLowerCase();
    const args = plan.arguments.join(' ').toLowerCase();

    // Direct network tools
    const networkTools = ['npm', 'yarn', 'pnpm', 'pip', 'wget', 'curl', 'git', 'apt-get', 'brew'];
    if (networkTools.includes(exe)) {
      if (exe === 'git' && !args.includes('fetch') && !args.includes('pull') && !args.includes('clone') && !args.includes('push')) {
        return false;
      }
      return true;
    }

    // Script runners that can easily do network
    if (exe === 'node' || exe === 'python' || exe === 'powershell' || exe === 'pwsh') {
      return true;
    }

    // Custom executables in local dir (assumed potentially unsafe network)
    if (exe.startsWith('./') || exe.startsWith('.\\')) {
      return true;
    }

    // URL or registry arguments
    if (args.includes('http://') || args.includes('https://') || args.includes('registry')) {
      return true;
    }

    return false;
  }

  private createBlockedResult(plan: CommandPlan, reason: string, startTime: number): CommandExecutionResult {
    return {
      status: 'BLOCKED_BY_POLICY',
      exitCode: -1,
      stdout: '',
      stderr: `[Workbench] Blocked by Policy: ${reason}`,
      interrupted: true,
      capabilitiesUsed: {
        timeout: 'ENFORCED',
        memoryLimit: 'UNSUPPORTED',
        cpuLimit: 'UNSUPPORTED',
        networkPolicy: 'UNENFORCED'
      }
    };
  }
}
