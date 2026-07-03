import React, { useState, useRef, useEffect } from 'react'
import {
  Bot, Send, Square, Trash2, Sparkles, ChevronDown,
  Mic, MicOff, Settings2, Copy, Check, X, AlertCircle,
  Wand2, Languages, FileText, Expand, Lightbulb
} from 'lucide-react'
import type { AIMessage } from '../hooks/useAI'

interface AIPanelProps {
  isOpen: boolean
  onClose: () => void
  messages: AIMessage[]
  isGenerating: boolean
  isAvailable: boolean
  models: { name: string; filename: string; path: string; size: number }[]
  settings: { modelPath: string; temperature: number; maxTokens: number; systemPrompt: string }
  onSend: (message: string, context?: string) => void
  onAbort: () => void
  onClear: () => void
  onUpdateSettings: (s: Partial<{ modelPath: string; temperature: number; maxTokens: number; systemPrompt: string }>) => void
  currentContent: string
  panelWidth?: number
  selectedText?: string
  onClearSelectedText?: () => void
  onApplySuggestion?: (text: string, mode: 'replace' | 'insert') => void
}

const QUICK_ACTIONS = [
  { id: 'summarize', icon: FileText, label: '요약', prompt: '현재 문서 내용을 핵심만 3줄로 요약해줘.' },
  { id: 'improve', icon: Wand2, label: '교정', prompt: '현재 문서의 문체와 표현을 자연스럽게 개선해줘.' },
  { id: 'translate', icon: Languages, label: '번역', prompt: '현재 문서를 영어로 번역해줘.' },
  { id: 'expand', icon: Expand, label: '확장', prompt: '현재 문서 내용을 더 풍부하게 확장해줘.' },
  { id: 'explain', icon: Lightbulb, label: '설명', prompt: '현재 문서의 핵심 개념을 쉽게 설명해줘.' },
]

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(0)}MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)}GB`
}

function MessageBubble({
  msg,
  onApplySuggestion,
  hasSelection,
}: {
  msg: AIMessage
  onApplySuggestion?: (text: string, mode: 'replace' | 'insert') => void
  hasSelection: boolean
}) {
  const [copied, setCopied] = useState(false)
  const isUser = msg.role === 'user'

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(msg.content)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {}
  }

  // AI 제안 코드/텍스트 추출
  let codeSnippet = ''
  if (msg.content.includes('```')) {
    const parts = msg.content.split('```')
    if (parts[1]) {
      const lines = parts[1].split('\n')
      // 첫 줄이 언어 식별자(javascript, py 등)인 경우 제거
      if (lines[0] && lines[0].trim().length < 15 && !lines[0].includes(' ') && !lines[0].includes('(')) {
        codeSnippet = lines.slice(1).join('\n').trim()
      } else {
        codeSnippet = parts[1].trim()
      }
    }
  }

  const textToApply = codeSnippet || msg.content.trim()

  if (msg.role === 'system') {
    return (
      <div style={{
        textAlign: 'center',
        padding: '4px 0',
        fontSize: '10px',
        color: 'var(--text-muted)',
      }}>
        {msg.content}
      </div>
    )
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: isUser ? 'row-reverse' : 'row',
      gap: '8px',
      alignItems: 'flex-start',
      marginBottom: '14px',
    }}>
      {/* 아바타 */}
      <div style={{
        width: '28px',
        height: '28px',
        borderRadius: '50%',
        flexShrink: 0,
        background: isUser
          ? 'linear-gradient(135deg, var(--primary), #7c3aed)'
          : 'linear-gradient(135deg, var(--secondary), #0891b2)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '12px',
        fontWeight: 700,
        color: '#fff',
        boxShadow: isUser ? '0 2px 8px var(--primary-glow)' : '0 2px 8px var(--secondary-glow)',
      }}>
        {isUser ? 'U' : <Bot size={14} />}
      </div>

      {/* 말풍선 */}
      <div style={{ maxWidth: '82%', position: 'relative' }}>
        <div style={{
          padding: '10px 12px',
          borderRadius: isUser ? '14px 4px 14px 14px' : '4px 14px 14px 14px',
          background: isUser
            ? 'linear-gradient(135deg, rgba(139,92,246,0.25), rgba(124,58,237,0.2))'
            : 'var(--bg-card)',
          border: `1px solid ${isUser ? 'rgba(139,92,246,0.35)' : 'var(--border-muted)'}`,
          fontSize: '13px',
          lineHeight: '1.6',
          color: msg.error ? '#f87171' : 'var(--text-main)',
          wordBreak: 'break-word',
          whiteSpace: 'pre-wrap',
          position: 'relative',
        }}>
          {msg.content}
          {msg.isStreaming && (
            <span style={{
              display: 'inline-block',
              width: '8px',
              height: '14px',
              background: 'var(--secondary)',
              marginLeft: '2px',
              verticalAlign: 'middle',
              borderRadius: '2px',
              animation: 'cursor-blink 0.8s step-end infinite',
            }} />
          )}
        </div>

        {/* 스마트 액션 버튼 그룹 */}
        {!isUser && !msg.isStreaming && msg.content && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            marginTop: '8px',
            padding: '0 2px',
            flexWrap: 'wrap',
          }}>
            {/* 복사 */}
            <button
              onClick={handleCopy}
              style={{
                background: 'var(--bg-glass)',
                border: '1px solid var(--border-muted)',
                cursor: 'pointer',
                color: copied ? '#10b981' : 'var(--text-muted)',
                display: 'flex',
                alignItems: 'center',
                gap: '3px',
                fontSize: '10px',
                padding: '3px 7px',
                borderRadius: '5px',
                transition: 'all 0.15s',
              }}
            >
              {copied ? <Check size={10} /> : <Copy size={10} />}
              {copied ? '복사됨' : '복사'}
            </button>

            {/* 에디터 커서 삽입 */}
            {onApplySuggestion && (
              <button
                onClick={() => onApplySuggestion(textToApply, 'insert')}
                style={{
                  background: 'rgba(139,92,246,0.1)',
                  border: '1px solid rgba(139,92,246,0.25)',
                  cursor: 'pointer',
                  color: 'var(--primary)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '3px',
                  fontSize: '10px',
                  padding: '3px 7px',
                  borderRadius: '5px',
                  transition: 'all 0.15s',
                }}
              >
                ➕ 커서에 삽입
              </button>
            )}

            {/* 선택 교체 */}
            {onApplySuggestion && (
              <button
                onClick={() => onApplySuggestion(textToApply, 'replace')}
                disabled={!hasSelection}
                style={{
                  background: hasSelection ? 'rgba(6,182,212,0.12)' : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${hasSelection ? 'rgba(6,182,212,0.3)' : 'var(--border-muted)'}`,
                  cursor: hasSelection ? 'pointer' : 'not-allowed',
                  color: hasSelection ? 'var(--secondary)' : 'var(--text-muted)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '3px',
                  fontSize: '10px',
                  padding: '3px 7px',
                  borderRadius: '5px',
                  transition: 'all 0.15s',
                  opacity: hasSelection ? 1 : 0.45,
                }}
                title={hasSelection ? '에디터 선택 영역과 교체합니다' : '에디터에서 영역을 드래그하면 교체할 수 있습니다'}
              >
                ✏️ 선택교체
              </button>
            )}
          </div>
        )}

        {/* 타임스탬프 */}
        <div style={{
          fontSize: '9px',
          color: 'var(--text-dark)',
          marginTop: '6px',
          textAlign: isUser ? 'right' : 'left',
        }}>
          {new Date(msg.timestamp).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>
    </div>
  )
}

export function AIPanel({
  isOpen, onClose, messages, isGenerating, isAvailable,
  models, settings, onSend, onAbort, onClear,
  onUpdateSettings, currentContent, panelWidth = 320,
  selectedText = '',
  onClearSelectedText,
  onApplySuggestion,
}: AIPanelProps) {
  const [input, setInput] = useState('')
  const [showSettings, setShowSettings] = useState(false)
  const [useContext, setUseContext] = useState(true) // 기본으로 켬
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages])

  const handleSend = () => {
    if (!input.trim() || isGenerating) return

    // 선택 영역이 있으면 우선적 콘셉트 제공, 없으면 전체 문서 포함 여부 참조
    const finalContext = selectedText
      ? `[선택한 부분 텍스트]\n${selectedText}\n\n[문서 내용 전체]\n${currentContent}`
      : (useContext ? currentContent : undefined)

    onSend(input.trim(), finalContext)
    setInput('')
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleQuickAction = (prompt: string) => {
    if (isGenerating) return
    const finalContext = selectedText
      ? `[선택한 부분 텍스트]\n${selectedText}\n\n[문서 내용 전체]\n${currentContent}`
      : currentContent
    onSend(prompt, finalContext)
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
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '13px', fontWeight: 700, letterSpacing: '0.3px' }}>
            AMEVA <span style={{ color: 'var(--primary)' }}>AI</span>
          </div>
          <div style={{ fontSize: '9px', color: 'var(--text-muted)' }}>
            {isAvailable
              ? `Local LLM · ${models.find(m => m.path === settings.modelPath)?.name || '모델 미선택'}`
              : '로컬 LLM 미설치'
            }
          </div>
        </div>
        <button
          onClick={() => setShowSettings(!showSettings)}
          style={{
            background: showSettings ? 'var(--bg-glass-active)' : 'transparent',
            border: 'none', cursor: 'pointer',
            color: 'var(--text-muted)', display: 'flex', alignItems: 'center',
            padding: '4px', borderRadius: '5px', transition: 'all 0.15s',
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
          }}
        >
          <X size={14} />
        </button>
      </div>

      {/* 설정 패널 */}
      {showSettings && (
        <div style={{
          padding: '12px 16px',
          borderBottom: '1px solid var(--border-muted)',
          background: 'var(--bg-glass-active)',
          display: 'flex', flexDirection: 'column', gap: '10px',
          flexShrink: 0,
        }}>
          {/* 모델 선택 */}
          <div>
            <label style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
              모델 선택
            </label>
            {models.length === 0 ? (
              <div style={{
                padding: '8px', borderRadius: '6px',
                background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
                fontSize: '11px', color: '#f87171',
                display: 'flex', alignItems: 'center', gap: '6px',
              }}>
                <AlertCircle size={12} />
                C:\ameva\models\llm 에 .gguf 모델 없음
              </div>
            ) : (
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
            )}
          </div>

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

          {/* llama.cpp 설치 안내 */}
          {!isAvailable && (
            <div style={{
              padding: '8px', borderRadius: '6px',
              background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.3)',
              fontSize: '10px', color: 'var(--text-muted)',
            }}>
              💡 AI 사용을 위해 llama.cpp를 설치하세요:<br />
              C:\ameva\llama\llama-cli.exe
            </div>
          )}
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

      {/* 메시지 목록 */}
      {messages.length > 0 && (
        <div style={{
          flex: 1, overflowY: 'auto',
          padding: '14px 12px',
          display: 'flex', flexDirection: 'column',
        }}>
          {messages.map(msg => (
            <MessageBubble
              key={msg.id}
              msg={msg}
              onApplySuggestion={onApplySuggestion}
              hasSelection={!!selectedText}
            />
          ))}
          <div ref={messagesEndRef} />
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
        <div style={{ display: 'flex', alignItems: 'center', justifyCommand: 'space-between', justifyContent: 'space-between' }}>
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
            placeholder={isAvailable ? '메시지를 입력하세요... (Shift+Enter: 줄바꿈)' : 'llama.cpp 설치 필요'}
            disabled={!isAvailable}
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
              <Square size={14} />
            </button>
          ) : (
            <button
              onClick={handleSend}
              disabled={!input.trim() || !isAvailable}
              style={{
                width: '36px', height: '36px', borderRadius: '8px',
                background: input.trim() && isAvailable
                  ? (selectedText ? 'linear-gradient(135deg, var(--secondary), #0891b2)' : 'linear-gradient(135deg, var(--primary), #7c3aed)')
                  : 'rgba(255,255,255,0.05)',
                border: '1px solid transparent',
                color: '#fff', cursor: input.trim() && isAvailable ? 'pointer' : 'not-allowed',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
                boxShadow: input.trim() && isAvailable ? (selectedText ? '0 2px 8px var(--secondary-glow)' : '0 2px 8px var(--primary-glow)') : 'none',
                transition: 'all 0.15s',
                opacity: input.trim() && isAvailable ? 1 : 0.4,
              }}
              title="전송 (Enter)"
            >
              <Send size={14} />
            </button>
          )}
        </div>
      </div>

      <style>{`
        @keyframes cursor-blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
      `}</style>
    </div>
  )
}
