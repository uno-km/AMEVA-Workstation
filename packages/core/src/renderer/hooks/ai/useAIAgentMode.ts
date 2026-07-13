/**
 * @file useAIAgentMode.ts
 * @system AMEVA OS Desktop Workstation - Client Renderer
 * @location src/renderer/hooks/ai/useAIAgentMode.ts
 * @role ReAct (Reason-Action) Agent Loop Executor Hook
 * 
 * [책임 범위 - RESPONSIBILITY]
 * - 플러그인 도구( registerAgentTools )들과 연계하여 AI 에이전트의 ReAct 다중 추론 실행 루프를 구동(`runAgentMode`)한다.
 * - 도구 수행 중간 로그(accumulatedLogs)를 파싱하여 현재 구동 중인 도구명 지표(⚙️ [도구 실행] 'xxx' 도구...)를 실시간 챗 리스트에 피드백한다.
 * - 에이전트 추론 루프가 도출한 최종 Answer와 생각 단계별 Steps 로그들을 Reasoning Trace로 정렬 가공하여 메시지 상태 노드에 밀어 넣는다.
 * 
 * [책임이 아닌 것 - NON-RESPONSIBILITY]
 * - Llama.cpp 및 Ollama의 네트워크 Health Check (useAIHealthCheck에서 전담).
 * 
 * [절대 깨면 안 되는 계약 - CONTRACT]
 * - MUST NOT bypass scheduler release: 에이전트 루프 기동이 최종 끝났을 때(성공/실패 무관)는,
 *   반드시 `finally` 블록을 통과시켜 에이전트 락 플래그(`isAgentRunningRef.current = false`)를 내리고
 *   생성 상태(`setIsGenerating(false)`)를 해제하여 UI 및 후속 대기 큐(`processNextQueueRef`)가 영구 프리징되는 현상을 완벽 차단할 것.
 * - MUST NOT swallow agent execution errors: 에이전트 루프 내부 예외 발생 시,
 *   console.error와 대화 말풍선 카드에 에러 원인을 명시해 띄우고 실패 레코드를 반환할 것.
 
 * [소비처 - CONSUMERS / USAGE CONTEXT]
 * - 소비처 A (src/renderer/App.tsx): 최상위 Facade 구조에 통합 마운트.
 * - 소비처 B (src/renderer/contexts/AppContext.tsx): 리액트 Context 훅 목록에 바인딩되어 하위 뷰에 전파.
 */

/* 
 * [IMPORT SEGMENTATION & CONTRACTS]
 * - useCallback: runAgentMode 핸들러가 매번 재생성되어 상위 훅의 렌더 플로우를 흔들지 않도록 억제하기 위한 리액트 훅.
 * - useRef: 렌더 트리 갱신 주기 밖에서 동기적으로 에이전트 구동 락(isAgentRunningRef)을 제어하기 위한 참조 훅.
 */
import { useCallback, useRef } from 'react'

/* 
 * [ELECTRON IPC BRIDGE ADAPTER]
 * - ipc: 에이전트 사고 단계 로그를 로컈 파일 로그에 기록하기 위한 감청 전송 모듈.
 */
import * as ipc from '../../services/ipc/electronApiAdapter'

/* 
 * [AGENT CORE UTILS - LEGACY PATH]
 * - AgentEngine: 기존 ReAct 에이전트 실행 엔진 (기본 모드에서 사용, 동작 보존).
 * - registerAgentTools, buildAgentQuery, getAgentSystemPrompt, parseStockDataAndGenerateCard:
 *   기존 에이전트 모드 지원 헬퍼들. 신규 오케스트레이터 모드에서는 사용하지 않지만
 *   이전 버전 호환성을 위해 변경하지 않는다.
 */
import { AgentEngine } from '../../utils/agentEngine'
import { registerAgentTools } from '../../services/ai/agentTools'
import { buildAgentQuery, getAgentSystemPrompt } from '../../services/ai/agentPromptFactory'
import { parseStockDataAndGenerateCard } from '../../services/ai/agentStockCard'

/*
 * [ORCHESTRATOR - NEW PATH]
 * - AgentOrchestratorSession: 딥 리즈닝 모드에서 가동되는 신규 오케스트레이터 세션.
 *   deepReasoning 플래그가 true일 때만 사용되며, false일 때는 기존 AgentEngine이 사용된다.
 */
