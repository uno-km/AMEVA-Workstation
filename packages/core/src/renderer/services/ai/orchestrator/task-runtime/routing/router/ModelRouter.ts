/**
 * @file routing/router/ModelRouter.ts
 * @system AMEVA OS Desktop Workstation
 * @role Central routing decision logic
 */

import type { TaskRoutingProfile, ModelSelectionResult, RoutingConfig, ModelRole, ModelDescriptor } from '../domain/types';
import { ModelRegistry } from '../registry/ModelRegistry';
import { HardwareResourceService } from './HardwareResourceService';
import { ModelAdapterProvider } from '../adapter/ModelAdapterProvider';

export class ModelRouter {
  
  public static async route(profile: TaskRoutingProfile, config: RoutingConfig): Promise<ModelSelectionResult> {
    const registry = ModelRegistry.getInstance();
    const decidedAt = Date.now();
    const routingDecisionId = `route_${crypto.randomUUID()}`;
    const rejectedCandidates: { modelId: string, reason: string }[] = [];
    const selectionReasons: string[] = [];
    
    // 1. Check for Rule Engine path first
    // If the task is purely about simple JSON parsing, file check, or simple classification without complex reasoning
    if (this.canUseRuleEngine(profile, config)) {
      selectionReasons.push('Task is simple enough to bypass LLM and use RULE_ENGINE.');
      return {
        routingDecisionId,
        selectedModelId: 'RULE_ENGINE',
        selectedRole: 'RULE_ENGINE',
        candidateModelIds: [],
        rejectedCandidates: [],
        selectionReasons,
        requiredCapabilities: profile.requiredCapabilities,
        estimatedContextTokens: profile.contextSize,
        estimatedOutputTokens: profile.expectedOutputTokens,
        privacyDecision: { allowed: true, reason: 'Local rule execution' },
        escalationPolicy: 'NONE',
        confidence: 1.0,
        fallbackModelIds: [],
        routingBudgetRemaining: profile.routingBudgetRemaining,
        decidedAt,
        status: 'SUCCESS'
      };
    }

    if (profile.taskType.startsWith('CODE_')) {
       const codeModelId = config.codingModelId || 'qwen-7b-code';
       selectionReasons.push(`Task is CODE specific (${profile.taskType}), bypassing general routing and forcing coding model: ${codeModelId}`);
       return {
         routingDecisionId,
         selectedModelId: codeModelId,
         selectedRole: 'PRIMARY_MODEL',
         candidateModelIds: [codeModelId],
         rejectedCandidates: [],
         selectionReasons,
         requiredCapabilities: profile.requiredCapabilities,
         estimatedContextTokens: profile.contextSize,
         estimatedOutputTokens: profile.expectedOutputTokens,
         privacyDecision: { allowed: true, reason: 'Local coding model execution' },
         escalationPolicy: 'NONE',
         confidence: 1.0,
         fallbackModelIds: [],
         routingBudgetRemaining: profile.routingBudgetRemaining,
         decidedAt,
         status: 'SUCCESS'
       };
    }

    if (!config.routingEnabled) {
       // Legacy Fallback mode
       const allAvailable = registry.getAvailableModels();
       if (allAvailable.length === 0) {
          return this.createFailureResult(routingDecisionId, profile, 'MODEL_UNAVAILABLE');
       }
       const loadedId = ModelAdapterProvider.getInstance().getLoadedModelId();
       const defaultModel = loadedId ? registry.getModel(loadedId) || allAvailable[allAvailable.length - 1] : allAvailable[allAvailable.length - 1];
       
       return this.createSuccessResult(routingDecisionId, profile, defaultModel, 'PRIMARY_MODEL', ['Routing is disabled; using default/legacy path.']);
    }

    const hwMetrics = await HardwareResourceService.getMetrics();
    const loadedModelId = ModelAdapterProvider.getInstance().getLoadedModelId();

    // 2. Map complexity to desired target roles
    const targetRoles = this.determineTargetRoles(profile);
    
    let candidateDescriptors: ModelDescriptor[] = [];
    for (const role of targetRoles) {
       const roleModels = registry.getModelsByRole(role);
       for (const rm of roleModels) {
         if (!candidateDescriptors.some(c => c.modelId === rm.modelId)) {
           candidateDescriptors.push(rm);
         }
       }
    }

    if (candidateDescriptors.length === 0) {
       return this.createFailureResult(routingDecisionId, profile, 'MODEL_UNAVAILABLE');
    }

    // Filter pipeline
    const filteredCandidates: ModelDescriptor[] = [];
    
    for (const model of candidateDescriptors) {
       // A. Privacy & Policy Gate
       const privacyCheck = this.checkPrivacyGate(profile.privacyLevel, model, config);
       if (!privacyCheck.allowed) {
         rejectedCandidates.push({ modelId: model.modelId, reason: `Privacy blocked: ${privacyCheck.reason}`});
         continue;
       }

       // B. Capability Filter
       const missingCapabilities = profile.requiredCapabilities.filter(c => !model.capabilities.includes(c));
       if (missingCapabilities.length > 0) {
         rejectedCandidates.push({ modelId: model.modelId, reason: `Missing capabilities: ${missingCapabilities.join(', ')}`});
         continue;
       }

       // C. Context Window
       if (model.contextWindow < profile.contextSize) {
         rejectedCandidates.push({ modelId: model.modelId, reason: `Context window too small (${model.contextWindow} < ${profile.contextSize})`});
         continue;
       }

       // D. Hardware Check (Conservative Policy)
       if (hwMetrics) {
         if (hwMetrics.availableVramMb < (model.requiredVramMb * 0.8)) {
           rejectedCandidates.push({ modelId: model.modelId, reason: `Insufficient VRAM (${hwMetrics.availableVramMb} available)`});
           continue;
         }
        } else {
          if (model.healthStatus === 'OOM') {
            rejectedCandidates.push({ modelId: model.modelId, reason: `Model previously OOMed.`});
            continue;
          }
          // Do not hardcode 8GB. Allow models to be evaluated but we will score them later based on uncertainty.
        }

       // E. Previous failure exclusion
       if (profile.previousModelIds.includes(model.modelId)) {
         // Exclude exact repeat if it failed multiple times, or heavily penalize
         rejectedCandidates.push({ modelId: model.modelId, reason: `Model failed previously on this task attempt.`});
         continue;
       }

       filteredCandidates.push(model);
    }

    if (filteredCandidates.length === 0) {
       const allCandidates = candidateDescriptors.map(c => c.modelId);
       if (rejectedCandidates.some(r => r.reason.includes('Privacy'))) {
         return this.createFailureResult(routingDecisionId, profile, 'PRIVACY_POLICY_BLOCKED', rejectedCandidates, allCandidates);
       }
       if (rejectedCandidates.some(r => r.reason.includes('capabilities'))) {
         return this.createFailureResult(routingDecisionId, profile, 'CAPABILITY_UNAVAILABLE', rejectedCandidates, allCandidates);
       }
       if (rejectedCandidates.some(r => r.reason.includes('Context'))) {
         return this.createFailureResult(routingDecisionId, profile, 'CONTEXT_LIMIT_EXCEEDED', rejectedCandidates, allCandidates);
       }
       if (!hwMetrics && rejectedCandidates.length > 0) {
         return this.createFailureResult(routingDecisionId, profile, 'WAITING_USER', rejectedCandidates, allCandidates);
       }
       return this.createFailureResult(routingDecisionId, profile, 'WAITING_USER', rejectedCandidates, allCandidates);
    }

    // 9. Optimal Selection
    // Score models based on swap cost, speed preference, and size
    filteredCandidates.sort((a, b) => {
       let scoreA = 0;
       let scoreB = 0;
       
       if (a.modelId === loadedModelId) scoreA += 100;
       if (b.modelId === loadedModelId) scoreB += 100;
       
       if (!hwMetrics) {
         if (a.requiredVramMb === 0 || !a.requiredVramMb) scoreA -= 30; // Uncertainty penalty
         if (b.requiredVramMb === 0 || !b.requiredVramMb) scoreB -= 30;
       }

       if (profile.latencyPreference === 'speed') {
         if (a.estimatedLatencyClass === 'low') scoreA += 50;
         if (b.estimatedLatencyClass === 'low') scoreB += 50;
       }

       if (profile.qualityPreference === 'high' || profile.qualityPreference === 'maximum') {
          if (a.parameterClass.includes('32B') || a.parameterClass.includes('14B')) scoreA += 50;
          if (b.parameterClass.includes('32B') || b.parameterClass.includes('14B')) scoreB += 50;
       }

       return scoreB - scoreA; // Descending
    });

    const selectedModel = filteredCandidates[0];
    selectionReasons.push(`Selected ${selectedModel.modelId} as it satisfies capabilities and privacy constraints.`);
    if (selectedModel.modelId === loadedModelId) {
      selectionReasons.push(`Avoided model swap cost by reusing currently loaded model.`);
    } else if (!hwMetrics) {
      selectionReasons.push(`Applied conservative hardware policy (no real-time metrics).`);
    }

    const fallbackIds = filteredCandidates.slice(1).map(m => m.modelId);
    
    return {
      routingDecisionId,
      selectedModelId: selectedModel.modelId,
      selectedRole: this.mapModelToRole(selectedModel, targetRoles),
      candidateModelIds: candidateDescriptors.map(m => m.modelId),
      rejectedCandidates,
      selectionReasons,
      requiredCapabilities: profile.requiredCapabilities,
      estimatedContextTokens: profile.contextSize,
      estimatedOutputTokens: profile.expectedOutputTokens,
      privacyDecision: { allowed: true, reason: 'Passed local/remote policy checks' },
      escalationPolicy: 'ONE_STEP',
      confidence: 0.9,
      fallbackModelIds: fallbackIds,
      routingBudgetRemaining: profile.routingBudgetRemaining,
      decidedAt,
      status: 'SUCCESS'
    };
  }

