/**
 * @file orchestrator/task-runtime/multi-agent/CapabilityRouter.ts
 * @system AMEVA OS Desktop Workstation
 * @role Capability Routing and Security Boundary
 */

import { MultiAgentRole, RoleCapabilities, CapabilityMatrix } from './types.ts';

export class CapabilityRouter {
  public canExecute(role: MultiAgentRole, action: keyof CapabilityMatrix): boolean {
    const caps = RoleCapabilities[role];
    if (!caps) return false;
    return caps[action];
  }

  public validateHighRiskAction(role: MultiAgentRole, action: string, requiresMainApproval: boolean, requiresUserApproval: boolean): boolean {
    // 6.4 Apply Pipeline transition must be strictly verified
    if (action === 'EXECUTE_APPLY') {
      if (role !== 'MAIN' && role !== 'HUMAN' && role !== 'ORCHESTRATOR') {
        return false;
      }
    }

    if (requiresMainApproval && role !== 'MAIN') return false;
    if (requiresUserApproval && role !== 'HUMAN') return false;

    return true;
  }

  public routePayload(role: MultiAgentRole, payload: any): any {
    // Secret/Token raw delivery forbidden. Redact sensitive info.
    const sanitized = { ...payload };
    if (sanitized.secrets || sanitized.tokens) {
      sanitized.secrets = '[REDACTED]';
      sanitized.tokens = '[REDACTED]';
    }
    return sanitized;
  }
}
