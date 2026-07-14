export type WorkbenchType = 'CODE' | 'DOCUMENT' | 'MIXED';

export type WorkbenchSessionStatus = 
  | 'DECLARED'
  | 'PREPARING'
  | 'READY'
  | 'RUNNING'
  | 'VERIFYING'
  | 'COMMITTING'
  | 'COMPLETED'
  | 'FAILED'
  | 'ROLLED_BACK'
  | 'WAITING_USER';

export type LargeFilePolicy = 'EXCLUDE' | 'REFERENCE_ONLY' | 'REQUIRE_APPROVAL' | 'FAIL';

export type NetworkPolicy = 'DENY' | 'ALLOWLIST' | 'APPROVAL_REQUIRED';

export type CapabilityStatus = 'ENFORCED' | 'OBSERVED_ONLY' | 'UNSUPPORTED';

export interface ResourceLimits {
  timeoutMs: number;
  maxMemoryMb: number;
  maxCpuPercent: number;
  maxSingleFileBytes: number;
  maxWorkspaceBytes: number;
  maxFileCount: number;
  maxArtifactBytes: number;
  maxCommandOutputBytes: number;
  largeFilePolicy: LargeFilePolicy;
}

export interface WorkContract {
  objective: string;
  workbenchType: WorkbenchType;
  requiredInputs: string[];
  expectedOutputs: string[];
  acceptanceCriteria: string[];
  requiredChecks: string[];
  allowedFiles: string[];
  protectedFiles: string[];
  allowedTools: string[];
  approvalRequirements: string[];
  executionPolicy: string;
  completionPolicy: string;
}

export interface CommandPlan {
  commandId: string;
  executable: string;
  arguments: string[];
  workingDirectory: string;
  environmentKeys: Record<string, string>;
  timeoutMs: number;
  memoryLimitMb: number;
  cpuLimit: number;
  networkRequired: boolean;
  expectedExitCodes: number[];
  purpose: string;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  approvalRequired: boolean;
}

export interface DiffFileInfo {
  logicalPath: string;
  previousHash: string;
  newHash: string;
  previousSize: number;
  newSize: number;
  changedRanges: string[]; // e.g. "L10-L20"
  isBinary: boolean;
  isProtected: boolean;
}

export interface WorkbenchDiff {
  addedFiles: DiffFileInfo[];
  modifiedFiles: DiffFileInfo[];
  deletedFiles: DiffFileInfo[];
  renamedFiles: DiffFileInfo[];
  unchangedFiles: DiffFileInfo[];
  artifactChanges: Record<string, any>;
  changedRanges: Record<string, string[]>;
  baseRevision: string;
  newRevision: string;
  summary: string;
}

export interface WorkbenchSession {
  workbenchSessionId: string;
  missionId: string;
  taskId: string;
  attemptId: string;
  workbenchType: WorkbenchType;
  sourceWorkspace: string;
  isolatedWorkspace: string;
  baseRevision: string;
  currentRevision: string;
  allowedPaths: string[];
  protectedPaths: string[];
  allowedCommands: string[];
  networkPolicy: NetworkPolicy;
  resourceLimits: ResourceLimits;
  requiredChecks: string[];
  expectedArtifacts: string[];
  status: WorkbenchSessionStatus;
  createdAt: number;
  updatedAt: number;
}

export interface SnapshotManifestItem {
  path: string;
  reason: string;
}

export interface SnapshotManifest {
  totalFiles: number;
  totalBytes: number;
  copiedFiles: SnapshotManifestItem[];
  excludedFiles: SnapshotManifestItem[];
  referenceOnlyFiles: SnapshotManifestItem[];
  approvalRequiredFiles: SnapshotManifestItem[];
  failedFiles: SnapshotManifestItem[];
}

export interface CommandExecutionResult {
  status: 'COMPLETED' | 'FAILED' | 'TIMED_OUT' | 'BLOCKED_BY_POLICY';
  exitCode: number;
  stdout: string;
  stderr: string;
  interrupted: boolean;
  capabilitiesUsed: Record<string, string>;
}