import { AgentOrchestratorSession } from '../../services/ai/orchestrator/AgentOrchestrator'
import { useAIState } from '../../stores/useAIState'

/* 
 * [TYPES]
 * - AIMessage: 대화 말풍선 목록 노드 규격.
 * - AISettings: AI 엔진 파라미터 구조체.
 */
import type { AIMessage, AISettings } from '../../types/aiTypes'
import type { OrchestratorConfig } from '../../services/ai/orchestrator/types'

/**
 * appendToVfsLog
 * AMEVA 가상 파일 시스템(VFS)의 특정 로그 파일(/sys/agent_reasoning.log) 끝에 문자열을 누적하여 저장한다.
 */
function appendToVfsLog(text: string): void {
  try {
    const logPath = '/sys/agent_reasoning.log'
    const vfsRaw = localStorage.getItem('ameva_vfs')
    let vfsData: Record<string, any> = {}
    if (vfsRaw) {
      try {
        vfsData = JSON.parse(vfsRaw)
      } catch {
        vfsData = {}
      }
    }
    
    let currentLog = ''
    if (vfsData[logPath]) {
      if (typeof vfsData[logPath] === 'object' && vfsData[logPath] !== null) {
        currentLog = vfsData[logPath].content || ''
      } else if (typeof vfsData[logPath] === 'string') {
        currentLog = vfsData[logPath]
      }
    }
    
    const updatedLog = currentLog + text + '\n'
    
    // VFS 저장 규격 객체 바인딩
    vfsData[logPath] = {
      content: updatedLog,
      meta: {
        size: updatedLog.length,
        modified: new Date().toISOString()
      }
    }
    
    localStorage.setItem('ameva_vfs', JSON.stringify(vfsData))
    // 탭 갱신 및 파일 탐색기 연동 트리거를 위한 커스텀 이벤트 방출
    window.dispatchEvent(new CustomEvent('ameva:file-auto-write', { detail: { path: logPath } }))
  } catch (err) {
    console.warn('[appendToVfsLog] Failed to append logs to AMEVA VFS:', err)
  }
}

/**
 * AgentModeParams 인터페이스 정의.
 * 에이전트 루프 구동에 필요한 상태 및 세터 함수들의 주입 통로.
 */
export interface AgentModeParams {
  assistantId: string
  sessId: string
  finalSettings: AISettings
  userMessage: string
  context?: string
  taggedBlocks?: { id: string; text: string }[]
  intent: string
  enabledPlugins: Record<string, boolean>
  isPro: boolean
  editorRef: React.RefObject<any>
  messages: AIMessage[]
  setMessages: React.Dispatch<React.SetStateAction<AIMessage[]>>
  setIsGenerating: React.Dispatch<React.SetStateAction<boolean>>
  currentAssistantIdRef: React.MutableRefObject<string | null>
  processNextQueueRef: React.MutableRefObject<(() => void) | null>
}

/**
 * AgentModeResult 인터페이스 정의.
 * 실행 성공 유무 및 추가 의사결정(수락/거절) 팝업 보존 여부 반환 규격.
 */
export interface AgentModeResult {
  success: boolean
  hasPendingDecision: boolean
  error?: string
}

/**
 * @hook useAIAgentMode
 * @description 플러그인 연계 ReAct 도구 호출 루프를 가동하고 중간 상태 및 최종 결과를 메시지 뷰에 매핑하는 훅.
 */
