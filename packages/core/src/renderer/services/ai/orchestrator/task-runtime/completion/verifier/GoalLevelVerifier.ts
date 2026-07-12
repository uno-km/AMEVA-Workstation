/**
 * @file orchestrator/task-runtime/completion/verifier/GoalLevelVerifier.ts
 * @system AMEVA OS Desktop Workstation
 * @role 개별 Task의 성공(PASS)들을 취합해 전체 Goal-Level에서 모순이나 누락이 없는지 검증
 */

import type { MissionCompletionReviewInput } from '../../domain/types';

export class GoalLevelVerifier {
  /**
   * 전체 목표 관점에서의 성공 여부와 검증 경고를 반환합니다.
   */
  public verify(input: MissionCompletionReviewInput): {
    success: boolean;
    warnings: string[];
    waitingUser: boolean;
  } {
    const warnings: string[] = [];
    let success = true;
    let waitingUser = false;

    // 만약 전체 Mission이 Semantic Runtime이 비활성화 되어 제대로 검증을 못했다면?
    // Semantic 검증이 필요한 미션인 경우(예: 글쓰기, 요약 등) WAITING_USER 플래그 켜기
    const semanticExpected = input.allTaskDefinitions.some(d => d.capabilityRequirements?.includes('semantic_analysis') || d.capabilityRequirements?.includes('llm'));
    
    if (semanticExpected && input.toolRuntimeStatus === 'DISABLED_SAFELY') {
      success = false;
      waitingUser = true;
      warnings.push('[GoalLevelVerifier] Semantic Runtime(LLM)이 비활성화되어 의미론적 목표 달성 여부를 자동 검증할 수 없습니다. 수동 검토가 필요합니다.');
    }

    // 미해결 이슈(unresolvedIssues) 중 치명적 결함 체크
    const fatalIssues = input.unresolvedIssues.filter(iss => iss.toLowerCase().includes('fatal') || iss.toLowerCase().includes('critical'));
    if (fatalIssues.length > 0) {
      success = false;
      warnings.push(`[GoalLevelVerifier] ${fatalIssues.length} 개의 치명적 미해결 이슈가 존재합니다.`);
    }

    // (모순이나 논리 오류를 여기서 추가 분석할 수 있음)

    return {
      success,
      warnings,
      waitingUser
    };
  }
}
