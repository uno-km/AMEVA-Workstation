/**
 * @file ExcelModal.tsx
 * @system AMEVA OS Desktop Workstation
 * @location packages/core/src/renderer/components/ExcelModal.tsx
 * @role Global Excel Viewer/Editor Modal
 */

import React, { useRef, useState, useEffect, lazy, Suspense } from 'react'
import { X } from 'lucide-react'

const LazyWorkbook = lazy(() =>
  import('@fortune-sheet/react').then((m) => {
    // Dynamic import for CSS
    import('@fortune-sheet/react/dist/index.css' as any)
    return { default: m.Workbook }
  })
)

export interface ExcelModalProps {
  isOpen: boolean
  onClose: () => void
}

export function ExcelModal({ isOpen, onClose }: ExcelModalProps) {
  const workbookRef = useRef<any>(null)
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    setIsMounted(true)
  }, [])

  if (!isOpen) return null

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose()
        }
      }}
    >
      <div
        style={{
          width: '95%',
          height: '95%',
          backgroundColor: '#fff',
          borderRadius: '8px',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 10px 30px rgba(0,0,0,0.5)'
        }}
      >
        <div
          style={{
            height: '40px',
            backgroundColor: 'var(--bg-glass)',
            borderBottom: '1px solid var(--border-muted)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 16px',
            color: 'var(--text-main)',
            fontWeight: 600
          }}
        >
          <span>Excel Viewer & Editor (Pro)</span>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: 'none', color: 'var(--text-main)',
              cursor: 'pointer', padding: '4px'
            }}
          >
            <X size={20} />
          </button>
        </div>
        <div style={{ flex: 1, position: 'relative', color: '#000' }}>
          <Suspense fallback={<div style={{ padding: '20px' }}>Loading Excel...</div>}>
            {isMounted && (
              <LazyWorkbook
                ref={workbookRef}
                data={[{ name: 'Sheet1', celldata: [], status: 1 }]}
                lang="en"
              />
            )}
          </Suspense>
        </div>
      </div>
    </div>
  )
}
