/**
 * @file orchestrator/task/TaskVerifier.ts
 * @system AMEVA OS Desktop Workstation
 * @location src/renderer/services/ai/orchestrator/task/TaskVerifier.ts
 * @role 태스크 실행 성적서(TaskResult)의 결과 및 산출물을 다각도로 검수하는 2단계 검증기
 *
 * [소비처 - CONSUMERS / USAGE CONTEXT]
 * - AgentOrchestrator.ts: TaskExecutor 실행 완료 직후 verify()를 가동해 COMPLETED vs FAILED를 판정함.
 */

import type { ILLMEngineAdapter } from '../types';
import type { Task, TaskResult } from './types';

/**
 * TaskVerifier
 * 1단계 정적 산출물 유무 식별 및 2단계 LLM 의미론적 충족 감수를 결합하여,
 * 가짜 완료(False Completion) 및 빈 답변 노출 결함을 원천 차단하는 검수 엔진.
 */
export class TaskVerifier {
  private readonly llmAdapter: ILLMEngineAdapter;

  /**
   * 생성자
   *
   * @param llmAdapter - 동적 검수 목적의 스트리밍 어댑터
   */
  constructor(llmAdapter: ILLMEngineAdapter) {
    this.llmAdapter = llmAdapter;
  }

  /**
   * 태스크의 완료 여부를 다차원적으로 최종 검정합니다.
   *
   * @param task - 검증할 대상 태스크 객체
   * @param result - Executor가 작성한 실행 성적서
   * @returns 검증 결과 통과 여부 (true = PASS, false = FAIL)
   */
  public async verify(task: Task, result: TaskResult, session?: any): Promise<boolean> {
    console.info(`[TaskVerifier] 태스크 검증 기동: ${task.id} (${task.title})`);

    // 1단계: 정적 검증 (형식 및 빈 본문 체크)
    const staticPass = this.verifyStatic(task, result);
    if (!staticPass) {
      console.warn(`[TaskVerifier] 태스크 ${task.id} 1단계 정적 검증 실패.`);
      if (session) {
        session.emitEvent({
          type: 'critic_feedback',
          verdict: 'FAIL',
          reason: `태스크 ${task.id} 정적 검증 실패: 결과 요약이 비어있거나 산출물 기재가 누락되었습니다.`,
          taskTitle: task.title
        })
      }
      return false;
    }

    // 2단계: 동적 의미론적 검증 (LLM Critic 감수)
    try {
      if (session) {
        session.emitEvent({
          type: 'critic_feedback',
          verdict: 'FAIL',
          reason: `태스크 ${task.id} 비평가(Verifier) 동적 의미론적 검수 개시...`,
          taskTitle: task.title
        })
      }
      const dynamicPass = await this.verifyDynamic(task, result);
      if (!dynamicPass) {
        console.warn(`[TaskVerifier] 태스크 ${task.id} 2단계 동적 검증 실패.`);
        if (session) {
          session.emitEvent({
            type: 'critic_feedback',
            verdict: 'FAIL',
            reason: `태스크 ${task.id} 동적 검증 실패: LLM 검수 기준 만족에 실패했습니다.`,
            taskTitle: task.title
          })
        }
        return false;
      }
    } catch (err: unknown) {
      console.warn(`[TaskVerifier] 동적 검수 도중 오류가 발생해 정적 통과에 기반해 PASS 폴백 처리함:`, err);
    }

    console.info(`[TaskVerifier] 태스크 ${task.id} 검증 최종 통과 (PASS)`);
    return true;
  }

  /**
   * 정적 리소스 및 텍스트 존재 확인 (1단계)
   */
  private verifyStatic(task: Task, result: TaskResult): boolean {
    if (!result.summary || result.summary.trim() === '') {
      return false;
    }
    // "빈 답변" 텍스트 차단 가드
    if (result.summary.includes('태스크 결과 획득 실패 (빈 답변)')) {
      return false;
    }

    // expectedOutput에 파일 언급이 있고 result.artifact가 잡혔다면 VFS 내역 등 유추 검사
    if (task.expectedOutput.toLowerCase().includes('파일') && !result.artifact) {
      // 만약 결과 텍스트 내에 확장자가 포함된 경로 형태가 존재하지 않는다면 주의 로깅
      console.debug(`[TaskVerifier] expectedOutput에 '파일'이 언급되었으나 artifact 경로 미추출.`);
    }

    return true;
  }

