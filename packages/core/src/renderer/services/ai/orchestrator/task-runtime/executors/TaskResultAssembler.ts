/**
 * @file orchestrator/task-runtime/executors/TaskResultAssembler.ts
 * @system AMEVA OS Desktop Workstation
 * @role 실행이 종료된 후 텍스트 출력, 툴 실행 이력 등을 모아 TaskResult(Output)로 패키징
 */

import type { TaskResult, TaskOutput, TaskEvidence } from '../domain/types';

export class TaskResultAssembler {
  /**
   * LLM의 최종 텍스트 응답 및 중간 수집 데이터를 바탕으로 TaskResult를 조립합니다.
   * 조립 후 상태는 VERIFYING으로 넘어가게 됩니다.
   */
  public assemble(
    attemptId: string,
    finalText: string,
    toolEvidences: TaskEvidence[]
  ): TaskResult {
    const outputs: TaskOutput[] = [];
    
    // 단순 텍스트를 기본 Output으로 추가
    if (finalText && finalText.trim().length > 0) {
      outputs.push({
        type: 'text',
        content: finalText.replace(/\[DONE\]/g, '').trim()
      });
    }

    // TODO: 만약 JSON 포맷의 산출물이 포함되어 있다면 파싱해서 'structured_data' 타입으로 추가 가능

    return {
      attemptId,
      createdAt: Date.now(),
      status: 'VERIFYING', // 이 결과가 VERIFYING 상태를 위한 것임을 명시
      summary: `Task Execution Completed (Attempt: ${attemptId})`,
      outputs,
      evidence: toolEvidences
    };
  }
}
