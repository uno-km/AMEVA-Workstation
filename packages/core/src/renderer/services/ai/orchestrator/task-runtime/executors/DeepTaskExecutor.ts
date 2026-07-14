/**
 * @file orchestrator/task-runtime/executors/DeepTaskExecutor.ts
 * @system AMEVA OS Desktop Workstation
 * @role V2 Task Runtime의 핵심 실행 엔진 — LLM Reasoning + Tool Action + Observation 폐루프
 *
 * [소비처 - CONSUMERS / USAGE CONTEXT]
 * - TaskDispatcher: dispatchTask() 내에서 비동기로 기동
 *
 * [STAGE D — Tool Runtime 실제 ReAct 연결]
 * 이전: 1턴만 실행 후 break (Tool 실행 불가 stub)
 * 이후: 실제 ReAct Action–Observation 폐루프
 *
 * [ReAct 폐루프 설계]
 * 1. Task Context → 시스템 프롬프트 빌드
 * 2. LLM generateStream() 호출
 * 3. ToolCallParser → Tool Action 감지
 * 4. Tool Action 있으면: ToolRegistry.executeTool() → Observation 생성 → 다음 Turn
 * 5. Tool Action 없으면: expectedOutputs 충족 여부 판단
 *    - 충족 → VERIFYING 전이
 *    - 미충족이고 maxTurns 미달 → 계속 추론
 *    - maxTurns 초과 → MAX_TURNS → VERIFYING 전이 (Verifier가 판단)
 *
 * [False Success 방지]
 * - [DONE] 키워드로 조기 종료 절대 금지 (삭제)
 * - Tool 실패를 성공 Observation으로 포장 금지 (ToolObservationBuilder)
 * - LLM에게 Tool 결과를 상상하도록 허용 금지
 *
 * [보안]
 * - ToolCallParser: prototype pollution, 크기 제한, idempotency
 * - Shadow Mode에서 외부 변경 Tool 실행 금지 (ToolPolicyChecker via V2ToolRuntimeAdapter)
 *
 * [AGENTS.md 규칙 준수]
 * - any 사용 없음
 * - 침묵 예외 없음 (AGENTS.md 규칙 5)
 */

import type { ILLMEngineAdapter } from '../../types';
import { TaskRuntimeStore } from '../store/TaskRuntimeStore';
import { TaskLeaseManager } from '../lease/TaskLeaseManager';
import { MissionBudgetLedger } from '../budget/MissionBudgetLedger';
import { TaskExecutionContextBuilder } from './TaskExecutionContextBuilder';
import { TaskResultAssembler } from './TaskResultAssembler';
import { ToolCallParser } from './ToolCallParser';
import { ToolObservationBuilder, type ToolObservation } from './ToolObservationBuilder';
import { CheckpointRuntime } from '../checkpoint/CheckpointRuntime';
import { ToolPolicyChecker, ToolPolicyViolationError } from '../policy/ToolPolicyChecker';
import { ToolApprovalPolicy, ToolApprovalViolationError } from '../policy/ToolApprovalPolicy';
import type { TaskEvidence } from '../domain/types';
import { ToolRegistry } from '../../ToolRegistry';


/**
 * [도메인 종속 지역 상수]
 * ReAct Loop 제어값
 */
const MAX_CONSECUTIVE_NO_TOOL_TURNS = 3; // 연속 Tool 없는 턴 허용 횟수 (이후 Output 충족 여부 판단)
const TOOL_EXECUTION_TIMEOUT_MS = 30_000; // 단일 Tool 실행 타임아웃 (30초)

export class DeepTaskExecutor {
  private contextBuilder: TaskExecutionContextBuilder;
  private resultAssembler: TaskResultAssembler;
  private toolCallParser: ToolCallParser;
  private observationBuilder: ToolObservationBuilder;
  private checkpointRuntime: CheckpointRuntime;

