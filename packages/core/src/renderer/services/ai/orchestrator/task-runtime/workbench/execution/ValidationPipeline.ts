import { WorkbenchSession, ValidationResult } from '../domain/WorkbenchTypes';
import { IWorkbenchHostAdapter } from '../adapter/IWorkbenchHostAdapter';

export class ValidationPipeline {
  public async runValidation(
    session: WorkbenchSession, 
    hostAdapter: IWorkbenchHostAdapter
  ): Promise<ValidationResult> {
    
    // In Phase 6.2, we run build/test in the isolated workspace.
    // For this demonstration, let's assume we read a validation plan from session.requiredChecks.
    // E.g., ['tsc --noEmit', 'vitest run']

    const errors: string[] = [];
    const warnings: string[] = [];
    let fullStdout = '';
    let fullStderr = '';

    for (const check of session.requiredChecks) {
      const parts = check.split(' ');
      const executable = parts[0];
      const args = parts.slice(1);

      try {
        const result = await hostAdapter.commandExecutor.execute({
          commandId: `val-${Date.now()}`,
          executable,
          arguments: args,
          workingDirectory: session.isolatedWorkspace,
          environmentKeys: {},
          timeoutMs: 30000,
          memoryLimitMb: 1024,
          cpuLimit: 1,
          networkRequired: false,
          expectedExitCodes: [0],
          purpose: `Validation: ${check}`,
          riskLevel: 'MEDIUM',
          approvalRequired: false
        }, 'DENY', 1024 * 1024);

        fullStdout += `[${check}] stdout:\n${result.stdout}\n`;
        fullStderr += `[${check}] stderr:\n${result.stderr}\n`;

        if (result.status !== 'COMPLETED' || result.exitCode !== 0) {
          errors.push(`Validation check '${check}' failed with exit code ${result.exitCode}.`);
        }
      } catch (err: any) {
        errors.push(`Validation check '${check}' encountered an error: ${err.message}`);
      }
    }

    return {
      passed: errors.length === 0,
      errors,
      warnings,
      stdout: fullStdout,
      stderr: fullStderr
    };
  }
}
