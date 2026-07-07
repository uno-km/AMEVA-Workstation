import React, { useState, useRef, useEffect } from 'react'
import {
  Bot, Send, Trash2, Sparkles,
  Settings2, Check, X, AlertCircle,
  Wand2, Languages, FileText, Expand, Lightbulb, Lock, Terminal
} from 'lucide-react'
import type { AIMessage } from '../types/aiTypes'
import { useAILogStore } from '../stores/useAILogStore'
import { flattenBlocks, retrieveRelevantBlocks } from '../utils/ragUtils'
import { formatBytes } from '../utils/aiFormatters'
import { AIChatList } from './ai-panel/AIChatList'

interface AIPanelProps {
  isOpen: boolean
  onClose: () => void
  messages: AIMessage[]
  isGenerating: boolean
  isAvailable: boolean
  models: { name: string; filename: string; path: string; size: number }[]
  settings: { modelPath: string; temperature: number; maxTokens: number; systemPrompt: string; apiType?: string; apiKey?: string; apiEndpoint?: string; apiModel?: string; gpuOnly?: boolean; theme?: string }
  onSend: (message: string, context?: string, originalText?: string, blockId?: string, runtimeSettings?: any) => void
  onAbort: () => void
  onClear: () => void
  onUpdateSettings: (s: any) => void
  currentContent: string
  panelWidth?: number
  selectedText?: string
  onClearSelectedText?: () => void
  onApplySuggestion?: (text: string, mode: 'replace' | 'insert', blockId?: string) => void
  onUpdateDiffState?: (msgId: string, state: 'accepted' | 'rejected') => void
  onApplyInsertSuggestion?: (msgId: string, afterBlockId: string, blockType: string, content: string, level?: number, suggestionIndex?: number) => void
  onUpdateInsertSuggestionStatus?: (msgId: string, status: 'pending' | 'accepted' | 'rejected', newAfterBlockId?: string, newSiblingIndex?: number, suggestionIndex?: number) => void
  activeBlockId?: string
  editor?: any
  blocks?: any[]
  activeTab?: string
  installedPlugins?: string[]
  engineLogs?: string
  setEngineLogs?: (val: string | ((prev: string) => string)) => void
  showModelHub?: boolean
  setShowModelHub?: (show: boolean) => void
  refreshModels?: () => Promise<void>
  importModel?: () => Promise<void>
  downloadStatus?: any
  setDownloadStatus?: (val: any) => void
  taggedBlocks: { id: string; text: string }[]
  setTaggedBlocks: React.Dispatch<React.SetStateAction<{ id: string; text: string }[]>>
  onScrollToBlock: (blockId: string) => void
  pendingQueue?: Array<any>
  removeFromQueue?: (id: string) => void
}

const QUICK_ACTIONS = [
  { id: 'summarize', icon: FileText, label: '요약', prompt: '현재 문서 내용을 핵심만 3줄로 요약해줘.' },
  { id: 'improve', icon: Wand2, label: '교정', prompt: '현재 문서의 문체와 표현을 자연스럽게 개선해줘.' },
  { id: 'translate', icon: Languages, label: '번역', prompt: '현재 문서를 영어로 번역해줘.' },
  { id: 'expand', icon: Expand, label: '확장', prompt: '현재 문서 내용을 더 풍부하게 확장해줘.' },
  { id: 'explain', icon: Lightbulb, label: '설명', prompt: '현재 문서의 핵심 개념을 쉽게 설명해줘.' },
]

