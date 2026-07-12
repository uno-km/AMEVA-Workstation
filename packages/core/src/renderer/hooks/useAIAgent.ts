/**
 * @file useAIAgent.ts
 * @system AMEVA OS Desktop Workstation - Client Renderer
 * @location src/renderer/hooks/useAIAgent.ts
 * @role AI Agent Core Facade (Facade Pattern)
 * 
 * [소비처 - CONSUMERS / USAGE CONTEXT]
 * - 소비처 A (src/renderer/App.tsx): `useAIAgent` 훅을 호출하여 AI 패널에 챗 메시지, 추론 가동 유무 및 모델 상태를 제공하고 context value로 캡슐화 노출함.
 * - 소비처 B (src/renderer/components/AIPanel.tsx): UI 전송 버튼 클릭 시 `generateResponse`를, 정지 시 `abortGeneration`을 최종 호출해 소비함.
 * - 결합 규격: 본 훅은 반드시 AppContext.Provider 내부 리액트 라이프사이클 컨텍스트 내에서 가동되어야 함.
 * 
 * [책임 범위 - RESPONSIBILITY]
 * - AI 생성 라이프사이클(인풋 전송, 응답 스트리밍, 대화 목록 렌더링, 제안 반영 대기 큐)을 제어하는 세부 훅들을 통합한다.
 * - Electron IPC를 통한 LLM 중단(`llmAbort`) 명령 발송 및 스트림 파서 결과의 라우팅을 조율한다.
 * - Zustand 상태 변경(`useAIState`, `useAILogStore`)의 바인딩 지점을 자식들에게 중계한다.
 * 
 * [책임이 아닌 것 - NON-RESPONSIBILITY]
 * - 로컬 Llama.cpp 프로세스의 파일 로드 및 가동(Start/Stop) 관리 (useLocalAIEngine의 단독 소유).
 * - 실제 EDIT/INSERT 제안을 에디터 DOM에 쓰는 구체적 조작 (useAIResponseHandler가 단독 소유).
 * 
 * [절대 깨면 안 되는 계약 - CONTRACT]
 * - MUST NOT: `isGenerating` 락 상태가 유지되는 동안은 큐에 존재하는 다음 대기 요청을 실행해서는 안 됨 (useAIQueue의 동기화 락 보존 계약).
 * - MUST: AI 응답 생성 완료 콜백인 `handleDone`은 어떠한 경우에도(성공/실패/중단) 호출되어 큐를 비워야 하며, 그렇지 않으면 UI 락 프리징이 발생함.
 */

/* 
 * [IMPORT SEGMENTATION & CONTRACTS]
 * - useRef: React의 렌더 트리 독립적인 런타임 락(Lock) 상태 및 엘리먼트 참조값 보존용 훅.
 * - useCallback: 컴포넌트 리렌더링 시 자식 컴포넌트의 불필요한 재생성을 차단하기 위한 메모이즈 훅.
 * - useEffect: 비동기 큐 동기화 라이프사이클 구동 훅.
 */
import { useRef, useCallback, useEffect } from 'react'

/* 
 * [ZUSTAND STORE HOOKS]
 * - useAIState: AI 설정 상태 및 기동 모델 리스트 관리 스토어.
 * - useAILogStore: 에이전트 생성 도중 축적되는 실시간 출력물 보존 스토어.
 */
import { useAIState } from '../stores/useAIState'
import { useAILogStore } from '../stores/useAILogStore'

/* 
 * [IPC & INFRASTRUCTURE CONTROLLERS]
 * - useAIIpc: Electron 프로세스와의 IPC 채널 라이브러리 연동 세션 관리 훅.
 * - useAIStreamProcessor: 토큰을 실시간 수신하여 정제(Sanitize)하고 렌더링 스로틀을 거치는 전담 훅.
 * - useAIMessageState: 메시지 노드의 수정(Diff) 및 삽입 승인 이력 관리 훅.
 * - useAIQueue: 순차 추론 실행을 보장하는 에이전트 명령 큐 조작 훅.
 * - useAIEngineLogs: 로컬 바이너리가 방출하는 터미널 콘솔 디버그 로그 수집 훅.
 * - ipc: Electron Preload 레이어와 1:1 매핑되어 실행 및 중단 신호를 쏘는 어댑터.
 */
