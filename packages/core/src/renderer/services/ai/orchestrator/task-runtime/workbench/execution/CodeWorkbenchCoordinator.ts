import { WorkbenchSession, CodeChangePlan, ValidationResult, RepairAttempt, WorkbenchDiff } from '../domain/WorkbenchTypes';
import { IWorkbenchHostAdapter } from '../adapter/IWorkbenchHostAdapter';
import { ChangePlanner } from './ChangePlanner';
import { CodeModifier } from './CodeModifier';
import { ValidationPipeline } from './ValidationPipeline';
import { RepairLoop } from './RepairLoop';
import { PatchGenerator } from './PatchGenerator';

export class CodeWorkbenchCoordinator {
  private changePlanner = new ChangePlanner();
  private codeModifier = new CodeModifier();
  private validationPipeline = new ValidationPipeline();
  private repairLoop = new RepairLoop();
  private patchGenerator = new PatchGenerator();

  constructor(private hostAdapter: IWorkbenchHostAdapter) {}

  public async runCodeModificationCycle(
    session: WorkbenchSession, 
    objective: string, 
    maxRepairs: number = 3
  ): Promise<{ diff: WorkbenchDiff | null; validationResult: ValidationResult }> {
    
    // 1. Plan Changes
    const plan = await this.changePlanner.createPlan(session, objective);

    // 2. Apply Changes to Isolated Workspace
    await this.codeModifier.applyModifications(session, plan, this.hostAdapter.fileSystem);

    // 3. Validation Pipeline
    let validationResult = await this.validationPipeline.runValidation(session, this.hostAdapter);

    // 4. Partial Repair Loop
    let repairAttempts = 0;
    while (!validationResult.passed && repairAttempts < maxRepairs) {
      repairAttempts++;
      const repairAttempt = await this.repairLoop.attemptRepair(session, validationResult, repairAttempts);
      if (repairAttempt.proposedFixes.length > 0) {
        await this.codeModifier.applyModifications(session, {
          planId: `repair-${repairAttempts}`,
          objective: 'Repair validation failures',
          modifications: repairAttempt.proposedFixes,
          expectedImpact: []
        }, this.hostAdapter.fileSystem);
        
        validationResult = await this.validationPipeline.runValidation(session, this.hostAdapter);
      } else {
        break; // No fixes proposed
      }
    }

    // 5. Generate Output
    if (validationResult.passed) {
      const diff = await this.patchGenerator.generateDiff(session, this.hostAdapter);
      return { diff, validationResult };
    }

    return { diff: null, validationResult };
  }
}