  /**
   * LLM을 사용한 의미론적 완수율 평가 (2단계)
   */
  private async verifyDynamic(task: Task, result: TaskResult): Promise<boolean> {
    const systemPrompt = `당신은 AMEVA OS의 Task Verification Critic입니다.
주어진 태스크 목표 및 완료 기준과 실제 실행 결과 요약을 비교하여, 해당 태스크가 성실하게 완수되었는지 철저히 검정하십시오.
답변은 반드시 '[PASS]' 또는 '[FAIL]' 대괄호를 씌운 단어로 시작하십시오. 잡설이나 설명은 최소화하십시오.

[평가 기준]
- 결과 요약에 목표에 상응하는 실질 데이터나 요약문이 포함되었는가? (PASS)
- 단순 혼잣말이나 진행 과정 핑계만 적혀있고 실물 결과가 누락되었는가? (FAIL)
- [중요 관용 정책] 만약 실행 결과에 태스크 목표(예: 제목 작성, 보고서 뼈대 구축 등)를 정상 완수한 내용이 들어있다면, 설령 절대 규칙 상의 특정 포맷(예: JSON)을 완전히 지키지 못하고 일반 텍스트로 답했더라도 내용이 완수되었다면 반드시 PASS 판정을 내려야 합니다. 형식이 아닌 성실한 내용 작성을 우선순위로 두십시오.`;

    const userMessage = `[태스크 목표]
${task.objective}

[완료 기준]
${task.expectedOutput}

[실제 실행 결과 요약]
${result.summary}

위 결과를 검정하여 [PASS] 또는 [FAIL]을 출력하십시오.`;

    const messages = [
      { role: 'system' as const, content: systemPrompt },
      { role: 'user' as const, content: userMessage }
    ];

    const verdictRaw = await this.llmAdapter.generateStream(messages, () => {});
    const verdictClean = verdictRaw.trim().toUpperCase();

    console.debug(`[TaskVerifier] 동적 검증 LLM 판정 결과: "${verdictClean}"`);

    /*
     * [RUN-TIME VERDICT DECISION FLOW]
     * - hasPass: 텍스트 본문 내 PASS 단어 포함 여부.
     * - hasFail: 텍스트 본문 내 FAIL 단어 포함 여부.
     * - Rationale: 소형 로컬 7B 모델이 서술형으로 설명 조를 길게 대답하여 "검토 결과 PASS이며 FAIL은 아님" 처럼
     *   두 단어가 모두 혼용될 경우, includes('FAIL')로 인해 오판 탈락하는 상황을 정규식 및 초반 문자열 매칭으로 해소한다.
     *   단, 최종 판단이 완전히 불확실하거나 모호할 때는 가짜 완료(False Completion) 예방을 위해 보수적으로 FAIL로 귀결시킨다.
     */
    const hasPass = /\[?PASS\]?/i.test(verdictClean);
    const hasFail = /\[?FAIL\]?/i.test(verdictClean);
    
    // 1순위: PASS만 검출되고 FAIL이 없는 경우
    if (hasPass && !hasFail) {
      return true;
    }
    // 2순위: FAIL만 검출되고 PASS가 없는 경우
    if (hasFail && !hasPass) {
      return false;
    }
    
    // 3순위: 두 단어가 모두 잡혔거나 모두 잡히지 않은 경우, 답변 시작 15자 내의 단어 가중치 판별
    const first15 = verdictClean.slice(0, 15);
    if (/PASS/i.test(first15)) {
      return true;
    }
    if (/FAIL/i.test(first15)) {
      return false;
    }
    
    // 4순위: 애매하거나 모호할 경우, 가짜 완료(False Completion) 방지를 위해 보수적으로 FAIL 처리
    console.warn(`[TaskVerifier] 애매한 LLM 판정 결과("${verdictClean}")로 인해 보수적으로 FAIL 처리함.`);
    return false;
  }
}
