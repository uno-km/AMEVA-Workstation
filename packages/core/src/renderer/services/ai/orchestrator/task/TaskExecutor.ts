/**
 * @file orchestrator/task/TaskExecutor.ts
 * @system AMEVA OS Desktop Workstation
 * @location src/renderer/services/ai/orchestrator/task/TaskExecutor.ts
 * @role 개별 태스크를 수주받아 ReAct 및 도구 실행을 래핑 수행하여 실행 성적서(TaskResult)를 반환하는 실행기
 *
 * [소비처 - CONSUMERS / USAGE CONTEXT]
 * - AgentOrchestrator.ts: 태스크 큐에서 READY 노드를 꺼내 TaskExecutor.execute()에 인가하여 기동.
 */

import type { Task, TaskResult } from './types';

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
당신은 현재 거대한 미션(궁극의 목표)을 달성하기 위해 여러 단계 중 하나를 수행하고 있습니다.

[궁극의 미션 목표]
"${session.goal || ''}"

[현재 할당된 단일 태스크]
- ID: ${task.id}
- 제목: ${task.title}
- 목표: ${task.objective}
- 산출물 검증 기준 (expectedOutput): ${task.expectedOutput}

[작업 지침]
1. 위 궁극의 미션 목표를 달성하기 위해, 이전 단계들의 작업 결과(문맥)를 이어받아 **현재 할당된 태스크의 목표만을 집중적으로** 완수하십시오.
2. [매우 중요] 이전 단계에서 작성된 문서 내용(예: 개요, 목차 등)을 다시 처음부터 베껴 쓰거나 덮어쓰지 마십시오! 이미 작성된 파일에 새로운 섹션(예: 역사, 본문 등)을 이어서 추가해야 한다면 반드시 'append_file' 도구를 사용해야 합니다.

🚨 [작업 완료 선언 시 절대 규칙]
당신은 절대로 작업을 완료했다고 주장해서는 안 됩니다.
작업 완료는 다음 4가지 조건을 모두 만족할 때만 선언할 수 있습니다:
1. 실제 도구 호출 성공
2. 산출물 생성 또는 수정 확인
3. 결과 요약 작성
4. 검증자가 확인 가능한 증거 제출

위 조건이 하나라도 누락되면 FAILED 상태가 됩니다.
작업 완료 선언(Final Answer) 시 반드시 아래 JSON 구조만 출력하십시오:

Final Answer: {
  "status": "SUCCESS",
  "artifacts": [
    {
      "path": "파일경로 (예: cheese_report.md)",
      "description": "생성 또는 수정 내용"
    }
  ],
  "summary": "수행 결과 요약",
  "evidence": [
    "검증 가능한 근거1",
    "검증 가능한 근거2"
  ]
}

주의: '완료했습니다' 등 추측성 문장만 뱉거나, 증거 없이 성공을 선언하는 행위는 엄격히 금지됩니다.
`;

      /*
       * [CONTEXT COMPRESSION - PREVENT 400 BAD REQUEST]
       * - Rationale: 태스크가 여러 개 누적될수록 이전 단계들의 상세 ReAct 토큰(Thoughts, Observations)들이 누적되어
       *   로컬 LLM의 컨텍스트 한계 용량을 초과해 400 Bad Request 에러를 야기한다.
       *   따라서 신규 태스크 실행 진입 시 시스템 프롬프트만 보존한 채 이전의 장황한 ReAct 세부 로그들을 소거하고,
       *   대신 이미 성공적으로 완료된 태스크들의 결과 요약(Summary) 목록만을 정갈하게 합성하여 컨텍스트를 압축 리셋한다.
       */
      const baseSystemPrompt = (session as any).buildSystemPrompt ? (session as any).buildSystemPrompt(true) : '';
      
      const completedTaskSummaries = session.taskGraph
        ? session.taskGraph.getTasks()
            .filter((t: any) => t.status === 'COMPLETED' && t.result)
            .map((t: any) => `- [완료] ${t.id} (${t.title}): ${t.result.summary || '요약 없음'}`)
            .join('\n')
        : '';

      const contextSummaryPrompt = `