// ══════════════════════════════════════════════════════
// InsertPreviewCard — AI 삽입 제안 승인/거절 + 위아래 이동 UI
// 판단 근거 접힌 글 + 경로 + 완료 후 상세 로그 포함
// ══════════════════════════════════════════════════════
export function AIPanel({
  isOpen, onClose, messages, isGenerating, isAvailable,
  models, settings, onSend, onAbort, onClear,
  onUpdateSettings, currentContent, panelWidth = 320,
  selectedText = '',
  onClearSelectedText,
  onApplySuggestion,
  onUpdateDiffState,
  onApplyInsertSuggestion,
  onUpdateInsertSuggestionStatus,
  activeBlockId,
  editor: _editor,
  blocks = [],
  activeTab = 'ai',
  installedPlugins = [],
  engineLogs = '', // 🤖 실시간 원시 로그 데이터 매핑
  setEngineLogs: _setEngineLogs,
  showModelHub = false,
  setShowModelHub,
  refreshModels,
  importModel,
  downloadStatus,
  setDownloadStatus,
  taggedBlocks = [],
  setTaggedBlocks,
  onScrollToBlock,
  pendingQueue = [],
  removeFromQueue,
}: AIPanelProps) {
  const [input, setInput] = useState('')
  // clearSensorLogs: 엔진 로그 초기화 함수 — Zustand 스토어에서 직접 구독
  const { clearSensorLogs } = useAILogStore()
  const isWhiteTheme = settings.theme === 'white'
  const [manualMode, setManualMode] = useState<'auto' | 'edit' | 'summary' | 'chat'>('auto')
  const [showSettings, setShowSettings] = useState(false)

  // ── [FEAT] 외부 우클릭 팝업 연동 질문 텍스트 바인딩 ──
  useEffect(() => {
    const handleFillInput = (e: Event) => {
      const customEvent = e as CustomEvent<string>
      if (customEvent.detail) {
        setInput(customEvent.detail)
        setTimeout(() => {
          textareaRef.current?.focus()
        }, 50)
      }
    }
    window.addEventListener('ameva:fill-ai-input', handleFillInput)
    return () => {
      window.removeEventListener('ameva:fill-ai-input', handleFillInput)
    }
  }, [])
  const [useContext, setUseContext] = useState(true) // 기본으로 켬
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const logEndRef = useRef<HTMLDivElement>(null)
  // ==========================================================
  // [NEW] Transient Updates (React 리렌더링 우회 로그 스트리밍)
  // ==========================================================
  const sensorLogContainerRef = useRef<HTMLDivElement>(null)
  
  useEffect(() => {
    // Zustand 스토어의 sensorLogs가 변경될 때마다 React 렌더링 루프를 타지 않고 DOM을 직접 업데이트합니다.
    const unsubscribe = useAILogStore.subscribe((state, prevState) => {
      if (state.sensorLogs === prevState.sensorLogs) return;
      
      const container = sensorLogContainerRef.current;
      if (!container) return;
      
      // 새로 추가된 로그만 비교해서 Append 할 수도 있으나,
      // 가장 간단한 방법은 innerHTML을 직접 교체하는 것입니다. (보안 이슈가 없다면)
      // 최적화를 위해 문자열을 조립해 한 번에 씁니다.
      let htmlString = '';
      const logs = state.sensorLogs;
      for (let i = 0; i < logs.length; i++) {
        const line = logs[i];
        if (i > 0 && !line.trim()) continue;
        
        let color = '#a7f3d0';
        if (line.includes('[System]')) color = '#93c5fd';
        if (line.includes('[Error]') || line.includes('오류')) color = '#fca5a5';
        if (line.includes('[Plugin]')) color = '#fde047';
        
        htmlString += `<div style="color: ${color}; min-height: 1.2em;">${line}</div>`;
      }
      
      container.innerHTML = htmlString;
      
      // 자동 스크롤 (logEndRef와 유사하게 작동)
      container.scrollTop = container.scrollHeight;
    });
    
    return () => unsubscribe();
  }, []);
 // 🤖 로그 자동스크롤용
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const logContainerRef = useRef<HTMLDivElement>(null)
  const [isLogsExpanded, setIsLogsExpanded] = useState(false)

  // 🤖 Props settings 구조분해 및 폴백 기본값 지정
  const apiType = settings.apiType || 'local'
  const gpuOnly = settings.gpuOnly !== false
  const apiKey = settings.apiKey || ''
  // [FIX-W-003] 동적 API 엔드포인트/모델명 상태 도입
  const apiEndpoint = settings.apiEndpoint || ''
  const apiModel = settings.apiModel || ''

  // API 제공사(apiProvider) 상태를 settings.apiEndpoint로부터 실시간 계산(Derived State)하여 상태 일관성을 확보합니다.
  const apiProvider = (() => {
    const endpoint = settings.apiEndpoint || ''
    if (endpoint === '') return 'custom'
    if (endpoint.includes('generativelanguage.googleapis.com')) return 'gemini'
    if (endpoint.includes('api.openai.com')) return 'openai'
    if (endpoint.includes('api.anthropic.com')) return 'anthropic'
    return 'custom'
  })()

  // 플랫폼별 모델 정의
  const PROVIDER_MODELS = {
    gemini: [
      { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
      { value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
      { value: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash' },
      { value: 'gemini-2.0-flash-thinking-exp', label: 'Gemini 2.0 Flash Thinking' },
      { value: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash' },
      { value: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro' },
    ],
    openai: [
      { value: 'gpt-4o-mini', label: 'GPT-4o Mini' },
      { value: 'gpt-4o', label: 'GPT-4o' },
      { value: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
      { value: 'o1-mini', label: 'o1 Mini' },
      { value: 'o1-preview', label: 'o1 Preview' },
    ],
    anthropic: [
      { value: 'claude-3-5-sonnet-latest', label: 'Claude 3.5 Sonnet' },
      { value: 'claude-3-5-haiku-latest', label: 'Claude 3.5 Haiku' },
      { value: 'claude-3-opus-latest', label: 'Claude 3 Opus' },
    ]
  }

  // 제공사 변경 핸들러
  const handleProviderChange = (provider: 'gemini' | 'openai' | 'anthropic' | 'custom') => {
    if (provider === 'gemini') {
      onUpdateSettings({
        apiEndpoint: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
        apiModel: 'gemini-2.5-flash'
      })
    } else if (provider === 'openai') {
      onUpdateSettings({
        apiEndpoint: 'https://api.openai.com/v1/chat/completions',
        apiModel: 'gpt-4o-mini'
      })
    } else if (provider === 'anthropic') {
      onUpdateSettings({
        apiEndpoint: 'https://api.anthropic.com/v1/messages',
        apiModel: 'claude-3-5-sonnet-latest'
      })
    } else if (provider === 'custom') {
      onUpdateSettings({
        apiEndpoint: '',
        apiModel: ''
      })
    }
  }

  // API 키 로드 완료 여부를 추적하는 로컬 Ref (중복 비동기 호출 방지 락)
  const isApiKeyLoadedRef = useRef<Record<string, boolean>>({})

  // 앱 시작 시 및 apiProvider 변경 시 OS 키체인에서 암호화 저장된 API Key 복구
  useEffect(() => {
    if (!window.electronAPI || apiType !== 'api') return

    // 해당 제공사의 키를 이미 로드했다면 중복 실행 완전히 차단
    if (isApiKeyLoadedRef.current[apiProvider]) return

    const loadSavedApiKey = async () => {
      let keychainKey = 'openai-api-key'
      if (apiProvider === 'gemini') {
        keychainKey = 'gemini-api-key'
      } else if (apiProvider === 'anthropic') {
        keychainKey = 'claude-api-key'
      } else if (apiProvider === 'openai') {
        keychainKey = 'openai-api-key'
      } else if (apiProvider === 'custom') {
        return
      }

      const savedKey = await window.electronAPI.keychainGet(keychainKey)
      if (savedKey) {
        isApiKeyLoadedRef.current[apiProvider] = true
        if (savedKey !== apiKey) {
          onUpdateSettings({ apiKey: savedKey })
        }
      }
    }

    loadSavedApiKey()
  }, [apiProvider, apiType, apiKey])

  // API Key 변경 시 휴리스틱 탐지 핸들러 및 OS 키체인 자동 저장
  const handleApiKeyChange = (val: string) => {
    const trimmed = val.trim()
    let detectedProvider: 'gemini' | 'openai' | 'anthropic' | 'custom' | null = null
    let targetEndpoint = ''
    let targetModel = ''
    let keychainKey = 'openai-api-key'

    if (trimmed.startsWith('AIzaSy') || trimmed.startsWith('AQ.')) {
      detectedProvider = 'gemini'
      targetEndpoint = 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions'
      targetModel = 'gemini-2.5-flash'
      keychainKey = 'gemini-api-key'
    } else if (trimmed.startsWith('sk-ant')) {
      detectedProvider = 'anthropic'
      targetEndpoint = 'https://api.anthropic.com/v1/messages'
      targetModel = 'claude-3-5-sonnet-latest'
      keychainKey = 'claude-api-key'
    } else if (trimmed.startsWith('sk-')) {
      detectedProvider = 'openai'
      targetEndpoint = 'https://api.openai.com/v1/chat/completions'
      targetModel = 'gpt-4o-mini'
      keychainKey = 'openai-api-key'
    } else {
      if (apiProvider === 'gemini') keychainKey = 'gemini-api-key'
      else if (apiProvider === 'anthropic') keychainKey = 'claude-api-key'
      else if (apiProvider === 'openai') keychainKey = 'openai-api-key'
    }

    if (detectedProvider) {
      onUpdateSettings({
        apiKey: val,
        apiEndpoint: targetEndpoint,
        apiModel: targetModel
      })
    } else {
      onUpdateSettings({ apiKey: val })
    }

    if (window.electronAPI) {
      if (trimmed === '') {
        window.electronAPI.keychainDelete(keychainKey)
      } else {
        window.electronAPI.keychainSet(keychainKey, val)
      }
    }
  }

  const [gpuName, setGpuName] = useState('')
  const [showDownloadDetail, setShowDownloadDetail] = useState(false)
  const [showLogs, setShowLogs] = useState(false) // 🤖 실시간 터미널 로그창 토글 상태

  // 🤖 로컬 엔진 유효 여부 또는 무설치 모드(WASM, API, Ollama) 활성화 여부 판정
  const isInputEnabled = isAvailable || apiType === 'wasm' || apiType === 'api' || apiType === 'ollama'

  // 모달이 열릴 때마다 로컬 모델 목록 스캔 동기화
  useEffect(() => {
    if (showModelHub && refreshModels) {
      refreshModels()
    }
  }, [showModelHub, refreshModels])

  useEffect(() => {
    if (window.electronAPI?.llmGetGpuName) {
      window.electronAPI.llmGetGpuName().then(setGpuName)
    }
  }, [])

  // 메시지 수신 시 스마트 자동 스크롤
  useEffect(() => {
    const container = messagesContainerRef.current
    if (container) {
      const lastMessage = messages[messages.length - 1]
      const isUserMsg = lastMessage?.role === 'user'
      const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 60
      if ((isNearBottom || isUserMsg) && messagesEndRef.current) {
        messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
      }
    }
  }, [messages])

  // 🤖 태그가 추가되거나 AI 패널이 활성화(열림)될 때 채팅 입력창(textarea) 포커싱 유지
  useEffect(() => {
    if (isOpen && taggedBlocks.length > 0) {
      const timer = setTimeout(() => {
        textareaRef.current?.focus()
      }, 100)
      return () => clearTimeout(timer)
    }
  }, [taggedBlocks.length, isOpen])

  const getContextWithRAG = (query: string, useFullFallback = false) => {
    // 항상 문서 블록 구조 인덱스를 포함 (WRITE/EDIT 모드에서 afterBlockId 선택에 필수)
    const buildBlockIndex = () => {
      if (!blocks || blocks.length === 0) return ''
      const flatAll: any[] = (function flatten(bks: any[]): any[] {
        return (bks || []).flatMap((b: any) => [b, ...flatten(b.children || [])])
      })(blocks)
      const lines = flatAll.map((b: any) => {
        const txt = Array.isArray(b.content)
          ? b.content.map((c: any) => c.text || '').join('').slice(0, 60)
          : ''
        const extra = b.type === 'heading' && b.props?.level ? ` level=${b.props.level}` : ''
        return `[Block ID: ${b.id}, Type: ${b.type}${extra}] ${txt}`
      })
      return `[문서 블록 구조 목록 — 삽입 위치(afterBlockId) 선택 시 사용]\n` + lines.join('\n')
    }

    if (selectedText) {
      return `[선택한 부분 텍스트]\n${selectedText}\n\n[문서 내용 전체]\n${currentContent}\n\n${buildBlockIndex()}`
    }
    if (!useContext && !useFullFallback) return buildBlockIndex() || undefined

    if (blocks && blocks.length > 0) {
      try {
        const flat = flattenBlocks(blocks)
        const relevant = retrieveRelevantBlocks(query, flat, 5)
        if (relevant.length > 0) {
          return `[참조된 관련 문서 내용 (RAG 검색 결과)]\n아래는 사용자의 질문과 가장 연관성이 높은 문서 내 블록들입니다. 해당 정보를 정확히 파악하여 답변에 반영하고, 필요 시 명시된 Block ID를 사용해 수정 제안을 하십시오.\n\n` +
            relevant.map((b: any) => `[Block ID: ${b.id}, Type: ${b.type}]\n${b.text}`).join('\n\n') +
            `\n\n${buildBlockIndex()}`
        }
      } catch (e) {
        console.warn('RAG 검색 실패, 전체 본문 폴백:', e)
      }
    }
    return (currentContent ? currentContent + '\n\n' : '') + buildBlockIndex()
  }

  // 🤖 로그 수신 시 스마트 자동 스크롤
  useEffect(() => {
    const container = logContainerRef.current
    if (container) {
      const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 60
      if (isNearBottom && logEndRef.current) {
        logEndRef.current.scrollIntoView({ behavior: 'auto' })
      }
    }
  }, [engineLogs])

  const getActiveMode = (queryText: string): 'write' | 'edit' | 'summary' | 'chat' => {
    if (manualMode !== 'auto') return manualMode as any

    const cleanInput = queryText.toLowerCase().trim()
    const summaryKeywords = ['요약', '정리', '줄여', 'summarize', 'summary', 'brief']
    if (summaryKeywords.some(k => cleanInput.includes(k))) return 'summary'

    const writeKeywords = [
      '써줘', '써', '작성', '보고서', '리포트', '문서 만들어', '글 써줘',
      '제목', '본문', '넣어줘', '넣어', '입력해', '추가해줘', '만들어줘',
      '생성해', '도입말', '서론', '결론',
      'write', 'draft', 'create', 'compose', 'generate', 'insert',
    ]
    if (writeKeywords.some(k => cleanInput.includes(k))) return 'write'

    if (selectedText) return 'edit'

    const editKeywords = [
      '수정', '변경', '바꿔', '고쳐', '삽입', '지워', '교체', '고쳐줘',
      'edit', 'modify', 'replace', 'rewrite', 'correct'
    ]
    if (editKeywords.some(k => cleanInput.includes(k))) return 'edit'

    return 'chat'
  }

  const handleSend = () => {
    if (!input.trim()) return

    const finalContext = getContextWithRAG(input.trim(), false)
    const resolvedMode = getActiveMode(input)

    onSend(input.trim(), finalContext, selectedText || undefined, activeBlockId, {
      apiType,
      gpuOnly,
      apiKey,
      modelPath: settings.modelPath,
      resolvedMode, // 🤖 동적 결정되거나 수동 지정된 의도 모드 전달
    })
    setInput('')
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    } else if (e.key === 'Backspace' && input === '' && taggedBlocks.length > 0) {
      e.preventDefault()
      setTaggedBlocks(prev => prev.slice(0, prev.length - 1))
    }
  }

  const handleQuickAction = (prompt: string) => {
    if (isGenerating) return
    const finalContext = getContextWithRAG(prompt, true)
    const resolvedMode = getActiveMode(prompt)
    onSend(prompt, finalContext, selectedText || undefined, activeBlockId, {
      apiType,
      gpuOnly,
      apiKey,
      modelPath: settings.modelPath,
      resolvedMode, // 🤖 동적 결정되거나 수동 지정된 의도 모드 전달
    })
  }

  if (!isOpen) return null

  return (
    <div
      data-focus-region="ai-panel"
      style={{
        width: panelWidth,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--bg-main)',
        backdropFilter: 'blur(20px)',
        borderLeft: '1px solid var(--border-muted)',
        position: 'relative',
        overflow: 'hidden',
        color: 'var(--text-main)',
      }}
    >
      {/* 글로우 라인 */}
      <div style={{
        position: 'absolute',
        top: 0, left: 0, right: 0,
        height: '2px',
        background: 'linear-gradient(90deg, var(--primary), var(--secondary), var(--accent))',
      }} />

      {/* 헤더 */}
      <div style={{
        padding: '14px 16px 10px',
        borderBottom: '1px solid var(--border-muted)',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        flexShrink: 0,
        flexWrap: 'nowrap',
        width: '100%',
        boxSizing: 'border-box'
      }}>
        <div style={{
          width: '28px', height: '28px', borderRadius: '8px',
          background: 'linear-gradient(135deg, var(--primary), var(--secondary))',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 0 12px var(--primary-glow)',
          flexShrink: 0,
        }}>
          <Sparkles size={14} color="#fff" />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '13px', fontWeight: 700, letterSpacing: '0.3px', flexShrink: 0 }}>
              AMEVA <span style={{ color: 'var(--primary)' }}>AI</span>
            </span>
            {/* AI 모드별 상태 배지 */}
            <span style={{
              fontSize: '8px', fontWeight: 800, padding: '1px 4px', borderRadius: '4px',
              color: '#fff',
              flexShrink: 0,
              background: apiType === 'wasm'
                ? 'linear-gradient(135deg, #0284c7, #0369a1)' // WASM 블루
                : apiType === 'api'
                ? 'linear-gradient(135deg, #7c3aed, #6d28d9)' // API 퍼플
                : apiType === 'ollama'
                ? 'linear-gradient(135deg, #f97316, #ea580c)' // Ollama 오렌지
                : 'linear-gradient(135deg, #16a34a, #15803d)', // Local 그린
            }}>
              {apiType === 'wasm' ? 'WebGPU WASM' : apiType === 'api' ? 'Cloud API' : apiType === 'ollama' ? 'Ollama' : 'Native Core'}
            </span>
            {/* 로컬 구동 시 CPU/GPU 가속 상태 배지 */}
            {(apiType === 'local' || apiType === 'ollama') && (
              <span style={{
                fontSize: '8px', fontWeight: 800, padding: '1px 4px', borderRadius: '4px',
                color: '#fff',
                flexShrink: 0,
                background: gpuOnly
                  ? 'linear-gradient(135deg, #a855f7, #7c3aed)' // GPU 가속 보라
                  : 'linear-gradient(135deg, #4b5563, #374151)', // CPU 그레이
              }}>
                {gpuOnly ? 'GPU 가속' : 'CPU 연산'}
              </span>
            )}
          </div>
          <div style={{ fontSize: '9px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%' }}>
            {apiType === 'api'
              ? `${apiProvider === 'gemini' ? 'Google Gemini' : apiProvider === 'anthropic' ? 'Anthropic Claude' : apiProvider === 'openai' ? 'OpenAI GPT' : 'Custom Cloud API'} 연결됨`
              : apiType === 'ollama'
              ? 'Ollama 로컬 백그라운드 서비스'
              : (isAvailable
                  ? `${models.find(m => m.path === settings.modelPath)?.name || '모델을 선택하세요'}`
                  : '로컬 모델 검색 필요'
                )
            }
          </div>
        </div>
        {(apiType === 'local' || apiType === 'ollama') && (
          <button
            onClick={() => setShowLogs(!showLogs)}
            style={{
              background: showLogs ? 'var(--bg-glass-active)' : 'transparent',
              border: 'none', cursor: 'pointer',
              color: showLogs ? 'var(--primary)' : 'var(--text-muted)',
              display: 'flex', alignItems: 'center',
              padding: '4px', borderRadius: '5px', transition: 'all 0.15s',
              marginRight: '2px',
              flexShrink: 0,
            }}
            title="AI 엔진 터미널 로그 실시간 감시"
          >
            <Terminal size={14} />
          </button>
        )}
        <button
          onClick={() => setShowSettings(!showSettings)}
          style={{
            background: showSettings ? 'var(--bg-glass-active)' : 'transparent',
            border: 'none', cursor: 'pointer',
            color: 'var(--text-muted)', display: 'flex', alignItems: 'center',
            padding: '4px', borderRadius: '5px', transition: 'all 0.15s',
            flexShrink: 0,
          }}
          title="AI 설정"
        >
          <Settings2 size={14} />
        </button>
        <button
          onClick={onClose}
          style={{
            background: 'transparent', border: 'none', cursor: 'pointer',
            color: 'var(--text-muted)', display: 'flex', alignItems: 'center',
            padding: '4px', borderRadius: '5px',
            flexShrink: 0,
          }}
        >
          <X size={14} />
        </button>
      </div>

      {activeTab === 'ai' && (
        <>
          {/* 설정 패널 (모달 UI) */}
      {showSettings && (
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          zIndex: 1000,
          background: 'rgba(0, 0, 0, 0.4)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '16px'
        }} onClick={() => setShowSettings(false)}>
          <div style={{
            width: '100%', maxWidth: '340px', maxHeight: '100%',
            overflowY: 'auto',
            background: 'var(--bg-glass-active)',
            border: '1px solid var(--border-muted)',
            borderRadius: '12px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
            padding: '16px',
            display: 'flex', flexDirection: 'column', gap: '12px'
          }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-main)' }}>AI 설정</span>
              <button onClick={() => setShowSettings(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={16} />
              </button>
            </div>
          {/* AI 실행 유형 선택 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '10px', color: 'var(--text-muted)' }}>AI 실행 유형</label>
            <select
              value={apiType}
              onChange={e => onUpdateSettings({ apiType: e.target.value as any })}
              style={{
                width: '100%',
                background: 'var(--bg-glass)',
                border: '1px solid var(--border-muted)',
                borderRadius: '6px',
                padding: '5px 8px',
                color: 'var(--text-main)',
                fontSize: '11px',
              }}
            >
              <option value="wasm">로컬 WebGPU 가속 (무설치)</option>
              <option value="local">로컬 고성능 엔진 (llama-cli)</option>
              <option value="ollama">로컬 백그라운드 서비스 (Ollama)</option>
              <option value="api">클라우드 외부 API (OpenAI 등)</option>
            </select>
          </div>

          {/* API Key 입력란 */}
          {apiType === 'api' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {/* API 제공사 선택 */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '10px', color: 'var(--text-muted)' }}>API 제공사</label>
                <select
                  value={apiProvider}
                  onChange={e => handleProviderChange(e.target.value as any)}
                  style={{
                    width: '100%',
                    background: 'var(--bg-glass)',
                    border: '1px solid var(--border-muted)',
                    borderRadius: '6px',
                    padding: '5px 8px',
                    color: 'var(--text-main)',
                    fontSize: '11px',
                  }}
                >
                  <option value="gemini">Google Gemini (AI Studio)</option>
                  <option value="openai">OpenAI</option>
                  <option value="anthropic">Anthropic (Claude)</option>
                  <option value="custom">Custom (직접 입력)</option>
                </select>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '10px', color: 'var(--text-muted)' }}>API Key</label>
                <input
                  type="password"
                  value={apiKey}
                  onChange={e => handleApiKeyChange(e.target.value)}
                  placeholder="키를 입력하면 제공사가 자동 감지됩니다"
                  style={{
                    width: '100%',
                    background: 'var(--bg-glass)',
                    border: '1px solid var(--border-muted)',
                    borderRadius: '6px',
                    padding: '5px 8px',
                    color: 'var(--text-main)',
                    fontSize: '11px',
                    outline: 'none',
                  }}
                />
              </div>
              {/* [FIX-W-003] 엔드포인트 입력란 */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '10px', color: 'var(--text-muted)' }}>API 엔드포인트 (URL)</label>
                <input
                  type="text"
                  value={apiEndpoint}
                  onChange={e => onUpdateSettings({ apiEndpoint: e.target.value })}
                  disabled={apiProvider !== 'custom'}
                  placeholder="https://api.openai.com/v1/chat/completions"
                  style={{
                    width: '100%',
                    background: apiProvider === 'custom' ? 'var(--bg-glass)' : 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid var(--border-muted)',
                    borderRadius: '6px',
                    padding: '5px 8px',
                    color: apiProvider === 'custom' ? 'var(--text-main)' : 'var(--text-muted)',
                    fontSize: '10px',
                    outline: 'none',
                    cursor: apiProvider === 'custom' ? 'text' : 'not-allowed',
                  }}
                />
              </div>
              {/* [FIX-W-003] 모델명 입력란 / 셀렉트박스 */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '10px', color: 'var(--text-muted)' }}>API 모델명</label>
                {apiProvider === 'custom' ? (
                  <input
                    type="text"
                    value={apiModel}
                    onChange={e => onUpdateSettings({ apiModel: e.target.value })}
                    placeholder="gpt-4o-mini | claude-3-5-sonnet-20241022"
                    style={{
                      width: '100%',
                      background: 'var(--bg-glass)',
                      border: '1px solid var(--border-muted)',
                      borderRadius: '6px',
                      padding: '5px 8px',
                      color: 'var(--text-main)',
                      fontSize: '10px',
                      outline: 'none',
                    }}
                  />
                ) : (
                  <select
                    value={apiModel}
                    onChange={e => onUpdateSettings({ apiModel: e.target.value })}
                    style={{
                      width: '100%',
                      background: 'var(--bg-glass)',
                      border: '1px solid var(--border-muted)',
                      borderRadius: '6px',
                      padding: '5px 8px',
                      color: 'var(--text-main)',
                      fontSize: '11px',
                    }}
                  >
                    {(PROVIDER_MODELS[apiProvider] || []).map((m: any) => (
                      <option key={m.value} value={m.value}>{m.label}</option>
                    ))}
                  </select>
                )}
              </div>
              {/* Anthropic 선택 시 경고/주의 안내문구 추가 */}
              {apiProvider === 'anthropic' && (
                <div style={{ fontSize: '9px', color: '#fbbf24', marginTop: '2px', lineHeight: '1.2' }}>
                  ⚠️ Anthropic 공식 API는 헤더 규격이 달라 직접 연동 시 에러가 날 수 있습니다. OpenRouter나 OpenAI 호환 프록시를 사용할 때는 제공사를 Custom으로 지정하여 설정하세요.
                </div>
              )}
            </div>
          )}

          {/* 모델 선택 */}
          {apiType !== 'api' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <label style={{ fontSize: '10px', color: 'var(--text-muted)' }}>모델 선택</label>
                <button
                  onClick={() => setShowModelHub(true)}
                  style={{
                    fontSize: '9px', color: 'var(--primary)', background: 'none', border: 'none',
                    cursor: 'pointer', padding: 0, fontWeight: 700,
                  }}
                >
                  모델 허브 개방 📥
                </button>
              </div>
              {models.length === 0 ? (
                <div style={{
                  padding: '8px', borderRadius: '6px',
                  background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
                  fontSize: '11px', color: '#f87171',
                  display: 'flex', flexDirection: 'column', gap: '6px',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <AlertCircle size={12} />
                    <span>C:\ameva\models\llm 에 모델 없음</span>
                  </div>
                  <button
                    onClick={() => setShowModelHub(true)}
                    style={{
                      width: '100%', padding: '4px 8px', borderRadius: '4px',
                      background: 'var(--primary)', color: '#fff', border: 'none',
                      fontSize: '10px', fontWeight: 700, cursor: 'pointer',
                      textAlign: 'center',
                    }}
                  >
                    추천 AI 모델 다운로드 센터 열기
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                  <select
                    value={settings.modelPath}
                    onChange={e => onUpdateSettings({ modelPath: e.target.value })}
                    style={{
                      width: '100%',
                      background: 'var(--bg-glass)',
                      border: '1px solid var(--border-muted)',
                      borderRadius: '6px',
                      padding: '5px 8px',
                      color: 'var(--text-main)',
                      fontSize: '11px',
                    }}
                  >
                    {models.map(m => (
                      <option key={m.path} value={m.path} style={{ background: 'var(--bg-main)', color: 'var(--text-main)' }}>
                        {m.name} ({formatBytes(m.size)})
                      </option>
                    ))}
                  </select>
                  {importModel && (
                    <button
                      onClick={importModel}
                      style={{
                        alignSelf: 'flex-start',
                        fontSize: '9.5px', color: 'rgba(167,139,250,0.85)', background: 'none', border: 'none',
                        cursor: 'pointer', padding: '1px 0', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '2px'
                      }}
                    >
                      + 외부 다운로드한 모델 파일(.gguf) 직접 가져오기
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* 하드웨어 가속 옵션 */}
          {apiType !== 'api' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '2px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="checkbox"
                  id="gpuOnly-checkbox"
                  checked={gpuOnly}
                  onChange={e => onUpdateSettings({ gpuOnly: e.target.checked })}
                  style={{ accentColor: 'var(--primary)' }}
                />
                <label htmlFor="gpuOnly-checkbox" style={{ fontSize: '11px', color: 'var(--text-main)', cursor: 'pointer' }}>
                  GPU 전용 가속 활성화 (해제 시 CPU 모드로 기동)
                </label>
              </div>
              {gpuName && (
                <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginLeft: '22px' }}>
                  감지된 그래픽 장치: <span style={{ color: 'var(--secondary)', fontWeight: 'bold' }}>{gpuName}</span>
                </div>
              )}
            </div>
          )}

          {/* Temperature */}
          <div>
            <label style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
              <span>Temperature (창의성)</span>
              <span style={{ color: 'var(--primary)' }}>{settings.temperature.toFixed(1)}</span>
            </label>
            <input
              type="range" min="0" max="1" step="0.1"
              value={settings.temperature}
              onChange={e => onUpdateSettings({ temperature: parseFloat(e.target.value) })}
              style={{ width: '100%', accentColor: 'var(--primary)' }}
            />
          </div>

          {/* Max Tokens */}
          <div>
            <label style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
              <span>최대 토큰</span>
              <span style={{ color: 'var(--primary)' }}>{settings.maxTokens}</span>
            </label>
            <input
              type="range" min="128" max="2048" step="128"
              value={settings.maxTokens}
              onChange={e => onUpdateSettings({ maxTokens: parseInt(e.target.value) })}
              style={{ width: '100%', accentColor: 'var(--primary)' }}
            />
          </div>

          {/* Hugging Face 추천 모델 다운로드 마켓플레이스 */}
          <div style={{ marginTop: '10px', borderTop: '1px solid var(--border-muted)', paddingTop: '10px' }}>
            <label style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
              Hugging Face 추천 모델 원클릭 다운로드
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {[
                { name: 'Qwen 2.5 1.5B (GGUF)', file: 'qwen2.5-1.5b-instruct-q4_k_m.gguf', url: 'https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct-GGUF/resolve/main/qwen2.5-1.5b-instruct-q4_k_m.gguf' },
                { name: 'Qwen 2.5 3B (GGUF)', file: 'qwen2.5-3b-instruct-q4_k_m.gguf', url: 'https://huggingface.co/Qwen/Qwen2.5-3B-Instruct-GGUF/resolve/main/qwen2.5-3b-instruct-q4_k_m.gguf' },
                { name: 'Llama 3.1 8B (GGUF)', file: 'Meta-Llama-3.1-8B-Instruct-Q4_K_M.gguf', url: 'https://huggingface.co/QuantFactory/Meta-Llama-3.1-8B-Instruct-GGUF/resolve/main/Meta-Llama-3.1-8B-Instruct-Q4_K_M.gguf' }
              ].map(m => {
                const isDownloading = downloadStatus && downloadStatus.filename === m.file && downloadStatus.progress < 100
                return (
                  <div key={m.file} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    background: 'rgba(255,255,255,0.02)', padding: '6px 8px', borderRadius: '6px',
                    border: '1px solid var(--border-muted)'
                  }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-main)' }}>{m.name}</span>
                      <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>{m.file}</span>
                    </div>
                    <button
                      disabled={!!isDownloading}
                      onClick={async () => {
                        if ((window as any).electron) {
                          setDownloadStatus({ filename: m.file, progress: 0, speed: 0, downloadedBytes: 0, totalBytes: 0, timeRemaining: 0 })
                          const res = await (window as any).electron.invoke('llm:downloadModel', { url: m.url, filename: m.file })
                          if (res.success) {
                            alert('다운로드 완료! AI 모델이 활성화되었습니다.')
                          } else {
                            alert(`다운로드 실패: ${res.error}`)
                          }
                        }
                      }}
                      style={{
                        background: isDownloading ? 'rgba(255,255,255,0.05)' : 'linear-gradient(135deg, var(--primary), var(--secondary))',
                        border: 'none', color: '#fff', fontSize: '10px', padding: '4px 10px',
                        borderRadius: '4px', cursor: isDownloading ? 'not-allowed' : 'pointer', fontWeight: 700
                      }}
                    >
                      {isDownloading ? `${downloadStatus.progress}%` : '설치'}
                    </button>
                  </div>
                )
              })}
            </div>
          </div>

          {/* llama.cpp 설치 안내 (로컬 고성능 엔진 모드일 때만 안내 노출) */}
          {apiType === 'local' && !isAvailable && (
            <div style={{
              padding: '8px', borderRadius: '6px',
              background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.3)',
              fontSize: '10px', color: 'var(--text-muted)',
            }}>
              AI 사용을 위해 llama.cpp를 설치하세요:<br />
              C:\ameva\llama\llama-cli.exe
            </div>
          )}
        </div>
        </div>
      )}

      {/* 메시지 없을 때 환영 화면 */}
      {messages.length === 0 && !showSettings && (
        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          padding: '20px', gap: '16px',
          overflowY: 'auto',
        }}>
          <div style={{
            width: '56px', height: '56px', borderRadius: '16px',
            background: 'linear-gradient(135deg, rgba(139,92,246,0.3), rgba(6,182,212,0.3))',
            border: '1px solid rgba(139,92,246,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 30px rgba(139,92,246,0.15)',
          }}>
            <Sparkles size={24} color="var(--primary)" />
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '14px', fontWeight: 700, marginBottom: '6px' }}>
              AMEVA AI
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: '1.5' }}>
              문서 작성을 돕는 로컬 AI입니다.<br />
              {selectedText ? (
                <span style={{ color: 'var(--secondary)', fontWeight: 'bold' }}>
                  에디터 선택 영역({selectedText.length}자) 분석 대기 중!
                </span>
              ) : (
                '아래 빠른 작업으로 시작하거나 직접 입력하세요.'
              )}
            </div>
          </div>

          {/* 빠른 작업 버튼들 */}
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {QUICK_ACTIONS.map(action => {
              const labelText = selectedText ? `선택 영역 ${action.label}` : action.label
              return (
                <button
                  key={action.id}
                  onClick={() => handleQuickAction(action.prompt)}
                  disabled={!isAvailable}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '10px',
                    padding: '10px 14px', borderRadius: '8px',
                    background: selectedText ? 'rgba(6,182,212,0.06)' : 'var(--bg-glass)',
                    border: `1px solid ${selectedText ? 'rgba(6,182,212,0.25)' : 'var(--border-muted)'}`,
                    color: 'var(--text-main)', cursor: isAvailable ? 'pointer' : 'not-allowed',
                    fontSize: '12px', textAlign: 'left',
                    transition: 'all 0.15s',
                    opacity: isAvailable ? 1 : 0.5,
                  }}
                  onMouseEnter={e => {
                    if (isAvailable) {
                      ;(e.currentTarget as HTMLButtonElement).style.borderColor = selectedText ? 'var(--secondary)' : 'var(--primary)'
                      ;(e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-glass-active)'
                    }
                  }}
                  onMouseLeave={e => {
                    ;(e.currentTarget as HTMLButtonElement).style.borderColor = selectedText ? 'rgba(6,182,212,0.25)' : 'var(--border-muted)'
                    ;(e.currentTarget as HTMLButtonElement).style.background = selectedText ? 'rgba(6,182,212,0.06)' : 'var(--bg-glass)'
                  }}
                >
                  <action.icon size={14} style={{ color: selectedText ? 'var(--secondary)' : 'var(--primary)', flexShrink: 0 }} />
                  <span>{labelText}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* 🤖 실시간 AI 엔진 터미널 로그 서랍장 */}
      {showLogs && (
        <div style={{
          height: isLogsExpanded ? '320px' : '160px',
          background: '#090a0f',
          borderBottom: '1px solid var(--border-muted)',
          display: 'flex', flexDirection: 'column',
          flexShrink: 0,
          transition: 'height 0.2s ease',
        }}>
          {/* 터미널 헤더 바 */}
          <div style={{
            background: '#000', padding: '4px 10px',
            borderBottom: '1px solid #1e1e24',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <span style={{ fontSize: '9px', fontWeight: 'bold', color: '#10b981', fontFamily: 'monospace' }}>
              📟 AI ENGINE TERMINAL LOGS (REALTIME)
            </span>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <button
                onClick={() => setIsLogsExpanded(prev => !prev)}
                style={{
                  fontSize: '8px', color: 'var(--text-muted)', background: 'none',
                  border: 'none', cursor: 'pointer', padding: 0,
                }}
                title={isLogsExpanded ? "축소하기" : "확대하기"}
              >
                {isLogsExpanded ? "Collapse" : "Extend"}
              </button>
              <button
                onClick={() => clearSensorLogs()}
                style={{
                  fontSize: '8px', color: 'var(--text-muted)', background: 'none',
                  border: 'none', cursor: 'pointer', padding: 0,
                }}
                title="로그 비우기"
              >
                Clear
              </button>
            </div>
          </div>
          {/* 로그 아웃풋 스크롤 영역 */}
          <div 
            ref={logContainerRef}
            style={{
              flex: 1, overflowY: 'auto', padding: '8px',
              fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
              fontSize: '9.5px', color: '#a7f3d0', lineHeight: '1.4',
              wordBreak: 'break-all', whiteSpace: 'pre-wrap',
              userSelect: 'text',
              WebkitUserSelect: 'text',
            }}
          >
                        <div 
              ref={sensorLogContainerRef} 
              style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}
            >
              <span style={{ color: 'var(--text-muted)' }}>
                [대기] 센서 로그 데이터 스트리밍 시작 대기 중... (React 렌더링 우회 모드)
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 메시지 목록 */}
            {/* 메시지 목록 (AIChatList 모듈화) */}
      <AIChatList
        messages={messages}
        messagesContainerRef={messagesContainerRef}
        messagesEndRef={messagesEndRef}
        onApplySuggestion={onApplySuggestion}
        selectedText={selectedText}
        onUpdateDiffState={onUpdateDiffState}
        onApplyInsertSuggestion={onApplyInsertSuggestion}
        onUpdateInsertSuggestionStatus={onUpdateInsertSuggestionStatus}
        blocks={blocks}
        onScrollToBlock={onScrollToBlock}
        isWhiteTheme={isWhiteTheme}
      />

      {/* 📥 하단 다운로드 진행률 및 모달 레이저 */}
      {downloadStatus && downloadStatus.progress < 100 && (
        <div 
          onClick={() => setShowDownloadDetail(true)}
          style={{
            padding: '8px 12px',
            background: 'rgba(16,185,129,0.08)',
            borderTop: '1px solid rgba(16,185,129,0.15)',
            display: 'flex', alignItems: 'center', gap: '8px',
            cursor: 'pointer', flexShrink: 0,
            transition: 'background 0.2s'
          }}
        >
          <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center' }}>
            <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: '#10b981', animation: 'pulse 1.5s infinite' }} />
          </div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#10b981', fontWeight: 700 }}>
              <span>모델 파일 다운로드 중...</span>
              <span>{downloadStatus.progress}%</span>
            </div>
            <div style={{ width: '100%', height: '3px', background: 'rgba(255,255,255,0.05)', borderRadius: '2px', overflow: 'hidden' }}>
              <div style={{ width: `${downloadStatus.progress}%`, height: '100%', background: '#10b981', transition: 'width 0.2s' }} />
            </div>
          </div>
        </div>
      )}

      {/* 📥 다운로드 세부 진행 상황 팝업 모달 */}
      {showDownloadDetail && downloadStatus && (
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(15,23,42,0.85)', backdropFilter: 'blur(8px)',
          zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '20px'
        }}>
          <div style={{
            background: 'var(--bg-card)', border: '1px solid var(--border-muted)',
            borderRadius: '12px', padding: '20px', width: '100%', maxWidth: '300px',
            boxShadow: '0 20px 40px rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column', gap: '12px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '13px', fontWeight: 800, color: '#f8fafc' }}>다운로드 세부 정보</span>
              <button 
                onClick={() => setShowDownloadDetail(false)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={14} />
              </button>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '11px', color: 'var(--text-muted)' }}>
              <div><strong>파일명:</strong> <span style={{ color: 'var(--text-main)' }}>{downloadStatus.filename}</span></div>
              <div><strong>진행률:</strong> <span style={{ color: '#10b981', fontWeight: 700 }}>{downloadStatus.progress}%</span></div>
              <div><strong>받은 용량:</strong> <span style={{ color: 'var(--text-main)' }}>{(downloadStatus.downloadedBytes / (1024 * 1024)).toFixed(1)} MB / {(downloadStatus.totalBytes / (1024 * 1024)).toFixed(1)} MB</span></div>
              <div><strong>현재 속도:</strong> <span style={{ color: 'var(--secondary)', fontWeight: 700 }}>{downloadStatus.speed} MB/s</span></div>
              <div><strong>남은 시간:</strong> <span style={{ color: 'var(--accent)' }}>{downloadStatus.timeRemaining}초</span></div>
            </div>

            <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '3px', overflow: 'hidden' }}>
              <div style={{ width: `${downloadStatus.progress}%`, height: '100%', background: 'linear-gradient(90deg, var(--primary), var(--secondary))', transition: 'width 0.2s' }} />
            </div>

            <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
              <button
                onClick={() => {
                  if ((window as any).electron) {
                    (window as any).electron.send('llm:cancelDownload')
                  }
                  setDownloadStatus(null)
                  setShowDownloadDetail(false)
                }}
                style={{
                  flex: 1, padding: '8px', borderRadius: '6px', background: 'rgba(239,68,68,0.1)',
                  border: '1px solid rgba(239,68,68,0.2)', color: '#f87171', fontSize: '11px',
                  fontWeight: 700, cursor: 'pointer', textAlign: 'center'
                }}
              >
                다운로드 취소
              </button>
              <button
                onClick={() => setShowDownloadDetail(false)}
                style={{
                  flex: 1, padding: '8px', borderRadius: '6px', background: 'var(--bg-glass-active)',
                  border: '1px solid var(--border-muted)', color: 'var(--text-main)', fontSize: '11px',
                  fontWeight: 600, cursor: 'pointer', textAlign: 'center'
                }}
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 입력 영역 */}
      <div style={{
        padding: '10px 12px',
        borderTop: '1px solid var(--border-muted)',
        display: 'flex', flexDirection: 'column', gap: '8px',
        flexShrink: 0,
        background: 'var(--bg-glass-active)',
      }}>
        {/* 🤖 에이전트 작업 모드 수동 지정 / 자동 라우팅 제어 패널 */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '2px',
          background: 'rgba(0,0,0,0.2)',
          border: '1px solid var(--border-muted)',
          borderRadius: '8px',
          padding: '2px',
          marginBottom: '2px',
          width: '100%',
          boxSizing: 'border-box',
        }}>
          {([
            { id: 'auto', label: '자동 (Auto)' },
            { id: 'edit', label: '수정 (Edit)' },
            { id: 'summary', label: '요약 (Summary)' },
            { id: 'chat', label: '대화 (Chat)' }
          ] as const).map(tab => {
            const isActive = manualMode === tab.id
            const currentResolved = getActiveMode(input)
            const resolvedLabel = tab.id === 'auto'
              ? `자동 (${currentResolved.toUpperCase()})`
              : tab.label
            
            // 활성화 탭 색상 커스텀 (수정: 분홍색, 요약: 하늘색, 대화: 보라색)
            const activeColor = tab.id === 'edit' || (tab.id === 'auto' && currentResolved === 'edit')
              ? '#fb7185'
              : tab.id === 'summary' || (tab.id === 'auto' && currentResolved === 'summary')
              ? '#38bdf8'
              : '#c084fc'

            return (
              <button
                key={tab.id}
                onClick={() => setManualMode(tab.id)}
                style={{
                  width: '100%',
                  padding: '5px 2px',
                  borderRadius: '6px',
                  background: isActive ? (isWhiteTheme ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.06)') : 'transparent',
                  border: isActive ? (isWhiteTheme ? '1px solid rgba(0,0,0,0.12)' : '1px solid rgba(255,255,255,0.1)') : '1px solid transparent',
                  color: isActive ? activeColor : 'var(--text-muted)',
                  fontSize: '9.5px',
                  fontWeight: isActive ? 800 : 500,
                  cursor: 'pointer',
                  textAlign: 'center',
                  transition: 'all 0.15s',
                  outline: 'none',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  boxSizing: 'border-box'
                }}
                title={resolvedLabel}
              >
                {resolvedLabel}
              </button>
            )
          })}
        </div>

        {/* 🤖 모델 간편 선택 셀렉트 */}
        {apiType === 'api' ? (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            width: '100%',
            marginBottom: '2px',
          }}>
            <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 600, flexShrink: 0 }}>
              AI 모델:
            </span>
            <div style={{
              flex: 1,
              background: isWhiteTheme ? 'rgba(0,0,0,0.02)' : 'rgba(255,255,255,0.02)',
              border: '1px solid var(--border-muted)',
              borderRadius: '6px',
              padding: '4px 6px',
              color: 'var(--primary)',
              fontSize: '10px',
              fontWeight: 700,
              fontFamily: 'monospace',
            }}>
              [Cloud API] {apiModel || 'Gemini'}
            </div>
          </div>
        ) : (
          models.length > 0 && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              width: '100%',
              marginBottom: '2px',
            }}>
              <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 600, flexShrink: 0 }}>
                AI 모델:
              </span>
              <select
                value={settings.modelPath}
                onChange={e => onUpdateSettings({ modelPath: e.target.value })}
                style={{
                  flex: 1,
                  background: isWhiteTheme ? 'var(--bg-card)' : 'rgba(0,0,0,0.2)',
                  border: '1px solid var(--border-muted)',
                  borderRadius: '6px',
                  padding: '4px 6px',
                  color: 'var(--text-main)',
                  fontSize: '10px',
                  outline: 'none',
                  cursor: 'pointer',
                  fontFamily: 'monospace',
                }}
              >
                {models.map(m => (
                  <option key={m.path} value={m.path} style={{ background: 'var(--bg-main)', color: 'var(--text-main)' }}>
                    {m.filename}
                  </option>
                ))}
              </select>
            </div>
          )
        )}

        {/* 선택 텍스트 연동 알림 뱃지 */}
        {selectedText && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'linear-gradient(90deg, rgba(6,182,212,0.12) 0%, transparent 100%)',
            border: '1px solid rgba(6,182,212,0.3)',
            borderRadius: '6px',
            padding: '6px 10px',
            marginBottom: '2px',
          }}>
            <span style={{ fontSize: '11px', color: 'var(--secondary)', display: 'flex', alignItems: 'center', gap: '5px', fontWeight: 'bold' }}>
              <Bot size={12} />
              에디터 선택 영역 연동 중 ({selectedText.length}자)
            </span>
            <button
              onClick={onClearSelectedText}
              style={{
                background: 'transparent', border: 'none', cursor: 'pointer',
                color: 'var(--text-muted)', display: 'flex', alignItems: 'center',
                padding: '2px', borderRadius: '4px',
              }}
              title="연동 해제"
            >
              <X size={12} />
            </button>
          </div>
        )}

        {/* 컨텍스트 옵션 + 클리어 */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <label style={{
            display: 'flex', alignItems: 'center', gap: '5px',
            fontSize: '10px', color: 'var(--text-muted)', cursor: 'pointer',
          }}>
            <input
              type="checkbox"
              checked={useContext}
              disabled={!!selectedText} // 선택 텍스트가 있을 때는 강제로 선택 텍스트 컨텍스트 사용
              onChange={e => setUseContext(e.target.checked)}
              style={{ accentColor: 'var(--primary)' }}
            />
            {selectedText ? '선택 영역 자동 연동됨' : '문서 전체 내용 포함'}
          </label>
          {messages.length > 0 && (
            <button
              onClick={onClear}
              style={{
                background: 'transparent', border: 'none', cursor: 'pointer',
                color: 'var(--text-muted)', display: 'flex', alignItems: 'center',
                gap: '3px', fontSize: '10px', padding: '2px 4px', borderRadius: '4px',
              }}
            >
              <Trash2 size={10} />
              대화 지우기
            </button>
          )}
        </div>

        {/* 🤖 참조된 태그 배지 목록UI */}
        {taggedBlocks.length > 0 && (
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '4px',
            padding: '6px',
            background: 'rgba(139, 92, 246, 0.06)',
            border: '1px dashed rgba(139, 92, 246, 0.22)',
            borderRadius: '6px',
            marginBottom: '4px',
            maxHeight: '65px',
            overflowY: 'auto',
            width: '100%',
            boxSizing: 'border-box'
          }}>
            {taggedBlocks.map(block => (
              <span
                key={block.id}
                onClick={() => onScrollToBlock(block.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  background: isWhiteTheme ? 'rgba(109, 40, 217, 0.08)' : 'rgba(139, 92, 246, 0.16)',
                  color: isWhiteTheme ? '#6d28d9' : '#c084fc',
                  fontSize: '9.5px',
                  fontWeight: 700,
                  padding: '2px 6px',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  border: isWhiteTheme ? '1px solid rgba(109, 40, 217, 0.2)' : '1px solid rgba(139, 92, 246, 0.25)',
                  transition: 'background 0.2s',
                  userSelect: 'none',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(139, 92, 246, 0.3)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(139, 92, 246, 0.16)'}
                title="클릭 시 에디터 상의 해당 위치로 이동 및 하이라이트"
              >
                💜 #{block.text}
                <X
                  size={10}
                  onClick={(e) => {
                    e.stopPropagation()
                    setTaggedBlocks(prev => prev.filter(b => b.id !== block.id))
                  }}
                  style={{ cursor: 'pointer', opacity: 0.7 }}
                />
              </span>
            ))}
          </div>
        )}

        {/* ⏳ 대기열 큐 (Request Queue) UI 목록 */}
        {pendingQueue.length > 0 && (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '5px',
            padding: '6px 8px',
            background: isWhiteTheme ? 'rgba(0,0,0,0.02)' : 'rgba(255,255,255,0.02)',
            border: '1px solid var(--border-muted)',
            borderRadius: '8px',
            marginBottom: '6px',
            maxHeight: '120px',
            overflowY: 'auto',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
              <span style={{ fontSize: '9px', fontWeight: 800, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                ⏳ 처리 대기열 ({pendingQueue.length}개)
              </span>
              <span style={{ fontSize: '8.5px', color: 'var(--text-muted)' }}>
                순차적으로 자동 실행됩니다
              </span>
            </div>
            {pendingQueue.map((item, idx) => (
              <div
                key={item.id || idx}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: isWhiteTheme ? 'var(--bg-card)' : 'rgba(255,255,255,0.03)',
                  border: '1px solid var(--border-muted)',
                  borderRadius: '6px',
                  padding: '4px 8px',
                }}
              >
                <span style={{
                  fontSize: '10px',
                  color: 'var(--text-main)',
                  textOverflow: 'ellipsis',
                  overflow: 'hidden',
                  whiteSpace: 'nowrap',
                  maxWidth: '85%',
                }}>
                  {idx + 1}. {item.userMessage}
                </span>
                <button
                  onClick={() => removeFromQueue?.(item.id)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#f87171',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    padding: '2px',
                    borderRadius: '4px',
                  }}
                  title="대기열에서 제거"
                >
                  <X size={10} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* 텍스트 입력 + 버튼 */}
        <div
          data-focus-region="ai-input"
          style={{ display: 'flex', gap: '6px', alignItems: 'flex-end', position: 'relative', borderRadius: '10px' }}
        >
          <textarea
            ref={textareaRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isInputEnabled ? '메시지를 입력하세요... (Shift+Enter: 줄바꿈)' : 'llama.cpp 설치 필요'}
            disabled={!isInputEnabled}
            rows={2}
            style={{
              flex: 1,
              background: 'var(--bg-glass)',
              border: selectedText ? '1px solid rgba(6,182,212,0.4)' : '1px solid var(--border-muted)',
              borderRadius: '8px',
              padding: '8px 10px',
              color: 'var(--text-main)',
              fontSize: '12px',
              resize: 'none',
              outline: 'none',
              fontFamily: 'var(--font-sans)',
              lineHeight: '1.5',
              transition: 'border-color 0.15s',
              maxHeight: '80px',
              overflowY: 'auto',
            }}
            onFocus={e => (e.target.style.borderColor = selectedText ? 'var(--secondary)' : 'var(--primary)')}
            onBlur={e => (e.target.style.borderColor = selectedText ? 'rgba(6,182,212,0.4)' : 'var(--border-muted)')}
          />

          {isGenerating ? (
            <button
              onClick={onAbort}
              style={{
                width: '36px', height: '36px', borderRadius: '8px',
                background: 'rgba(239,68,68,0.2)',
                border: '1px solid rgba(239,68,68,0.4)',
                color: '#f87171', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}
              title="중단"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2">
                <rect x="4" y="4" width="16" height="16" rx="2" />
              </svg>
            </button>
          ) : (
            <button
              onClick={handleSend}
              disabled={!input.trim() || !isInputEnabled}
              style={{
                width: '36px', height: '36px', borderRadius: '8px',
                background: input.trim() && isInputEnabled
                  ? (selectedText ? 'linear-gradient(135deg, var(--secondary), #0891b2)' : 'linear-gradient(135deg, var(--primary), #7c3aed)')
                  : 'rgba(255,255,255,0.05)',
                border: '1px solid transparent',
                color: '#fff', cursor: input.trim() && isInputEnabled ? 'pointer' : 'not-allowed',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
                boxShadow: input.trim() && isInputEnabled ? (selectedText ? '0 2px 8px var(--secondary-glow)' : '0 2px 8px var(--primary-glow)') : 'none',
                transition: 'all 0.15s',
                opacity: input.trim() && isInputEnabled ? 1 : 0.4,
              }}
              title="전송 (Enter)"
            >
              <Send size={14} />
            </button>
          )}
        </div>
      </div>
        </>
      )}

      {activeTab === 'outline' && (() => {
        const isUnlocked = installedPlugins.includes('outline')
        if (!isUnlocked) {
          return (
            <div style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '24px',
              textAlign: 'center',
              color: 'var(--text-dark)',
              gap: '12px',
            }}>
              <Lock size={28} style={{ color: 'var(--text-dark)' }} />
              <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#f8fafc' }}>
                Outline 기능이 잠겨 있습니다.
              </div>
              <div style={{ fontSize: '11px', lineHeight: '1.5', color: 'var(--text-muted)' }}>
                상단 메뉴의 Marketplace에서<br />
                Outline 익스텐션을 구독하시면 즉시 잠금이 해제됩니다.
              </div>
            </div>
          )
        }

        const getDocumentOutline = (items: any[]): { id: string; text: string; level: number }[] => {
          const list: any[] = []
          const traverse = (arr: any[]) => {
            for (const item of arr) {
              if (item.type === 'heading') {
                const text = item.content?.map((c: any) => c.text).join('') || '제목 없음'
                list.push({
                  id: item.id,
                  text,
                  level: item.props?.level || 1,
                })
              }
              if (item.children) {
                traverse(item.children)
              }
            }
          }
          if (items && Array.isArray(items)) {
            traverse(items)
          }
          return list
        }

        const outline = getDocumentOutline(blocks)

        return (
          <div style={{
            flex: 1,
            overflowY: 'auto',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '8px' }}>
              문서 개요 (총 {outline.length}개 제목)
            </div>
            {outline.length === 0 ? (
              <div style={{ fontSize: '11px', color: 'var(--text-dark)', fontStyle: 'italic', textAlign: 'center', marginTop: '24px' }}>
                작성된 제목(Heading)이 없습니다.
              </div>
            ) : (
              outline.map((item) => (
                <div
                  key={item.id}
                  onClick={() => {
                    const el = document.querySelector(`[data-id="${item.id}"]`)
                    if (el) {
                      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
                      el.classList.add('pulse-indicator')
                      setTimeout(() => el.classList.remove('pulse-indicator'), 1000)
                    }
                  }}
                  style={{
                    padding: '6px 10px',
                    borderRadius: '6px',
                    fontSize: '12px',
                    color: item.level === 1 ? 'var(--text-main)' : 'var(--text-muted)',
                    fontWeight: item.level === 1 ? 700 : item.level === 2 ? 600 : 500,
                    paddingLeft: `${(item.level - 1) * 12 + 10}px`,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    transition: 'background 0.15s',
                    borderLeft: item.level === 1 ? '2px solid var(--primary)' : '2px solid transparent',
                    background: 'rgba(255,255,255,0.01)',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-glass-active)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.01)'}
                >
                  <span style={{
                    width: '4px',
                    height: '4px',
                    borderRadius: '50%',
                    backgroundColor: item.level === 1 ? 'var(--primary)' : 'var(--text-dark)',
                    display: 'inline-block'
                  }} />
                  {item.text}
                </div>
              ))
            )}
          </div>
        )
      })()}

      {activeTab === 'calculator' && (
        <div
          id="ameva-plugin-calculator"
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            backgroundColor: 'var(--bg-main)',
            height: '100%',
            padding: '16px',
            overflowY: 'auto',
          }}
          ref={(el) => {
            if (el && (window as any).AMEVA_PLUGINS?.calculator) {
              try {
                (window as any).AMEVA_PLUGINS.calculator.render(el.id);
              } catch (e) {
                console.error('계산기 플러그인 렌더링 실패:', e);
              }
            }
          }}
        />
      )}

      {activeTab === 'finance' && (
        <div
          id="ameva-plugin-finance-dashboard"
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            backgroundColor: 'var(--bg-main)',
            height: '100%',
            padding: '16px',
            overflowY: 'auto',
          }}
          ref={(el) => {
            if (el && (window as any).AMEVA_PLUGINS?.["finance-dashboard"]) {
              try {
                (window as any).AMEVA_PLUGINS["finance-dashboard"].render(el.id);
              } catch (e) {
                console.error('주식/환율 플러그인 렌더링 실패:', e);
              }
            }
          }}
        />
      )}

      {activeTab === 'youtube' && (
        <div
          id="ameva-plugin-youtube"
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            backgroundColor: 'var(--bg-main)',
            height: '100%',
            padding: '16px',
            overflowY: 'auto',
          }}
          ref={(el) => {
            if (el && (window as any).AMEVA_PLUGINS?.youtube) {
              try {
                (window as any).AMEVA_PLUGINS.youtube.render(el.id);
              } catch (e) {
                console.error('YouTube 플러그인 렌더링 실패:', e);
              }
            }
          }}
        />
      )}

      {activeTab === 'naver' && (
        <div
          id="ameva-plugin-naver"
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            backgroundColor: 'var(--bg-main)',
            height: '100%',
            padding: '16px',
          }}
          ref={(el) => {
            if (el && (window as any).AMEVA_PLUGINS?.naver) {
              try {
                (window as any).AMEVA_PLUGINS.naver.render(el.id);
              } catch (e) {
                console.error('Naver 플러그인 렌더링 실패:', e);
              }
            }
          }}
        />
      )}

      {activeTab === 'google' && (
        <div
          id="ameva-plugin-google"
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            backgroundColor: 'var(--bg-main)',
            height: '100%',
            padding: '16px',
          }}
          ref={(el) => {
            if (el && (window as any).AMEVA_PLUGINS?.google) {
              try {
                (window as any).AMEVA_PLUGINS.google.render(el.id);
              } catch (e) {
                console.error('Google 플러그인 렌더링 실패:', e);
              }
            }
          }}
        />
      )}

      {activeTab === 'calendar' && (
        <div
          id="ameva-plugin-calendar"
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            backgroundColor: 'var(--bg-main)',
            height: '100%',
            padding: '16px',
            overflowY: 'auto',
          }}
          ref={(el) => {
            if (el && (window as any).AMEVA_PLUGINS?.calendar) {
              try {
                (window as any).AMEVA_PLUGINS.calendar.render(el.id);
              } catch (e) {
                console.error('Calendar 플러그인 렌더링 실패:', e);
              }
            }
          }}
        />
      )}

      {activeTab === 'google-drive' && (
        <div
          id="ameva-plugin-google-drive"
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            backgroundColor: 'var(--bg-main)',
            height: '100%',
            padding: '16px',
            overflowY: 'auto',
          }}
          ref={(el) => {
            if (el && (window as any).AMEVA_PLUGINS?.["google-drive"]) {
              try {
                (window as any).AMEVA_PLUGINS["google-drive"].render(el.id);
              } catch (e) {
                console.error('GoogleDrive 플러그인 렌더링 실패:', e);
              }
            }
          }}
        />
      )}

      {/* 🤖 AMEVA AI 추천 모델 다운로드 허브 모달 */}
      {showModelHub && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 9999, padding: '20px',
        }}>
          <div style={{
            background: 'var(--bg-main)', border: '1px solid var(--border-muted)',
            borderRadius: '12px', width: '100%', maxWidth: '440px',
            padding: '20px', boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
            display: 'flex', flexDirection: 'column', gap: '14px',
            color: 'var(--text-main)', position: 'relative',
          }}>
            <button
              onClick={() => setShowModelHub?.(false)}
              style={{
                position: 'absolute', top: '16px', right: '16px',
                background: 'none', border: 'none', color: 'var(--text-muted)',
                cursor: 'pointer', fontSize: '16px',
              }}
            >
              <X size={18} />
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Bot style={{ color: 'var(--primary)' }} size={22} />
              <h3 style={{ fontSize: '15px', fontWeight: 700, margin: 0 }}>AMEVA AI 모델 다운로드 센터</h3>
            </div>

            <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: 0, lineHeight: 1.4 }}>
              원하는 사양의 온디바이스 언어모델(.gguf)을 다운로드하세요.<br />
              내려받은 파일은 기본 경로 <code>C:\ameva\models\llm\</code> 에 저장되며 감지 완료 시 즉시 AI를 구동할 수 있습니다.
            </p>

            <div style={{
              display: 'flex', flexDirection: 'column', gap: '8px',
              maxHeight: '380px', overflowY: 'auto', paddingRight: '4px',
            }}>
              {[
                {
                  name: 'Qwen 2.5 1.5B (초경량 모델)',
                  size: '1.1 GB',
                  desc: '저사양 PC 및 오피스 문서 최적화',
                  url: 'https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct-GGUF/resolve/main/qwen2.5-1.5b-instruct-q4_k_m.gguf',
                  filename: 'qwen2.5-1.5b-instruct-q4_k_m.gguf',
                },
                {
                  name: 'Gemma 2 2B (구글 추천 모델)',
                  size: '1.6 GB',
                  desc: '빠른 속도와 우수한 한국어 이해도',
                  url: 'https://huggingface.co/lmstudio-community/gemma-2-2b-it-GGUF/resolve/main/gemma-2-2b-it-Q4_K_M.gguf',
                  filename: 'gemma-2-2b-it-q4_k_m.gguf',
                },
                {
                  name: 'EXAONE 3.0 2.4B (국산 최고 모델)',
                  size: '1.7 GB',
                  desc: 'LG AI 연구원의 뛰어난 한국어 특화 성능 (Public)',
                  url: 'https://huggingface.co/mradermacher/EXAONE-3.0-2.4B-Instruct-GGUF/resolve/main/EXAONE-3.0-2.4B-Instruct.Q4_K_M.gguf',
                  filename: 'exaone-3.0-2.4b-instruct-q4_k_m.gguf',
                },
                {
                  name: 'Qwen 2.5 3B (스탠다드 모델)',
                  size: '2.2 GB',
                  desc: '속도와 논리력 밸런스가 잡힌 베스트 에디션',
                  url: 'https://huggingface.co/Qwen/Qwen2.5-3B-Instruct-GGUF/resolve/main/qwen2.5-3b-instruct-q4_k_m.gguf',
                  filename: 'qwen2.5-3b-instruct-q4_k_m.gguf',
                },
                {
                  name: 'Qwen 2.5 7B (고성능 대화형 모델)',
                  size: '4.7 GB',
                  desc: '코딩 및 복잡한 추론 지원, 외장 GPU 권장',
                  url: 'https://huggingface.co/lmstudio-community/Qwen2.5-7B-Instruct-GGUF/resolve/main/Qwen2.5-7B-Instruct-Q4_K_M.gguf',
                  filename: 'Qwen2.5-7B-Instruct-Q4_K_M.gguf',
                },
                {
                  name: 'EXAONE 3.0 7.8B (국산 대형 모델)',
                  size: '4.9 GB',
                  desc: 'LG의 7.8B 최고 한국어 성능 및 문서 작업 특화 (Public)',
                  url: 'https://huggingface.co/mradermacher/EXAONE-3.0-7.8B-Instruct-GGUF/resolve/main/EXAONE-3.0-7.8B-Instruct.Q4_K_M.gguf',
                  filename: 'exaone-3.0-7.8b-instruct-q4_k_m.gguf',
                },
                {
                  name: 'Llama 3.2 8B (글로벌 표준 모델)',
                  size: '4.7 GB',
                  desc: '강력한 글로벌 코어 논리력, 외장 GPU 권장',
                  url: 'https://huggingface.co/lmstudio-community/Llama-3.2-8B-Instruct-GGUF/resolve/main/Llama-3.2-8B-Instruct-Q4_K_M.gguf',
                  filename: 'Llama-3.2-8B-Instruct-Q4_K_M.gguf',
                },
                {
                  name: 'Gemma 2 9B (구글 프리미엄 모델)',
                  size: '5.6 GB',
                  desc: '동급 모델 최강 성능 및 자연스러운 대화형 응답',
                  url: 'https://huggingface.co/lmstudio-community/gemma-2-9b-it-GGUF/resolve/main/gemma-2-9b-it-Q4_K_M.gguf',
                  filename: 'gemma-2-9b-it-q4_k_m.gguf',
                }
              ].map((model) => {
                const isDownloadingThis = downloadStatus && downloadStatus.filename === model.filename
                const isInstalled = models.some(m => m.filename.toLowerCase() === model.filename.toLowerCase())
                return (
                  <div key={model.filename} style={{
                    padding: '10px', borderRadius: '8px',
                    background: 'var(--bg-glass)', 
                    border: isInstalled ? '1px solid rgba(16,185,129,0.35)' : '1px solid var(--border-muted)',
                    boxShadow: isInstalled ? '0 0 10px rgba(16,185,129,0.05)' : 'none',
                    display: 'flex', flexDirection: 'column', gap: '6px',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <span style={{ fontSize: '12px', fontWeight: 700 }}>{model.name}</span>
                        {isInstalled && (
                          <span style={{ fontSize: '8.5px', background: 'rgba(16,185,129,0.15)', color: '#10b981', padding: '1px 4px', borderRadius: '4px', fontWeight: 700 }}>
                            설치됨
                          </span>
                        )}
                      </div>
                      <span style={{ fontSize: '10px', color: isInstalled ? '#10b981' : 'var(--primary)', fontWeight: 800 }}>{model.size}</span>
                    </div>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{model.desc}</div>

                    <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
                      {isInstalled ? (
                        <div style={{
                          flex: 1, padding: '5px 8px', borderRadius: '4px',
                          background: 'rgba(16,185,129,0.12)', color: '#10b981',
                          border: '1px solid rgba(16,185,129,0.3)', fontSize: '10px',
                          fontWeight: 700, textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '3px'
                        }}>
                          <Check size={10} /> 사용 가능 ✓
                        </div>
                      ) : (
                        window.electronAPI?.llmDownloadModel && (
                          <button
                            disabled={!!downloadStatus}
                            onClick={async () => {
                              if (window.electronAPI?.llmDownloadModel && setDownloadStatus) {
                                setDownloadStatus({ filename: model.filename, progress: 0, speed: 0 })
                                const res = await window.electronAPI.llmDownloadModel(model.filename, { url: model.url })
                                if (res && res.success) {
                                  if (refreshModels) await refreshModels()
                                } else if (res && !res.success) {
                                  alert(`다운로드 실패: ${res.error}`)
                                  setDownloadStatus(null)
                                }
                              }
                            }}
                            style={{
                              flex: 1, padding: '5px 8px', borderRadius: '4px',
                              background: 'var(--primary)', color: '#fff',
                              border: 'none', fontSize: '10px',
                              cursor: !!downloadStatus ? 'not-allowed' : 'pointer',
                              fontWeight: 700, opacity: !!downloadStatus ? 0.5 : 1,
                            }}
                          >
                            모델 다운로드 📥
                          </button>
                        )
                      )}
                    </div>

                    {isDownloadingThis && (
                      <div style={{ marginTop: '6px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: 'var(--text-muted)', marginBottom: '3px' }}>
                          <span>속도: {downloadStatus.speed} MB/s</span>
                          <span>진행률: {downloadStatus.progress}%</span>
                        </div>
                        <div style={{ width: '100%', height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', overflow: 'hidden' }}>
                          <div style={{ width: `${downloadStatus.progress}%`, height: '100%', background: 'var(--primary)', transition: 'width 0.2s' }} />
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
              <button
                onClick={() => {
                  if (window.electronAPI?.openExternalLink) {
                    window.electronAPI.openExternalLink('file:///C:/ameva/models/llm/')
                  }
                }}
                style={{
                  flex: 1, padding: '7px 8px', borderRadius: '6px',
                  background: 'none', border: '1px solid var(--border-muted)',
                  color: 'var(--text-main)', fontSize: '10.5px', cursor: 'pointer',
                  whiteSpace: 'nowrap'
                }}
              >
                폴더 열기 📂
              </button>
              {importModel && (
                <button
                  onClick={importModel}
                  style={{
                    flex: 1.2, padding: '7px 8px', borderRadius: '6px',
                    background: 'rgba(6, 182, 212, 0.12)', border: '1px solid rgba(6, 182, 212, 0.3)',
                    color: '#22d3ee', fontSize: '10.5px', cursor: 'pointer',
                    fontWeight: 700, whiteSpace: 'nowrap'
                  }}
                >
                  로컬 파일 복사/추가 📂
                </button>
              )}
              <button
                onClick={() => setShowModelHub?.(false)}
                style={{
                  flex: 1, padding: '7px 8px', borderRadius: '6px',
                  background: 'var(--bg-glass-active)', border: '1px solid var(--border-muted)',
                  color: 'var(--text-main)', fontSize: '10.5px', cursor: 'pointer',
                  fontWeight: 700, whiteSpace: 'nowrap'
                }}
              >
                완료 및 닫기
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes cursor-blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
        @keyframes dot-blink {
          0%, 80%, 100% { transform: scale(0); opacity: 0.3; }
          40% { transform: scale(1.0); opacity: 1; }
        }
        .dot-thinking {
          display: inline-block;
        }
      `}</style>
    </div>
  )
}

// ─── 챗봇용 언어 메타 및 색상 연동 정의 (JupyterCodeViewer와 100% 동일) ───
