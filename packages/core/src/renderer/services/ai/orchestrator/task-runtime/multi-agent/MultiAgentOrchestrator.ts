/**
 * @file orchestrator/task-runtime/multi-agent/MultiAgentOrchestrator.ts
 * @system AMEVA OS Desktop Workstation
 * @role Multi-Agent Collaboration Orchestrator
 */

import {
  MultiAgentTask,
  ImplementationPlan,
  ProposedChanges,
  ReviewReport,
  VerificationReport,
  ApprovalRequestBundle,
  HandoffState,
  MultiAgentRole,
  Provenance
} from './types.ts';
import { ConflictResolver, ConflictResolutionResult } from './ConflictResolver.ts';
import { CapabilityRouter } from './CapabilityRouter.ts';
import { TraceAuditor, AgentEventType } from './TraceAuditor.ts';

export class MultiAgentOrchestrator {
  private tasks: Map<string, MultiAgentTask> = new Map();
  private plans: Map<string, ImplementationPlan> = new Map();
  private changes: Map<string, ProposedChanges> = new Map();
  private reviews: Map<string, ReviewReport> = new Map();
  private verifications: Map<string, VerificationReport> = new Map();

  constructor(
    private conflictResolver: ConflictResolver,
    private capabilityRouter: CapabilityRouter,
    private traceAuditor: TraceAuditor
  ) {}

  public createTask(missionId: string, dependencies: string[] = [], baseRevision: string): MultiAgentTask {
    const taskId = `task-${Date.now()}`;
    const task: MultiAgentTask = {
      taskId,
      missionId,
      state: dependencies.length > 0 ? 'BLOCKED' : 'READY',
      dependencies,
      baseRevision,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    this.tasks.set(taskId, task);
    this.traceAuditor.appendEvent('agentActionStarted', taskId, missionId, 'ORCHESTRATOR', { action: 'CREATE_TASK' });
    return task;
  }

  public getTask(taskId: string): MultiAgentTask | undefined {
    return this.tasks.get(taskId);
  }

  public submitPlan(plan: ImplementationPlan): void {
    if (!this.capabilityRouter.canExecute(plan.provenance.role, 'fileRead')) {
      throw new Error("UNAUTHORIZED_ROLE");
    }
    
    this.plans.set(plan.artifactId, plan);
    this.traceAuditor.appendEvent('handoffCreated', plan.provenance.taskId, plan.provenance.missionId || 'N/A', plan.provenance.role, { artifactId: plan.artifactId, type: 'PLAN' });
  }

  public submitChanges(changes: ProposedChanges): void {
    if (!this.capabilityRouter.canExecute(changes.provenance.role, 'patchGenerate')) {
      throw new Error("UNAUTHORIZED_ROLE");
    }

    const plan = this.plans.get(changes.provenance.planId!);
    if (plan) {
      const conflictCheck = this.conflictResolver.detectPlanMismatch(plan, changes);
      if (conflictCheck.hasConflict) {
        this.traceAuditor.appendEvent('conflictDetected', changes.provenance.taskId, changes.provenance.missionId || 'N/A', changes.provenance.role, { reason: conflictCheck.reason });
        // Implicitly Rework state
        return;
      }
    }

    // Checking stale state against orchestrator known state (mocked as baseRevision check)
    const task = this.tasks.get(changes.provenance.taskId);
    if (task && task.baseRevision !== changes.baseRevision) {
      this.traceAuditor.appendEvent('conflictDetected', changes.provenance.taskId, changes.provenance.missionId || 'N/A', 'ORCHESTRATOR', { reason: 'Base Revision Mismatch' });
      return;
    }

    this.changes.set(changes.artifactId, changes);
    this.traceAuditor.appendEvent('handoffCreated', changes.provenance.taskId, changes.provenance.missionId || 'N/A', changes.provenance.role, { artifactId: changes.artifactId, type: 'CHANGES' });
  }

  public submitReview(review: ReviewReport): void {
    this.reviews.set(review.artifactId, review);
    if (review.status === 'REJECTED') {
      this.traceAuditor.appendEvent('handoffRejected', review.provenance.taskId, review.provenance.missionId || 'N/A', review.provenance.role, { reason: 'Review Failed' });
    } else {
      this.traceAuditor.appendEvent('handoffCreated', review.provenance.taskId, review.provenance.missionId || 'N/A', review.provenance.role, { artifactId: review.artifactId, type: 'REVIEW' });
    }
  }

  public submitVerification(verification: VerificationReport): void {
    this.verifications.set(verification.artifactId, verification);
    if (verification.status === 'FAILED') {
      this.traceAuditor.appendEvent('verificationFailed', verification.provenance.taskId, verification.provenance.missionId || 'N/A', verification.provenance.role, { issues: verification.lintResults.issues });
    } else {
      this.traceAuditor.appendEvent('handoffCreated', verification.provenance.taskId, verification.provenance.missionId || 'N/A', verification.provenance.role, { artifactId: verification.artifactId, type: 'VERIFICATION' });
    }
  }

  public requestApproval(bundle: ApprovalRequestBundle): void {
    if (!this.capabilityRouter.validateHighRiskAction(bundle.provenance.role, 'EXECUTE_APPLY', false, false)) {
      this.traceAuditor.appendEvent('quarantineEscalated', bundle.provenance.missionId, bundle.provenance.missionId, 'ORCHESTRATOR', { reason: 'Direct Apply Bypass Attempted' });
      throw new Error("SECURITY_BOUNDARY_VIOLATION");
    }

    // Request 6.4 Approval
    this.traceAuditor.appendEvent('approvalRequested', bundle.provenance.missionId, bundle.provenance.missionId, 'ORCHESTRATOR', { bundleId: bundle.artifactId, riskLevel: bundle.riskLevel });
  }

  public handleForgedPayload(payload: any): void {
    this.traceAuditor.appendEvent('quarantineEscalated', 'unknown', 'unknown', 'ORCHESTRATOR', { reason: 'Forged payload ignored', payload: this.capabilityRouter.routePayload('ORCHESTRATOR', payload) });
  }

  public resumeTasks(): void {
    // Mock resume of blocked/failed tasks
    for (const [id, task] of this.tasks.entries()) {
      if (task.state === 'BLOCKED') {
        task.state = 'READY';
        this.traceAuditor.appendEvent('resumeRecovered', task.taskId, task.missionId, 'ORCHESTRATOR', { state: task.state });
      }
    }
  }
}
