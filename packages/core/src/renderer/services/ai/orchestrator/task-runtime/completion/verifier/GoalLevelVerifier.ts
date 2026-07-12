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

    // Semantic 검증이 필요한 미션인 경우(예: 글쓰기, 분석, 요약 등) WAITING_USER 플래그 켜기
    // 실제 Adapter 연결 없이 Mocking(Stub)으로 SUCCESS 반환하는 것을 방지함
    const semanticExpected = input.allTaskDefinitions.some(d => d.capabilityRequirements?.includes('semantic_analysis') || d.capabilityRequirements?.includes('llm'));
    
    // 이 환경은 실제 LLM Adapter를 TaskRuntimeStore 또는 생성자에 주입받아 사용해야 함
    // LLM 주입이 안되어있거나, Runtime 상태가 비활성일 때 Mock 통과 처리하지 않고 WAITING_USER로 넘김
    if (semanticExpected) {
      // TODO: 실제 Goal-Level Verifier Prompt 및 Semantic Adapter 연동 필요.
      // 현재는 인프라 부재 시 거짓 SUCCESS를 선언하지 않기 위해 강제 WAITING_USER 처리.
      success = false;
      waitingUser = true;
      warnings.push('[GoalLevelVerifier] Semantic Runtime(LLM) 검증 모듈이 연결되지 않아 의미론적 목표 달성 여부를 자동 검증할 수 없습니다. 수동 검토가 필요합니다.');
    }

    // 미해결 이슈(unresolvedIssues) 중 치명적 결함 체크
    const fatalIssues = input.unresolvedIssues.filter(iss => iss.toLowerCase().includes('fatal') || iss.toLowerCase().includes('critical') || iss.toLowerCase().includes('error'));
    if (fatalIssues.length > 0) {
      success = false;
      warnings.push(`[GoalLevelVerifier] ${fatalIssues.length} 개의 치명적/미해결 오류가 존재합니다.`);
    }

    return {
      success,
      warnings,
      waitingUser
    };
  }
}
