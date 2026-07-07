
import { useAIPanelState } from './useAIPanelState'
import { useAIPanelScroll } from './useAIPanelScroll'
import { useAIKeychain } from './useAIKeychain'
import { useAIRAG } from './useAIRAG'
import { useAIModelHub } from './useAIModelHub'

export function useAIPanelLogic(props: any) {
  // 1. Scroll Refs & Logic
  const scroll = useAIPanelScroll(props.messages, props.engineLogs || '', props.taggedBlocks, props.isOpen)
  
  // 2. Local State
  const state = useAIPanelState(scroll.textareaRef)
  
  // 3. Keychain Logic
  const keychain = useAIKeychain(props.settings.apiType, props.settings.apiProvider || '', props.settings.apiKey || '', props.onUpdateSettings)
  
  // 4. RAG Logic
  const rag = useAIRAG(
    props.blocks, props.currentContent, props.selectedText, state.useContext, state.manualMode,
    props.activeBlockId, props.settings.apiType, props.settings.gpuOnly, props.settings.apiKey, props.settings.modelPath,
    props.onSend
  )
  
  // 5. Model Hub Logic
  const hub = useAIModelHub(props.showModelHub, props.refreshModels, props.setDownloadStatus)

  // 6. Event Handlers
  const handleSend = () => {
    rag.handleSendAction(state.input)
    state.setInput('')
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    } else if (e.key === 'Backspace' && state.input === '' && props.taggedBlocks.length > 0) {
      e.preventDefault()
      props.setTaggedBlocks(props.taggedBlocks.slice(0, props.taggedBlocks.length - 1))
    }
  }

  const handleQuickAction = (prompt: string) => {
    if (props.isGenerating) return
    rag.handleSendAction(prompt, true)
  }

  return {
    ...scroll,
    ...state,
    ...keychain,
    ...rag,
    ...hub,
    handleSend,
    handleKeyDown,
    handleQuickAction
  }
}
