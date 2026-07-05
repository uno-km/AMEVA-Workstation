import { useState, useRef, useCallback, useEffect } from 'react'

export interface AIMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: number
  isStreaming?: boolean
  error?: boolean
  aborted?: boolean
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
  systemPrompt: `당신은 AMEVA 문서 에디터의 전문 AI 어시스턴트입니다.

# 사고 과정 지침 (Thinking Process)
- 답변을 생성하기 전에, 반드시 가장 먼저 \`<thought>\` 태그를 열어 질문의 의도 분석, 관련 정보 매핑, 답변 구상 및 단계별 추론/검증 과정을 한국어로 상세히 적으십시오.
- 생각을 작성할 때는 반드시 대괄호를 사용한 대분류 헤더(예: [분석], [추론], [수행 계획], [검증] 등)를 작성하고, 그 아래에 하이픈(-)과 들여쓰기를 사용하여 여러 단계의 세부 생각(Chain of Thought)을 기술하십시오.
- 복잡한 문제일수록 깊이 있게 생각하며 여러 단계(예: 1단계, 2단계, 3단계 등)로 나누어 상세히 추론하십시오.
- 생각이 완료되면 반드시 \`</thought>\` 태그를 닫고 실제 답변 본문을 작성하십시오.
- 예시:
  \`<thought>
  [분석]
  - 사용자가 문서 요약 요청함.
    - 입력 텍스트의 크기는 약 500자이며, 프로젝트 일정에 관한 내용임.
  [추론]
  - 프로젝트 일정에서 가장 중요한 마일스톤 3가지를 추출하는 것이 핵심임.
  [수행 계획]
  - 1단계: RAG 본문을 검토하여 날짜와 마일스톤 매핑.
  - 2단계: 각 마일스톤의 중요도를 평가하여 순위 지정.
  - 3단계: 가독성을 높이기 위해 요약 결과를 3줄 목록 형태로 구성.
  </thought>
  요청하신 요약본입니다...\`

# 핵심 지침 (Core Directives)
1. **전문적이고 간결한 응답**: 불필요한 인사말, 잡담, 서론("도와드릴까요?", "여기 결과입니다")은 완전히 생략하고 요청받은 결과물만 즉시 출력하십시오.
2. **콘텍스트 인식 & RAG**: 제공되는 컨텍스트 블록 \`[Block ID: <id>, Type: <type>]\` 정보를 적극 참조하십시오.
3. **수정 제안 (Edit Suggestion)**: 사용자가 특정 블록이나 텍스트의 변경/교체/수정을 요구하는 경우, 수정된 본문을 제안하되 답변 맨 마지막에 반드시 아래 형식의 수정 제안 태그를 추가하십시오:
   [EDIT_SUGGESTION: 대상블록ID]
   수정된 코드 또는 텍스트 본문
   (블록 ID는 컨텍스트에 명시된 ID와 정확히 일치해야 합니다. 마음대로 지셔서는 안 됩니다.)
4. **한국어 답변**: 사용자의 질문 언어에 상관없이 **반드시 한국어(Korean)로 답변**하십시오.`,
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
      if (stored) {
        const parsed = JSON.parse(stored)
        // 기존 구버전 및 한국어 강제성이 빠졌거나 사고 과정 지침이 빠진 옛 프롬프트 교체 마이그레이션
        if (parsed.systemPrompt && (
          parsed.systemPrompt.includes('간결하고 명확하게 답하세요') || 
          parsed.systemPrompt.includes('친근하고 유연하게') ||
          parsed.systemPrompt.includes('AMEVA AI입니다.') ||
          !parsed.systemPrompt.includes('한국어 답변') ||
          !parsed.systemPrompt.includes('사고 과정 지침')
        )) {
          parsed.systemPrompt = DEFAULT_SETTINGS.systemPrompt
          localStorage.setItem('ai-settings', JSON.stringify(parsed))
        }
        return { ...DEFAULT_SETTINGS, ...parsed }
      }
    } catch {}
    return DEFAULT_SETTINGS
  })
  const [streamingText, setStreamingText] = useState('')
  const [isAvailable, setIsAvailable] = useState(false)
  const [models, setModels] = useState<{ name: string; filename: string; path: string; size: number }[]>([])
  const [engineLogs, setEngineLogs] = useState<string>('') // 🤖 로컬 터미널 로그 데이터 저장소

  const unsubTokenRef = useRef<(() => void) | null>(null)
  const unsubDoneRef = useRef<(() => void) | null>(null)
  const unsubLogRef = useRef<(() => void) | null>(null)
  const currentAssistantIdRef = useRef<string | null>(null)

  // 모델 목록 로드
  useEffect(() => {
    if (!window.electronAPI) {
      // 🤖 웹 브라우저 환경에서는 WebGPU WASM, 클라우드 API, Ollama 모드 가동을 위해 true로 오픈
      setIsAvailable(true)
      return
    }
    setIsAvailable(true)
    window.electronAPI.llmListModels().then(list => {
      setModels(list)
      if (list.length > 0) {
        setSettings(prev => {
          const exists = list.some(m => m.path === prev.modelPath)
          if (exists) return prev
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
      
      const targetId = currentAssistantIdRef.current
      setMessages(prev => {
        let updated = false
        const next = prev.map(m => {
          if (targetId && m.id === targetId) {
            updated = true
            
            // 🤖 [안전 장치] 만약 <thought>는 있는데 </thought>로 안 닫혔으면 자동 보정
            if (data.success && m.content.includes('<thought>') && !m.content.toLowerCase().includes('</thought>')) {
              const editIdx = m.content.indexOf('[EDIT_SUGGESTION')
              if (editIdx !== -1) {
                m.content = m.content.substring(0, editIdx).trim() + '\n</thought>\n' + m.content.substring(editIdx)
              } else {
                m.content = m.content.trim() + '\n</thought>\n'
              }
            }

            let blockId = m.blockId
            let originalText = m.originalText
            let proposedText = m.content
            
            // 🤖 [수정 제안 자동 감지] [EDIT_SUGGESTION: blockId] 구문 파싱 및 에디터 연동
            const match = m.content.match(/\[EDIT_SUGGESTION:\s*([a-zA-Z0-9_\-]+)\](?:\r?\n)?([\s\S]*)/i)
            if (match && data.success) {
              blockId = match[1]
              proposedText = match[2].trim()
              
              // 채팅 말풍선 텍스트 청소 (메타태그 영역 제거)
              m.content = m.content.replace(/\[EDIT_SUGGESTION:\s*[a-zA-Z0-9_\-]+\](?:\r?\n)?[\s\S]*/i, '').trim()
              
              if (editorRef.current) {
                try {
                  const block = editorRef.current.getBlock(blockId)
                  if (block) {
                    if (block.type === 'jupyter') {
                      originalText = block.props?.code || ''
                    } else if (Array.isArray(block.content)) {
                      originalText = block.content.map((c: any) => c.text || '').join('')
                    } else {
                      originalText = String(block.content || '')
                    }
                  }
                } catch (e) {
                  console.warn('에디터 블록 조회 실패:', e)
                }
              }
            }
            
            const isAbortError = !data.success && (data.error === '사용자에 의해 중단됨' || data.error === 'Aborted' || data.error?.includes('중단'));
            
            let finalContent = m.content
            if (!data.success) {
              if (isAbortError) {
                finalContent = m.content.trim() ? m.content : '사용자가 답변을 중단했습니다'
              } else {
                finalContent = data.error || '오류가 발생했습니다.'
              }
            }

            return {
              ...m,
              isStreaming: false,
              error: !data.success && !isAbortError,
              aborted: isAbortError || m.aborted,
              content: finalContent,
              proposedText: data.success || (isAbortError && m.content.trim()) ? (match ? proposedText : m.content) : undefined,
              originalText: data.success || (isAbortError && m.content.trim()) ? (match ? originalText : m.originalText) : undefined,
              blockId: blockId
            }
          }
          return m
        })

        // 폴백: 명시적인 변경이 없었고 마지막 메시지가 assistant 이면 업데이트
        if (!updated && next.length > 0 && next[next.length - 1].role === 'assistant') {
          const lastIdx = next.length - 1
          const lastMsg = next[lastIdx]
          
          const isAbortError = !data.success && (data.error === '사용자에 의해 중단됨' || data.error === 'Aborted' || data.error?.includes('중단'));
          let finalContent = lastMsg.content
          if (!data.success) {
            if (isAbortError) {
              finalContent = lastMsg.content.trim() ? lastMsg.content : '사용자가 답변을 중단했습니다'
            } else {
              finalContent = data.error || '오류가 발생했습니다.'
            }
          } else {
            // 🤖 [안전 장치] 만약 <thought>는 있는데 </thought>로 안 닫혔으면 자동 보정
            if (finalContent.includes('<thought>') && !finalContent.toLowerCase().includes('</thought>')) {
              const editIdx = finalContent.indexOf('[EDIT_SUGGESTION')
              if (editIdx !== -1) {
                finalContent = finalContent.substring(0, editIdx).trim() + '\n</thought>\n' + finalContent.substring(editIdx)
              } else {
                finalContent = finalContent.trim() + '\n</thought>\n'
              }
            }
          }

          next[lastIdx] = {
            ...lastMsg,
            isStreaming: false,
            error: !data.success && !isAbortError,
            aborted: isAbortError || lastMsg.aborted,
            content: finalContent,
            proposedText: data.success || (isAbortError && lastMsg.content.trim()) ? finalContent : undefined
          }
        }
        return next
      })
      currentAssistantIdRef.current = null
    })

    // 🤖 실시간 원시 콘솔 로그 수신
    const unsubLog = window.electronAPI.onLLMLog((data) => {
      setEngineLogs(prev => prev + data.text)
    })

    unsubTokenRef.current = unsubToken
    unsubDoneRef.current = unsubDone
    unsubLogRef.current = unsubLog

    return () => {
      unsubToken()
      unsubDone()
      unsubLog()
    }
  }, [])

  const editorRef = useRef<any>(null)

  const generateResponse = useCallback(async (
    userMessage: string, 
    context?: string, 
    originalText?: string, 
    blockId?: string,
    runtimeSettings?: Partial<AISettings>,
    editorInstance?: any
  ) => {
    if (editorInstance) {
      editorRef.current = editorInstance
    }
    if (!window.electronAPI || isGenerating) return

    setEngineLogs('') // [디버그] 이전 LLM 세션 로그 비우기
    console.log('[useAI] generateResponse 호출됨. 런타임 세팅:', runtimeSettings)

    const userMsg: AIMessage = {
      id: `msg_${Date.now()}_user`,
      role: 'user',
      content: userMessage,
      timestamp: Date.now(),
    }

    // 🤖 [하이브리드 에이전트 의도 분석 & 플래닝]
    const intent = (runtimeSettings as any)?.resolvedMode
      ? (runtimeSettings as any).resolvedMode.toUpperCase() as 'EDIT' | 'SUMMARY' | 'CHAT'
      : (() => {
          const cleanPrompt = userMessage.toLowerCase().trim()
          const summaryKeywords = ['요약', '정리', '줄여', 'summarize', 'summary', 'brief']
          if (summaryKeywords.some(k => cleanPrompt.includes(k))) return 'SUMMARY'
          
          const editKeywords = ['수정', '변경', '바꿔', '고쳐', '삽입', '지워', '추가', '작성해', 'edit', 'modify', 'replace', 'rewrite', 'correct']
          if (editKeywords.some(k => cleanPrompt.includes(k))) return 'EDIT'
          
          return 'CHAT'
        })()

    // 호출 시점 런타임 세팅 최우선 병합
    const finalSettings = { ...settings, ...runtimeSettings }

    const modelName = finalSettings.modelPath ? finalSettings.modelPath.split(/[\\/]/).pop() || 'Qwen-3B' : 'Qwen-3B'
    const initialThought = `<thought>
[의도 분석 (Intent Router)]
- 활성화된 의도 모드: ${intent}

[시스템 플래닝 (System Planner)]
- 1단계: RAG 컨텍스트 동적 로드 및 블록 매핑 완료
- 2단계: 최근 ${messages.length > 0 ? messages.length : 0}개 메시지 히스토리 세션 동기화 완료
- 3단계: 로컬 추론 엔진 (${modelName}) 실시간 추론 구동 시작

[모델 실시간 사고 과정 (LLM Thinking Process)]
`

    const assistantId = `msg_${Date.now()}_assistant`
    const assistantMsg: AIMessage = {
      id: assistantId,
      role: 'assistant',
      content: initialThought, // 생각 과정 박스를 실시간으로 보장하기 위해 초기값으로 삽입
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

    // 의도에 따라 특화된 에이전트 실행 지침을 시스템 프롬프트에 동적 결합
    let dynamicSystemPrompt = finalSettings.systemPrompt
    dynamicSystemPrompt += `\n\n[사고 과정 및 출력 규격 지침]\n- 답변을 생성하기 전에 질문의 의도 파악, 문맥 해석, 답변 계획 및 여러 단계에 걸친 상세 추론 과정을 한국어로 작성하십시오.\n- 생각 과정(Thinking Process)은 [분석], [추론], [수행 계획] 등의 대분류 섹션을 대괄호로 적고, 그 아래에 하이픈(-)과 2칸 들여쓰기를 사용해 단계별로 구체화하여 적으십시오 (예: 1단계: ..., 2단계: ...).\n- 중요: 생각 과정의 시작인 <thought> 태그는 시스템이 이미 생성하여 제공했으므로 절대 직접 출력하지 마십시오. 곧바로 첫 대분류인 [분석]부터 시작해 생각을 작성하십시오.\n- 생각이 끝나면 반드시 </thought> 태그를 출력하여 닫은 뒤, 본문 답변을 작성하십시오.`

    if (intent === 'EDIT') {
      dynamicSystemPrompt += `\n\n[현재 작업 모드: 문서 부분 수정(EDIT)]\n- 당신은 사용자의 문서 수정 요청을 받았습니다.\n- 본문 답변에 반드시 수정 제안 태그([EDIT_SUGGESTION: 블록ID])를 올바른 양식으로 포함시키십시오.`
    } else if (intent === 'SUMMARY') {
      dynamicSystemPrompt += `\n\n[현재 작업 모드: 문서 요약(SUMMARY)]\n- 당신은 문서 요약 요청을 받았습니다.\n- 본문 답변에 명확하고 가독성 높은 3줄 요약본을 작성하십시오.`
    } else {
      dynamicSystemPrompt += `\n\n[현재 작업 모드: 일반 대화(CHAT)]\n- 당신은 일반 질문이나 조언 요청을 받았습니다.\n- 본문 답변은 친절하고 전문적인 톤으로 작성하십시오.`
    }

    // 최근 5개 대화쌍 (최대 10개 메시지)의 내역을 백엔드로 전달하기 위해 매핑
    const historyPayload = messages.slice(-10).map(m => ({
      role: m.role === 'user' ? 'user' : 'assistant',
      content: m.content
    }))

    const result = await window.electronAPI.llmGenerate({
      modelPath: finalSettings.modelPath,
      prompt: userMessage,
      context: context || undefined,
      systemPrompt: dynamicSystemPrompt, // 동적 시스템 프롬프트 전달
      maxTokens: finalSettings.maxTokens,
      temperature: finalSettings.temperature,
      apiType: finalSettings.apiType === 'wasm' ? 'local' : finalSettings.apiType, // WASM 모드도 로컬 추론 기반 스태프
      apiKey: finalSettings.apiKey,
      gpuOnly: finalSettings.gpuOnly,
      history: historyPayload, // 🤖 대화 내역 전달
    })

    // 에러면 즉시 처리
    if (!result.success && result.error) {
      console.error('[useAI] LLM 구동 실패:', result.error)
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
    // 프로세스 중단 신호를 보내고, 실제 상태 정리는 llm:done 수신 시 통합 처리합니다.
  }, [isGenerating])

  const clearHistory = useCallback(() => {
    setMessages([])
    setStreamingText('')
  }, [])

  const updateSettings = useCallback((newSettings: Partial<AISettings>) => {
    setSettings(prev => {
      const updated = { ...prev, ...newSettings }
      try {
        // [SEC-W-002] API Key는 localStorage에 저장하지 않음 — 메모리에만 보관
        const { apiKey: _apiKey, ...safeSettings } = updated
        localStorage.setItem('ai-settings', JSON.stringify(safeSettings))
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
    engineLogs, // 🤖 실시간 터미널 콘솔 로그 텍스트
    setEngineLogs,
    generateResponse,
    processBlock,
    abortGeneration,
    clearHistory,
    updateSettings,
    updateMessageDiffState,
  }
}
