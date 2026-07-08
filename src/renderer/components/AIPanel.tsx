
import { useRef } from 'react'
import { FileText, Wand2, Languages, Expand, Lightbulb } from 'lucide-react'
import { useAIPanelLogic } from '../hooks/ai/useAIPanelLogic'
import { AIChatList } from './ai-panel/AIChatList'
import { AIPanelHeader } from './ai/AIPanelHeader'
import { AIInputBar } from './ai/AIInputBar'
import { AIWelcomeScreen } from './ai/AIWelcomeScreen'
import { AIDownloadProgress } from './ai/AIDownloadProgress'
import { AIInputContextBar } from './ai/AIInputContextBar'
import { AIDocumentOutline } from './ai/AIDocumentOutline'
import { AIPluginViews } from './ai/AIPluginViews'

const QUICK_ACTIONS = [
  { id: 'summarize', icon: FileText, label: '요약', prompt: '이 문서를 세 문장으로 요약해줘.' },
  { id: 'improve', icon: Wand2, label: '개선', prompt: '더 자연스럽고 전문적인 표현으로 다듬어줘.' },
  { id: 'translate', icon: Languages, label: '번역', prompt: '이 문서를 영어로 번역해줘.' },
  { id: 'expand', icon: Expand, label: '확장', prompt: '이 문장의 내용을 좀 더 풍성하게 확장해줘.' },
  { id: 'explain', icon: Lightbulb, label: '설명', prompt: '이 개념을 쉽게 풀어서 설명해줘.' },
]

import { useUIStore } from '../stores/useUIStore'
import { useWorkspaceStore } from '../stores/useWorkspaceStore'
import { useProcessStore } from '../stores/useProcessStore'
import { useAI } from '../hooks/useAI'
import { useAppContext } from '../contexts/AppContext'
import { useAppAISuggestions } from '../hooks/app/useAppAISuggestions'

