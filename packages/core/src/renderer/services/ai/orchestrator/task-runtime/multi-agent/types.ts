/**
 * @file orchestrator/task-runtime/multi-agent/types.ts
 * @system AMEVA OS Desktop Workstation
 * @role Multi-Agent Collaboration Types
 */

export type MultiAgentRole =
  | 'ORCHESTRATOR'
  | 'PLANNER'
  | 'IMPLEMENTER'
  | 'REVIEWER'
  | 'VERIFIER'
  | 'HUMAN'
  | 'MAIN';

export type TaskState =
  | 'READY'
  | 'BLOCKED'
  | 'IN_PROGRESS'
  | 'FAILED'
  | 'COMPLETED'
  | 'CANCELLED';

export type HandoffState =
  | 'DRAFTED'
  | 'SUBMITTED'
  | 'ACCEPTED'
  | 'REJECTED'
  | 'STALE';

export type ReviewState =
  | 'PENDING'
  | 'APPROVED'
  | 'REWORK_REQUIRED';

export type VerificationState =
  | 'PENDING'
  | 'PASSED'
  | 'FAILED';

export type ApprovalState =
  | 'WAITING_HUMAN'
  | 'WAITING_MAIN'
  | 'APPROVED'
  | 'REJECTED';

export interface MultiAgentTask {
  taskId: string;
  missionId: string;
  parentId?: string;
  assignedRole?: MultiAgentRole;
  assignedAgentId?: string;
  state: TaskState;
  dependencies: string[];
  baseRevision: string;
  targetRevision?: string;
  createdAt: number;
  updatedAt: number;
}

export interface Provenance {
  createdBy: string;
  role: MultiAgentRole;
  timestamp: number;
  taskId: string;
  planId?: string;
  targetChangesId?: string;
  missionId?: string;
}

export interface ImplementationPlan {
  artifactId: string;
  revision: number;
  provenance: Provenance;
  baseRevision: string;
  requiredInputs: string[];
  targetFiles: string[];
  steps: {
    description: string;
    expectedOutcome: string;
  }[];
  validationRules: string[];
}

export interface ProposedChanges {
  artifactId: string;
  revision: number;
  provenance: Provenance;
  baseRevision: string;
  patches: {
    filePath: string;
    diff: string;
    checksum: string;
  }[];
}

export interface ReviewReport {
  artifactId: string;
  revision: number;
  provenance: Provenance;
  status: 'APPROVED' | 'REJECTED';
  feedback: {
    filePath?: string;
    lineNumber?: number;
    message: string;
    severity: 'ERROR' | 'WARNING' | 'INFO';
  }[];
}

export interface VerificationReport {
  artifactId: string;
  revision: number;
  provenance: Provenance;
  status: 'PASSED' | 'FAILED';
  testResults: {
    passed: number;
    failed: number;
    logs: string;
  };
  lintResults: {
    passed: boolean;
    issues: string[];
  };
}

export interface ApprovalRequestBundle {
  artifactId: string;
  revision: number;
  provenance: Provenance;
  baseRevision: string;
  artifacts: {
    planId: string;
    changesId: string;
    reviewId: string;
    verificationId: string;
  };
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

export interface CapabilityMatrix {
  fileRead: boolean;
  patchGenerate: boolean;
  executeTests: boolean;
  networkRequest: boolean;
  requestApply: boolean;
  approve: boolean;
}

export const RoleCapabilities: Record<MultiAgentRole, CapabilityMatrix> = {
  ORCHESTRATOR: { fileRead: false, patchGenerate: false, executeTests: false, networkRequest: false, requestApply: true, approve: false },
  PLANNER: { fileRead: true, patchGenerate: false, executeTests: false, networkRequest: false, requestApply: false, approve: false },
  IMPLEMENTER: { fileRead: true, patchGenerate: true, executeTests: true, networkRequest: false, requestApply: false, approve: false },
  REVIEWER: { fileRead: true, patchGenerate: false, executeTests: false, networkRequest: false, requestApply: false, approve: false },
  VERIFIER: { fileRead: true, patchGenerate: false, executeTests: true, networkRequest: false, requestApply: false, approve: false },
  HUMAN: { fileRead: true, patchGenerate: false, executeTests: false, networkRequest: false, requestApply: false, approve: true },
  MAIN: { fileRead: true, patchGenerate: false, executeTests: false, networkRequest: false, requestApply: false, approve: true }
};
