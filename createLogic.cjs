const fs = require('fs');

let content = fs.readFileSync('src/renderer/components/AIPanel.tsx', 'utf-8');

// We want to create useAIPanelLogic.ts
// It should contain:
// - input state
// - manualMode state
// - isLogsExpanded state
// - isKeySaved state (fetch from keychain)
// - handleApiKeyChange logic
// - handleSend
// - handleKeyDown
// - handleQuickAction
// - getContextWithRAG

// We can just create this file statically, since we know what it needs to do.
const useAIPanelLogicContent = `
import { useState, useRef, useEffect, useCallback } from 'react'
import { getContextWithRAG as ragGetContext, getActiveMode as ragGetActiveMode } from '../../utils/ragUtils'
import { keychainGet, keychainSet, keychainDelete } from '../../services/ipc/electronApiAdapter'
import { analyzeApiKey } from '../../services/ai/analyzeApiKey'

export function useAIPanelLogic(props: any) {
  const { onSend, settings, selectedText, activeBlockId, isGenerating, setTaggedBlocks, taggedBlocks } = props
  const [input, setInput] = useState('')
  const [manualMode, setManualMode] = useState<'auto' | 'edit' | 'summary' | 'chat'>('auto')
  const [useContext, setUseContext] = useState(true)
  const [isLogsExpanded, setIsLogsExpanded] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [isKeySaved, setIsKeySaved] = useState<Record<string, boolean>>({})
  
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const logEndRef = useRef<HTMLDivElement>(null)

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

  const handleApiKeyChange = (val: string) => {
    const provider = analyzeApiKey(val)
    if (provider) {
      props.onUpdateSettings({ ...settings, apiKey: val, apiProvider: provider })
    } else {
      props.onUpdateSettings({ ...settings, apiKey: val })
    }
  }

  const getContextWithRAG = (userText: string, isQuickAction = false) => {
    return ragGetContext(userText, isQuickAction, useContext, manualMode, taggedBlocks, props.blocks, props.editor)
  }

  const getActiveMode = (userText: string) => {
    return ragGetActiveMode(userText, manualMode, selectedText)
  }

  const handleSend = () => {
    if (!input.trim()) return
    const finalContext = getContextWithRAG(input.trim(), false)
    const resolvedMode = getActiveMode(input)

    onSend(input.trim(), finalContext, selectedText || undefined, activeBlockId, {
      apiType: settings.apiType,
      gpuOnly: settings.gpuOnly,
      apiKey: settings.apiKey,
      modelPath: settings.modelPath,
      resolvedMode,
    })
    setInput('')
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    } else if (e.key === 'Backspace' && input === '' && taggedBlocks.length > 0) {
      e.preventDefault()
      setTaggedBlocks((prev: any) => prev.slice(0, prev.length - 1))
    }
  }

  const handleQuickAction = (prompt: string) => {
    if (isGenerating) return
    const finalContext = getContextWithRAG(prompt, true)
    const resolvedMode = getActiveMode(prompt)
    onSend(prompt, finalContext, selectedText || undefined, activeBlockId, {
      apiType: settings.apiType,
      gpuOnly: settings.gpuOnly,
      apiKey: settings.apiKey,
      modelPath: settings.modelPath,
      resolvedMode,
      isQuickAction: true
    })
  }

  return {
    input, setInput,
    manualMode, setManualMode,
    useContext, setUseContext,
    isLogsExpanded, setIsLogsExpanded,
    showSettings, setShowSettings,
    isKeySaved, setIsKeySaved,
    textareaRef, messagesEndRef, logEndRef,
    handleApiKeyChange, handleSend, handleKeyDown, handleQuickAction
  }
}
`

fs.writeFileSync('src/renderer/hooks/ai/useAIPanelLogic.ts', useAIPanelLogicContent, 'utf-8');
console.log('Created useAIPanelLogic.ts');
