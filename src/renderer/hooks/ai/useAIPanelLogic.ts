/**
 * @file useAIPanelLogic.ts
 * @system AMEVA OS Desktop Workstation
 * @location src/renderer/hooks/ai/useAIPanelLogic.ts
 * @role Core module helper and integration logic
 * 
 * [소비처 - CONSUMERS / USAGE CONTEXT]
 * - 소비처 A (src/renderer/App.tsx): 최상위 Facade 구조에 통합 마운트.
 * - 소비처 B (src/renderer/contexts/AppContext.tsx): 리액트 Context 훅 목록에 바인딩되어 하위 뷰에 전파.
 * 
 * [책임 범위 - RESPONSIBILITY]
 * - 본 파일은 AMEVA 시스템 내에서 도메인 목적에 부합하는 연산 및 데이터 처리 흐름을 안전하게 캡슐화한다.
 * - 외부 라이브러리 및 하위 종속성을 조율하고 결과 규격을 일관되게 제공한다.
 * 
 * [절대 깨면 안 되는 계약 - CONTRACT]
 * - MUST: 모든 예외 발생 시 에러를 침묵시키지 말고 에러 로그를 명확하게 남길 것.
 * - MUST NOT: TypeScript any 형식을 우회 수단으로 함부로 선언하지 말 것.
 */


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
