import { useEffect, useState } from 'react'
import { AlertTriangle } from 'lucide-react'

interface QuitConfirmModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
}

export function QuitConfirmModal({ isOpen, onClose, onConfirm }: QuitConfirmModalProps) {
  const [isRendered, setIsRendered] = useState(false)
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setIsRendered(true)
      setTimeout(() => setIsVisible(true), 10)
    } else {
      setIsVisible(false)
      const timer = setTimeout(() => setIsRendered(false), 200)
      return () => clearTimeout(timer)
    }
  }, [isOpen])

  if (!isRendered) return null

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'var(--bg-glass)', backdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 99999, opacity: isVisible ? 1 : 0, transition: 'opacity 0.2s ease',
      WebkitAppRegion: 'no-drag'
    } as any}>
      <div 
        style={{
          background: 'var(--bg-main)', border: '1px solid var(--border-muted)',
          borderRadius: '12px', padding: '24px', width: '380px',
          boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
          transform: isVisible ? 'scale(1)' : 'scale(0.95)',
          transition: 'transform 0.2s ease'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
          <div style={{ padding: '10px', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '50%', color: '#ef4444' }}>
            <AlertTriangle size={24} />
          </div>
          <div>
            <h2 style={{ margin: '0 0 4px', fontSize: '16px', fontWeight: 700, color: 'var(--text-main)' }}>정말 종료하시겠습니까?</h2>
            <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-muted)' }}>저장하지 않은 작업 내용이 모두 지워집니다.</p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '24px' }}>
          <button
            onClick={onClose}
            style={{
              padding: '8px 16px', background: 'var(--bg-glass-active)', border: '1px solid var(--border-muted)',
              color: 'var(--text-main)', borderRadius: '6px', fontSize: '13px', cursor: 'pointer', fontWeight: 600
            }}
          >
            취소
          </button>
          <button
            onClick={onConfirm}
            style={{
              padding: '8px 16px', background: '#ef4444', border: '1px solid #dc2626',
              color: '#fff', borderRadius: '6px', fontSize: '13px', cursor: 'pointer', fontWeight: 600
            }}
          >
            강제 종료
          </button>
        </div>
      </div>
    </div>
  )
}
