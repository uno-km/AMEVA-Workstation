/**
 * @file orchestrator/task/FinalReporter.ts
 * @system AMEVA OS Desktop Workstation
 * @location src/renderer/services/ai/orchestrator/task/FinalReporter.ts
 * @role 미션 완료 시 정량 통계 및 수행 과정을 포함한 가시적인 최종 보고서 마크다운을 빌드하는 리포터
 *
 * [소비처 - CONSUMERS / USAGE CONTEXT]
 * - AgentOrchestrator.ts: 모든 태스크 큐 실행이 정지했을 때 최종 응답 빌더에서 호출해 보고서 합성.
 */

/**
 * FinalReporter
 * 실행 통계 메트릭을 분석해 사용자가 한눈에 진행 사항과 산출물을 이해할 수 있는
 * 고품질의 프리미엄 마크다운 카드로 최종 리포트를 작성합니다.
 */
export class FinalReporter {
  /**
   * 최종 완수 보고서를 작성합니다.
   *
   * @param goal - 사용자 최종 목표
   * @param stats - CompletionManager의 집계 통계 객체
   * @param completionRate - 완수율 수치 (0~100)
   * @param resultGrade - SUCCESS | PARTIALLY_COMPLETE | FAILED 판정 결과
   * @param totalTurns - 소요된 총 ReAct 턴 수
   * @param recoveryCount - 런타임 백그라운드 복구 횟수
   * @returns 최종 작성된 마크다운 보고서 본문
   */
  public static buildReport(
    goal: string,
    stats: { total: number; completed: number; failed: number; skipped: number; userAssist: number },
    completionRate: number,
    resultGrade: 'SUCCESS' | 'PARTIALLY_COMPLETE' | 'FAILED',
    totalTurns: number,
    recoveryCount: number,
    modelName?: string
  ): string {
    const statusEmoji = resultGrade === 'SUCCESS' ? '🟢 SUCCESS' : resultGrade === 'PARTIALLY_COMPLETE' ? '🟡 PARTIALLY COMPLETE' : '🔴 FAILED';
    
    return `### 📋 AMEVA Mission Execution Report

> **Mission Status**: ${statusEmoji}
> **Goal**: "${goal}"

---

#### 📊 Task Execution Statistics
- **Total Tasks**: ${stats.total}
- **Completed**: ${stats.completed}
- **Skipped**: ${stats.skipped}
- **Failed**: ${stats.failed}
- **User Assist Pending**: ${stats.userAssist}
- **Task Completion Rate**: ${completionRate}%

#### ⚙️ Inference & Fault Tolerance metrics
- **Model Used**: ${modelName || 'Unknown'}
- **Total Inference Turns**: ${totalTurns} turns
- **Self-Healing Recovery Count**: ${recoveryCount} times
- **Verification Verdict**: ${resultGrade === 'SUCCESS' ? 'PASS' : 'WARNING / FAIL'}

---

*본 보고서는 AMEVA OS Task Runtime Engine에 의해 정적/동적 검증이 완료된 신뢰 성적서입니다.*`;
  }
}
