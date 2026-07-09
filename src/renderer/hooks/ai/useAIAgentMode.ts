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
 */

/* 
 * [IMPORT SEGMENTATION & CONTRACTS]
 * - useCallback: runAgentMode 핸들러가 매번 재생성되어 상위 훅의 렌더 플로우를 흔들지 않도록 억제하기 위한 리액트 훅.
 * - useRef: 렌더 트리 갱신 주기 밖에서 동기적으로 에이전트 구동 락(isAgentRunningRef)을 제어하기 위한 참조 훅.
 */
import { useCallback, useRef } from 'react'

/* 
 * [ELECTRON IPC BRIDGE ADAPTER]
 * - ipc: 에이전트 사고 단계 로그를 로컬 파일 로그에 기록하기 위한 감청 전송 모듈.
 */
import * as ipc from '../../services/ipc/electronApiAdapter'

/* 
 * [AGENT CORE UTILS]
 * - AgentEngine: ReAct 방식에 기반하여 최대 회수(maxTurns) 동안 생각을 순환 구동하는 에이전트 실행 엔진.
 * - registerAgentTools: 활성화된 플러그인(웹 검색, 주식, 파일 IO 등)을 에이전트가 호출 가능한 도구로 맵 바인딩 등록하는 헬퍼.
 * - buildAgentQuery: 메시지 히스토리와 태그 단락 맥락을 결합해 최종 에이전트 타깃 쿼리를 구성하는 빌더.
 * - getAgentSystemPrompt: 에이전트용 ReAct 템플릿(Thought/Action/Action Input/Observation) 프롬프트 획득기.
 * - parseStockDataAndGenerateCard: 수집된 에이전트 행동 로그 속에서 UI 카드 렌더링에 적절한 제안 구조를 발라내는 파서.
 */
import { AgentEngine } from '../../utils/agentEngine'
import { registerAgentTools } from '../../services/ai/agentTools'
import { buildAgentQuery, getAgentSystemPrompt } from '../../services/ai/agentPromptFactory'
import { parseStockDataAndGenerateCard } from '../../services/ai/agentStockCard'

/* 
 * [TYPES]
 * - AIMessage: 대화 말풍선 목록 노드 규격.
 * - AISettings: AI 엔진 파라미터 구조체.
 */
import type { AIMessage, AISettings } from '../../types/aiTypes'

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
      const agentQuery = buildAgentQuery(userMessage, messages, taggedBlocks)
      const agentSystemPrompt = getAgentSystemPrompt()

      // 3. 에이전트 세션 실행 개시 및 실시간 중간 로그 콜백 바인딩
      const agentResult = await agent.executeSession(agentQuery, (log: string) => {
        ipc.llmAddLog({ text: log, prefix: 'ReAct' })
        accumulatedLogs += log

        // 유저 화면에 실시간으로 '어떤 도구를 몇 단계째 실행 중인지' 피드백 갱신
        setMessages((prev) => prev.map((m) => {
          if (m.id !== assistantId) return m

          let statusText = '🤖 에이전트 추론 루프 기동 중...'
          if (accumulatedLogs.includes('Action:')) {
            const lines = accumulatedLogs.split('\n')
            const actionLine = lines.find((l) => l.includes('Action:'))
            if (actionLine) {
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
                  const traces = [{
                    id: `trace_agent_${m.id}_${sIdx}_thought`,
                    source: 'model' as const,
                    type: 'thinking' as const,
                    text: `[사고 단계 ${sIdx + 1}] ${s.thought}`,
                    model: finalSettings.modelPath || 'unknown',
                    timestamp: new Date().toISOString()
                  }]
                  if (s.action) {
                    let actionText = `🎯 도구 실행: ${s.action}\n인자: ${s.actionInput}`
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
 * 1. 에이전트의 최대 ReAct 반복 사고 횟수(현재 5회)를 늘리고 싶을 때:
 *    - `maxTurns: 5` 파라미터 수치를 조율하되, 너무 높이면 API 응답 비용 및 연산 루프 무한 프리징 위험이 급증함에 주의할 것.
 * ============================================================================
 */
