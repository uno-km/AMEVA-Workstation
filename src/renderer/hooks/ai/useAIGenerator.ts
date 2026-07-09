/**
 * @file useAIGenerator.ts
 * @system AMEVA OS Desktop Workstation - Client Renderer
 * @location src/renderer/hooks/ai/useAIGenerator.ts
 * @role AI Inference Trigger & Context Prompt Builder Hook
 * 
 * [책임 범위 - RESPONSIBILITY]
 * - 사용자가 요청한 자연어 질의와 에디터 마크다운 노드, 드래그 캡처 버퍼를 조합하여 시스템 프롬프트(dynamicSystemPrompt)를 빌드한다.
 * - 무료 요금제 사용자의 클라우드 호출 한도(checkUsageLimit)를 감청하여 차단 팝업을 연계한다.
 * - IPC 채널(`ipc.llmGenerate`)로 매개변수 패킷을 밀어 넣고, 생성 시작 시 스토어 락 플래그(`setIsGenerating(true)`)를 기동한다.
 * - 코딩 질문 감지 시 코딩용 특화 모델(codeModelPath)로 동적 스위칭하는 분기를 처리한다.
 * 
 * [책임이 아닌 것 - NON-RESPONSIBILITY]
 * - 스트리밍 진행 수신 및 60ms 디바운스 화면 렌더링 (useAIStreamProcessor에서 가로챔).
 * - 완료 후 에디터 DOM 블록 편집 (useAIResponseHandler에서 직접 패치).
 * 
 * [절대 깨면 안 되는 계약 - CONTRACT]
 * - MUST NOT bypass usage check: 상용 클라우드 Gemini/Claude 백엔드의 무단 남용을 방지하기 위해, Pro 플랜이 아닌 일반 유저의 API 호출 한도 체크를 절대 우회해서는 안 됨.
 * - MUST: `generateResponse` 진입 시 `isGeneratingRef.current` 락이 켜져 있다면,
 *   추론 요청을 묵살하지 않고 반드시 순차 처리를 위해 대기 큐(`enqueue`)에 직렬화해 넣어야 한다.
 */

/* 
 * [IMPORT SEGMENTATION & CONTRACTS]
 * - useCallback: generateResponse 핸들러 함수의 재생성을 억제하여 렌더러 루프를 안정화하기 위한 기본 리액트 API.
 */
import { useCallback } from 'react'

/* 
 * [SERVICES & HELPERS]
 * - ipc: Electron Preload IPC 채널에 바인딩되어 메인 프로세스로 LLM 구동 신호를 방출하는 어댑터.
 * - determineIntent: 질의 문장 및 드래그 영역 정보를 분석하여 CHAT/WRITE/EDIT 의도를 레이블화하는 함수.
 * - detectCodingRequest: 프롬프트에 프로그래밍 코드 수정이나 생성 지시가 섞여있는지 감지하는 헬퍼.
 * - checkUsageLimit: 무료 요금제 라이선스 한도 도달 여부 및 경고 문구를 리턴하는 분석기.
 * - incrementUsageCount: 무료 라이선스 사용 횟수를 누적 저장하는 로컬 스토리지 액션.
 * - buildSystemPrompt: 템플릿과 문서 맥락을 병합하여 LLM용 시스템 프롬프트를 구성하는 빌더.
 */
import * as ipc from '../../services/ipc/electronApiAdapter'
import { determineIntent } from '../../services/ai/determineIntent'
import { detectCodingRequest } from '../../services/ai/detectCodingRequest'
import { checkUsageLimit, incrementUsageCount } from '../../services/ai/checkUsageLimit'
import { buildSystemPrompt } from '../../services/ai/buildSystemPrompt'

/* 
 * [ZUSTAND LOG STORE]
 * - useAILogStore: 실시간 출력 및 이전 대화 메시지 상태 보존 스토어.
 */
import { useAILogStore } from '../../stores/useAILogStore'

/* 
 * [TYPES]
 * - AIMessage: 개별 대화 말풍선 모델 규격.
 * - AISettings: AI 엔진 파라미터 규격.
 */
import type { AIMessage, AISettings } from '../../types/aiTypes'

/**
 * @hook useAIGenerator
 * @description 시스템 프롬프트를 조립하고 IPC LLM 통신 요청을 트리거하는 에이전트 핵심 구동 훅.
 */