import { useAIIpc } from './ai/useAIIpc'
import { useAIStreamProcessor } from './ai/useAIStreamProcessor'
import { useAIMessageState } from './ai/useAIMessageState'
import { useAIQueue } from './ai/useAIQueue'
import { useAIEngineLogs } from './ai/useAIEngineLogs'
import * as ipc from '../services/ipc/electronApiAdapter'
import { WebLLMEngine } from '../services/ai/WebLLMEngine'

/* 
 * [SUB-DOMAINS ACTION ENGINES]
 * - useAIModels: 사용 가능한 채팅/코드 모델 패치 및 다운로드 트리거 연동.
 * - useAIHealthCheck: 로컬 포트 접속 테스트 및 AI 서비스 상태 핑 체크.
 * - useAIBlockProcessor: 에디터 내 특정 단락을 LLM 지시 형태로 파싱하는 프로세서.
 * - useAIResponseHandler: 추론 종결 감지 시 마크다운 파싱 및 에디터 직접 조작.
 * - useAIGenerator: 프롬프트 구성 및 LLM 추론 트리거 조율.
 */
import { useAIModels } from './ai/useAIModels'
import { useAIHealthCheck } from './ai/useAIHealthCheck'
import { useAIBlockProcessor } from './ai/useAIBlockProcessor'
import { useAIResponseHandler } from './ai/useAIResponseHandler'
import { useAIGenerator } from './ai/useAIGenerator'
import { useAIAgentMode } from './ai/useAIAgentMode'
import { determineIntent } from '../services/ai/determineIntent'

/**
 * @hook useAIAgent
 * @description AI 에이전트의 생성, 중단, 모델 캐싱, 큐 핸들링, 스냅샷 반영 등을 총괄 조율하는 최상단 파사드.
 */
