/**
 * @file routing/profiler/TaskProfiler.ts
 * @system AMEVA OS Desktop Workstation
 * @role Convert Task/Mission data into TaskRoutingProfile
 */

import type { Task } from '../../domain/types';
import type { TaskRoutingProfile, Capability, PrivacyLevel } from '../domain/types';

export class TaskProfiler {
  /**
   * Generates a routing profile based on task state, definition, and historical data.
   */
  public static profileTask(
    missionId: string,
    task: Task,
    taskType: TaskRoutingProfile['taskType'],
    previousFailures: unknown[] = []
  ): TaskRoutingProfile {
    
    // 1. Instruction & Reasoning Complexity
    let instructionComplexity = 0.3;
    let reasoningComplexity = 0.3;
    
    const words = (task.definition.goal || '').split(' ').length + (task.definition.description || '').split(' ').length;
    if (words > 50) instructionComplexity = 0.6;
    if (words > 150) instructionComplexity = 0.9;

    const depCount = task.dependencies?.length || 0;
    if (depCount > 2) reasoningComplexity += 0.2;
    if (depCount > 5) reasoningComplexity += 0.4;

    const requiresLogic = task.definition.goal.toLowerCase().includes('logic') || task.definition.goal.toLowerCase().includes('algorithm');
    if (requiresLogic) reasoningComplexity += 0.3;

    instructionComplexity = Math.min(1.0, instructionComplexity);
    reasoningComplexity = Math.min(1.0, reasoningComplexity);

    // 2. Capabilities
    const requiredCapabilities: Capability[] = [];
    let toolRequired = false;
    let codeExecutionRequired = false;
    let structuredOutputRequired = false;

    // Check outputs
    if (task.definition.expectedOutputs) {
      for (const out of task.definition.expectedOutputs) {
        if (out.kind === 'JSON' || out.kind === 'CSV' || out.kind === 'DATA') {
          structuredOutputRequired = true;
          requiredCapabilities.push('STRUCTURED_OUTPUT');
        }
        if (out.kind === 'CODE') {
          codeExecutionRequired = true;
          requiredCapabilities.push('CODE_GENERATION');
        }
        if (out.kind === 'FILE') {
          toolRequired = true;
          requiredCapabilities.push('DOCUMENT_DRAFTING');
        }
      }
    }

    if (taskType === 'PLANNING') {
      requiredCapabilities.push('PLANNING');
      requiredCapabilities.push('STRUCTURED_OUTPUT');
      structuredOutputRequired = true;
    }
    if (taskType === 'VERIFICATION') {
      requiredCapabilities.push('SEMANTIC_VERIFICATION');
    }
    if (taskType === 'SUMMARIZATION') {
      requiredCapabilities.push('SUMMARIZATION');
    }

    // Tools
    const requiredTools = task.definition.requiredTools || [];
    if (requiredTools.length > 0) {
      toolRequired = true;
      requiredCapabilities.push('TOOL_SELECTION');
    }

    // 3. Privacy & Risk
    let privacyLevel: PrivacyLevel = 'INTERNAL'; // Default
    if (task.definition.goal.includes('secret') || task.definition.goal.includes('password') || task.definition.goal.includes('confidential')) {
      privacyLevel = 'CONFIDENTIAL';
    }
    if (task.definition.goal.includes('sensitive') || task.definition.goal.includes('internal api')) {
      privacyLevel = 'RESTRICTED';
    }

    let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'LOW';
    if (toolRequired) riskLevel = 'MEDIUM';
    if (codeExecutionRequired) riskLevel = 'HIGH';
    if (privacyLevel === 'RESTRICTED') riskLevel = 'CRITICAL';

    // 4. Context & Tokens
    // Heuristic calculation
    const contextSize = 1000 + (words * 2) + (previousFailures.length * 500);
    const expectedOutputTokens = 500 + (structuredOutputRequired ? 500 : 0) + (codeExecutionRequired ? 1000 : 0);
    
    if (contextSize > 8000) {
      requiredCapabilities.push('LONG_CONTEXT');
    }

    // 5. Failures & Retries
    const retryHistory = previousFailures.length;
    const previousModelIds: string[] = previousFailures.map(f => f.modelId).filter(Boolean);
    const previousDefectSignatures: string[] = previousFailures.map(f => f.defectSignature).filter(Boolean);

    // Deduplicate capabilities
    const uniqueCapabilities = Array.from(new Set(requiredCapabilities));

    return {
      missionId,
      taskId: task.id,
      taskType,
      instructionComplexity,
      reasoningComplexity,
      contextSize,
      expectedOutputTokens,
      requiredCapabilities: uniqueCapabilities,
      toolRequired,
      structuredOutputRequired,
      codeExecutionRequired,
      artifactKinds: task.definition.expectedOutputs?.map(o => o.kind) || [],
      privacyLevel,
      riskLevel,
      latencyPreference: taskType === 'SUMMARIZATION' || taskType === 'ROUTING' ? 'speed' : 'balanced',
      qualityPreference: taskType === 'VERIFICATION' || taskType === 'PLANNING' ? 'high' : 'acceptable',
      retryHistory,
      previousModelIds,
      previousDefectSignatures,
      routingBudgetRemaining: 1.0 // This will be calculated by the BudgetManager later
    };
  }
}