  private store: TaskRuntimeStore;
  private leaseManager: TaskLeaseManager;
  private ledger: MissionBudgetLedger;
  private adapter: ILLMEngineAdapter;
  private toolRegistry?: ToolRegistry;
  private artifactManager?: any; // any for now to avoid circular deps if they exist, or import type later

  constructor(
    store: TaskRuntimeStore,
    leaseManager: TaskLeaseManager,
    ledger: MissionBudgetLedger,
    adapter: ILLMEngineAdapter,
    toolRegistry?: ToolRegistry,
    checkpointRuntimeInjected?: CheckpointRuntime,
    artifactManager?: any
  ) {
    this.store = store;
    this.leaseManager = leaseManager;
    this.ledger = ledger;
    this.adapter = adapter;
    this.toolRegistry = toolRegistry;
    this.artifactManager = artifactManager;
    this.contextBuilder = new TaskExecutionContextBuilder(store);
    this.resultAssembler = new TaskResultAssembler();
    this.toolCallParser = new ToolCallParser();
    this.observationBuilder = new ToolObservationBuilder();
    this.checkpointRuntime = checkpointRuntimeInjected ?? new CheckpointRuntime();
  }

  /**
   * Task 실행 메인 루프 — ReAct Action–Observation 폐루프.
   *
   * [상태 전이]
   * RUNNING → VERIFYING (정상 종료, 최대 턴 도달)
   * RUNNING → FAILED (실행 오류 또는 Lease 만료)
   */
  public async execute(
    missionId: string,
    taskId: string,
    attemptId: string,
    leaseId: string,
    abortSignal?: AbortSignal
  ): Promise<void> {
    const task = this.store.getTask(missionId, taskId);
    const maxTurns = task.definition.allocatedReasoningTurns ?? task.definition.budgetTurns ?? 1000;

    let currentTurn = 0;
    let finalText = '';
    const evidences: TaskEvidence[] = [];
    const observations: ToolObservation[] = [];
    const completedToolCallIds: string[] = []; // Checkpoint resume 시 재실행 방지용
    let consecutiveNoToolTurns = 0;
    let streamFinishReason: 'OUTPUT_SUFFICIENT' | 'EOF' | 'ABORT' | 'ERROR' | 'MAX_TURNS' = 'EOF';

    // planVersion 추출 (Checkpoint 저장용)
    const planVersion = task.definition.plannerMetadata?.['planVersion'] as number | undefined ?? 1;

    /*
     * [ToolRegistry 연결]
     * 주입된 ToolRegistry를 사용하거나, 주입이 없으면 새 인스턴스 생성.
     * 기존 Legacy ToolRegistry와 독립적으로 V2 전용 인스턴스를 사용하여 충돌 방지.
     */
    const registry = this.toolRegistry ?? new ToolRegistry();
    // 기본 도구가 등록되지 않은 경우에만 등록
    if (registry.getAllDefinitions().length === 0) {
      try {
        await registry.registerDefaultTools();
      } catch (regErr: unknown) {
        // 도구 등록 실패는 경고만 남기고 계속 진행 (브라우저 환경 외 실행 시 발생 가능)
        const regMsg = regErr instanceof Error ? regErr.message : String(regErr);
        console.warn('[DeepTaskExecutor] Tool 기본 등록 실패 (테스트 환경일 수 있음):', regMsg);
      }
    }
    const knownToolNames = new Set(registry.getAllDefinitions().map(t => t.name));

    // 초기 컨텍스트(프롬프트) 생성 - 도구 정의 및 호출 포맷 주입
    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> =
      this.contextBuilder.buildContextMessages(missionId, task, registry);

    try {
      while (currentTurn < maxTurns) {
        if (abortSignal?.aborted) {
          streamFinishReason = 'ABORT';
          throw new Error('Task execution was aborted by signal.');
        }

        // ─── Lease 갱신 (매 턴마다) ───────────────────────────────────────
        try {
          this.leaseManager.renewLease(leaseId);
        } catch (leaseError: unknown) {
          streamFinishReason = 'ERROR';
          const msg = leaseError instanceof Error ? leaseError.message : String(leaseError);
          throw new Error(`Lease expired or invalid during turn ${currentTurn}: ${msg}`);
        }

        currentTurn++;

        // ─── LLM 호출 ────────────────────────────────────────────────────
        const responseText = await this.adapter.generateStream(messages, (_token) => {
          if (abortSignal?.aborted) {
            /* AbortSignal은 generateStream 완료 후 상위에서 처리 */
          }
        });

        finalText += responseText;
        // assistant 메시지를 컨텍스트에 추가
        messages.push({ role: 'assistant', content: responseText });

        // ─── Tool Call 파싱 ───────────────────────────────────────────────
        const parseResult = this.toolCallParser.parse(responseText, currentTurn, knownToolNames);

        if (parseResult.success) {
          /*
           * [Tool Action 감지]
           * Tool Call 후보를 실제로 실행하고 Observation을 생성한다.
           */
          const candidate = parseResult.candidate;
          consecutiveNoToolTurns = 0;
          let activeToolTrace: any = undefined;

          try {
            // [Item 6] Tool 실행 전 정책 검증
            // Shadow Mode 차단, 맰드 등록 확인 등 수행
            ToolPolicyChecker.assertAllowed(candidate.toolName, knownToolNames);

            const traceManager = this.store.getTraceManager();
            const toolDefinition = registry.getDefinition(candidate.toolName);

            traceManager.recordDecisionSummary(missionId, taskId, String(attemptId), {
              objective: task.definition.title || task.definition.goal || `Execute task ${taskId}`,
              knownFacts: [`Current task status is ${task.state.status}`, `Attempting turn ${currentTurn}`],
              missingInformation: [],
              selectedAction: `Execute tool ${candidate.toolName}`,
              selectedTool: candidate.toolName,
              selectionReason: `Selected tool '${candidate.toolName}' to advance task '${task.definition.title || taskId}' towards completion.`,
              alternativesConsidered: [],
              rejectionReasons: {},
              expectedOutcome: `Tool execution result will be processed into observation for the next reasoning turn.`,
              riskLevel: toolDefinition?.riskLevel || 'HIGH',
              approvalRequired: toolDefinition?.approvalRequired ?? (toolDefinition?.riskLevel === 'HIGH' || toolDefinition?.riskLevel === 'CRITICAL'),
              nextStepIfFailed: `Examine failure observation and attempt recovery or report defect.`
            });

            const { toolTrace } = traceManager.recordToolSelected(
              missionId, taskId, String(attemptId),
              candidate.toolCallId, candidate.toolName, 'general',
              `Executing tool '${candidate.toolName}' for task '${taskId}'`,
              candidate.arguments,
              toolDefinition
            );
            activeToolTrace = toolTrace;

            // Phase 4 위험도 및 승인 정책 검사
            if (toolTrace.approvalRequired) {
              const idempotencyKey = `idemp-appr-${missionId}-${candidate.toolCallId}`;
              const existingAppr = ToolApprovalPolicy.getApprovalRequest(`appr-${idempotencyKey}`);
              const status = existingAppr?.status ?? 'PENDING';
              if (status !== 'APPROVED') {
                traceManager.recordApprovalRequested(
                  missionId, taskId, String(attemptId),
                  candidate.toolCallId, candidate.toolName, toolTrace.riskLevel,
                  candidate.arguments, [], `Tool '${candidate.toolName}' requires user approval (${toolTrace.riskLevel} risk).`
                );
              }
              ToolApprovalPolicy.assertApproved(candidate.toolName, status, toolTrace.riskLevel);
            }

            traceManager.recordToolExecutionStarted(missionId, taskId, String(attemptId), toolTrace);

            // Tool 실행 (Timeout 포함) — DI된 registry 인스턴스 사용
            // [Item 4] Legacy expectedOutput 호환
            let resolvedOutputId: string | undefined = undefined;
            if (candidate.toolName === 'write_file') {
              // [Phase 3.1] Enforce write_file restriction based on retryScope
              const previousFailures = task.state.previousFailures || [];
              if (previousFailures.length > 0) {
                const lastFailure = previousFailures[previousFailures.length - 1];
                if (lastFailure.retryScope && lastFailure.retryScope !== 'FULL_TASK') {
                  throw new ToolPolicyViolationError('write_file is blocked for partial repair. Use apply_patch tool instead.', 'SHADOW_MODE_BLOCKED');
                }
              }

              const fileOutputs = task.definition.expectedOutputs?.filter(o => o.kind === 'FILE') || [];
              if (fileOutputs.length === 1) {
                resolvedOutputId = fileOutputs[0].id;
                console.warn(`[DeepTaskExecutor] LEGACY_SINGLE_OUTPUT_MAPPING: Auto-mapping to ${resolvedOutputId}`);
              } else {
                throw new Error('AMBIGUOUS_EXPECTED_OUTPUT: Cannot resolve exact expectedOutput for write_file');
              }
            }

            const toolContext: any = { 
              missionId, 
              taskId, 
              attemptId,
              artifactId: resolvedOutputId || `artifact-${crypto.randomUUID()}`,
              expectedOutput: resolvedOutputId,
              idempotencyKey: `${taskId}-${attemptId}-${candidate.toolCallId}`
            };

            if (candidate.toolName === 'apply_patch' && this.artifactManager) {
               const targetAid = candidate.arguments['artifactId'] || toolContext.artifactId;
               const manifest = await this.artifactManager.getManifest(missionId, targetAid);
               if (manifest) {
                  toolContext.currentRevision = manifest.revision;
                  toolContext.finalPath = manifest.finalPath;
                  toolContext.retryScope = task.state.previousFailures?.slice(-1)[0]?.retryScope;
               }
            }

            const toolResultPromise = registry.executeTool(candidate.toolName, candidate.arguments, toolContext);

            const timeoutPromise = new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error(`Tool '${candidate.toolName}' timed out after ${TOOL_EXECUTION_TIMEOUT_MS}ms`)), TOOL_EXECUTION_TIMEOUT_MS)
            );

            const toolResult = await Promise.race([toolResultPromise, timeoutPromise]);

            // [Item 2.1 & 3 & 5] Artifact Staging/Manifest Interaction
            if ((candidate.toolName === 'write_file' || candidate.toolName === 'apply_patch') && toolResult.success && this.artifactManager) {
              const { 
                artifactId: retAid, 
                missionId: retMid, 
                taskId: retTid, 
                attemptId: retAttId, 
                normalizedStagedPath, 
                size, 
                contentHash,
                newRevision
              } = toolResult;

              if (retMid !== missionId || retTid !== taskId || retAttId !== attemptId || !normalizedStagedPath) {
                throw new Error('Artifact context mismatch or normalizedStagedPath missing. WRITTEN transition denied.');
              }

              const aid = retAid || toolContext.artifactId;
              
              // No silent catch! Propagate error.
              await this.artifactManager.declareArtifact({
                artifactId: aid,
                missionId,
                taskId,
                attemptId: String(attemptId),
                kind: 'FILE',
                required: false, // Wait, task definition tells us if it's required. Default false.
                stagedPath: normalizedStagedPath,
                status: 'DECLARED',
                revision: newRevision || 1,
                createdAt: Date.now(),
                updatedAt: Date.now(),
                provenance: { missionId, taskId, attemptId: String(attemptId), producer: candidate.toolName }
              });
              // Store size and hash if supported by markWritten, otherwise the manager has to fetch it.
              // Assuming markWritten can take it, or declareArtifact takes it.
              await this.artifactManager.markStaged(missionId, aid);
              await this.artifactManager.markWritten(missionId, aid);
              console.log(`[DeepTaskExecutor] Artifact ${aid} marked WRITTEN for mission ${missionId}`);
            }

            // Phase 4 Trace 완료 기록
            if (activeToolTrace) {
              this.store.getTraceManager().recordToolExecutionTerminal(
                missionId, taskId, String(attemptId),
                activeToolTrace,
                toolResult.success ? 'SUCCEEDED' : 'FAILED',
                `Tool '${candidate.toolName}' finished with status ${toolResult.success ? 'SUCCEEDED' : 'FAILED'}`
              );
            }

            // Observation 빌드 (False Success 방지: success=false → FAILED 관측)
            const observation = this.observationBuilder.buildSuccess(candidate, toolResult);
            this.store.getTraceManager().recordToolObservation(missionId, taskId, String(attemptId), observation);
            observations.push(observation);

            // Evidence 기록
            evidences.push({
              source: 'tool_result',
              data: {
                toolCallId: candidate.toolCallId,
                toolName: candidate.toolName,
                status: observation.status,
                description: `Tool '${candidate.toolName}' ${observation.status}`
              },
              timestamp: Date.now()
            });

            // Observation을 다음 Turn의 user 메시지로 주입
            const observationText = this.observationBuilder.toContextMessage(observation);
            messages.push({ role: 'user', content: observationText });

            // [Checkpoint 저장] Tool 성공 직후 안전 지점 저장 (forceNow=true)
            if (observation.status === 'SUCCESS') {
              completedToolCallIds.push(candidate.toolCallId);
              this.checkpointRuntime.maybeSaveOnTurnBoundary(
                missionId, taskId, attemptId,
                currentTurn, finalText, completedToolCallIds, planVersion,
                true // Tool 성공 직후 강제 저장
              );
            }

          } catch (toolError: unknown) {
            /*
             * [Tool 실행 오류 처리]
             * 오류를 침묵시키지 않는다 (AGENTS.md 규칙 5).
             * 실패 Observation을 생성하여 LLM이 다음 Turn에서 인지하게 한다.
             * 오류를 성공 Observation으로 포장하지 않는다.
             * [Item 6] ToolPolicyViolationError는 'POLICY_BLOCKED' 유형으로 구분.
             */
            const errorMsg = toolError instanceof Error ? toolError.message : String(toolError);
            const isShadowBlock = toolError instanceof ToolPolicyViolationError && toolError.violationType === 'SHADOW_MODE_BLOCKED';
            const isApprovalBlock = toolError instanceof ToolApprovalViolationError;

            if (activeToolTrace) {
              this.store.getTraceManager().recordToolExecutionTerminal(
                missionId, taskId, String(attemptId),
                activeToolTrace,
                isApprovalBlock ? 'CANCELLED' : errorMsg.includes('timed out') ? 'TIMED_OUT' : 'FAILED',
                errorMsg
              );
            }

            if (isShadowBlock) {
              console.info(
                `[DeepTaskExecutor] Tool '${candidate.toolName}' blocked by Shadow Mode policy. ` +
                `Observation: POLICY_BLOCKED.`
              );
            } else if (isApprovalBlock) {
              console.warn(
                `[DeepTaskExecutor] Tool '${candidate.toolName}' blocked waiting for user approval (${(toolError as ToolApprovalViolationError).riskLevel} risk).`
              );
            } else {
              console.error(`[DeepTaskExecutor] Tool '${candidate.toolName}' 실행 실패:`, errorMsg);
            }

            const failedObservation = this.observationBuilder.buildFailure(
              candidate,
              errorMsg,
              isApprovalBlock ? 'REJECTED' :
              errorMsg.includes('timed out') ? 'TIMED_OUT' :
              isShadowBlock ? 'ERROR' :
              'ERROR'
            );
            this.store.getTraceManager().recordToolObservation(missionId, taskId, String(attemptId), failedObservation);
            observations.push(failedObservation);

            const observationText = this.observationBuilder.toContextMessage(failedObservation);
            messages.push({ role: 'user', content: observationText });
          }

        } else {
          /*
           * [Tool Action 없음]
           * LLM이 Tool 없이 순수 텍스트를 응답한 경우.
           * 연속 Tool-없는-턴 카운터 증가.
           * - NO_TOOL_CALL_FOUND: 정상 — 추론 중
           * - 그 외(파싱 오류): 경고 로그 (LLM 출력 형식 문제)
          if (!parseResult.success) {
            if (parseResult.error.errorType !== 'NO_TOOL_CALL_FOUND') {
              console.warn(`[DeepTaskExecutor] Tool 파싱 오류 (Turn ${currentTurn}):`, parseResult.error.message);
              messages.push({ role: 'user', content: `[System Error] ${parseResult.error.message}` });
              consecutiveNoToolTurns = 0;
              continue;
            }
          }
          consecutiveNoToolTurns++;

          /*
           * [Output 충족 여부 판단]
           * expectedOutputs가 있는 경우 현재까지의 finalText에서 충족 여부를 확인한다.
           * 간단한 키워드 기반 체크 (Semantic 검증은 VerificationRuntime에서 수행).
           * Tool 없이 MAX_CONSECUTIVE_NO_TOOL_TURNS 턴 연속 응답하면 Output 충분하다고 판단.
           */
          if (consecutiveNoToolTurns >= MAX_CONSECUTIVE_NO_TOOL_TURNS) {
            streamFinishReason = 'OUTPUT_SUFFICIENT';
            break;
          }
        }

