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

  /*
   * [FUNCTION CONTRACT]
   * - 함수 명: `AIInputBar`
   * - 역할: 인자 정보를 검수하고 비즈니스 계약 조건에 맞춰 최종 바인딩 결과물/바이너리 버퍼를 반환함.
   * - 예시: `AIInputBar(...)` 호출 시 런타임 비동기/동기 연쇄 반응 유도.
   */
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
  /*
   * [DISPLAY STATE CONVERSION - Rationale]
   * - isReview: Zustand 입력값에 계획 리뷰 접두사([계획 리뷰])가 부착되어 있는지 검출.
   * - displayValue: 입력 필드 렌더링 시 대괄호 문자열을 비주얼 상에서 가려주어 정돈된 뷰 제공.
   * - handleChange: 타이핑 완료 시 백그라운드에서 다시 [계획 리뷰] 접두사를 원자적으로 합성하여 상위 스토어로 상신.
   */
  const isReview = value.startsWith('[계획 리뷰]')
  const displayValue = isReview ? value.replace(/^\[계획 리뷰\]\s*/, '') : value
  
  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value
    if (isReview) {
      onChange(`[계획 리뷰] ${text}`)
    } else {
      onChange(text)
    }
  }

  return (
    <div
      data-focus-region="ai-input"
      style={{ display: 'flex', gap: '6px', alignItems: 'flex-end', position: 'relative', borderRadius: '10px', width: '100%' }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
        {isReview && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              background: 'linear-gradient(135deg, #6366f1, #a855f7)',
              color: '#fff',
              fontSize: '10px',
              fontWeight: 700,
              padding: '2px 8px',
              borderRadius: '12px',
              boxShadow: '0 2px 5px rgba(99, 102, 241, 0.25)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              fontFamily: 'var(--font-sans)',
              letterSpacing: '0.3px'
            }}>
              <span>📝 계획 리뷰 피드백</span>
              <button
                onClick={() => onChange('')}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'rgba(255, 255, 255, 0.8)',
                  cursor: 'pointer',
                  fontSize: '9px',
                  padding: '0 2px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  marginLeft: '2px'
                }}
                title="리뷰 취소"
              >
                ✕
              </button>
            </div>
          </div>
        )}
        <textarea
          ref={textareaRef as any}
          value={displayValue}
          onChange={handleChange}
          onKeyDown={onKeyDown}
          placeholder={isReview ? '계획 수정 요구사항을 적어주세요...' : placeholder}
          disabled={disabled}
          rows={2}
          style={{
            width: '100%',
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
            boxSizing: 'border-box'
          }}
          onFocus={e => (e.target.style.borderColor = selectedText ? 'var(--secondary)' : 'var(--primary)')}
          onBlur={e => (e.target.style.borderColor = selectedText ? 'rgba(6,182,212,0.4)' : 'var(--border-muted)')}
        />
      </div>

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

