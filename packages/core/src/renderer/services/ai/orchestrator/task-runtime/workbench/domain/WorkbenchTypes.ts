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
  sessionCapabilityToken?: string;
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

// ----------------------------------------------------------------------------
// Phase 6.2 Code Workbench Specific Types
// ----------------------------------------------------------------------------

export type CodeJobStatus = 
  | 'DECLARED'
  | 'DISCOVERING'
  | 'PLANNING'
  | 'READY'
  | 'EDITING'
  | 'CHECKING'
  | 'REPAIRING'
  | 'VERIFYING'
  | 'COMMITTING_OUTPUT'
  | 'COMPLETED'
  | 'FAILED'
  | 'WAITING_USER'
  | 'ROLLED_BACK';

export interface CodeWorkbenchJob {
  codeJobId: string;
  workbenchSessionId: string;
  missionId: string;
  taskId: string;
  attemptId: string;
  objective: string;
  repositoryRoot: string;
  isolatedWorkspace: string;
  baseRevision: string;
  sourceDigest: string;
  targetFiles: string[];
  allowedFiles: string[];
  protectedFiles: string[];
  expectedChanges: string[];
  acceptanceCriteria: string[];
  requiredChecks: string[];
  commandPolicy: string;
  networkPolicy: NetworkPolicy;
  resourceLimits: ResourceLimits;
  routingProfile: string;
  status: CodeJobStatus;
  createdAt: number;
  updatedAt: number;
}

export interface RepositoryProfile {
  language: string;
  frameworks: string[];
  packageManager: string;
  sourceRoots: string[];
  testRoots: string[];
  buildCommands: string[];
  testCommands: string[];
  lintCommands: string[];
  formatCommands: string[];
  typeCheckCommands: string[];
  generatedPaths: string[];
  protectedPaths: string[];
  dependencyFiles: string[];
  repositoryRevision: string;
  confidence: number;
  warnings: string[];
  discoveredConfigFiles: string[];
  discoveredScripts: Record<string, string>;
  packageManagerEvidence: string;
  frameworkEvidence: string;
  compilerConfig: any;
  projectReferences: string[];
  pathAliases: Record<string, string>;
  discoveryWarnings: string[];
}

export type CodeModificationScope = 'FILE' | 'CLASS' | 'FUNCTION' | 'METHOD' | 'FIELD' | 'IMPORT' | 'EXPORT' | 'VARIABLE' | 'INTERFACE' | 'TYPE_ALIAS' | 'TEST' | 'CONFIG';

export interface CodeModification {
  changeId: string;
  targetFile: string;
  targetSymbol?: string;
  scope: CodeModificationScope;
  changeType: 'CREATE' | 'UPDATE' | 'DELETE';
  rationale: string;
  expectedBehavior: string;
  sourceRevision: string;
  expectedOldHash: string;
  allowedRanges: string[];
  protectedRanges: string[];
  requiredChecks: string[];
  dependencies: string[];
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  content?: string;
}

export interface CodeChangePlan {
  planId: string;
  objective: string;
  affectedSymbols: string[];
  filesToRead: string[];
  filesToModify: string[];
  filesToCreate: string[];
  filesToDelete: string[];
  protectedFiles: string[];
  plannedChanges: CodeModification[];
  expectedBehavior: string;
  requiredChecks: string[];
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  approvalRequired: boolean;
  rollbackStrategy: string;
  modelId: string;
  confidence: number;
}

export type CheckExecutionMode = 
  | 'HOST_COMMAND_EXECUTED'
  | 'SYNTHETIC_COMMAND_EXECUTED'
  | 'BLOCKED_BY_APPROVAL_INTEGRATION'
  | 'BLOCKED_BY_POLICY'
  | 'BLOCKED_BY_ENVIRONMENT';

export type CheckCommandClassification = 
  | 'TRUSTED_LOCAL_CHECK'
  | 'APPROVAL_REQUIRED'
  | 'BLOCKED_BY_POLICY';

