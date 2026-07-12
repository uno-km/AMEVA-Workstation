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
    leaseId: string,
    abortSignal?: AbortSignal
  ): Promise<void> {
    const task = this.store.getTask(missionId, taskId);
    const maxTurns = task.definition.allocatedReasoningTurns || task.definition.budgetTurns || 1000;
    
    let currentTurn = 0;
    let finalText = '';
    const evidences: TaskEvidence[] = [];
    let streamFinishReason: 'DONE' | 'EOF' | 'ABORT' | 'ERROR' | 'MAX_TURNS' = 'EOF';

    // 초기 컨텍스트(프롬프트) 생성
    const messages = this.contextBuilder.buildContextMessages(missionId, task);

    try {
      while (currentTurn < maxTurns) {
        if (abortSignal && abortSignal.aborted) {
          streamFinishReason = 'ABORT';
          throw new Error('Task execution was aborted by signal.');
        }

        // Lease 만료 여부 확인 및 갱신 (선택적)
        // 여기서는 매 턴마다 갱신하여 락을 유지함
        try {
          this.leaseManager.renewLease(leaseId);
        } catch (leaseError) {
          streamFinishReason = 'ERROR';
          throw new Error(`Lease expired or invalid during turn ${currentTurn}: ${leaseError}`);
        }

        currentTurn++;

        // LLM 호출
        let chunkText = '';
        const responseText = await this.adapter.generateStream(messages, (token) => {
          chunkText += token;
          if (abortSignal && abortSignal.aborted) {
            // (구현에 따라 여기서 중단 가능)
          }
        });

        // 텍스트 저장
        finalText += responseText;
        messages.push({ role: 'assistant', content: responseText });

        // 스트림 조기 종료 감지 (Done 신호)
        if (responseText.includes('[DONE]')) {
          streamFinishReason = 'DONE';
          break; // 현재 스트림 루프(Reasoning 턴 반복) 탈출
        }

        // TODO: Tool 호출(JSON) 파싱 및 실행 로직
        // PHASE 3.5: 현재 "Disabled Safely" 정책에 따라 Tool 실행 기능은 막혀 있음.
        // Tool 요청이 들어와도 실행 불가이므로 다음 턴으로 넘어가거나 종료.
        // 여기서는 무한 루프를 방지하기 위해 스트림 종료로 간주함
        break;
      }

      if (currentTurn >= maxTurns) {
        streamFinishReason = 'MAX_TURNS';
      }

      // 예산 소비 정산 (실제 소비한 턴 수를 Ledger에 보고하고 나머지 예약분 반환)
      this.ledger.commitTaskBudget(missionId, taskId, maxTurns, currentTurn);

      // 최종 Result 조립
      const taskResult = this.resultAssembler.assemble(attemptId, finalText, evidences);
      (taskResult as any).streamFinishReason = streamFinishReason; // PHASE 4 인계를 위한 확장 정보

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
          reason: `Execution stopped (Reason: ${streamFinishReason}). Submitting for verification.`,
          actor: 'DeepTaskExecutor',
          timestamp: Date.now()
        },
        'VERIFYING',
        { taskResult }
      );

    } catch (error: any) {
      console.error(`[DeepTaskExecutor] Task ${taskId} failed:`, error);
      
      // 예산 반환
      this.ledger.commitTaskBudget(missionId, taskId, maxTurns, currentTurn);
      
      try {
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
      
      // 런타임에 에러 전파하여 rejection 추적 활성화
      throw error;
    } finally {
      // 락(Lease) 해제 보장
      this.leaseManager.releaseLease(leaseId);
    }
  }
}
