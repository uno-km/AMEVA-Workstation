import { WorkbenchSession, CodeChangePlan } from '../domain/WorkbenchTypes';

export class ChangePlanner {
  public async createPlan(session: WorkbenchSession, objective: string): Promise<CodeChangePlan> {
    // In a real system, this would invoke an LLM to analyze the workspace and generate a plan.
    // For now, we return a mock plan or rely on an injected plan.
    return {
      planId: `plan-${Date.now()}`,
      objective,
      modifications: [],
      expectedImpact: []
    };
  }
}
