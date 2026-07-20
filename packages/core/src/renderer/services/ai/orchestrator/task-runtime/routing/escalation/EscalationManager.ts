/**
 * @file routing/escalation/EscalationManager.ts
 * @system AMEVA OS Desktop Workstation
 * @role Handles step-by-step model escalation and loop prevention.
 */

import type { ModelRole, EscalationPackage, RoutingDecision } from '../domain/types';

export interface EscalationResult {
  escalationReason: string;
  targetRole: ModelRole | null;
  excludedModelIds: string[];
  failedCombinationDigest: string;
  requiredCapabilities: string[];
  remainingBudget: number;
}

export class EscalationManager {
  private history: EscalationPackage[] = [];

  private static ROLE_ORDER: ModelRole[] = ['RULE_ENGINE', 'SMALL_MODEL', 'MEDIUM_MODEL', 'PRIMARY_MODEL'];

  public recordEscalation(pkg: EscalationPackage): void {
    this.history.push(pkg);
  }

  public getNextRole(currentRole: ModelRole | null): ModelRole {
    if (!currentRole || currentRole === 'PRIMARY_MODEL') {
      return 'PRIMARY_MODEL';
    }
    const idx = EscalationManager.ROLE_ORDER.indexOf(currentRole);
    if (idx === -1 || idx === EscalationManager.ROLE_ORDER.length - 1) {
      return 'PRIMARY_MODEL';
    }
    return EscalationManager.ROLE_ORDER[idx + 1];
  }

  public processEscalation(pkg: EscalationPackage, currentDecision: import('../domain/RoutingDecisionResult').RoutingDecisionResult | undefined, budgetRemaining: number): EscalationResult {
    const digest = this.createDigest(pkg);
    const isDuplicate = this.isExactDuplicate(pkg.previousModelId, pkg.defectSignatures, pkg.retryScope);

    if (isDuplicate || pkg.previousRole === 'PRIMARY_MODEL') {
      return {
        escalationReason: isDuplicate ? 'Duplicate combination failed' : 'PRIMARY model failed',
        targetRole: null, // Signals termination
        excludedModelIds: [pkg.previousModelId],
        failedCombinationDigest: digest,
        requiredCapabilities: [],
        remainingBudget: budgetRemaining
      };
    }

    this.recordEscalation(pkg);

    return {
      escalationReason: pkg.escalationReason || 'Capability insufficient',
      targetRole: this.getNextRole(pkg.previousRole),
      excludedModelIds: this.history.map(h => h.previousModelId),
      failedCombinationDigest: digest,
      requiredCapabilities: [],
      remainingBudget: budgetRemaining - 1
    };
  }

  private createDigest(pkg: EscalationPackage): string {
    return `${pkg.previousModelId}|${pkg.retryScope}|${pkg.defectSignatures.join(',')}`;
  }

  /**
   * Checks if an exact same combination of model and failure signature has been attempted.
   */
  public isExactDuplicate(modelId: string, defectSignatures: string[], retryScope: string): boolean {
    return this.history.some(pkg => 
      pkg.previousModelId === modelId &&
      pkg.retryScope === retryScope &&
      pkg.defectSignatures.length === defectSignatures.length &&
      pkg.defectSignatures.every(d => defectSignatures.includes(d))
    );
  }

  public getHistory(): EscalationPackage[] {
    return [...this.history];
  }
}
