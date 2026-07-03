import { useState, useRef, useCallback, useEffect } from 'react'

export interface AIMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: number
  isStreaming?: boolean
  error?: boolean
  // 인라인 Diff 제안용 메타데이터
  originalText?: string
  proposedText?: string
  diffState?: 'pending' | 'accepted' | 'rejected'
  blockId?: string
}

export interface AISettings {
  modelPath: string
  temperature: number
  maxTokens: number
  systemPrompt: string
  apiType?: 'local' | 'api' | 'wasm'
  apiKey?: string
  gpuOnly?: boolean
}

const DEFAULT_SETTINGS: AISettings = {
  modelPath: 'C:\\ameva\\models\\llm\\qwen2.5-3b-instruct-q4_k_m.gguf',
  temperature: 0.7,
  maxTokens: 512,
  systemPrompt: `당신은 AMEVA AI 어시스턴트입니다. 문서 편집을 돕는 전문 AI입니다.
- 사용자의 언어(한국어/영어)로 응답하세요
- 간결하고 명확하게 답하세요
- 문서 내용 분석, 요약, 번역, 교정, 확장에 특화되어 있습니다
- 코드 설명, 표 분석, 다이어그램 설명도 가능합니다`,
  apiType: 'local',
  apiKey: '',
  gpuOnly: true,
}

