import React from 'react'
import { Send, Check } from 'lucide-react'

export interface AIInputBarProps {
  value: string
  disabled: boolean
  isGenerating: boolean
  placeholder?: string
  textareaRef?: React.RefObject<HTMLTextAreaElement | null>
  onChange: (value: string) => void
  onSubmit: () => void
  onAbort: () => void
  onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void
  selectedText?: string
}

export function AIInputBar({
  value,
  disabled,
  isGenerating,
  placeholder = '메시지를 입력하세요...',
  textareaRef,
  onChange,
  onSubmit,
  onAbort,
  onKeyDown,
  selectedText
}: AIInputBarProps) {
  console.debug("Unused vars (AIInputBar):", { Check });
  return (
    <div
      data-focus-region="ai-input"
      style={{ display: 'flex', gap: '6px', alignItems: 'flex-end', position: 'relative', borderRadius: '10px' }}
    >
      <textarea
        ref={textareaRef as any}
        value={value}
        onChange={e => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        disabled={disabled}
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
            background: 'var(--bg-glass-active)',
            border: '1px solid var(--border-muted)',
            borderRadius: '8px', padding: '10px',
            color: 'var(--text-main)', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
            boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
          }}
          title="중지"
        >
          <div style={{ width: '12px', height: '12px', background: '#ef4444', borderRadius: '2px' }} />
        </button>
      ) : (
        <button
          onClick={onSubmit}
          disabled={disabled || !value.trim()}
          style={{
            background: (disabled || !value.trim()) ? 'var(--bg-glass-active)' : 'linear-gradient(135deg, var(--primary), var(--secondary))',
            border: 'none',
            borderRadius: '8px', padding: '10px',
            color: '#fff',
            cursor: (disabled || !value.trim()) ? 'not-allowed' : 'pointer',
            opacity: (disabled || !value.trim()) ? 0.5 : 1,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
            boxShadow: (disabled || !value.trim()) ? 'none' : '0 2px 10px var(--primary-glow)',
            transition: 'all 0.2s'
          }}
        >
          <Send size={16} />
        </button>
      )}
    </div>
  )
}
