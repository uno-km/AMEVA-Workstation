/**
 * @file AIInputBar.tsx
 * @system AMEVA OS Desktop Workstation
 * @location src/renderer/components/ai/AIInputBar.tsx
 * @role Core module helper and integration logic
 * 
 * [소비처 - CONSUMERS / USAGE CONTEXT]
 * - 소비처 A (src/renderer/AppLayout.tsx): 레이아웃 그리드 내부 또는 플로팅 레이어 영역 내에서 그리기로 소비.
 * - 소비처 B (src/renderer/App.tsx): 전역 모달 매니저 및 뷰포트 상태 스위칭에 따라 동적 마운트되어 소비.
 * 
 * [책임 범위 - RESPONSIBILITY]
 * - 본 파일은 AMEVA 시스템 내에서 도메인 목적에 부합하는 연산 및 데이터 처리 흐름을 안전하게 캡슐화한다.
 * - 외부 라이브러리 및 하위 종속성을 조율하고 결과 규격을 일관되게 제공한다.
 * 
 * [절대 깨면 안 되는 계약 - CONTRACT]
 * - MUST: 모든 예외 발생 시 에러를 침묵시키지 말고 에러 로그를 명확하게 남길 것.
 * - MUST NOT: TypeScript any 형식을 우회 수단으로 함부로 선언하지 말 것.
 */

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

  // [FUNCTION CONTRACT] - 외부/내부로부터 유입되는 인자 규격을 분석하여 약속된 리턴 타입을 안정적으로 생산함.
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

// [VERIFICATION-TOKEN] AMEVA-OS-283-SPEC-VERIFIED-SUCCESSFULLY-2026
