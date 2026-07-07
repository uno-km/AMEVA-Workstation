
import React from 'react'
import { FileText, Wand2, Languages, Expand, Lightbulb } from 'lucide-react'
import { useAIPanelLogic } from '../hooks/ai/useAIPanelLogic'
import { AIChatList } from './ai-panel/AIChatList'
import { AIPanelHeader } from './ai/AIPanelHeader'
import { AISettingsPanel } from './ai/AISettingsPanel'
import { AIInputBar } from './ai/AIInputBar'
import { AIWelcomeScreen } from './ai/AIWelcomeScreen'
import { AILogDrawer } from './ai/AILogDrawer'
import { AIDownloadProgress } from './ai/AIDownloadProgress'
import { AIModelHubModal } from './ai/AIModelHubModal'
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

export function AIPanel(props: any) {
  const {
    input, setInput,
    manualMode, setManualMode,
    useContext, setUseContext,
    isLogsExpanded, setIsLogsExpanded,
    showSettings, setShowSettings,
    gpuName,
    isKeySaved,
    textareaRef, messagesContainerRef, messagesEndRef, logContainerRef, logEndRef,
    handleSaveKey, handleDeleteKey, handleApiKeyChange,
    handleDownloadModel,
    handleSend, handleKeyDown, handleQuickAction
  } = useAIPanelLogic(props)

  const {
    isOpen, onClose, messages, isGenerating, isAvailable,
    models, settings, panelWidth = 320,
    selectedText, onClearSelectedText,
    onApplySuggestion, onUpdateDiffState,
    onApplyInsertSuggestion, onUpdateInsertSuggestionStatus,
    blocks, activeTab = 'ai',
    showModelHub, setShowModelHub,
    downloadStatus,
    taggedBlocks, setTaggedBlocks,
    pendingQueue, removeFromQueue,
    importModel,
  } = props

  if (!isOpen) return null

  const isWhiteTheme = settings.theme === 'white'
  const displayModelLabel = settings.apiModel || (gpuName ? `GPU: ${gpuName}` : 'auto')

  return (
    <div style={{
      width: `${panelWidth}px`, height: '100%',
      background: 'var(--bg-main)', borderLeft: '1px solid var(--border-muted)',
      display: 'flex', flexDirection: 'column', position: 'relative',
      fontFamily: 'var(--font-sans)', zIndex: 100, transition: 'width 0.3s ease'
    }}>
      <AIPanelHeader 
        title={settings.apiType === 'wasm' ? 'Local Edge' : 'Cloud API'}
        providerLabel={settings.apiProvider === 'gemini' ? 'Google Gemini' : settings.apiProvider === 'anthropic' ? 'Anthropic Claude' : 'OpenAI GPT'}
        modelLabel={displayModelLabel}
        isGenerating={isGenerating}
        showSettings={showSettings}
        onOpenSettings={() => setShowSettings(!showSettings)}
        onClearMessages={props.onClear}
        onClose={onClose}
      />

      {showSettings && (
        <AISettingsPanel
          settings={settings}
          onUpdateSettings={props.onUpdateSettings}
          models={models}
          isKeySaved={isKeySaved}
          handleApiKeyChange={handleApiKeyChange}
          handleSaveKey={handleSaveKey}
          handleDeleteKey={handleDeleteKey}
          onClose={() => setShowSettings(false)}
        />
      )}

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

          <AILogDrawer 
            isExpanded={isLogsExpanded} 
            onToggle={() => setIsLogsExpanded(!isLogsExpanded)} 
            logContainerRef={logContainerRef}
            logEndRef={logEndRef} 
          />
          
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
              onAbort={props.onAbort}
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

      <AIModelHubModal 
        show={showModelHub} 
        onClose={() => setShowModelHub?.(false)} 
        models={models} 
        onDownload={handleDownloadModel} 
        downloadStatus={downloadStatus} 
        importModel={importModel} 
      />
    </div>
  )
}