  private static canUseRuleEngine(profile: TaskRoutingProfile, config: RoutingConfig): boolean {
    // Only if it's a very simple task without required reasoning or tools
    if (profile.instructionComplexity < 0.2 && profile.reasoningComplexity < 0.2 && !profile.toolRequired) {
      // Examples: JSON validation, simple string formatting, file existence checks
      return false; // In Phase 5, if task requires LLM, this returns false.
    }
    
    // "RULE_ENGINE이 처리 가능한 Summarization은 다음으로 제한한다: 로그 절단, 중복 제거, 구조화 통계 집계, 기존 Summary 선택, 길이 제한 및 정규화."
    // 의미 요약, 결론 생성, 문맥 통합은 SMALL 또는 MEDIUM 모델을 요구한다.
    if (profile.taskType === 'SUMMARIZATION') {
      const maxTokens = config.maxRuleEngineContextTokens ?? 500;
      if (profile.contextSize <= maxTokens && profile.reasoningComplexity <= 0.2) {
        return true; // Use RULE_ENGINE for very small, non-semantic summarization
      }
    }
    
    return false;
  }

  private static determineTargetRoles(profile: TaskRoutingProfile): ModelRole[] {
    const roles: ModelRole[] = [];
    
    if (profile.taskType === 'SUMMARIZATION') {
      roles.push('SMALL_MODEL', 'MEDIUM_MODEL');
      return roles;
    }
    
    if (profile.reasoningComplexity > 0.7 || profile.codeExecutionRequired || profile.qualityPreference === 'maximum') {
      roles.push('PRIMARY_MODEL', 'MEDIUM_MODEL');
    } else if (profile.reasoningComplexity > 0.4 || profile.toolRequired) {
      roles.push('MEDIUM_MODEL', 'PRIMARY_MODEL');
    } else {
      roles.push('SMALL_MODEL', 'MEDIUM_MODEL');
    }
    return roles;
  }

