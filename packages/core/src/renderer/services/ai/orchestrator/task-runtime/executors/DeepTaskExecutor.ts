/**
 * @file orchestrator/task-runtime/executors/DeepTaskExecutor.ts
 * @system AMEVA OS Desktop Workstation
 * @role 개별 Task를 최대 1000턴까지 실행할 수 있는 마이크로 ReAct 엔진(Sub-Orchestrator)
 */

import type { ILLMEngineAdapter } from '../../types';
import { TaskRuntimeStore } from '../store/TaskRuntimeStore';
import { TaskLeaseManager } from '../lease/TaskLeaseManager';
import { MissionBudgetLedger } from '../budget/MissionBudgetLedger';
import { TaskExecutionContextBuilder } from './TaskExecutionContextBuilder';
import { TaskResultAssembler } from './TaskResultAssembler';
import type { TaskEvidence } from '../domain/types';

export class DeepTaskExecutor {
  private contextBuilder: TaskExecutionContextBuilder;
  private resultAssembler: TaskResultAssembler;

  constructor(
    private store: TaskRuntimeStore,
    private leaseManager: TaskLeaseManager,
    private ledger: MissionBudgetLedger,
    private adapter: ILLMEngineAdapter
  ) {
    this.contextBuilder = new TaskExecutionContextBuilder(store);
    this.resultAssembler = new TaskResultAssembler();
  }

  /**
   * Task 실행 메인 루프 (최대 1000턴)
   */
  public async execute(
    missionId: string, 
    taskId: string, 
    attemptId: string, 
    abortSignal?: AbortSignal
  ): Promise<void> {
    const task = this.store.getTask(missionId, taskId);
    const maxTurns = task.definition.allocatedReasoningTurns || task.definition.budgetTurns || 1000;
    
    let currentTurn = 0;
    let isGoalAchieved = false;
    let finalText = '';
    const evidences: TaskEvidence[] = [];

    // 초기 컨텍스트(프롬프트) 생성
    const messages = this.contextBuilder.buildContextMessages(missionId, task);

    try {
      while (currentTurn < maxTurns) {
        if (abortSignal && abortSignal.aborted) {
          throw new Error('Task execution was aborted.');
        }

        currentTurn++;

        // LLM 호출
        let chunkText = '';
        const responseText = await this.adapter.generateStream(messages, (token) => {
          chunkText += token;
          // (선택) 스트림 도중 조기 취소 감지 가능
        });

        // 텍스트 저장
        finalText += responseText;
        messages.push({ role: 'assistant', content: responseText });

        // 조기 종료 감지 (Done 신호)
        if (responseText.includes('[DONE]')) {
          isGoalAchieved = true;
          break; // 루프 탈출
        }

        // TODO: Tool 호출(JSON) 파싱 및 실행 로직 (PHASE 3의 핵심 ReAct 기능)
        // const toolCalls = parseToolCalls(responseText);
        // if (toolCalls.length > 0) {
        //   const toolResults = await executeTools(toolCalls);
        //   evidences.push(...toolResults);
        //   messages.push({ role: 'user', content: formatToolResults(toolResults) });
        //   continue; // 계속 루프 돎
        // } else {
        //   // 툴 호출이 없고 DONE도 없으면 무한루프 방지를 위해 조기 종료할 수 있음
        //   break;
        // }
        
        // 현재는 Tool 실행 연동 전이므로 바로 종료 (임시)
        isGoalAchieved = true;
        break;
      }

      // 예산 소비 정산 (소비한 턴 수를 Ledger에 보고)
      this.ledger.commitTaskBudget(missionId, taskId, maxTurns, currentTurn);

      // 최종 Result 조립
      const taskResult = this.resultAssembler.assemble(attemptId, finalText, evidences);

      // RUNNING -> VERIFYING 상태 전이
      const currentTask = this.store.getTask(missionId, taskId);
      this.store.dispatchTransition(
        {
          commandId: `cmd-verify-${crypto.randomUUID()}`,
          missionId,
          taskId,
          attemptId,
          expectedCurrentStatus: 'RUNNING',
          expectedStateVersion: currentTask.state.stateVersion,
          reason: 'Execution completed. Submitting for verification.',
          actor: 'DeepTaskExecutor',
          timestamp: Date.now()
        },
        'VERIFYING',
        { taskResult } // 조립된 결과를 함께 갱신
      );

    } catch (error: any) {
      console.error(`[DeepTaskExecutor] Task ${taskId} failed:`, error);
      
      // 오류 발생 시 RUNNING -> FAILED 로 전이
      try {
        // 예산은 예약된 만큼만 반환 (또는 소모된 만큼 처리)
        this.ledger.commitTaskBudget(missionId, taskId, maxTurns, currentTurn);
        
        const currentTask = this.store.getTask(missionId, taskId);
        this.store.dispatchTransition(
          {
            commandId: `cmd-fail-${crypto.randomUUID()}`,
            missionId,
            taskId,
            attemptId,
            expectedCurrentStatus: 'RUNNING',
            expectedStateVersion: currentTask.state.stateVersion,
            reason: `Execution failed: ${error.message}`,
            actor: 'DeepTaskExecutor',
            timestamp: Date.now()
          },
          'FAILED',
          { lastFailure: { errorType: 'ExecutionError', message: error.message, timestamp: Date.now() } }
        );
      } catch (transitionError) {
        console.error(`[DeepTaskExecutor] Failed to transition to FAILED:`, transitionError);
      }
    } finally {
      // 락(Lease) 해제
      // 이 부분은 LeaseManager에 attemptId 기반 release가 필요함 (생략 시 sweep에 의해 해제됨)
    }
  }
}
