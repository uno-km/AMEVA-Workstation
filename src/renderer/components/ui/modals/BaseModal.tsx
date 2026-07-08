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
