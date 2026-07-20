/**
 * @file routing/domain/types.ts
 * @system AMEVA OS Desktop Workstation
 * @role Phase 5 Model Routing Domain Types
 */

export type ModelRole = 'RULE_ENGINE' | 'SMALL_MODEL' | 'MEDIUM_MODEL' | 'PRIMARY_MODEL';
export type PrivacyLevel = 'PUBLIC' | 'INTERNAL' | 'CONFIDENTIAL' | 'RESTRICTED';
export type HealthStatus = 'PROCESS_READY' | 'MODEL_LOADING' | 'MODEL_READY' | 'PREFILLING' | 'DECODING' | 'DEGRADED' | 'UNRESPONSIVE' | 'OOM' | 'UNAVAILABLE';
export type ModelAvailability = 'AVAILABLE' | 'NOT_INSTALLED' | 'LOADING' | 'UNAVAILABLE' | 'UNHEALTHY' | 'DISABLED';

export type Capability = 
  | 'CLASSIFICATION'
  | 'ROUTING'
  | 'SUMMARIZATION'
  | 'PLANNING'
  | 'DOCUMENT_DRAFTING'
  | 'DOCUMENT_REVISION'
  | 'CODE_GENERATION'
  | 'CODE_REPAIR'
  | 'TOOL_SELECTION'
  | 'TOOL_RESULT_INTERPRETATION'
  | 'STRUCTURED_OUTPUT'
  | 'SEMANTIC_VERIFICATION'
  | 'LONG_CONTEXT'
  | 'MULTILINGUAL';

export interface ModelDescriptor {
  modelId: string;
  displayName: string;
  provider: string; // e.g. 'webgpu', 'ollama', 'llamacpp', 'cloud'
  endpointType: string;
  localOrRemote: 'local' | 'remote';
  parameterClass: string; // e.g. '7B', '3B', '1.5B'
  contextWindow: number;
  maxOutputTokens: number;
  supportedLanguages: string[];
  capabilities: Capability[];
  toolCallingSupport: 'native' | 'prompt_only' | 'none';
  structuredOutputSupport: 'native_schema' | 'grammar' | 'prompt_only' | 'none';
  codeCapability: boolean;
  longContextCapability: boolean;
  semanticVerificationCapability: boolean;
  privacyLevel: PrivacyLevel;
  estimatedLatencyClass: 'low' | 'medium' | 'high';
  estimatedMemoryMb: number;
  requiredVramMb: number;
  availability: ModelAvailability;
  healthStatus: HealthStatus;
  version: string;
  enabled: boolean;
}

export interface TaskRoutingProfile {
  missionId: string;
  taskId: string;
  taskType: 'PLANNING' | 'EXECUTION' | 'VERIFICATION' | 'SEMANTIC_VERIFIER' | 'PARTIAL_REPAIR' | 'SUMMARIZATION' | 'ROUTING' | 'CODE_ERROR_ANALYSIS' | 'CODE_AUTO_FIX';
  retryScope?: string;
  sourceModelId?: string;
  protectedRanges?: unknown[];
  instructionComplexity: number; // 0.0 - 1.0
  reasoningComplexity: number;   // 0.0 - 1.0
  contextSize: number;           // estimated tokens
  expectedOutputTokens: number;
  requiredCapabilities: Capability[];
  toolRequired: boolean;
  structuredOutputRequired: boolean;
  codeExecutionRequired: boolean;
  artifactKinds: string[];
  privacyLevel: PrivacyLevel;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  latencyPreference: 'speed' | 'balanced' | 'quality';
  qualityPreference: 'acceptable' | 'high' | 'maximum';
  retryHistory: number;
  previousModelIds: string[];
  previousDefectSignatures: string[];
  routingBudgetRemaining: number;
}

export interface ModelSelectionResult {
  routingDecisionId: string;
  selectedModelId: string | 'RULE_ENGINE';
  selectedRole: ModelRole;
  candidateModelIds: string[];
  rejectedCandidates: Array<{ modelId: string, reason: string }>;
  selectionReasons: string[];
  requiredCapabilities: Capability[];
  estimatedContextTokens: number;
  estimatedOutputTokens: number;
  privacyDecision: { allowed: boolean, reason: string };
  escalationPolicy: string;
  confidence: number;
  fallbackModelIds: string[];
  routingBudgetRemaining: number;
  decidedAt: number;
  
  // Status indicates if routing was successful or blocked
  status: 'SUCCESS' | 'WAITING_USER' | 'MODEL_UNAVAILABLE' | 'CAPABILITY_UNAVAILABLE' | 'CONTEXT_LIMIT_EXCEEDED' | 'PRIVACY_POLICY_BLOCKED';
}

export interface RoutingConfig {
  routingEnabled: boolean;
  localFirst: boolean;
  allowRemoteForPublic: boolean;
  allowRemoteForInternal: boolean;
  approvalRequiredForRemoteConfidential: boolean;
  confidenceThresholdUse: number;      // default 0.85
  confidenceThresholdEscalate: number; // default 0.60
  maxRoutingDecisions: number;
  maxModelEscalations: number;
  maxModelSwitches: number;
  maxTotalModelCalls: number;
  maxEstimatedTokens: number;
  maxRoutingTimeMs: number;
  rolePreferences: Record<ModelRole, string[]>;
  disabledModelIds: string[];
  forcedLocalTaskTypes: string[];
  forcedModelByCapability: Partial<Record<Capability, string>>;
  maxRuleEngineContextTokens: number;
  codingModelId?: string;
  codingModelPath?: string;
}

export interface EscalationPackage {
  previousModelId: string;
  previousRole: ModelRole;
  failureType: string;
  defectSignatures: string[];
  validationResult: unknown;
  toolObservationSummary: string;
  failedOutputReference: string;
  retryScope: string;
  newModelRole: ModelRole;
  protectedRanges: unknown[];
  doNotRepeat: boolean;
  escalationReason: string;
}
