/**
 * @file BaseModal.tsx
 * @system AMEVA OS Desktop Workstation
 * @location src/renderer/components/ui/modals/BaseModal.tsx
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
import { X } from 'lucide-react'

export interface BaseModalProps {
  isOpen: boolean
  onClose: () => void
  title?: React.ReactNode
  icon?: React.ReactNode
  children: React.ReactNode
  footer?: React.ReactNode
  width?: string | number
  height?: string | number
  style?: React.CSSProperties
  className?: string
  headerExtra?: React.ReactNode
  hideHeader?: boolean
  onMouseDown?: (e: React.MouseEvent) => void
}

export function BaseModal({
  isOpen,
  onClose,
  title,
  icon,
  children,
  footer,
  width = '90%',
  height,
  style,
  className = '',
  headerExtra,
  hideHeader,
  onMouseDown
}: BaseModalProps) {
  if (!isOpen) return null

  return (
    <div
      className={`glass-panel glow-primary ${className}`}
      style={{
        width: typeof width === 'number' ? `${width}px` : width,
        height: typeof height === 'number' ? `${height}px` : height,
        borderRadius: '16px',
        border: '1px solid var(--border-glow)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 25px 60px rgba(139, 92, 246, 0.35)',
        color: 'var(--text-main)',
        ...style
      }}
    >
      {/* 헤더 */}
      {!hideHeader && (
        <div
          onMouseDown={onMouseDown}
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid var(--border-muted)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            backgroundColor: 'var(--bg-glass-active)',
            cursor: onMouseDown ? 'move' : 'default',
            userSelect: 'none'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--primary)' }}>
            {icon}
            {title && (
              <h3 style={{ fontSize: '16px', fontWeight: 800, fontFamily: 'var(--font-sans)', margin: 0 }}>
                {title}
              </h3>
            )}
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {headerExtra}
            <button
              onClick={onClose}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-main)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '4px'
              }}
            >
              <X size={20} />
            </button>
          </div>
        </div>
      )}

      {/* 바디 */}
      <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
        {children}
      </div>

      {/* 푸터 */}
      {footer && (
        <div
          style={{
            padding: '16px 24px',
            borderTop: '1px solid var(--border-muted)',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '12px',
            backgroundColor: 'var(--bg-glass-active)'
          }}
        >
          {footer}
        </div>
      )}
    </div>
  )
}
