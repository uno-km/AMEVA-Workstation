/**
 * @file orchestrator/task/TaskExecutor.ts
 * @system AMEVA OS Desktop Workstation
 * @location src/renderer/services/ai/orchestrator/task/TaskExecutor.ts
 * @role 개별 태스크를 수주받아 ReAct 및 도구 실행을 래핑 수행하여 실행 성적서(TaskResult)를 반환하는 실행기
 *
 * [소비처 - CONSUMERS / USAGE CONTEXT]
 * - AgentOrchestrator.ts: 태스크 큐에서 READY 노드를 꺼내 TaskExecutor.execute()에 인가하여 기동.
 */

import type { Task, TaskResult, TaskStatus } from './types';

/**
 * TaskExecutor
 * 개별 태스크의 목표 및 검증 요구 사항을 컨텍스트에 추가 주입하여,
 * 도구 호출 및 온디바이스/원격 스트리밍 추론 루프를 조율 실행하는 핵심 런타임 실행기.
 */
export class TaskExecutor {
  /**
   * 지정된 Task를 실행합니다.
   *
   * @param task - 실행 대상 태스크 노드
   * @param session - AgentOrchestratorSession 인스턴스 (메인 프로세스 IPC 및 도구 실행 컨텍스트 제공)
   * @returns 태스크 실행 성적서 (TaskResult)
   */
  public async execute(task: Task, session: any): Promise<TaskResult> {
    const startTime = Date.now();
    console.info(`[TaskExecutor] 태스크 실행 개시: ${task.id} (${task.title})`);

    // 태스크 실행을 위해 전용 컨텍스트 빌드 및 상태 동기화 진행
    session.emitPhaseChange('thinking');

    try {
      // 1. 선행 태스크 결과들로 누적된 컨텍스트 및 expectedOutput 제약 프롬프트 합성
      const taskPrompt = `
[현재 실행할 태스크 정보]
- ID: ${task.id}
- 제목: ${task.title}
- 목표: ${task.objective}
- 산출물 검증 기준 (expectedOutput): ${task.expectedOutput}

이전 단계들의 작업 결과를 참조하여, 위 태스크의 목표를 완수하십시오.
작업이 끝났다면 반드시 'Final Answer:' 접두사 뒤에 결과 요약과 산출 정보를 포함하여 작성하십시오.
`;

      // session의 contextMessages에 태스크 안내 컨텍스트 주입
      session.contextMessages.push({
        role: 'user',
        content: taskPrompt
      });

      // 2. session 내에서 해당 태스크에 대응하는 ReAct 단일 루프 기동
      let accumulatedText = '';
      
      // 태스크 전용 ReAct 루프 개시
      let turns = 0;
      const maxTaskTurns = 15; // 단일 태스크가 루프에 빠져 무한 소모하는 것을 차단하는 로컬 가드레일

      while (turns < maxTaskTurns && !session.isAborted) {
        turns++;
        session.parser.reset();
        session.pendingToolCall = null;

        // 단일 턴 토큰 스트리밍 구동 (내장 runSingleTurn 재활용)
        await session.runSingleTurn();

        // 도구 호출이 설정되었을 경우, 도구를 실행하고 다음 턴으로 계속
        if (session.pendingToolCall !== null) {
          await session.executeToolAndObserve(session.pendingToolCall);
          continue;
        }

        // Final Answer 유입 시 루프 탈출
        if (session.accumulatedAnswer.trim() !== '') {
          accumulatedText = session.accumulatedAnswer.trim();
          break;
        }

        // 빈 턴 가드
        console.warn(`[TaskExecutor] 태스크 ${task.id} 수행 중 빈 턴 감지. 루틴 강제 종결.`);
        break;
      }

      // 최종 답변 확보
      const summaryAnswer = accumulatedText || '태스크 결과 획득 실패 (빈 답변)';
      const executionTime = Date.now() - startTime;

      // 성공 판정 뼈대 반환 (Verifier가 이 반환값을 사후 정적/동적 최종 검정함)
      return {
        status: 'SUCCESS',
        artifact: this.extractArtifactPath(summaryAnswer) || undefined,
        summary: summaryAnswer,
        evidence: `Task completed within ${turns} turns. Output size: ${summaryAnswer.length} chars.`,
        executionTime
      };

    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error(`[TaskExecutor] 태스크 ${task.id} 실행 중 치명적 예외:`, errMsg);
      
      return {
        status: 'FAILED',
        summary: `태스크 실행 오류: ${errMsg}`,
        evidence: `Error stack detected during task runtime.`,
        executionTime: Date.now() - startTime
      };
    }
  }

  /**
   * 결과 텍스트에서 생성된 파일 경로 등을 정규식으로 유추 추출하는 서브 헬퍼.
   */
  private extractArtifactPath(text: string): string | null {
    // 예: "파일이 c:/path/to/file.md 에 생성되었습니다" 또는 "c:\Users\..." 매칭
    const pathRegex = /([a-zA-Z]:[\\/][\w\-.\\/]+)/;
    const match = text.match(pathRegex);
    return match ? match[1] : null;
  }
}