export function AIPanel() {
  const { showAIPanel: isOpen, setShowAIPanel, activeRightTab: activeTab, setIsSettingsOpen, showModelHub, setShowModelHub } = useUIStore()
  const { currentContent, selectedText, setSelectedText, activeBlockId, taggedBlocks, setTaggedBlocks } = useWorkspaceStore()
  const { downloadStatus, setDownloadStatus, aiPanelWidth: panelWidth = 320 } = useProcessStore()
  
  const {
    messages, isGenerating, isAvailable, models, settings,
    generateResponse, abortGeneration, clearHistory, updateSettings,
    updateMessageDiffState, updateInsertSuggestionStatus, engineLogs, setEngineLogs,
    refreshModels, importModel, pendingQueue, removeFromQueue
  } = useAI()
  
  const { editor } = useAppContext()
  const blocks = editor?.document || []
  
  const { handleApplySuggestion, handleApplyInsertSuggestion } = useAppAISuggestions(editor, updateInsertSuggestionStatus)
  const onApplySuggestion = handleApplySuggestion
  const onApplyInsertSuggestion = handleApplyInsertSuggestion
  const onUpdateDiffState = updateMessageDiffState
  const onUpdateInsertSuggestionStatus = updateInsertSuggestionStatus
  const onClearSelectedText = () => setSelectedText('')
  const onOpenGlobalSettings = (tab: any) => setIsSettingsOpen(true, tab)
  const onClose = () => setShowAIPanel(false)
  const onClear = clearHistory
  
  const onSend = (msg: string, ctx?: string, orig?: string, bId?: string, runtimeSettings?: any) => {
    generateResponse(msg, ctx, orig, bId, runtimeSettings, editor, taggedBlocks)
    setTaggedBlocks([])
  }

  // Pack the props for useAIPanelLogic to avoid changing it entirely yet
  const logicProps = {
    messages, engineLogs, taggedBlocks, isOpen, settings,
    blocks, currentContent, selectedText, activeBlockId,
    onSend, showModelHub, refreshModels, setDownloadStatus,
    onUpdateSettings: updateSettings, setTaggedBlocks
  }

  const {
    input, setInput, manualMode, setManualMode, useContext, setUseContext, gpuName,
    textareaRef, messagesContainerRef, messagesEndRef,
    handleSend, handleKeyDown, handleQuickAction
  } = useAIPanelLogic(logicProps)

  if (!isOpen) return null
  const isWhiteTheme = settings.theme === 'white'
  const displayModelLabel = settings.apiModel || (gpuName ? `GPU: ${gpuName}` : 'auto')

  return (
    <div 
      className={`ai-panel ${isAIPanelDragging ? 'dragging' : ''}`}
      onDragOver={(e) => {
        e.preventDefault()
        e.dataTransfer.dropEffect = 'copy'
      }}
      onDrop={(e) => {
        e.preventDefault()
        let url = e.dataTransfer.getData('text/uri-list') || e.dataTransfer.getData('text/plain')
        if (url) {
          setInput((prev: string) => prev + (prev ? ' ' : '') + url.trim())
        }
      }}
      style={{
      width: `${panelWidth}px`, height: '100%',
      background: 'var(--bg-main)', borderLeft: '1px solid var(--border-muted)',
      display: 'flex', flexDirection: 'column', position: 'relative',
      fontFamily: 'var(--font-sans)', zIndex: 100, transition: 'width 0.3s ease'
    }}>
      <AIPanelHeader 
        title={settings.apiType === 'wasm' ? 'Local Edge' : settings.apiType === 'local' ? 'Native Core' : settings.apiType === 'ollama' ? 'Ollama' : 'Cloud API'}
        providerLabel={settings.apiType === 'api' ? (settings.apiProvider === 'gemini' ? 'Google Gemini' : settings.apiProvider === 'anthropic' ? 'Anthropic Claude' : 'OpenAI GPT') : (settings.apiType === 'local' ? 'Llama.cpp' : settings.apiType === 'ollama' ? 'Local Server' : 'WebGPU')}
        modelLabel={displayModelLabel}
        isGenerating={isGenerating}
        onOpenSettings={() => onOpenGlobalSettings?.('AIEngine')}
        onClearMessages={onClear}
        onClose={onClose}
      />

      {activeTab === 'ai' && (
        <>
          {messages.length === 0 ? (
            <AIWelcomeScreen QUICK_ACTIONS={QUICK_ACTIONS} isAvailable={isAvailable} onAction={handleQuickAction} />
          ) : (
            <div ref={messagesContainerRef} style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column' }}>
              <AIChatList
                messages={messages}
                messagesContainerRef={messagesContainerRef}
                messagesEndRef={messagesEndRef}
                onApplySuggestion={onApplySuggestion}
                onUpdateDiffState={onUpdateDiffState}
                onApplyInsertSuggestion={onApplyInsertSuggestion}
                onUpdateInsertSuggestionStatus={onUpdateInsertSuggestionStatus}
                isWhiteTheme={isWhiteTheme}
                blocks={blocks}
                selectedText={selectedText}
              />
              <div ref={messagesEndRef} />
            </div>
          )}


          
          <AIDownloadProgress 
            downloadStatus={downloadStatus} 
            onCancel={() => {}} 
            onShowDetails={() => {}} 
          />

          <div style={{ padding: '12px 14px', borderTop: '1px solid var(--border-muted)', background: 'var(--bg-main)' }}>
            <AIInputContextBar
              manualMode={manualMode} setManualMode={setManualMode}
              selectedText={selectedText} onClearSelectedText={onClearSelectedText}
              useContext={useContext} setUseContext={setUseContext}
              taggedBlocks={taggedBlocks} setTaggedBlocks={setTaggedBlocks}
              pendingQueue={pendingQueue} removeFromQueue={removeFromQueue}
              models={models} apiModel={settings.apiModel} onModelChange={() => {}}
            />
            
            <AIInputBar
              value={input}
              disabled={!isAvailable}
              isGenerating={isGenerating}
              placeholder={isAvailable ? '메시지를 입력하세요...' : '준비중...'}
              textareaRef={textareaRef}
              onChange={setInput}
              onSubmit={handleSend}
              onAbort={abortGeneration}
              onKeyDown={handleKeyDown}
              selectedText={selectedText}
            />
          </div>
        </>
      )}

      {activeTab === 'outline' && <AIDocumentOutline blocks={blocks} />}

      {activeTab !== 'ai' && activeTab !== 'outline' && (
        <AIPluginViews activeTab={activeTab} />
      )}
    </div>
  )
}
