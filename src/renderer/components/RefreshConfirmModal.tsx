import { useEffect } from 'react'
import { RotateCw } from 'lucide-react'

export interface RefreshConfirmModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
}

export function RefreshConfirmModal({ isOpen, onClose, onConfirm }: RefreshConfirmModalProps) {
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'Enter') onConfirm()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose, onConfirm])

  if (!isOpen) return null

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 99999
    }} onClick={onClose}>
      <div style={{
        background: '#16161a', border: '1px solid #2e2e38',
        borderRadius: '12px', width: '400px', padding: '24px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)', display: 'flex',
        flexDirection: 'column', gap: '16px'
      }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(59, 130, 246, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <RotateCw size={20} color="#3b82f6" />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: '16px', color: '#fff' }}>새로고침 하시겠습니까?</h2>
            <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#9ca3af' }}>모든 임시 작업이 초기화되며 최초 화면으로 이동합니다.</p>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '8px' }}>
          <button onClick={onClose} style={{
            padding: '8px 16px', background: 'transparent', border: '1px solid #3f3f46',
            borderRadius: '6px', color: '#d1d5db', cursor: 'pointer', fontSize: '13px'
          }}>취소 (Esc)</button>
          <button onClick={onConfirm} style={{
            padding: '8px 16px', background: '#3b82f6', border: 'none',
            borderRadius: '6px', color: '#fff', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold'
          }}>새로고침 (Enter)</button>
        </div>
      </div>
    </div>
  )
}
