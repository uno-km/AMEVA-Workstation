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
 
 * [소비처 - CONSUMERS / USAGE CONTEXT]
 * - 소비처 A (src/renderer/App.tsx): 최상위 Facade 구조에 통합 마운트.
 * - 소비처 B (src/renderer/contexts/AppContext.tsx): 리액트 Context 훅 목록에 바인딩되어 하위 뷰에 전파.
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
import { WebLLMEngine } from '../../services/ai/WebLLMEngine'

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
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `finalSettings`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const finalSettings = ...` 형태로 안전 캐싱 후 가공 기동.
       */
    const finalSettings = { ...settings, ...runtimeSettings }

    // FIM 코딩 특화 모델 경로 스위칭 처리
    const isCodingRequest = detectCodingRequest(userMessage)
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `codeModelUsed`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const codeModelUsed = ...` 형태로 안전 캐싱 후 가공 기동.
       */
    let codeModelUsed = false
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `isCodingRequest && finalSettings.codeModelPath && finalSettings.codeModelPath !== ''`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (isCodingRequest && finalSettings.codeModelPath && finalSettings.codeModelPath !== '')` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
    if (isCodingRequest && finalSettings.codeModelPath && finalSettings.codeModelPath !== '') {
      finalSettings.modelPath = finalSettings.codeModelPath
      codeModelUsed = true
    }

    // 무료 라이선스 사용자의 클라우드 호출 횟수 임계 한계 도달 체크
    const limitResult = checkUsageLimit(isPro, finalSettings)
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `limitResult.isLimitExceeded`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (limitResult.isLimitExceeded)` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
    if (limitResult.isLimitExceeded) {
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `limitMessageId`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const limitMessageId = ...` 형태로 안전 캐싱 후 가공 기동.
       */
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

    const resolvedModelName = codeModelUsed
      ? (finalSettings.codeModelPath ? finalSettings.codeModelPath.split(/[/\\]/).pop() : 'Code Model')
      : (finalSettings.apiType === 'api' 
          ? (finalSettings.apiModel || finalSettings.apiProvider || 'API Model') 
          : (finalSettings.modelPath ? finalSettings.modelPath.split(/[/\\]/).pop() : 'Local Model'));

    // 신규 말풍선 엘리먼트 ID 및 세션 UUID 생성
    const assistantId = `msg_${Date.now()}_assistant`
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `sessId`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const sessId = ...` 형태로 안전 캐싱 후 가공 기동.
       */
    const sessId = useAILogStore.getState().chatSessionId

    // 60ms 디바운서 인스턴스 초기화 기동
    resetSession(sessId, assistantId)

    // 사용자 질의 구문 말풍선 메타 구성 및 에이전트 메시지 노드 주입
    const instructionId = `inst_${Math.random().toString(36).substring(2, 9)}`
    const userMsg: AIMessage = {
      id: `msg_${Date.now()}_user`,
      role: 'user',
      content: userMessage,
      timestamp: Date.now(),
      taggedBlocks: taggedBlocks && taggedBlocks.length > 0 ? [...taggedBlocks] : undefined,
      instructionId,
      sessionId: sessId,
      modelName: resolvedModelName
    }

    addUserAndAssistantMessages(userMsg, assistantId, originalText, blockId, resolvedModelName)

      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `codeModelUsed`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (codeModelUsed)` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
    if (codeModelUsed) {
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `modelNameOnly`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const modelNameOnly = ...` 형태로 안전 캐싱 후 가공 기동.
       */
      const modelNameOnly = finalSettings.modelPath.split(/[/\\]/).pop()
      setEngineLogs(`[System] 코딩 요청이 감지되었습니다. 코딩 특화 모델(${modelNameOnly})로 전환하여 응답을 생성합니다.\n`)
    }

    // 생성 진행 중 락 활성화 및 버퍼 텍스트 초기화
    setIsGenerating(true)
    setStreamingText('')

    /*
     * [FIX-STUCK-001] 120초 안전망 타임아웃: done 이벤트 누락으로 인한 무한 대기(UI stuck) 방지.
     * - WASM/Local LLM 모드에서 스트림 done 이벤트가 간혹 소실되면 isGenerating 락이 영구적으로
     *   true 상태로 남아 사용자가 다음 메시지를 전송할 수 없는 UI freeze 현상이 발생한다.
     * - 120초(120,000ms) 초과 시 렌더러 측 락을 강제 해제하고 에러 상태로 메시지를 마무리한다.
     * - 타이머는 생성이 정상 완료될 때 반드시 해제되어야 메모리 누수가 발생하지 않는다.
     */
    const safetyTimeoutHandle = setTimeout(() => {
      // 타임아웃 시점에도 락이 여전히 걸려있는 경우에만 강제 해제를 수행한다.
      if (isGeneratingRef.current) {
        console.warn('[useAIGenerator] 120초 안전망 타임아웃 발동: isGenerating 락을 강제 해제합니다.')
        setIsGenerating(false)
        setStreamingText('')
        // isStreaming 상태가 남아있는 모든 메시지를 에러 상태로 일괄 종결한다.
        setMessages(
          useAILogStore.getState().messages.map((m) =>
            m.isStreaming
              ? { ...m, isStreaming: false, error: true, content: m.content || '[타임아웃] 응답이 일정 시간 내에 완료되지 않았습니다.' }
              : m
          )
        )
      }
    }, 120_000)

    // 시스템 지시 사항 프롬프트 조립
    const dynamicSystemPrompt = buildSystemPrompt({
      baseSystemPrompt: finalSettings.systemPrompt,
      intent,
      context,
      taggedBlocks,
      isCodingRequest,
      deepReasoning: finalSettings.deepReasoning
    })

    // 최근 10개의 대화 컨텍스트 히스토리 어레이 슬라이스 페이로드 작성
    const historyPayload = messages.slice(-10).map((m) => ({
      role: (m.role === 'user' ? 'user' : 'assistant') as 'user' | 'assistant',
      content: (m as any).finalAnswer ?? m.content
    }))

    /*
     * [STRATEGY PATTERN & ROUTING ISOLATION]
     * - apiType이 'wasm' 인 경우: 메인 프로세스(llama-server.exe)로 전혀 보내지 않고, 렌더러단 WebLLMEngine으로 즉시 격리 라우팅.
     * - 그 외(local, ollama, api): 기존 메인 프로세스 IPC 파이프라인(`ipc.llmGenerate`)을 100% 원본 유지하여 안전하게 전송.
     */
    if (finalSettings.apiType === 'wasm') {
      try {
        setEngineLogs('[System] WebGPU 가속 기반 온디바이스 Wasm 엔진 추론을 시작합니다...\n')
        const webLLM = WebLLMEngine.getInstance()

        /*
         * [RUN-TIME STATE / INVARIANT]
         * - 변수 명: `wasmHistory`
         * - 자료형 / 예상 값: ChatCompletionMessageParam[] 배열.
         * - 시나리오: WebLLMEngine에 전달할 대화 내역 포맷으로 변환.
         */
        const wasmHistory = historyPayload.map((h) => ({
          role: h.role,
          content: h.content
        }))
        wasmHistory.push({ role: 'user', content: userMessage })

        /*
         * [RUN-TIME STATE / INVARIANT]
         * - 변수 명: `finalAnswer`
         * - 자료형 / 예상 값: string.
         * - 시나리오: WebGPU 스트리밍 토큰들을 수신하며 UI 말풍선 렌더링을 갱신하고 최종 텍스트 획득.
         */
        const finalAnswer = await webLLM.generateStream(
          wasmHistory,
          {
            systemPrompt: dynamicSystemPrompt,
            temperature: finalSettings.temperature,
            maxTokens: finalSettings.maxTokens,
            gpuOnly: finalSettings.gpuOnly
          },
          (tokenText: string) => {
            processToken(tokenText, sessId)
          }
        )

        clearTimeout(safetyTimeoutHandle)
        setIsGenerating(false) // Wasm 로컬 추론 완료 즉시 생성 락 해제
        handleDone({ success: true, text: finalAnswer }, sessId, assistantId, taggedBlocks, intent)
      } catch (err: unknown) {
        clearTimeout(safetyTimeoutHandle)
        const errorMsg = err instanceof Error ? err.message : String(err)
        console.error('[useAI] WebGPU 온디바이스 구동 실패:', errorMsg)
        setIsGenerating(false)
        setMessages(useAILogStore.getState().messages.map((m) =>
          m.id === assistantId
            ? { ...m, content: `❌ 웹LM 가속 실패: ${errorMsg}\n(설정의 AI 탭에서 웹LM 모델을 먼저 로드하거나 VRAM/메모리 사양을 확인해주세요.)`, isStreaming: false, error: true }
            : m
        ))
        currentAssistantIdRef.current = null
        setTimeout(() => processNextQueueRef.current?.(), 80)
      }
    } else {
      // IPC 통신 실시간 스트림 수신기 구독 등록 (메인 프로세스 기반 local, ollama, api 전용)
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
        apiType: finalSettings.apiType, // 우회 코드(? 'local' : ...) 삭제 및 순수 apiType 전송
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
        clearTimeout(safetyTimeoutHandle)
        setIsGenerating(false)
        setMessages(useAILogStore.getState().messages.map((m) =>
          m.id === assistantId
            ? { ...m, content: `❌ ${result.error}`, isStreaming: false, error: true }
            : m
        ))
        currentAssistantIdRef.current = null
        setTimeout(() => processNextQueueRef.current?.(), 80)
      } else {
        clearTimeout(safetyTimeoutHandle)
      }
    }

    // 무료 플랜 사용량 누적 카운트 업
    const isLocalModel = finalSettings.apiType === 'local' || finalSettings.apiType === 'wasm' || finalSettings.apiType === 'ollama'
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `isPersonalApiKey`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const isPersonalApiKey = ...` 형태로 안전 캐싱 후 가공 기동.
       */
    const isPersonalApiKey = finalSettings.apiType === 'api' && !!finalSettings.apiKey && finalSettings.apiKey.trim() !== ''
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `!isPro && !isLocalModel && !isPersonalApiKey`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (!isPro && !isLocalModel && !isPersonalApiKey)` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
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