export function useAIAgentMode() {
  /*
   * [INVARIANT - Synchronous Agent Lock Reference]
   * - isAgentRunningRef: 에이전트 구동 동안 일반 토큰 스트림 처리를 임시 무력화하기 위한 동기식 락 플래그.
   */
  const isAgentRunningRef = useRef(false)

  /**
   * [CONTRACT - ReAct Loop Session Execution]
   * - Rationale: 파라미터 객체들을 비구조화 해제하여, AgentEngine 인스턴스를 구축하고 최대 5회(maxTurns)까지 Thought/Action/Observation을 자동 반복 구동한다.
   */
  const runAgentMode = useCallback(async (params: AgentModeParams): Promise<AgentModeResult> => {
    const {
      assistantId,
      sessId,
      finalSettings,
      userMessage,
      taggedBlocks,
      enabledPlugins,
      messages,
      setMessages,
      setIsGenerating,
      currentAssistantIdRef,
      processNextQueueRef
    } = params

    // 에이전트 락 활성화 및 로그 추가
    isAgentRunningRef.current = true
    ipc.llmAddLog({ text: '에이전트 모드 활성화. ReAct 루프 기동 중...', prefix: 'ReAct' })

    // 에디터 제안 수동 결정 수락창 팝업 플래그
    let agentHasPendingDecision = false

    /*
     * [DEEP REASONING BRANCH]
     * - deepReasoning 플래그 활성화 시: 신규 AgentOrchestratorSession 경로로 분기한다.
     * - deepReasoning 플래그 미활성화 시: 기존 AgentEngine 경로로 폴백하여 동작을 보존한다.
     *
     * 시나리오:
     * - true: <thought>/<tool_call> 파싱, 10000턴 가드레일, 7B 컨텍스트 풀 적용
     * - false: 기존 Thought/Action/Observation 텍스트 파싱 방식 (최대 5턴)
     */
    if (finalSettings.deepReasoning === true) {
      return await runDeepReasoningMode(params, isAgentRunningRef)
    }

    try {
      // 1. ReAct 동작 엔진 빌드
      const agent = new AgentEngine({
        providerType: finalSettings.apiType === 'ollama' ? 'ollama' : 'llama.cpp',
        endpointUrl: finalSettings.apiType === 'ollama' ? 'http://localhost:11434' : 'http://localhost:12345',
        modelName: finalSettings.modelPath,
        temperature: 0.1,
        maxTurns: 5
      }, sessId)

      // 2. 도구 맵 바인딩 등록 수행
      await registerAgentTools(agent, enabledPlugins)

      // 실시간 루프 진행 디버그 텍스트 누적 버퍼
      let accumulatedLogs = ''
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `agentQuery`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const agentQuery = ...` 형태로 안전 캐싱 후 가공 기동.
       */
      const agentQuery = buildAgentQuery(userMessage, messages, taggedBlocks)
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `agentSystemPrompt`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const agentSystemPrompt = ...` 형태로 안전 캐싱 후 가공 기동.
       */
      const agentSystemPrompt = getAgentSystemPrompt()

      // 3. 에이전트 세션 실행 개시 및 실시간 중간 로그 콜백 바인딩
      const agentResult = await agent.executeSession(agentQuery, (log: string) => {
        ipc.llmAddLog({ text: log, prefix: 'ReAct' })
        accumulatedLogs += log

        // 유저 화면에 실시간으로 '어떤 도구를 몇 단계째 실행 중인지' 피드백 갱신
        setMessages((prev) => prev.map((m) => {
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `m.id !== assistantId`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (m.id !== assistantId)` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
          if (m.id !== assistantId) return m

      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `statusText`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const statusText = ...` 형태로 안전 캐싱 후 가공 기동.
       */
          let statusText = '🤖 에이전트 추론 루프 기동 중...'
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `accumulatedLogs.includes('Action:')`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (accumulatedLogs.includes('Action:'))` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
          if (accumulatedLogs.includes('Action:')) {
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `lines`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const lines = ...` 형태로 안전 캐싱 후 가공 기동.
       */
            const lines = accumulatedLogs.split('\n')
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `actionLine`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const actionLine = ...` 형태로 안전 캐싱 후 가공 기동.
       */
            const actionLine = lines.find((l) => l.includes('Action:'))
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `actionLine`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (actionLine)` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
            if (actionLine) {
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `actName`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const actName = ...` 형태로 안전 캐싱 후 가공 기동.
       */
              const actName = actionLine.replace(/Action:\s*/i, '').trim()
              statusText = `⚙️ [도구 실행] '${actName}' 도구를 기동하고 있습니다...`
            }
          }

          return {
            ...m,
            content: '',
            isStreaming: true,
            reasoningTrace: [{
              id: `trace_agent_${m.id}_realtime`,
              source: 'model',
              type: 'thinking',
              text: statusText,
              model: finalSettings.modelPath || 'unknown',
              timestamp: new Date().toISOString()
            }]
          }
        }))
      }, agentSystemPrompt)

      // 4. 에이전트 루프가 종결 도달 시 최종 답안을 추출하여 상태 갱신
      if (agentResult.success && agentResult.finalAnswer) {
        // 주식 정보 등 구조화 원시 로그 분석 정제
        const { cleanContent, insertSuggestions } = parseStockDataAndGenerateCard(
          accumulatedLogs,
          agentResult.finalAnswer,
          taggedBlocks
        )

        // 수동 수락/거절이 필요한 제안서가 팝업되었는지 여부
        agentHasPendingDecision = insertSuggestions.length > 0

        setMessages((prev) => prev.map((m) =>
          m.id === assistantId
            ? {
                ...m,
                content: cleanContent,
                isStreaming: false,
                finalAnswer: cleanContent,
                insertSuggestion: insertSuggestions[0],
                insertSuggestions: insertSuggestions,
                // 생각 궤적 단계별로 분해 정렬하여 타임라인 데이터 구성
                reasoningTrace: agentResult.steps.flatMap((s: { thought: string; action?: string; actionInput?: string; observation?: string }, sIdx: number) => {
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `traces`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const traces = ...` 형태로 안전 캐싱 후 가공 기동.
       */
                  const traces = [{
                    id: `trace_agent_${m.id}_${sIdx}_thought`,
                    source: 'model' as const,
                    type: 'thinking' as const,
                    text: `[사고 단계 ${sIdx + 1}] ${s.thought}`,
                    model: finalSettings.modelPath || 'unknown',
                    timestamp: new Date().toISOString()
                  }]
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `s.action`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (s.action)` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
                  if (s.action) {
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `actionText`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const actionText = ...` 형태로 안전 캐싱 후 가공 기동.
       */
                    let actionText = `🎯 도구 실행: ${s.action}\n인자: ${s.actionInput}`
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `s.observation`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (s.observation)` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
                    if (s.observation) {
                      actionText += `\n\n🔍 결과:\n${s.observation.replace(/^Observation:\s*/i, '').trim()}`
                    }
                    traces.push({
                      id: `trace_agent_${m.id}_${sIdx}_action`,
                      source: 'model' as const,
                      type: 'thinking' as const,
                      text: actionText,
                      model: finalSettings.modelPath || 'unknown',
                      timestamp: new Date().toISOString()
                    })
                  }
                  return traces
                })
              }
            : m
        ))
      } else {
        // 성공 지표 미달성 시 예외를 던져 catch 블록으로 이주함
        throw new Error(agentResult.error || '에이전트가 솔루션을 도출하지 못했습니다.')
      }

      return { success: true, hasPendingDecision: agentHasPendingDecision }
    } catch (err: any) {
      console.error('[useAIAgentMode] 에이전트 구동 실패:', err)
      setMessages((prev) => prev.map((m) =>
        m.id === assistantId
          ? { ...m, content: `❌ 에이전트 실행 실패: ${err.message}`, isStreaming: false, error: true }
          : m
      ))
      return { success: false, hasPendingDecision: false, error: err.message }
    } finally {
      // CONTRACT: 락 상태 강제 리셋 및 메모리 참조 해제 보장
      isAgentRunningRef.current = false
      setIsGenerating(false)
      currentAssistantIdRef.current = null
      
      // 결정 보류 팝업이 없을 때만 다음 큐를 연속 구동함
      if (!agentHasPendingDecision) {
        setTimeout(() => processNextQueueRef.current?.(), 80)
      }
    }
  }, [])

  return { runAgentMode, isAgentRunningRef }
}

/**
 * ============================================================================
 * FUTURE DEVELOPMENT GUIDE (AI Agent Instruction Layer)
 * ============================================================================
 * 1. 에이전트의 최대 ReAct 반복 사고 횟수를 늘리고 싶을 때:
 *    - AISettings.maxAgentTurns 값을 Settings 화면에서 조절하면 된다.
 * 2. 딥 리즈닝 모드(deepReasoning: true)에서는 runDeepReasoningMode → AgentOrchestratorSession.
 *    - maxAgentTurns / agentContextPoolSize 는 AISettings에서 사용자가 직접 조절한다.
 * ============================================================================
 */

/* ============================================================
 * runDeepReasoningMode
 * ============================================================ */

/**
 * runDeepReasoningMode
 * deepReasoning === true 일 때 useAIAgentMode가 위임하는 독립 실행 함수.
 * AgentOrchestratorSession을 인스턴스화하고 ReAct 루프를 구동하며,
 * 모든 이벤트를 useAIState 스토어와 메시지 말풍선에 동기화한다.
 */
async function runDeepReasoningMode(
  params: AgentModeParams,
  isAgentRunningRef: React.MutableRefObject<boolean>
): Promise<AgentModeResult> {
  const {
    assistantId,
    finalSettings,
    userMessage,
    messages,
    taggedBlocks,
    setMessages,
    setIsGenerating,
    currentAssistantIdRef,
    processNextQueueRef
  } = params

  const {
    resetAgentState,
    setAgentPhase,
    appendAgentThought,
    setAgentTaskPlan,
    updateAgentTaskStepStatus,
    setAgentCurrentToolName,
    setAgentAccumulatedAnswer
  } = useAIState.getState()

  resetAgentState()
  ipc.llmAddLog({ text: '[딥 리즈닝] AgentOrchestrator 세션 기동', prefix: 'Orchestrator' })
  appendToVfsLog(`\n\n==================================================\n🤖 [에이전트 실행 시작] Goal: "${userMessage}"\n시간: ${new Date().toLocaleString()}\n==================================================`)

  const orchestratorConfig: OrchestratorConfig = {
    maxTurns: finalSettings.maxAgentTurns ?? 10000,
    contextPoolMaxTokens: finalSettings.agentContextPoolSize ?? 32768,
    engineType: (finalSettings.apiType as OrchestratorConfig['engineType']) ?? 'local',
    endpointUrl: finalSettings.apiType === 'ollama'
      ? 'http://localhost:11434'
      : 'http://localhost:12345',
    modelId: finalSettings.modelPath,
    temperature: finalSettings.temperature ?? 0.1
  }

  const history = messages.slice(-10).map((m) => ({
    role: (m.role === 'user' ? 'user' : 'assistant') as 'user' | 'assistant',
    content: m.finalAnswer ?? m.content
  }))

  const enrichedMessage = taggedBlocks && taggedBlocks.length > 0
    ? `[참조 본문]\n${taggedBlocks.map((b, i) => `[${i + 1}] "${b.text}"`).join('\n')}\n\n${userMessage}`
    : userMessage

  const session = new AgentOrchestratorSession(orchestratorConfig, (event) => {
    switch (event.type) {
      case 'phase_change':
        setAgentPhase(event.phase)
        setMessages((prev) => prev.map((m) => {
          if (m.id !== assistantId) return m
          return { ...m, isStreaming: event.phase !== 'done' && event.phase !== 'error' }
        }))
        break

      case 'thought_token':
        appendAgentThought(event.token)
        setMessages((prev) => prev.map((m) => {
          if (m.id !== assistantId) return m
          return {
            ...m, content: '', isStreaming: true, isThinking: true,
            reasoningTrace: (() => {
              const existingTrace = m.reasoningTrace || []
              const targetId = `orch_thought_${m.id}_${event.taskTitle || 'curr'}`
              const foundIdx = existingTrace.findIndex((t: any) => t.id === targetId)
              const updated = [...existingTrace]
              if (foundIdx > -1) {
                updated[foundIdx] = {
                  ...updated[foundIdx],
                  text: event.accumulated
                }
              } else {
                updated.push({
                  id: targetId,
                  source: 'model' as const,
                  type: 'thinking' as const,
                  text: event.accumulated,
                  model: finalSettings.modelPath || 'unknown',
                  timestamp: new Date().toISOString()
                })
              }
              return updated
            })()
          }
        }))
        break

      case 'answer_token':
        setAgentAccumulatedAnswer(event.accumulated)
        setMessages((prev) => prev.map((m) => {
          if (m.id !== assistantId) return m
          return { ...m, content: event.accumulated, isStreaming: true, isThinking: false }
        }))
        break

      case 'tool_call_start':
        setAgentCurrentToolName(event.toolName)
        appendToVfsLog(`⚙️ [도구 실행 시작] \`${event.toolName}\`\n인자: ${JSON.stringify(event.toolArgs, null, 2)}`)
        setMessages((prev) => prev.map((m) => {
          if (m.id !== assistantId) return m
          const existingTrace = m.reasoningTrace || []
          return {
            ...m, isStreaming: true,
            reasoningTrace: [
              ...existingTrace,
              {
                id: `orch_tool_${m.id}_${event.toolName}_${Date.now()}`,
                source: 'model' as const,
                type: 'thinking' as const,
                text: `⚙️ [도구 실행 중] \`${event.toolName}\`\n인자: ${JSON.stringify(event.toolArgs, null, 2)}`,
                model: finalSettings.modelPath || 'unknown',
                timestamp: new Date().toISOString()
              }
            ]
          }
        }))
        break

      case 'tool_call_end':
        setAgentCurrentToolName(null)
        {
          const isSuccess = event.result?.success
          const detail = isSuccess 
            ? `결과: 성공\n산출 데이터: ${String(event.result?.result).slice(0, 300)}${String(event.result?.result).length > 300 ? '...' : ''}`
            : `결과: 실패 - ${event.result?.error || '알 수 없는 오류'}`
          appendToVfsLog(`🔹 [도구 실행 완료] ${detail}`)
          setMessages((prev) => prev.map((m) => {
            if (m.id !== assistantId) return m
            const existingTrace = m.reasoningTrace || []
            return {
              ...m,
              reasoningTrace: [
                ...existingTrace,
                {
                  id: `orch_tool_end_${m.id}_${Date.now()}`,
                  source: 'model' as const,
                  type: 'thinking' as const,
                  text: `🔹 [도구 실행 완료] ${detail}`,
                  model: 'System',
                  timestamp: new Date().toISOString()
                }
              ]
            }
          }))
        }
        break

      case 'task_plan':
        setAgentTaskPlan(event.plan)
        break

      case 'task_step_update':
        updateAgentTaskStepStatus(event.stepId, event.status)
        break

      case 'plan_approval_request':
        // 렌더러가 planApprovalState === 'pending' 상태를 인지해 승인 UI 카드를 렌더링하도록 유도함
        break

      case 'task_exec_start':
        appendToVfsLog(`⚙️ [태스크 실행] ${event.taskTitle} (시도: ${event.attempt}회차)`)
        setMessages((prev) => prev.map((m) => {
          if (m.id !== assistantId) return m
          const existingTrace = m.reasoningTrace || []
          return {
            ...m,
            isStreaming: true,
            isThinking: true,
            reasoningTrace: [
              ...existingTrace,
              {
                id: `orch_task_exec_${m.id}_${Date.now()}`,
                source: 'model' as const,
                type: 'thinking' as const,
                text: `⚙️ [태스크 실행] ${event.taskTitle} (시도: ${event.attempt}회차)`,
                model: finalSettings.modelPath || 'unknown',
                timestamp: new Date().toISOString()
              }
            ]
          }
        }))
        break

      case 'critic_feedback':
        {
          const icon = event.verdict === 'PASS' ? '✅' : '❌'
          appendToVfsLog(`${icon} [자아비판 피드백] ${event.reason}`)
          setMessages((prev) => prev.map((m) => {
            if (m.id !== assistantId) return m
            const existingTrace = m.reasoningTrace || []
            return {
              ...m,
              isStreaming: true,
              isThinking: true,
              reasoningTrace: [
                ...existingTrace,
                {
                  id: `orch_critic_${m.id}_${Date.now()}`,
                  source: 'pipeline' as const,
                  type: 'thinking' as const,
                  text: `${icon} [자아비판 피드백] ${event.reason}`,
                  model: 'TaskVerifier',
                  timestamp: new Date().toISOString()
                }
              ]
            }
          }))
        }
        break

      case 'final_answer':
        appendToVfsLog(`\n🤖 [최종 답변 도출]\n${event.answer}\n==================================================\n`)
        setMessages((prev) => prev.map((m) => {
          if (m.id !== assistantId) return m
          return { ...m, content: event.answer, finalAnswer: event.answer, isStreaming: false, isThinking: false }
        }))
        break

      case 'error':
        ipc.llmAddLog({ text: `[Orchestrator] 오류: ${event.message}`, prefix: 'Orchestrator' })
        appendToVfsLog(`❌ [Orchestrator 에러]: ${event.message}`)
        break
    }
  })

  try {
    await session.initialize()
    await session.run(enrichedMessage, history)
    return { success: true, hasPendingDecision: false }
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err)
    console.error('[runDeepReasoningMode] 오케스트레이터 실행 실패:', errMsg)
    setMessages((prev) => prev.map((m) =>
      m.id === assistantId
        ? { ...m, content: `❌ 딥 리즈닝 실행 실패: ${errMsg}`, isStreaming: false, error: true }
        : m
    ))
    return { success: false, hasPendingDecision: false, error: errMsg }
  } finally {
    isAgentRunningRef.current = false
    setIsGenerating(false)
    currentAssistantIdRef.current = null
    useAIState.getState().setResumeFromCheckpoint(null)
    setTimeout(() => processNextQueueRef.current?.(), 80)
  }
}
