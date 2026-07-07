const fs = require('fs');

const createHook = (name, content) => {
  fs.writeFileSync(`src/renderer/hooks/ai/${name}.ts`, content, 'utf-8');
  console.log(`Created ${name}.ts`);
};

// 4. useAIModelHub
createHook('useAIModelHub', `
import { useEffect } from 'react'
import * as ipc from '../../services/ipc/electronApiAdapter'

export function useAIModelHub(showModelHub: boolean, refreshModels?: () => Promise<void>, setDownloadStatus?: (val: any) => void) {
  useEffect(() => {
    if (showModelHub && refreshModels) {
      refreshModels()
    }
  }, [showModelHub, refreshModels])

  const handleDownloadModel = async (modelId: string, url: string, filename: string) => {
    if (ipc.isElectronEnv() && setDownloadStatus && (ipc as any).llmDownloadModel) {
      setDownloadStatus({ filename, progress: 0, speed: 0 })
      const res = await (ipc as any).llmDownloadModel({ url, filename })
      if (!res?.success) {
        alert(\`다운로드 실패: \${res?.error || '알 수 없는 오류'}\`)
        setDownloadStatus(null)
      }
    }
  }

  return { handleDownloadModel }
}
`);

// 5. useAIRAG
createHook('useAIRAG', `
export function useAIRAG(
  blocks: any[],
  currentContent: string,
  selectedText: string,
  useContext: boolean,
  manualMode: string,
  activeBlockId: string | undefined,
  apiType: string,
  gpuOnly: boolean,
  apiKey: string,
  modelPath: string,
  onSend: (msg: string, context?: string, selected?: string, blockId?: string, settings?: any) => void
) {
  const getContextWithRAG = (query: string, useFullFallback = false) => {
    const buildBlockIndex = () => {
      if (!blocks || blocks.length === 0) return ''
      const flatAll: any[] = (function flatten(bks: any[]): any[] {
        return (bks || []).flatMap((b: any) => [b, ...flatten(b.children || [])])
      })(blocks)
      const lines = flatAll.map((b: any) => {
        const txt = Array.isArray(b.content)
          ? b.content.map((c: any) => c.text || '').join('').slice(0, 60)
          : ''
        const extra = b.type === 'heading' && b.props?.level ? \` level=\${b.props.level}\` : ''
        return \`[Block ID: \${b.id}, Type: \${b.type}\${extra}] \${txt}\`
      })
      return \`[문서 블록 구조 목록 — 삽입 위치(afterBlockId) 선택 시 사용]\\n\` + lines.join('\\n')
    }

    if (selectedText) {
      return \`[선택한 부분 텍스트]\\n\${selectedText}\\n\\n[문서 내용 전체]\\n\${currentContent}\\n\\n\${buildBlockIndex()}\`
    }
    if (!useContext && !useFullFallback) return buildBlockIndex() || undefined

    return (currentContent ? currentContent + '\\n\\n' : '') + buildBlockIndex()
  }

  const getActiveMode = (queryText: string): 'write' | 'edit' | 'summary' | 'chat' => {
    if (manualMode !== 'auto') return manualMode as any
    const cleanInput = queryText.toLowerCase().trim()
    const summaryKeywords = ['요약', '정리', '줄여', 'summarize', 'summary', 'brief']
    if (summaryKeywords.some(k => cleanInput.includes(k))) return 'summary'
    const writeKeywords = [
      '써줘', '써', '작성', '보고서', '리포트', '문서 만들어', '글 써줘',
      '제목', '본문', '넣어줘', '넣어', '입력해', '추가해줘', '만들어줘',
      '생성해', '도입말', '서론', '결론', 'write', 'draft', 'create', 'compose', 'generate', 'insert',
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

  const handleSendAction = (text: string, isQuickAction = false) => {
    if (!text.trim()) return
    const finalContext = getContextWithRAG(text.trim(), isQuickAction)
    const resolvedMode = getActiveMode(text)

    onSend(text.trim(), finalContext, selectedText || undefined, activeBlockId, {
      apiType, gpuOnly, apiKey, modelPath, resolvedMode, isQuickAction
    })
  }

  return { getContextWithRAG, getActiveMode, handleSendAction }
}
`);

// 6. Master Hook: useAIPanelLogic
createHook('useAIPanelLogic', `
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
      props.setTaggedBlocks((prev: any) => prev.slice(0, prev.length - 1))
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
`);