export function useAI() {
  const [messages, setMessages] = useState<AIMessage[]>([])
  const [isGenerating, setIsGenerating] = useState(false)
  const [settings, setSettings] = useState<AISettings>(() => {
    try {
      const stored = localStorage.getItem('ai-settings')
      if (stored) return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) }
    } catch {}
    return DEFAULT_SETTINGS
  })
  const [streamingText, setStreamingText] = useState('')
  const [isAvailable, setIsAvailable] = useState(false)
  const [models, setModels] = useState<{ name: string; filename: string; path: string; size: number }[]>([])

  const unsubTokenRef = useRef<(() => void) | null>(null)
  const unsubDoneRef = useRef<(() => void) | null>(null)
  const currentAssistantIdRef = useRef<string | null>(null)

  // 모델 목록 로드
  useEffect(() => {
    if (!window.electronAPI) return
    setIsAvailable(true)
    window.electronAPI.llmListModels().then(list => {
      setModels(list)
      if (list.length > 0) {
        setSettings(prev => {
          // 저장된 모델 경로가 리스트에 존재하는지 체크
          const exists = list.some(m => m.path === prev.modelPath)
          if (exists) return prev

          // 존재하지 않으면 3B 모델 우선 선택
          const preferred = list.find(m => m.filename.includes('3b')) || list[list.length - 1]
          return { ...prev, modelPath: preferred.path }
        })
      }
    }).catch(() => {
      setIsAvailable(false)
    })
  }, [])

  // 이벤트 리스너 설정
  useEffect(() => {
    if (!window.electronAPI) return

    // 스트리밍 토큰 수신
    const unsubToken = window.electronAPI.onLLMToken((token) => {
      setStreamingText(prev => prev + token)
      if (currentAssistantIdRef.current) {
        setMessages(prev => prev.map(m =>
          m.id === currentAssistantIdRef.current
            ? { ...m, content: m.content + token, isStreaming: true }
            : m
        ))
      }
    })

    // 완료 이벤트 수신
    const unsubDone = window.electronAPI.onLLMDone((data) => {
      setIsGenerating(false)
      setStreamingText('')
      if (currentAssistantIdRef.current) {
        setMessages(prev => prev.map(m =>
          m.id === currentAssistantIdRef.current
            ? {
                ...m,
                isStreaming: false,
                error: !data.success,
                content: !data.success
                  ? (data.error || '오류가 발생했습니다.')
                  : m.content,
                proposedText: data.success ? m.content : undefined
              }
            : m
        ))
        currentAssistantIdRef.current = null
      }
    })

    unsubTokenRef.current = unsubToken
    unsubDoneRef.current = unsubDone

    return () => {
      unsubToken()
      unsubDone()
    }
  }, [])

  const generateResponse = useCallback(async (
    userMessage: string, 
    context?: string, 
    originalText?: string, 
    blockId?: string
  ) => {
    if (!window.electronAPI || isGenerating) return

    const userMsg: AIMessage = {
      id: `msg_${Date.now()}_user`,
      role: 'user',
      content: userMessage,
      timestamp: Date.now(),
    }

    const assistantId = `msg_${Date.now()}_assistant`
    const assistantMsg: AIMessage = {
      id: assistantId,
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
      isStreaming: true,
      originalText,
      diffState: originalText ? 'pending' : undefined,
      blockId
    }

    currentAssistantIdRef.current = assistantId
    setMessages(prev => [...prev, userMsg, assistantMsg])
    setIsGenerating(true)
    setStreamingText('')

    // 컨텍스트가 있으면 프롬프트에 포함
    const fullPrompt = context
      ? `다음 문서 내용을 참고하여 답변하세요:\n\n---\n${context.slice(0, 2000)}\n---\n\n${userMessage}`
      : userMessage

    const result = await window.electronAPI.llmGenerate({
      modelPath: settings.modelPath,
      prompt: fullPrompt,
      systemPrompt: settings.systemPrompt,
      maxTokens: settings.maxTokens,
      temperature: settings.temperature,
      apiType: settings.apiType === 'wasm' ? 'local' : settings.apiType, // WASM 모드도 로컬 추론 기반 스태프
      apiKey: settings.apiKey,
      gpuOnly: settings.gpuOnly,
    })

    // 에러면 즉시 처리
    if (!result.success && result.error) {
      setIsGenerating(false)
      setMessages(prev => prev.map(m =>
        m.id === assistantId
          ? { ...m, content: `❌ ${result.error}`, isStreaming: false, error: true }
          : m
      ))
      currentAssistantIdRef.current = null
    }
  }, [isGenerating, settings])

  // 블록 단위 AI 작업 (단발성 텍스트 반환)
  const processBlock = useCallback(async (
    action: 'summarize' | 'translate' | 'improve' | 'expand' | 'explain',
    content: string,
    targetLang?: string
  ): Promise<string> => {
    if (!window.electronAPI) return ''

    const prompts: Record<string, string> = {
      summarize: `다음 텍스트를 3줄 이내로 핵심만 요약하세요:\n\n${content}`,
      translate: `다음 텍스트를 ${targetLang || '영어'}로 번역하세요. 번역문만 출력하세요:\n\n${content}`,
      improve: `다음 텍스트의 문체와 표현을 개선하세요. 개선된 텍스트만 출력하세요:\n\n${content}`,
      expand: `다음 텍스트를 더 자세하고 풍부하게 확장하세요:\n\n${content}`,
      explain: `다음 내용을 쉽게 설명하세요:\n\n${content}`,
    }

    return new Promise<string>((resolve) => {
      let result = ''

      const unsubToken = window.electronAPI!.onLLMToken((token) => {
        result += token
      })

      const unsubDone = window.electronAPI!.onLLMDone((data) => {
        unsubToken()
        unsubDone()
        resolve(data.success ? result.trim() : (data.error || ''))
      })

      window.electronAPI!.llmGenerate({
        modelPath: settings.modelPath,
        prompt: prompts[action] || content,
        systemPrompt: 'You are a document editing assistant. Output only the requested content without any explanation or preamble.',
        maxTokens: 512,
        temperature: 0.5,
        apiType: settings.apiType === 'wasm' ? 'local' : settings.apiType,
        apiKey: settings.apiKey,
        gpuOnly: settings.gpuOnly,
      })
    })
  }, [settings.modelPath])

  const abortGeneration = useCallback(() => {
    if (!window.electronAPI || !isGenerating) return
    window.electronAPI.llmAbort()
    setIsGenerating(false)
    setStreamingText('')
    if (currentAssistantIdRef.current) {
      setMessages(prev => prev.map(m =>
        m.id === currentAssistantIdRef.current
          ? { ...m, content: m.content || '(중단됨)', isStreaming: false }
          : m
      ))
      currentAssistantIdRef.current = null
    }
  }, [isGenerating])

  const clearHistory = useCallback(() => {
    setMessages([])
    setStreamingText('')
  }, [])

  const updateSettings = useCallback((newSettings: Partial<AISettings>) => {
    setSettings(prev => {
      const updated = { ...prev, ...newSettings }
      try {
        localStorage.setItem('ai-settings', JSON.stringify(updated))
      } catch {}
      return updated
    })
  }, [])

  const updateMessageDiffState = useCallback((msgId: string, state: 'accepted' | 'rejected') => {
    setMessages(prev => prev.map(m =>
      m.id === msgId ? { ...m, diffState: state } : m
    ))
  }, [])

  return {
    messages,
    isGenerating,
    isAvailable,
    models,
    settings,
    streamingText,
    generateResponse,
    processBlock,
    abortGeneration,
    clearHistory,
    updateSettings,
    updateMessageDiffState,
  }
}
