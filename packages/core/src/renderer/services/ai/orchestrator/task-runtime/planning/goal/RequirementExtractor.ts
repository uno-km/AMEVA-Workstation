/**
 * @file orchestrator/task-runtime/planning/goal/RequirementExtractor.ts
 * @system AMEVA OS Desktop Workstation
 * @role 사용자의 Raw Text에서 명시적/암묵적 요구사항을 도출하여 Requirement 객체 배열로 정규화
 */

import type { Requirement } from '../domain/PlanningTypes';

export class RequirementExtractor {
  /**
   * LLM/휴리스틱을 통해 사용자 요청에서 Requirement 배열을 추출하는 뼈대.
   * PHASE 2에서는 직접 LLM 엔진을 호출하는 구체 구현보다 이 인터페이스와 Mock 처리를 제공하여
   * 파이프라인의 구조적 정합성에 집중합니다.
   */
  public extract(sourceText: string): Requirement[] {
    // 임시 모킹 구현: 실제로는 LLM에 Prompt를 쏘아 요구사항을 추출함
    const baseRequirement: Requirement = {
      requirementId: `req-${crypto.randomUUID()}`,
      sourceText: sourceText,
      normalizedDescription: `User request handling for: ${sourceText.substring(0, 30)}...`,
      type: 'functional',
      required: true,
      priority: 1,
    };
    
    return [baseRequirement];
  }
}