  private static mapModelToRole(_model: ModelDescriptor, targetRoles: ModelRole[]): ModelRole {
    // Return the first target role that this model satisfies in the registry mapping, or default to targetRoles[0]
    return targetRoles[0]; // Simplified for now. Registry holds actual mappings.
  }

  private static checkPrivacyGate(privacy: string, model: ModelDescriptor, config: RoutingConfig): { allowed: boolean, reason: string } {
    if (model.localOrRemote === 'local') return { allowed: true, reason: 'Local model' };

    switch(privacy) {
      case 'RESTRICTED':
        return { allowed: false, reason: 'RESTRICTED privacy requires local models only.' };
      case 'CONFIDENTIAL':
        if (!config.approvalRequiredForRemoteConfidential) {
          return { allowed: false, reason: 'CONFIDENTIAL requires explicit user approval for remote.' };
        }
        return { allowed: true, reason: 'Remote allowed by explicit approval config.' };
      case 'INTERNAL':
        if (!config.allowRemoteForInternal) return { allowed: false, reason: 'INTERNAL policy prevents remote by default.' };
        return { allowed: true, reason: 'INTERNAL remote allowed.' };
      case 'PUBLIC':
        if (!config.allowRemoteForPublic) return { allowed: false, reason: 'PUBLIC remote prevented by config.' };
        return { allowed: true, reason: 'PUBLIC remote allowed.' };
      default:
        return { allowed: false, reason: 'Unknown privacy level.' };
    }
  }

  private static createFailureResult(id: string, profile: TaskRoutingProfile, status: ModelSelectionResult['status'], rejected: {modelId: string, reason: string}[] = [], candidates: string[] = []): ModelSelectionResult {
     return {
        routingDecisionId: id,
        selectedModelId: '',
        selectedRole: 'PRIMARY_MODEL',
        candidateModelIds: candidates,
        rejectedCandidates: rejected,
        selectionReasons: [`Failed to route: ${status}`],
        requiredCapabilities: profile.requiredCapabilities,
        estimatedContextTokens: profile.contextSize,
        estimatedOutputTokens: profile.expectedOutputTokens,
        privacyDecision: { allowed: false, reason: 'Blocked' },
        escalationPolicy: 'NONE',
        confidence: 0,
        fallbackModelIds: [],
        routingBudgetRemaining: profile.routingBudgetRemaining,
        decidedAt: Date.now(),
        status
     };
  }

  private static createSuccessResult(id: string, profile: TaskRoutingProfile, model: ModelDescriptor, role: ModelRole, reasons: string[]): ModelSelectionResult {
     return {
        routingDecisionId: id,
        selectedModelId: model.modelId,
        selectedRole: role,
        candidateModelIds: [model.modelId],
        rejectedCandidates: [],
        selectionReasons: reasons,
        requiredCapabilities: profile.requiredCapabilities,
        estimatedContextTokens: profile.contextSize,
        estimatedOutputTokens: profile.expectedOutputTokens,
        privacyDecision: { allowed: true, reason: 'Fallback bypass' },
        escalationPolicy: 'NONE',
        confidence: 1.0,
        fallbackModelIds: [],
        routingBudgetRemaining: profile.routingBudgetRemaining,
        decidedAt: Date.now(),
        status: 'SUCCESS'
     };
  }
}