        // [턴 경계 Checkpoint 저장] 매 N턴마다 Turn_BOUNDARY 저장
        this.checkpointRuntime.maybeSaveOnTurnBoundary(
          missionId, taskId, attemptId,
          currentTurn, finalText, completedToolCallIds, planVersion,
          false // 정책 진단 (N턴마다)
        );
      } // while 루프 종료

      if (currentTurn >= maxTurns && streamFinishReason === 'EOF') {
        streamFinishReason = 'MAX_TURNS';
      }

      // ─── Checkpoint 정리 ───────────────────────────────────────────────
      this.checkpointRuntime.clearTask(taskId);

      // ─── 예산 소비 정산 ────────────────────────────────────────────────
      this.ledger.commitTaskBudget(missionId, taskId, maxTurns, currentTurn);

      // ─── Tool Parser 상태 초기화 ───────────────────────────────────────
      this.toolCallParser.reset();

      // ─── 최종 Result 조립 ──────────────────────────────────────────────
      const taskResult = this.resultAssembler.assemble(attemptId, finalText, evidences);

      // RUNNING → VERIFYING 상태 전이
      const currentTask = this.store.getTask(missionId, taskId);
      this.store.dispatchTransition(
        {
          commandId: `cmd-verify-${crypto.randomUUID()}`,
          missionId,
          taskId,
          attemptId,
          expectedCurrentStatus: 'RUNNING',
          expectedStateVersion: currentTask.state.stateVersion,
          reason: `Execution completed (Reason: ${streamFinishReason}, Turns: ${currentTurn}, Tools: ${observations.length}). Submitting for verification.`,
          actor: 'DeepTaskExecutor',
          timestamp: Date.now()
        },
        'VERIFYING',
        { taskResult }
      );

    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`[DeepTaskExecutor] Task ${taskId} failed:`, errorMsg);

      // [반복 Crash 기록] 동일 Fingerprint에서 반복 실패 감지
      this.checkpointRuntime.recordCrash(taskId);

      // 예산 반환
      this.ledger.commitTaskBudget(missionId, taskId, maxTurns, currentTurn);
      this.toolCallParser.reset();


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
            reason: `Execution failed: ${errorMsg}`,
            actor: 'DeepTaskExecutor',
            timestamp: Date.now()
          },
          'FAILED',
          { lastFailure: { errorType: 'ExecutionError', message: errorMsg, timestamp: Date.now() } }
        );
      } catch (transitionError: unknown) {
        const tMsg = transitionError instanceof Error ? transitionError.message : String(transitionError);
        console.error(`[DeepTaskExecutor] Failed to transition to FAILED:`, tMsg);
      }

      throw error;
    } finally {
      // Lease 해제 보장
      this.leaseManager.releaseLease(leaseId);
    }
  }
}
