/**
 * @file orchestrator/task-runtime/dispatch/ExecutionStrategyResolver.ts
 * @system AMEVA OS Desktop Workstation
 * @role Task가 요구하는 Capability를 분석하여 실행 전략을 결정
 */

import type { TaskEntity } from '../domain/types';
import { CapabilityCatalog } from './CapabilityCatalog';

export type ExecutionStrategy = 'LLM_ONLY' | 'TOOL_ONLY' | 'HYBRID_REACT' | 'MANUAL';

export class ExecutionStrategyResolver {
  constructor(_catalog: CapabilityCatalog) {}

  public resolve(task: TaskEntity): ExecutionStrategy {
    const caps = task.definition.capabilityRequirements || [];
    
    if (caps.length === 0) {
      // 툴이 필요 없으면 순수 LLM 추론으로 해결 가능
      return 'LLM_ONLY';
    }

    if (caps.includes('manual.user')) {
      return 'MANUAL';
    }

    // 기본적으로 PHASE 3 에서는 툴을 사용하는 작업은 최대 1000턴까지 돌 수 있는 Deep Reasoning 엔진(HYBRID_REACT) 사용
    return 'HYBRID_REACT';
  }
}
