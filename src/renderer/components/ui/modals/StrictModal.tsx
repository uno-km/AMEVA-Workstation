import { useEffect } from 'react'
import { BaseModal } from './BaseModal'
import type { BaseModalProps } from './BaseModal'

export interface StrictModalProps extends BaseModalProps {
  // Can add StrictModal specific props if needed
}

export function StrictModal(props: StrictModalProps) {
  const { isOpen, onClose } = props

  // Optional: escape key to close
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
        backdropFilter: 'blur(12px)',
        backdropFilter: 'blur(12px)',
        zIndex: 10001,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div onClick={(e) => e.stopPropagation()} style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', width: '100%', height: '100%' }}>
        <BaseModal {...props} style={{ animation: 'scaleUp 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)', ...props.style }} />
      </div>
    </div>
  )
}