export interface CheckResult {
  checkId: string;
  checkType: string;
  sourceOfCommand: string;
  commandPlan: CommandPlan;
  required: boolean;
  capabilityStatus: 'AVAILABLE' | 'BLOCKED_BY_POLICY' | 'BLOCKED_BY_APPROVAL_INTEGRATION' | 'NOT_CONFIGURED' | 'UNSUPPORTED';
  approvalStatus: string;
  status: 'NOT_RUN' | 'RUNNING' | 'PASS' | 'FAIL' | 'BLOCKED' | 'INTERRUPTED' | 'NOT_APPLICABLE' | 'BLOCKED_BY_DEPENDENCY' | 'CHECK_SIDE_EFFECT_DETECTED';
  exitCode: number;
  startedAt: number;
  completedAt: number;
  durationMs: number;
  stdoutSummary: string;
  stderrSummary: string;
  diagnostics: CodeDiagnostic[];
  artifactReferences: string[];
  affectedFiles: string[];
  retryable: boolean;
  executionMode: CheckExecutionMode;
  verifiedRevision: string;
  inputDigest: string;
  dependsOn?: string[];
  blocks?: string[];
  rerunPolicy?: string;
  scope?: string;
}

export interface CodeDiagnostic {
  diagnosticId: string;
  signature?: string;
  parserType: string;
  tool: string;
  checkId?: string;
  checkType: string;
  severity: 'ERROR' | 'WARNING' | 'INFO';
  logicalFile?: string;
  file: string;
  line?: number;
  column?: number;
  code?: string;
  message: string;
  normalizedMessage: string;
  relatedSymbol?: string;
  failingTestId?: string;
  retryScope: CodeModificationScope;
  retryable: boolean;
  confidence?: number;
  rawOutputReference: string;
}

export interface CodeRepairPolicy {
  maxSameDiagnosticRepeats: number;
  maxRepairAttempts: number;
  minimumDiagnosticImprovement: number;
  minimumCheckImprovement: number;
  stopOnSameHash: boolean;
  allowStrategyChange: boolean;
  maxStrategyChanges?: number;
}

export interface TestWeakeningResult {
  testFile: string;
  weakeningDetected: boolean;
  weakeningTypes: string[];
  removedTests: string[];
  skippedTestsAdded: string[];
  todoTestsAdded: string[];
  onlyMarkersAdded: string[];
  assertionsBefore: number;
  assertionsAfter: number;
  swallowedErrorsAdded: string[];
  snapshotUpdates: string[];
  expectationChanges: Record<string, string>;
  justificationRequired: boolean;
  evidence: string[];
}

export interface SyntheticCodeBenchmarkReport {
  totalJobs: number;
  completedJobs: number;
  failedJobs: number;
  waitingUserJobs: number;
  averageCommandCount: number;
  averageRepairCount: number;
  partialPatchCount: number;
  fullFileReplacementCount: number;
  noProgressCount: number;
  testWeakeningBlockedCount: number;
  approvalBlockedCount: number;
  requiredCheckNotRunSuccessCount: number;
  forcedPassCount: number;
  sourceDirectModificationCount: number;
  averageDurationMs: number;
}

export type SourceApplyStatus = 
  | 'NOT_REQUESTED'
  | 'BLOCKED_BY_APPROVAL_INTEGRATION'
  | 'WAITING_APPROVAL'
  | 'APPLIED'
  | 'NOT_APPLICABLE';

export interface CodeChangeReport {
  codeJobId: string;
  objective: string;
  baseRevision: string;
  outputRevision: string;
  addedFiles: string[];
  modifiedFiles: string[];
  deletedFiles: string[];
  renamedCandidates: string[];
  changedSymbols: string[];
  changedRanges: string[];
  checks: CheckResult[];
  testSummary: string;
  buildSummary: string;
  unresolvedDiagnostics: CodeDiagnostic[];
  riskSummary: string;
  modelRoutingSummary: string;
  approvalSummary: string;
  sourceApplyStatus: SourceApplyStatus;
  artifactIds: string[];
  finalOutcome: string;
}

export interface RepairRequest {
  diagnosticSignatures: string[];
  failingCheckId: string;
  targetFile: string;
  targetSymbol?: string;
  retryScope: CodeModificationScope;
  expectedOldHash: string;
  sourceRevision: string;
  protectedRanges: string[];
  previousRepairStrategy?: string;
  doNotRepeat: boolean;
}