export function useAIAgent() {
  const { runAgentMode } = useAIAgentMode()
  /*
   * [ZUSTAND AI STATE SUBSCRIPTION]
   * - isGenerating: 응답 생성 여부 상태값.
   * - _setIsGenerating: 생성 중 플래그 변경 스토어 액션.
   * - isAvailable: AI 엔진 정상 가동 여부 플래그.
   * - setIsAvailable: AI 엔진 정상 가동 플래그 변경 세터.
   * - models: 챗 모델 어레이.
   * - setModels: 챗 모델 목록 보존 세터.
   * - codeModels: 코드 모델 어레이.
   * - setCodeModels: 코드 모델 목록 보존 세터.
   * - settings: AI 온도, 엔드포인트 등을 관리하는 전역 객체.
   * - updateSettings: AI 설정 상태 부분 갱신용 스토어 세터.
   */
  const {
    isGenerating,
    setIsGenerating: _setIsGenerating,
    isAvailable,
    setIsAvailable,
    models,
    setModels,
    codeModels,
    setCodeModels,
    settings,
    updateSettings
  } = useAIState()
  
  /*
   * [LOCK STATE INVARIANT - Ref vs State]
   * - isGeneratingRef: 큐 스케줄러의 비동기 호출 조건(동기화 락)을 판정하기 위해 useRef로 구현한 락 상태 사본.
   * - Rationale: React state의 비동기 업데이트 딜레이로 인해 락이 풀리는 현상을 차단하고자 `isGeneratingRef`를 동시 운용한다.
   */
  const isGeneratingRef = useRef(false)

  /*
   * [CONTRACT - Atomic State Setter Wrapper]
   * - Rationale: React 상태 스토어(`_setIsGenerating`)와 스케줄러 동기화 락(`isGeneratingRef.current`)의 불변 값을 일체화하여 보존하기 위해 래핑함.
   */
  const setIsGenerating = useCallback((val: boolean) => {
    _setIsGenerating(val)
    isGeneratingRef.current = val
  }, [_setIsGenerating])

  /*
   * [CONTRACT - Debug Terminal Logs Engine]
   * - engineLogs: Llama.cpp 등에서 방출되는 터미널 로그 목록.
   * - setEngineLogs: 터미널 로그 목록 보강 세터.
   */
  const { engineLogs, setEngineLogs } = useAIEngineLogs()

  /*
   * [CONTRACT - IPC Session Manager]
   * - subscribeSession: 특정 추론 요청에 대한 세션 이벤트 핸들러 등록 함수.
   * - unsubscribeSession: 특정 추론 세션 이벤트 해제 함수.
   */
  const { subscribeSession, unsubscribeSession } = useAIIpc()

  /*
   * [CONTRACT - Stream Sanitizer Controller]
   * - rawAccumRef: 생각 태그 정제 이전의 실시간 날 것의(un-sanitized) 텍스트 누적 버퍼 참조 변수.
   * - currentAssistantIdRef: 현재 스트리밍을 수신하여 갱신할 대상 AI 메시지 노드의 ID 참조 변수.
   * - currentSessionIdRef: 현재 진행 중인 추론 요청 세션 고유 키 참조 변수.
   * - resetSession: 새 추론 생성 세션을 초기화하고 누적 버퍼와 세션 아이디를 리셋하는 함수.
   * - processToken: 개별 토큰 유입 시 생각 태그와 결과물을 분리 파싱하여 스로틀에 따라 상태를 갱신하는 함수.
   * - finalize: 스트리밍이 최종 완료되었을 때 생각 버퍼를 동기화하고 정제 완료 결과(SanitizeResult)를 내는 함수.
   */
  const {
    rawAccumRef,
    currentAssistantIdRef,
    currentSessionIdRef,
    resetSession,
    processToken,
    finalize
  } = useAIStreamProcessor()

  /*
   * [CONTRACT - Message History Manager]
   * - messages: 현재 활성 세션에 노출할 챗 메시지 리스트.
   * - addUserAndAssistantMessages: 유저 입력값과 AI가 채워 넣을 빈 노드를 메시지 리스트에 동시 생성.
   * - finalizeAssistantMessage: 스트리밍 완료 후 최정 정제 텍스트 및 코드 제안 파싱물을 노드에 패치.
   * - updateMessageDiffState: EDIT 수락/거절 상태 갱신 API.
   * - updateInsertSuggestionStatus: INSERT 수락/거절 상태 갱신 API.
   */
  const {
    messages,
    addUserAndAssistantMessages,
    finalizeAssistantMessage,
    updateMessageDiffState,
    updateInsertSuggestionStatus
  } = useAIMessageState()

  /*
   * [CONTRACT - Queue Manager]
   * - pendingQueue: AI 연산 요청 대기 큐 리스트.
   * - removeFromQueue: 특정 대기 큐를 날려 실행을 차단함.
   * - enqueue: 신규 연산 요청을 대기 큐에 집어넣음.
   * - checkAndProcessNextQueue: 락 해제 시 다음 순차 대기 큐를 꺼내 실행을 개시하는 동기 스케줄러.
   * - clearQueue: 대기 큐 전체 초기화.
   */
  const {
    pendingQueue,
    removeFromQueue,
    enqueue,
    checkAndProcessNextQueue,
    clearQueue
  } = useAIQueue(isGeneratingRef)

  /*
   * [CONTRACT - State Sync to Log Store / Rationale]
   * - setMessages: AI 생성 진행률 및 스로틀을 실시간으로 화면에 렌더하기 위한 메시지 리셋 액션.
   * - setStreamingText: 누적된 실시간 출력 텍스트를 터미널 로그 및 디버깅 콘솔 창에 강제 주입하는 세터.
   */
  const { setMessages, setStreamingText } = useAILogStore()

  /*
   * [CONTRACT - Active Editor Reference / Rationale]
   * - editorRef: 현재 활성화된 에디터 인스턴스를 보존하여 비동기 추론 완료 시점에 에디터 DOM 블록을 직접 수정(Patch)할 수 있도록 바인딩하는 Mutable 레퍼런스 객체.
   * - MUST NOT clear: 에디터가 언마운트되기 전까지 레퍼런스를 잃으면 수락/거절에 따른 문서 패치가 전면 먹통이 됨.
   */
  const editorRef = useRef<any>(null)

  /*
   * [CONTRACT - Non-generating Scheduler Callback / Rationale]
   * - processNextQueueRef: 비동기 응답 처리 완료 및 사용자 제안 수락 후, 대기 큐를 마저 실행할 오케스트레이터의 팩토리 리스너 참조 변수.
   */
  const processNextQueueRef = useRef<(() => void) | null>(null)

  /*
   * [CONTRACT - Settings Dispatcher]
   * - Rationale: useAIState의 updateSettings와 연동하여 AI 설정을 부분/전체 패치하도록 랩핑.
   */
  const setSettings = useCallback((updater: any) => {
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `next`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const next = ...` 형태로 안전 캐싱 후 가공 기동.
       */
    const next = typeof updater === 'function' ? updater(useAIState.getState().settings) : updater
    updateSettings(next)
  }, [updateSettings])

  /*
   * [SUB-DOMAINS REGISTRATION]
   * - refreshModels: 모델 목록 갱신 훅.
   */
  const { refreshModels } = useAIModels(settings, setSettings, setModels, setCodeModels, setIsAvailable)
  
  /* 
   * [HEALTH CHECK SIDE EFFECT]
   * - 주기적으로 로컬 LLM 서버 포트 생존 검사를 구동하여 연결 여부(isAvailable)를 판단함.
   */
  useAIHealthCheck(settings, setIsAvailable)
  
  /*
   * [CONTRACT - Inference Finished Event Handler]
   * - handleDone: AI 스트림 통신 종결 시, 마크다운 코드 블록 파싱, EDIT/INSERT의 에디터 자동 패치, 메시지 상태 최종 갱신, 세션 언구독 및 다음 큐 실행을 연쇄 조정하는 핵심 조율기.
   */
  const { handleDone } = useAIResponseHandler(
    currentSessionIdRef,
    currentAssistantIdRef,
    rawAccumRef,
    finalize,
    finalizeAssistantMessage,
    unsubscribeSession,
    editorRef,
    processNextQueueRef
  )

  // [useAIGenerator 훅 복원 - LLM 요청 발송 제어]
  const { generateResponse: coreGenerateResponse } = useAIGenerator(
    settings,
    messages,
    isGeneratingRef,
    enqueue,
    setIsGenerating,
    setMessages,
    setStreamingText,
    resetSession,
    addUserAndAssistantMessages,
    processToken,
    subscribeSession,
    setEngineLogs,
    handleDone,
    editorRef,
    processNextQueueRef,
    currentAssistantIdRef
  )

  /*
   * [CONTRACT - Inference Initiator Controller]
   * - generateResponse: 유저 인풋 및 에디터 선택 텍스트 범위, 태그 지정된 블록 메타정보를 취합해 최적의 Prompt를 생성하고 큐에 넣어 LLM 세션을 구동함.
   */
  const generateResponse = useCallback(async (
    msg: string,
    ctx?: string,
    orig?: string,
    bId?: string,
    runtimeSettings?: any,
    editor?: any,
    taggedBlocks?: { id: string; text: string }[]
  ) => {
    // Rationale: 비동기 완료 시점에 에디터에 블록을 수정 삽입하기 위해 editorRef.current에 주입 보존한다.
    if (editor) editorRef.current = editor

    // [PLAN APPROVAL INTERCEPT] 플랜 승인 대기 상태일 때 사용자가 새 메시지를 전송하면 계획의 피드백(리뷰)으로 전달한다.
    const currentState = useAIState.getState()
    if (currentState.planApprovalState === 'pending') {
      const resolve = currentState.resolvePlanApproval
      if (resolve) {
        // [계획 리뷰] 접두사 제거 후 피드백으로 전달
        const feedbackText = msg.replace(/^\[계획 리뷰\]\s*/, '').trim()
        resolve({ approved: false, feedback: feedbackText })
        return { success: true, hasPendingDecision: false }
      }
    }

    const finalSettings = { ...settings, ...runtimeSettings }

    // [DEEP REASONING ORCHESTRATION] 딥리즈닝 모드 사용 시 AgentMode (Orchestrator) 루프로 직접 위임
    if (finalSettings.deepReasoning === true) {
      if (isGeneratingRef.current) {
        enqueue({ userMessage: msg, context: ctx, originalText: orig, blockId: bId, runtimeSettings, editorInstance: editor, taggedBlocks })
        return { success: true, hasPendingDecision: false }
      }

      setIsGenerating(true)
      const assistantId = `msg_${Date.now()}_assistant`
      const sessId = crypto.randomUUID()
      resetSession(sessId, assistantId)

      const userMsg: AIMessage = {
        id: `msg_${Date.now()}_user`,
        role: 'user',
        content: msg,
        timestamp: Date.now(),
        taggedBlocks: taggedBlocks && taggedBlocks.length > 0 ? [...taggedBlocks] : undefined
      }
      addUserAndAssistantMessages(userMsg, assistantId, orig, bId)

      let isPro = false
      try {
        isPro = localStorage.getItem('is-pro-plan') === 'true'
      } catch {}

      const intent = determineIntent(msg, taggedBlocks, finalSettings.resolvedMode)

      let enabledPlugins: Record<string, boolean> = {}
      try {
        const stored = localStorage.getItem('active-plugins')
        if (stored) enabledPlugins = JSON.parse(stored)
      } catch {}

      const agentParams = {
        assistantId,
        sessId,
        finalSettings,
        userMessage: msg,
        context: ctx,
        taggedBlocks,
        intent,
        enabledPlugins,
        isPro,
        editorRef,
        messages,
        setMessages,
        setIsGenerating,
        currentAssistantIdRef,
        processNextQueueRef
      }

      return await runAgentMode(agentParams)
    }

    return coreGenerateResponse(msg, ctx, orig, bId, runtimeSettings, editor, taggedBlocks)
  }, [coreGenerateResponse, settings, runAgentMode, enqueue, setIsGenerating, resetSession, addUserAndAssistantMessages, messages, setMessages, currentAssistantIdRef])

  /*
   * [SIDE EFFECT - Scheduler Callback Sync]
   * - 큐 스케줄러 인스턴스 변경 시 레퍼런스 콜백을 갱신 동기화한다.
   */
  useEffect(() => {
    processNextQueueRef.current = () => checkAndProcessNextQueue(generateResponse)
  }, [checkAndProcessNextQueue, generateResponse])

  /**
   * [SIDE EFFECT INTENTIONAL - LLM Abort Control]
   * - 사용자가 전송 도중 중단을 클릭 시, 대기 중인 큐를 전부 날리고 Electron 주 프로세스로 LLM 강제 중단 시그널을 발송한다.
   */
  const abortGeneration = useCallback(() => {
    /*
     * [FIX-ABORT-001] 중단 즉시 isGenerating 락을 해제하고 isStreaming 상태를 전부 초기화한다.
     * - 기존 구현은 ipc.llmAbort() 시그널을 메인 프로세스에만 보내고 렌더러 측 락을 즉시 풀지 않았다.
     * - 결과: 취소 직후 사용자가 메시지를 전송하면, isGenerating이 여전히 true이므로
     *   enqueue()로 분기되어 pendingQueue에 쌓이고, UI에 "대기 중..." 줄이 복제되는 버그가 발생한다.
     * - 해결: clearQueue() + setIsGenerating(false) + isStreaming 전체 패치를 원자적으로 수행한다.
     */
    clearQueue()

    // 1. 모든 스트리밍 중인 메시지를 즉시 isStreaming: false로 패치하여 UI 복제 방지
    setMessages(
      useAILogStore.getState().messages
        .filter((m) => !m.id.startsWith('msg_queue_'))
        .map((m) => (m.isStreaming ? { ...m, isStreaming: false, aborted: true } : m))
    )

    // 2. 렌더러 측 생성 락을 즉시 해제한다 (메인 프로세스 응답을 기다리지 않음)
    setIsGenerating(false)

    /*
     * [ALGORITHM BRANCH / DECISION]
     * - 조건 식: `settings.apiType === 'wasm'`
     * - 만족 시: 렌더러단 WebGPU 엔진(`WebLLMEngine`)의 진행 중인 Wasm 연산을 강제 중단한다.
     * - 불만족 시: Electron 환경의 메인 프로세스(`ipc.llmAbort`)로 LLM 강제 중단 시그널을 발송한다.
     */
    if (settings.apiType === 'wasm') {
      WebLLMEngine.getInstance().abort()
    } else if (ipc.isElectronEnv()) {
      const currentSessionId = currentSessionIdRef.current || 'default'
      ipc.llmAbort(currentSessionId)
    }
  }, [isGenerating, clearQueue, setMessages, setIsGenerating, currentSessionIdRef, settings.apiType])

      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `clearHistory`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const clearHistory = ...` 형태로 안전 캐싱 후 가공 기동.
       */
  const clearHistory = useCallback(() => {
    setMessages([])
    setStreamingText('')
  }, [setMessages, setStreamingText])

  const { processBlock } = useAIBlockProcessor(settings)

      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `handleUpdateMessageDiffState`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const handleUpdateMessageDiffState = ...` 형태로 안전 캐싱 후 가공 기동.
       */
  const handleUpdateMessageDiffState = useCallback((msgId: string, state: 'accepted' | 'rejected') => {
    updateMessageDiffState(msgId, state, () => processNextQueueRef.current?.())
  }, [updateMessageDiffState])

      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `handleUpdateInsertSuggestionStatus`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const handleUpdateInsertSuggestionStatus = ...` 형태로 안전 캐싱 후 가공 기동.
       */
  const handleUpdateInsertSuggestionStatus = useCallback((
    msgId: string,
    status: 'pending' | 'accepted' | 'rejected',
    newAfterBlockId?: string,
    newSiblingIndex?: number,
    suggestionIndex?: number
  ) => {
    updateInsertSuggestionStatus(
      msgId, status, newAfterBlockId, newSiblingIndex, suggestionIndex,
      () => processNextQueueRef.current?.()
    )
  }, [updateInsertSuggestionStatus])

  return {
    messages,
    isGenerating,
    isAvailable,
    models,
    codeModels,
    settings,
    streamingText: useAILogStore((s) => s.streamingText),
    engineLogs,
    setEngineLogs,
    generateResponse,
    processBlock,
    abortGeneration,
    clearHistory,
    updateSettings,
    updateMessageDiffState: handleUpdateMessageDiffState,
    updateInsertSuggestionStatus: handleUpdateInsertSuggestionStatus,
    pendingQueue,
    removeFromQueue,
    refreshModels
  }
}

/**
 * ============================================================================
 * FUTURE DEVELOPMENT GUIDE (AI Agent Instruction Layer)
 * ============================================================================
 * 1. AI 응답 후속 처리(예: 마크다운 파싱 규격 수정, 에디터 패치 오류 대응) 시:
 *    - 본 파일 `useAIAgent.ts`를 고치지 말고, `src/renderer/hooks/ai/useAIResponseHandler.ts`를 수정할 것.
 * 
 * 2. LLM 스트리밍 도중 토큰 유실이나 스로틀링 렌더링 렉 개선 시:
 *    - `src/renderer/hooks/ai/useAIStreamProcessor.ts` 내부의 60ms 렌더 딜레이 설정을 손볼 것.
 * 
 * 3. 락 프리징 버그 발생 시 점검 순서:
 *    - `isGeneratingRef.current`와 `isGenerating` state가 정상적으로 동기화 해제되었는지 로그 추적.
 *    - `handleDone` 콜백의 예외 처리 단에서 `setIsGenerating(false)`가 누락되었는지 확인.
 * ============================================================================
 */
