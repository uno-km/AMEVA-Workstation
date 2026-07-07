import React, { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Globe } from 'lucide-react'

// HTML Full modal preview
export function HtmlPreviewModal({ code, onClose }: { code: string; onClose: () => void }) {
  const iframeRef = useRef<HTMLIFrameElement>(null)

  useEffect(() => {
    const doc = iframeRef.current?.contentDocument
      || iframeRef.current?.contentWindow?.document
    if (doc) {
      doc.open()
      doc.write(code)
      doc.close()
    }
  }, [code])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return createPortal(
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 9000,
        background: 'rgba(0,0,0,0.75)', display: 'flex',
        alignItems: 'center', justifyContent: 'center',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '80vw', height: '75vh', borderRadius: '12px',
          overflow: 'hidden', display: 'flex', flexDirection: 'column',
          boxShadow: '0 24px 80px rgba(0,0,0,0.8)',
          border: '1.5px solid rgba(249,115,22,0.4)',
        }}
      >
        <div style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          padding: '10px 16px', background: '#111827',
          borderBottom: '1px solid rgba(249,115,22,0.2)',
        }}>
          <Globe size={14} style={{ color: '#f97316' }} />
          <span style={{ fontSize: '12px', color: '#fff', fontWeight: 'bold' }}>HTML Live Sandbox Preview</span>
          <button
            onClick={onClose}
            style={{
              marginLeft: 'auto', background: 'transparent', border: 'none',
              color: '#9ca3af', cursor: 'pointer', fontSize: '16px', fontWeight: 'bold'
            }}
          >
            &times;
          </button>
        </div>
        <iframe
          ref={iframeRef}
          sandbox="allow-scripts allow-modals"
          title="Html Preview Fullscreen"
          style={{ width: '100%', flex: 1, border: 'none', background: '#fff' }}
        />
      </div>
    </div>,
    document.body
  )
}