export function useAIGenerator(
  /*
   * [HOOK CONFIG PARAMETERS]
   * - settings: AI 구동 설정 정보.
   * - messages: 기존 대화 목록 히스토리.
   * - isGeneratingRef: 생성 진행 중 여부 락 판정용 Mutable 레퍼런스.
   * - enqueue: 큐 추가 액션.
   * - setIsGenerating: 생성 중 플래그 스토어 세터.
   * - setMessages: 메시지 갱신 스토어 세터.
   * - setStreamingText: 누적 출력 갱신 스토어 세터.
   * - resetSession: 스트림 세션 리셋 핸들러.
   * - addUserAndAssistantMessages: 메시지 말풍선 신규 생성 콜백.
   * - processToken: 토큰 파싱 처리 콜백.
   * - subscribeSession: 세션 IPC 구독 콜백.
   * - setEngineLogs: 로컬 엔진 터미널 로그 추가 세터.
   * - handleDone: 추론 완료 후속 처리 콜백.
   * - editorRef: 활성 에디터 보존용 Mutable 레퍼런스.
   * - processNextQueueRef: 다음 큐 실행 트리거용 Mutable 레퍼런스.
   * - currentAssistantIdRef: 현재 타이핑 대상 말풍선 ID Mutable 레퍼런스.
   */
  settings: AISettings,
  messages: AIMessage[],
  isGeneratingRef: React.MutableRefObject<boolean>,
  enqueue: (args: any) => void,
  setIsGenerating: (val: boolean) => void,
  setMessages: (msgs: AIMessage[]) => void,
  setStreamingText: (text: string) => void,
  resetSession: (sessId: string, asstId: string) => void,
  addUserAndAssistantMessages: (userMsg: AIMessage, asstId: string, origText?: string, blockId?: string) => void,
  processToken: (token: string, sessId: string) => void,
  subscribeSession: (sessId: string, onToken: (t: string) => void, onDone: (d: any) => void) => void,
  setEngineLogs: (log: string) => void,
  handleDone: (data: any, sessId: string, asstId: string, taggedBlocks?: any[], intent?: string) => void,
  editorRef: React.MutableRefObject<any>,
  processNextQueueRef: React.MutableRefObject<(() => void) | null>,
  currentAssistantIdRef: React.MutableRefObject<string | null>
) {
  /**
   * [CONTRACT - Main Generation Async Trigger]
   */
  const generateResponse = useCallback(async (
    userMessage: string,
    context?: string,
    originalText?: string,
    blockId?: string,
    runtimeSettings?: Partial<AISettings>,
    editorInstance?: any,
    taggedBlocks?: { id: string; text: string }[]
  ) => {
    // 1. 비동기 편집 처리를 위해 에디터 레퍼런스를 보존 백업함
    if (editorInstance) {
      editorRef.current = editorInstance
    }

    // 브라우저 렌더 환경이 아닌 경우(Electron 밖) 무력화 차단
    if (!ipc.isElectronEnv()) return

    /* 
     * [INVARIANT - Plan License Check]
     * - isPro: 로컬 스토리지에 기재된 라이선스가 Pro 버전인지 추출한다.
     */
    let isPro = false
    try {
      isPro = localStorage.getItem('is-pro-plan') === 'true'
    } catch (e) {
      console.error('[useAIAgent] 플러그인 상태 로드 실패:', e)
    }

    /* 
     * [INVARIANT - Busy Guard Queue Serializer]
     * - Rationale: 이미 다른 추론이 구동 중일 때는 요청을 큐에 밀어 넣고 즉시 함수를 빠져나와 레이스 컨디션을 차단한다.
     */
    if (isGeneratingRef.current) {
      enqueue({ userMessage, context, originalText, blockId, runtimeSettings, editorInstance, taggedBlocks })
      return
    }

    console.log('[useAI] generateResponse 호출됨. 런타임 세팅:', runtimeSettings)

    // 사용자의 입력 의도 분류 및 런타임 오버라이드 설정 병합
    const intent = determineIntent(userMessage, taggedBlocks, (runtimeSettings as any)?.resolvedMode)
    const finalSettings = { ...settings, ...runtimeSettings }

    // FIM 코딩 특화 모델 경로 스위칭 처리
    const isCodingRequest = detectCodingRequest(userMessage)
    let codeModelUsed = false
    if (isCodingRequest && finalSettings.codeModelPath && finalSettings.codeModelPath !== '') {
      finalSettings.modelPath = finalSettings.codeModelPath
      codeModelUsed = true
    }

    // 무료 라이선스 사용자의 클라우드 호출 횟수 임계 한계 도달 체크
    const limitResult = checkUsageLimit(isPro, finalSettings)
    if (limitResult.isLimitExceeded) {
      const limitMessageId = `msg_limit_${Date.now()}`
      setMessages([
        ...useAILogStore.getState().messages,
        {
          id: limitMessageId,
          role: 'assistant' as const,
          content: limitResult.limitMessage || '일일 한도를 초과했습니다.',
          timestamp: Date.now()
        }
      ])
      return
    }

    // 신규 말풍선 엘리먼트 ID 및 세션 UUID 생성
    const assistantId = `msg_${Date.now()}_assistant`
    const sessId = crypto.randomUUID()

    // 60ms 디바운서 인스턴스 초기화 기동
    resetSession(sessId, assistantId)

    // 사용자 질의 구문 말풍선 메타 구성 및 에이전트 메시지 노드 주입
    const userMsg: AIMessage = {
      id: `msg_${Date.now()}_user`,
      role: 'user',
      content: userMessage,
      timestamp: Date.now(),
      taggedBlocks: taggedBlocks && taggedBlocks.length > 0 ? [...taggedBlocks] : undefined
    }

    addUserAndAssistantMessages(userMsg, assistantId, originalText, blockId)

    if (codeModelUsed) {
      const modelNameOnly = finalSettings.modelPath.split(/[/\\]/).pop()
      setEngineLogs(`[System] 코딩 요청이 감지되었습니다. 코딩 특화 모델(${modelNameOnly})로 전환하여 응답을 생성합니다.\n`)
    }

    // 생성 진행 중 락 활성화 및 버퍼 텍스트 초기화
    setIsGenerating(true)
    setStreamingText('')

    // 시스템 지시 사항 프롬프트 조립
    const dynamicSystemPrompt = buildSystemPrompt({
      baseSystemPrompt: finalSettings.systemPrompt,
      intent,
      context,
      taggedBlocks,
      isCodingRequest
    })

    // 최근 10개의 대화 컨텍스트 히스토리 어레이 슬라이스 페이로드 작성
    const historyPayload = messages.slice(-10).map((m) => ({
      role: (m.role === 'user' ? 'user' : 'assistant') as 'user' | 'assistant',
      content: (m as any).finalAnswer ?? m.content
    }))

    // IPC 통신 실시간 스트림 수신기 구독 등록
    subscribeSession(
      sessId,
      (token) => processToken(token, sessId),
      (data) => handleDone(data, sessId, assistantId, taggedBlocks, intent)
    )

    // Electron 주 프로세스로 LLM 비동기 가동 RPC 지시 전송
    const result = await ipc.llmGenerate({
      sessionId: sessId,
      modelPath: finalSettings.modelPath,
      prompt: userMessage,
      context: (taggedBlocks && taggedBlocks.length > 0) ? undefined : (context || undefined),
      systemPrompt: dynamicSystemPrompt,
      maxTokens: finalSettings.maxTokens,
      temperature: finalSettings.temperature,
      apiType: finalSettings.apiType === 'wasm' ? 'local' : finalSettings.apiType,
      apiKey: finalSettings.apiKey,
      apiEndpoint: finalSettings.apiEndpoint,
      apiModel: finalSettings.apiModel,
      gpuOnly: finalSettings.gpuOnly,
      history: historyPayload
    })

    /*
     * [CONTRACT - RPC Error Fallback Handling]
     * - Rationale: IPC 호출 자체가 에러(예: Llama 프로세스 크래시 등)로 실패한 경우,
     *   대화창에 실패 경고를 출력하고 강제 락을 해제한 뒤 즉각 다음 대기 큐를 실행한다. (무한 대기 프리징 방지).
     */
    if (!result.success && result.error) {
      console.error('[useAI] LLM 구동 실패:', result.error)
      setIsGenerating(false)
      setMessages(useAILogStore.getState().messages.map((m) =>
        m.id === assistantId
          ? { ...m, content: `❌ ${result.error}`, isStreaming: false, error: true }
          : m
      ))
      currentAssistantIdRef.current = null
      setTimeout(() => processNextQueueRef.current?.(), 80)
    }

    // 무료 플랜 사용량 누적 카운트 업
    const isLocalModel = finalSettings.apiType === 'local' || finalSettings.apiType === 'wasm' || finalSettings.apiType === 'ollama'
    const isPersonalApiKey = finalSettings.apiType === 'api' && !!finalSettings.apiKey && finalSettings.apiKey.trim() !== ''
    if (!isPro && !isLocalModel && !isPersonalApiKey) {
      incrementUsageCount()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings, messages, isGeneratingRef, enqueue, setIsGenerating, setMessages, setStreamingText,
      resetSession, addUserAndAssistantMessages, processToken, subscribeSession, setEngineLogs])

  return { generateResponse }
}

/**
 * ============================================================================
 * FUTURE DEVELOPMENT GUIDE (AI Agent Instruction Layer)
 * ============================================================================
 * 1. 신규 의도 판단(Intent)이나 코딩 판단 로직이 업그레이드되었을 때:
 *    - `src/renderer/services/ai/determineIntent.ts` 등을 보완하고 본 파일의 `intent` 변수에 올바르게 반환되도록 할 것.
 * 
 * 2. IPC 데이터 전송 규격을 확장하고자 할 때:
 *    - `ipc.llmGenerate` 호출 매개변수와 `src/renderer/services/ipc/electronApiAdapter.ts` 내부 설정을 동기화 갱신할 것.
 * ============================================================================
 */
