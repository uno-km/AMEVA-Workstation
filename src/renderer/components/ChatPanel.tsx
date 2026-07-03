import React, { useState, useRef, useEffect } from 'react'
import { Send, MessageCircle, Wifi, WifiOff, Trash2 } from 'lucide-react'
import type { ChatMessage } from '../hooks/useChat'

interface ChatPanelProps {
  messages: ChatMessage[]
  onSend: (content: string) => void
  onClear: () => void
  username: string
  userColor: string
  serverRunning: boolean
}

export function ChatPanel({
  messages,
  onSend,
  onClear,
  username,
  userColor,
  serverRunning,
}: ChatPanelProps) {
  const [input, setInput] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages])

  const handleSend = () => {
    if (!input.trim() || !serverRunning) return
    onSend(input.trim())
    setInput('')
    inputRef.current?.focus()
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      overflow: 'hidden',
    }}>
      {/* 채팅 헤더 */}
      <div style={{
        padding: '10px 16px 8px',
        borderBottom: '1px solid var(--border-muted)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <MessageCircle size={13} style={{ color: 'var(--secondary)' }} />
          <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-main)' }}>실시간 채팅</span>
          <div style={{
            display: 'flex', alignItems: 'center', gap: '3px',
            fontSize: '9px', padding: '1px 5px', borderRadius: '10px',
            background: serverRunning ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
            color: serverRunning ? 'var(--success)' : 'var(--danger)',
          }}>
            {serverRunning ? <Wifi size={8} /> : <WifiOff size={8} />}
            {serverRunning ? '연결됨' : '오프라인'}
          </div>
        </div>
        {messages.length > 0 && (
          <button
            onClick={onClear}
            style={{
              background: 'transparent', border: 'none', cursor: 'pointer',
              color: 'var(--text-muted)', display: 'flex', alignItems: 'center', padding: '2px',
            }}
            title="채팅 지우기"
          >
            <Trash2 size={11} />
          </button>
        )}
      </div>

      {/* 메시지 목록 */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '10px 12px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
      }}>
        {messages.length === 0 ? (
          <div style={{
            flex: 1, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            color: 'var(--text-muted)', fontSize: '11px', textAlign: 'center',
            gap: '6px', padding: '20px 0',
          }}>
            <MessageCircle size={24} style={{ opacity: 0.3 }} />
            <span>
              {serverRunning
                ? '아직 메시지가 없습니다.\n첫 메시지를 보내보세요!'
                : '협업 서버를 실행하면\n채팅이 활성화됩니다.'
              }
            </span>
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.author === username
            const isSystem = msg.type === 'system'

            if (isSystem) {
              return (
                <div
                  key={msg.id}
                  style={{
                    textAlign: 'center',
                    fontSize: '10px',
                    color: 'var(--text-muted)',
                    padding: '2px 0',
                  }}
                >
                  {msg.content}
                </div>
              )
            }

            return (
              <div
                key={msg.id}
                style={{
                  display: 'flex',
                  flexDirection: isMe ? 'row-reverse' : 'row',
                  gap: '6px',
                  alignItems: 'flex-end',
                }}
              >
                {/* 아바타 */}
                {!isMe && (
                  <div style={{
                    width: '22px', height: '22px', borderRadius: '50%',
                    backgroundColor: msg.color,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '9px', fontWeight: 800, color: '#fff',
                    flexShrink: 0,
                  }}>
                    {msg.author.charAt(0).toUpperCase()}
                  </div>
                )}

                <div style={{ maxWidth: '80%', display: 'flex', flexDirection: 'column', gap: '2px', alignItems: isMe ? 'flex-end' : 'flex-start' }}>
                  {!isMe && (
                    <span style={{ fontSize: '9px', color: msg.color, fontWeight: 600, paddingLeft: '2px' }}>
                      {msg.author}
                    </span>
                  )}
                  <div style={{
                    padding: '7px 10px',
                    borderRadius: isMe ? '12px 4px 12px 12px' : '4px 12px 12px 12px',
                    background: isMe
                      ? `linear-gradient(135deg, ${userColor}33, ${userColor}22)`
                      : 'var(--bg-glass)',
                    border: `1px solid ${isMe ? `${userColor}44` : 'var(--border-muted)'}`,
                    fontSize: '12px',
                    color: 'var(--text-main)',
                    wordBreak: 'break-word',
                    lineHeight: '1.4',
                  }}>
                    {msg.content}
                  </div>
                  <span style={{ fontSize: '9px', color: 'var(--text-dark)', paddingLeft: '2px', paddingRight: '2px' }}>
                    {new Date(msg.timestamp).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            )
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* 입력 영역 */}
      <div
        data-focus-region="chat-input"
        style={{
          padding: '8px 12px',
          borderTop: '1px solid var(--border-muted)',
          display: 'flex',
          gap: '6px',
          alignItems: 'center',
          flexShrink: 0,
          position: 'relative',
          borderRadius: '0 0 8px 8px',
        }}
      >
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={serverRunning ? '메시지 입력...' : '서버 오프라인'}
          disabled={!serverRunning}
          style={{
            flex: 1,
            background: 'var(--bg-glass)',
            border: '1px solid var(--border-muted)',
            borderRadius: '20px',
            padding: '6px 12px',
            color: 'var(--text-main)',
            fontSize: '12px',
            outline: 'none',
            transition: 'border-color 0.15s',
            opacity: serverRunning ? 1 : 0.5,
          }}
          onFocus={e => (e.target.style.borderColor = 'var(--secondary)')}
          onBlur={e => (e.target.style.borderColor = 'var(--border-muted)')}
        />
        <button
          onClick={handleSend}
          disabled={!input.trim() || !serverRunning}
          style={{
            width: '30px', height: '30px', borderRadius: '50%',
            background: input.trim() && serverRunning
              ? 'linear-gradient(135deg, var(--secondary), #0891b2)'
              : 'var(--bg-glass)',
            border: 'none',
            color: '#fff', cursor: input.trim() && serverRunning ? 'pointer' : 'not-allowed',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
            transition: 'all 0.15s',
            opacity: input.trim() && serverRunning ? 1 : 0.4,
            boxShadow: input.trim() && serverRunning ? '0 2px 8px var(--secondary-glow)' : 'none',
          }}
        >
          <Send size={13} />
        </button>
      </div>
    </div>
  )
}
