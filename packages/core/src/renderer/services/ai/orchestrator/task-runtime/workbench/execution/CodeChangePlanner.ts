import { CodeChangePlan, CodeWorkbenchJob } from '../domain/WorkbenchTypes';

export class CodeChangePlanner {
  public validatePlan(plan: CodeChangePlan, job: CodeWorkbenchJob): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    for (const mod of plan.plannedChanges) {
      // 1. Check if outside allowed files
      if (job.allowedFiles.length > 0) {
        const isAllowed = job.allowedFiles.some(af => mod.targetFile.startsWith(af) || mod.targetFile === af);
        if (!isAllowed) {
          errors.push(`UNPLANNED_CHANGE_DETECTED: Target file ${mod.targetFile} is not in allowed files list.`);
        }
      }

      // 2. Check protected files
      if (job.protectedFiles.length > 0) {
        const isProtected = job.protectedFiles.some(pf => mod.targetFile.startsWith(pf) || mod.targetFile === pf);
        if (isProtected) {
          errors.push(`PROTECTED_FILE_VIOLATION: Target file ${mod.targetFile} is protected and cannot be modified.`);
        }
      }

      // 3. Source revision check
      if (mod.sourceRevision !== job.baseRevision) {
        errors.push(`REVISION_MISMATCH: Modification revision ${mod.sourceRevision} does not match job base revision ${job.baseRevision}.`);
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}
