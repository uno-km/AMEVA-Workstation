import React, { useState, useEffect, useRef } from 'react'
import { createReactBlockSpec } from '@blocknote/react'
import { Check, Edit2, FileImage } from 'lucide-react'

// Dynamic import or guarded import of Excalidraw to bypass Node environment check during build
let Excalidraw: any = null
try {
  const ex = require('@excalidraw/excalidraw')
  Excalidraw = ex.Excalidraw
} catch {
  // ESM or fallback import
  import('@excalidraw/excalidraw').then((m) => {
    Excalidraw = m.Excalidraw
  })
}

export const DrawingBlockSpec = createReactBlockSpec(
  {
    type: 'drawing',
    propSchema: {
      data: { default: '[]' }
    },
    content: 'none'
  },
  {
    render: ({ block, editor }) => {
      const [mounted, setMounted] = useState(false)
      const [isEditing, setIsEditing] = useState(true)
      const [excalidrawLoaded, setExcalidrawLoaded] = useState(!!Excalidraw)
      const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)

      useEffect(() => {
        setMounted(true)
        if (!Excalidraw) {
          // If not loaded via require, check dynamic import in interval
          const interval = setInterval(() => {
            if (Excalidraw) {
              setExcalidrawLoaded(true)
              clearInterval(interval)
            }
          }, 100)
          return () => clearInterval(interval)
        }
      }, [])

      // Parse initial data
      let initialElements = []
      try {
        initialElements = JSON.parse(block.props.data || '[]')
      } catch (e) {
        console.error('Drawing data parse error:', e)
      }

      // Debounced save to prevent rendering lag during drawing strokes
      const handleCanvasChange = (elements: any[]) => {
        if (saveTimeoutRef.current) {
          clearTimeout(saveTimeoutRef.current)
        }
        saveTimeoutRef.current = setTimeout(() => {
          const stringified = JSON.stringify(elements)
          if (stringified !== block.props.data) {
            editor.updateBlock(block.id, {
              type: 'drawing',
              props: { data: stringified }
            })
          }
        }, 500)
      };

      if (!mounted || (!Excalidraw && !excalidrawLoaded)) {
        return (
          <div style={{
            height: '350px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#16161a',
            border: '1px dashed #2e2e38',
            borderRadius: '8px',
            color: 'var(--text-muted)',
            fontSize: '12px'
          }}>
            드로잉 모듈을 준비 중입니다...
          </div>
        )
      }

      return (
        <div
          className="bn-block-content-wrapper"
          style={{
            width: '100%',
            backgroundColor: '#18181c',
            border: '1px solid #2e2e38',
            borderRadius: '8px',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            marginBottom: '10px'
          }}
        >
          {/* 헤더 바 */}
          <div style={{
            padding: '8px 12px',
            borderBottom: '1px solid #2e2e38',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: '#121215'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <FileImage size={14} style={{ color: 'var(--primary)' }} />
              <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#f8fafc' }}>Drawing Canvas</span>
            </div>
            
            <button
              onClick={() => setIsEditing(!isEditing)}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--primary)',
                fontSize: '11px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '4px 8px',
                borderRadius: '4px',
                backgroundColor: 'rgba(139,92,246,0.1)'
              }}
            >
              {isEditing ? (
                <>
                  <Check size={11} />
                  Done Sketching
                </>
              ) : (
                <>
                  <Edit2 size={11} />
                  Edit Sketch
                </>
              )}
            </button>
          </div>

          {/* 캔버스 본체 */}
          <div style={{ height: '380px', width: '100%', position: 'relative' }}>
            {isEditing ? (
              <Excalidraw
                initialData={{
                  elements: initialElements,
                  appState: { viewBackgroundColor: '#1e1e24', theme: 'dark' }
                }}
                onChange={handleCanvasChange}
              />
            ) : (
              // 뷰 전용 프리뷰 상태 (이벤트 차단용 마스크 오버레이 장착)
              <>
                <Excalidraw
                  initialData={{
                    elements: initialElements,
                    appState: { viewBackgroundColor: '#1e1e24', theme: 'dark' }
                  }}
                  viewModeEnabled={true}
                />
                <div style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  zIndex: 5,
                  cursor: 'default'
                }} />
              </>
            )}
          </div>
        </div>
      )
    }
  }
)

export const DrawingBlock = DrawingBlockSpec()
