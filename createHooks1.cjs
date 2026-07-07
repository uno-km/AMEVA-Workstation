const fs = require('fs');

const createHook = (name, content) => {
  fs.writeFileSync(`src/renderer/hooks/ai/${name}.ts`, content, 'utf-8');
  console.log(`Created ${name}.ts`);
};

// 1. useAIKeychain
createHook('useAIKeychain', `
import { useState, useRef, useEffect } from 'react'
import * as ipc from '../../services/ipc/electronApiAdapter'

export function useAIKeychain(apiType: string, apiProvider: string, apiKey: string, onUpdateSettings: (s: any) => void) {
  const isApiKeyLoadedRef = useRef<Record<string, boolean>>({})
  const [isKeySaved, setIsKeySaved] = useState<Record<string, boolean>>({})

  // 1. 마운트 및 프로바이더 변경 시 OS 키체인 연동
  useEffect(() => {
    if (!ipc.isElectronEnv() || apiType !== 'api') return
    if (isApiKeyLoadedRef.current[apiProvider]) return

    const loadSavedApiKey = async () => {
      let keychainKey = 'openai-api-key'
      if (apiProvider === 'gemini') keychainKey = 'gemini-api-key'
      else if (apiProvider === 'anthropic') keychainKey = 'claude-api-key'
      else if (apiProvider === 'custom') return

      const savedKey = await ipc.keychainGet(keychainKey)
      if (savedKey) {
        isApiKeyLoadedRef.current[apiProvider] = true
        setIsKeySaved(prev => ({ ...prev, [keychainKey]: true }))
        if (savedKey !== apiKey) {
          onUpdateSettings({ apiKey: savedKey })
        }
      }
    }
    loadSavedApiKey()
  }, [apiProvider, apiType, apiKey, onUpdateSettings])

  // 2. 수동 키 저장
  const handleSaveKey = async () => {
    if (!ipc.isElectronEnv() || !apiKey) return
    let keychainKey = 'openai-api-key'
    if (apiProvider === 'gemini') keychainKey = 'gemini-api-key'
    else if (apiProvider === 'anthropic') keychainKey = 'claude-api-key'
    
    await ipc.keychainSet(keychainKey, apiKey)
    setIsKeySaved(prev => ({ ...prev, [keychainKey]: true }))
  }

  // 3. 수동 키 삭제
  const handleDeleteKey = async () => {
    if (!ipc.isElectronEnv()) return
    let keychainKey = 'openai-api-key'
    if (apiProvider === 'gemini') keychainKey = 'gemini-api-key'
    else if (apiProvider === 'anthropic') keychainKey = 'claude-api-key'
    
    await ipc.keychainDelete(keychainKey)
    setIsKeySaved(prev => ({ ...prev, [keychainKey]: false }))
    onUpdateSettings({ apiKey: '' })
  }

  // 4. 입력 시 프로바이더 자동 변경 로직 (휴리스틱)
  const handleApiKeyChange = (val: string) => {
    const trimmed = val.trim()
    let detectedProvider: 'gemini' | 'openai' | 'anthropic' | 'custom' | null = null
    let targetEndpoint = ''
    let targetModel = ''

    if (trimmed.startsWith('AIzaSy') || trimmed.startsWith('AQ.')) {
      detectedProvider = 'gemini'
      targetEndpoint = 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions'
      targetModel = 'gemini-2.5-flash'
    } else if (trimmed.startsWith('sk-ant')) {
      detectedProvider = 'anthropic'
      targetEndpoint = 'https://api.anthropic.com/v1/messages'
      targetModel = 'claude-3-5-sonnet-latest'
    } else if (trimmed.startsWith('sk-')) {
      detectedProvider = 'openai'
      targetEndpoint = 'https://api.openai.com/v1/chat/completions'
      targetModel = 'gpt-4o-mini'
    }

    if (detectedProvider) {
      onUpdateSettings({ apiKey: val, apiEndpoint: targetEndpoint, apiModel: targetModel })
    } else {
      onUpdateSettings({ apiKey: val })
    }
  }

  return { isKeySaved, handleSaveKey, handleDeleteKey, handleApiKeyChange }
}
`);

// 2. useAIPanelState
createHook('useAIPanelState', `
import { useState, useEffect } from 'react'
import * as ipc from '../../services/ipc/electronApiAdapter'

export function useAIPanelState(textareaRef: React.RefObject<HTMLTextAreaElement>) {
  const [input, setInput] = useState('')
  const [manualMode, setManualMode] = useState<'auto' | 'edit' | 'summary' | 'chat'>('auto')
  const [useContext, setUseContext] = useState(true)
  const [isLogsExpanded, setIsLogsExpanded] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [gpuName, setGpuName] = useState('')

  // 커스텀 이벤트 (우클릭 등)로 텍스트 주입
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
  }, [textareaRef])

  // GPU 정보 스캔
  useEffect(() => {
    if (ipc.isElectronEnv()) {
      ipc.llmCheckHealth().then(res => {
        // Fallback for GPU info if needed, or if an endpoint exists.
        // We will just leave it empty if there's no direct GPU getter.
      })
    }
  }, [])

  return {
    input, setInput,
    manualMode, setManualMode,
    useContext, setUseContext,
    isLogsExpanded, setIsLogsExpanded,
    showSettings, setShowSettings,
    gpuName
  }
}
`);

// 3. useAIPanelScroll
createHook('useAIPanelScroll', `
import { useRef, useEffect } from 'react'

export function useAIPanelScroll(
  messages: any[],
  engineLogs: string,
  taggedBlocks: any[],
  isOpen: boolean
) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const logContainerRef = useRef<HTMLDivElement>(null)
  const logEndRef = useRef<HTMLDivElement>(null)

  // 메시지 스마트 스크롤
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

  // 로그 스마트 스크롤
  useEffect(() => {
    const container = logContainerRef.current
    if (container) {
      const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 60
      if (isNearBottom && logEndRef.current) {
        logEndRef.current.scrollIntoView({ behavior: 'auto' })
      }
    }
  }, [engineLogs])

  // 태그 블록 지정 시 포커싱
  useEffect(() => {
    if (isOpen && taggedBlocks.length > 0) {
      const timer = setTimeout(() => {
        textareaRef.current?.focus()
      }, 100)
      return () => clearTimeout(timer)
    }
  }, [taggedBlocks.length, isOpen])

  return { textareaRef, messagesContainerRef, messagesEndRef, logContainerRef, logEndRef }
}
`);
