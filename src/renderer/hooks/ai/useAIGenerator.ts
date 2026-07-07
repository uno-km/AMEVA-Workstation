import { useCallback } from 'react'
import * as ipc from '../../services/ipc/electronApiAdapter'
import { determineIntent } from '../../services/ai/determineIntent'
import { detectCodingRequest } from '../../services/ai/detectCodingRequest'
import { checkUsageLimit, incrementUsageCount } from '../../services/ai/checkUsageLimit'
import { buildSystemPrompt } from '../../services/ai/buildSystemPrompt'
import { useAILogStore } from '../../stores/useAILogStore'
import type { AIMessage, AISettings } from '../../types/aiTypes'

export function useAIGenerator(
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
  const generateResponse = useCallback(async (
    userMessage: string,
    context?: string,
    originalText?: string,
    blockId?: string,
    runtimeSettings?: Partial<AISettings>,
    editorInstance?: any,
    taggedBlocks?: { id: string; text: string }[]
  ) => {
    if (editorInstance) {
      editorRef.current = editorInstance
    }

    if (!ipc.isElectronEnv()) return

    // 플러그인/플랜 상태 파싱
    let isPro = false
    try {
      isPro = localStorage.getItem('is-pro-plan') === 'true'
    } catch (e) {
      console.error('[useAIAgent] 플러그인 상태 로드 실패:', e)
    }

    // 생성 중이면 큐에 추가
    if (isGeneratingRef.current) {
      enqueue({ userMessage, context, originalText, blockId, runtimeSettings, editorInstance, taggedBlocks })
      return
    }

    console.log('[useAI] generateResponse 호출됨. 런타임 세팅:', runtimeSettings)

    // 의도 분류 및 설정 병합
    const intent = determineIntent(userMessage, taggedBlocks, (runtimeSettings as any)?.resolvedMode)
    const finalSettings = { ...settings, ...runtimeSettings }

    // 코딩 요청 감지 및 코딩 특화 모델 교체
    const isCodingRequest = detectCodingRequest(userMessage)
    let codeModelUsed = false
    if (isCodingRequest && finalSettings.codeModelPath && finalSettings.codeModelPath !== '') {
      finalSettings.modelPath = finalSettings.codeModelPath
      codeModelUsed = true
    }

    // 사용 한도 체크 (무료 플랜)
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

    // 새 assistant 메시지 ID 및 세션 ID 생성
    const assistantId = `msg_${Date.now()}_assistant`
    const sessId = crypto.randomUUID()

    // 스트리밍 프로세서 세션 초기화
    resetSession(sessId, assistantId)

    // 사용자/assistant 메시지 추가
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

    setIsGenerating(true)
    setStreamingText('')

    // 시스템 프롬프트 조립
    const dynamicSystemPrompt = buildSystemPrompt({
      baseSystemPrompt: finalSettings.systemPrompt,
      intent,
      context,
      taggedBlocks,
      isCodingRequest
    })

    // 최근 대화 히스토리 페이로드 생성
    const historyPayload = messages.slice(-10).map((m) => ({
      role: (m.role === 'user' ? 'user' : 'assistant') as 'user' | 'assistant',
      content: (m as any).finalAnswer ?? m.content
    }))

    // IPC 구독 등록
    subscribeSession(
      sessId,
      (token) => processToken(token, sessId),
      (data) => handleDone(data, sessId, assistantId, taggedBlocks, intent)
    )

    // LLM 생성 요청
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

    // 즉각 에러 처리 (리스너가 받기 전에 llmGenerate 자체가 실패한 경우)
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

    // 사용량 카운트 증가 (무료 플랜 + 클라우드 API 사용자)
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
