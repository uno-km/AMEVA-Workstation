import { WorkbenchType } from '../domain/WorkbenchTypes';
import { TaskRoutingProfile } from '../../domain/types';

export class WorkbenchRouterProfileFactory {

  public static createProfile(
    type: WorkbenchType, 
    contextSize: number, 
    isSimpleFormatCheck: boolean = false
  ): TaskRoutingProfile {
    
    // Rule: 단순 파일 검사와 형식 검사는 RULE_ENGINE을 우선 사용한다.
    // FORMAT_CHECK를 SUMMARIZATION으로 매핑하지 마라.
    if (isSimpleFormatCheck) {
      return {
        taskType: 'FORMAT_CHECK', // Explicit task type
        instructionComplexity: 0.1,
        reasoningComplexity: 0.1,
        toolRequired: false,
        codeExecutionRequired: false,
        contextSize: Math.min(contextSize, 500),
        expectedOutputTokens: 10,
        privacyLevel: 'PUBLIC',
        latencyPreference: 'speed',
        qualityPreference: 'standard',
        previousModelIds: [],
        routingBudgetRemaining: 10
      };
    }

    switch (type) {
      case 'CODE':
        return {
          taskType: 'REASONING',
          instructionComplexity: 0.8,
          reasoningComplexity: 0.9,
          toolRequired: true,
          codeExecutionRequired: true,
          contextSize,
          expectedOutputTokens: 2048,
          privacyLevel: 'CONFIDENTIAL',
          latencyPreference: 'balanced',
          qualityPreference: 'high',
          previousModelIds: [],
          routingBudgetRemaining: 10
        };

      case 'DOCUMENT':
        return {
          taskType: 'SUMMARIZATION',
          instructionComplexity: 0.5,
          reasoningComplexity: 0.6,
          toolRequired: false, // mostly drafting
          codeExecutionRequired: false,
          contextSize: contextSize > 4096 ? contextSize : 4096,
          expectedOutputTokens: 4096,
          privacyLevel: 'CONFIDENTIAL',
          latencyPreference: 'balanced',
          qualityPreference: 'high',
          previousModelIds: [],
          routingBudgetRemaining: 10
        };

      case 'MIXED':
      default:
        return {
          taskType: 'REASONING',
          instructionComplexity: 0.7,
          reasoningComplexity: 0.8,
          toolRequired: true,
          codeExecutionRequired: false,
          contextSize,
          expectedOutputTokens: 2048,
          privacyLevel: 'CONFIDENTIAL',
          latencyPreference: 'balanced',
          qualityPreference: 'standard',
          previousModelIds: [],
          routingBudgetRemaining: 10
        };
    }
  }
}