[이전 태스크 실행 결과 요약 목록]
${completedTaskSummaries || '이전 단계 실행 결과 없음'}
`;

      session.contextMessages = [
        { role: 'system', content: baseSystemPrompt },
        { role: 'user', content: contextSummaryPrompt },
        { role: 'user', content: taskPrompt }
      ];

      /*
       * [RUN-TIME STATE / INVARIANT - ReAct Loop Control]
       * - accumulatedText: 모델이 최종적으로 반환한 Final Answer 본문을 누적하는 캐시 변수.
       * - consecutiveEmptyTurns: 도구 호출도 발생하지 않고 Final Answer도 유입되지 않은 턴의 누적 횟수.
       * - Rationale: 소형 로컬 7B 모델의 경우 첫 턴에 생각(thought)만 전개하고 다음 턴에 답변하는 경향이 있으므로,
       *   단 1회 무응답만으로 즉각 루프를 깨지(break) 않고 누적 3회 시도를 허용하여 답변 완수를 보호한다.
       */
      let accumulatedText = '';
      let consecutiveEmptyTurns = 0;
      
      // 태스크 전용 ReAct 루프 개시
      let turns = 0;
      const maxTaskTurns = 15; // 단일 태스크가 루프에 빠져 무한 소모하는 것을 차단하는 로컬 가드레일

      while (turns < maxTaskTurns && !session.isAborted) {
        turns++;
        session.parser.reset();
        // 배열 초기화로 변경 (AgentOrchestrator에서 get/set 처리)
        // Note: AgentOrchestrator의 pendingToolCalls를 직접 초기화하는 메서드 호출이 권장되나
        // 우선은 TS 에러 회피를 위해 getter/setter 우회 또는 무시합니다.
        (session as any).pendingToolCalls = [];

        // 단일 턴 토큰 스트리밍 구동 (내장 runSingleTurn 재활용)
        await session.runSingleTurn();

        // 여러 개의 도구 호출이 설정되었을 경우 차례대로 실행
        const toolCalls = (session as any).pendingToolCalls || [];
        if (toolCalls.length > 0) {
          consecutiveEmptyTurns = 0;
          for (const req of toolCalls) {
            await session.executeToolAndObserve(req);
          }
          continue;
        }

        // Final Answer 유입 시 루프 탈출
        if (session.accumulatedAnswer.trim() !== '') {
          accumulatedText = session.accumulatedAnswer.trim();
          break;
        }

        // 빈 턴 가드 및 완화 정책
        consecutiveEmptyTurns++;
        if (consecutiveEmptyTurns >= 3) {
          console.warn(`[TaskExecutor] 태스크 ${task.id} 수행 중 빈 턴이 3회 연속 감지되어 루틴을 강제 종결합니다. (FAILED 처리)`);
          break;
        }
        
        console.debug(`[TaskExecutor] 태스크 ${task.id} 수행 중 생각(thought)은 출력되었으나 도구 호출 및 최종 답이 없어 턴을 재개합니다. (연속 빈 턴: ${consecutiveEmptyTurns}/3)`);
      }

      const executionTime = Date.now() - startTime;

      /*
       * [P0-1 FIX — Strict Separation of Task Execution & Verification]
       * TaskExecutor 시점에서는 아직 VerificationResult / VerifiedOutput[] 검증이 완료되지 않았다.
       * 따라서 TaskExecutor는 절대로 'SUCCESS'를 최종 확정하지 않으며,
       * execution 결과로 'EXECUTED_PENDING_VERIFICATION' 상태를 반환한다.
       *
       * FILE_OUTPUT_REQUIRED 태스크의 경우:
       * - mutating tool 실행 흔적만으로 SUCCESS 금지
       * - "파일 작성 완료" 텍스트만으로 SUCCESS 금지
       * - expected path 선언만으로 SUCCESS 금지
       * - 오직 VerificationRuntime(DeterministicVerifier/VerificationDecisionPolicy)의
       *   typed decision === 'PASS' 및 verifiedOutputs.length > 0 일 때만 최종 SUCCESS/COMPLETED 전이 허용.
       */
      const outputMode: TaskOutputMode = (task as any).outputMode || (task as any).definition?.outputMode || 'NO_PERSISTED_OUTPUT';
      const extractedPath = this.extractArtifactPath(accumulatedText);

      // 빈 텍스트 무응답에 대한 1차 실행실패 검사 (NO_PERSISTED_OUTPUT 모드 시)
      if (outputMode === 'NO_PERSISTED_OUTPUT' && !accumulatedText.trim()) {
        console.warn(`[TaskExecutor] 태스크 ${task.id} (NO_PERSISTED_OUTPUT) 답변이 비어있어 FAILED 처리합니다.`);
        return {
          status: 'FAILED',
          summary: '태스크 결과 획득 실패 (모델 무응답)',
          evidence: `Task ran ${turns} turns but produced no output.`,
          executionTime
        };
      }

      const summaryAnswer = accumulatedText.trim() || `(태스크 실행 완료. 검증기 판정 대기 중: ${extractedPath || 'Execution Completed'})`;

      // TaskExecutor는 실행만 완수하고 검증 대기 상태(EXECUTED_PENDING_VERIFICATION)를 반환함.
      // 최종 SUCCESS/COMPLETED 상태는 오직 VerificationRuntime만 결정함.
      return {
        status: 'EXECUTED_PENDING_VERIFICATION',
        artifact: extractedPath || undefined,
        summary: summaryAnswer,
        evidence: `Task executed within ${turns} turns. OutputMode: ${outputMode}. Pending VerificationRuntime assessment.`,
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
   *
   * [ADR - Path Parsing Mitigation]
   * - Rationale: 로컬 파일 저장 시 c:\ 같은 절대 경로뿐만 아니라 cheese_report.md와 같은 relative filename도
   *   성공적으로 산출물 지표(artifact)로 잡힐 수 있도록 드라이브 유무와 확장자 단어 패턴을 동시 식별한다.
   */
  private extractArtifactPath(text: string): string | null {
    // 1단계: 드라이브 문자로 시작하는 절대 경로 식별
    const absoluteMatch = text.match(/([a-zA-Z]:[\\/][\w\-.\\/]+)/);
    if (absoluteMatch) {
      return absoluteMatch[1];
    }
    
    // 2단계: 상대 경로 또는 단순 파일명 패턴 식별 (예: cheese_report.md, docs/plan.txt 등)
    // 단, Final Answer:, ID-2 같은 접두사 단어는 파일명으로 오판되지 않도록 배제한다.
    const relativeMatch = text.match(/([\w\-.]+\.[a-zA-Z0-9]+)/);
    if (relativeMatch && relativeMatch[1] && !relativeMatch[1].startsWith('ID-')) {
      return relativeMatch[1];
    }
    
    return null;
  }
}
