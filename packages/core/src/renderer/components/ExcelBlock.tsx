/**
 * @file ExcelBlock.tsx
 * @system AMEVA OS Desktop Workstation
 * @location packages/core/src/renderer/components/editor/blocks/ExcelBlock.tsx
 * @role BlockNote Custom Block for Excel Viewer/Editor
 */

import React, { useRef, useState } from 'react'
import { createReactBlockSpec } from '@blocknote/react'
import { Workbook } from '@fortune-sheet/react'
import '@fortune-sheet/react/dist/index.css'
import { Maximize2, X } from 'lucide-react'

// 블록 사양 정의
export const ExcelBlock = createReactBlockSpec(
  {
    type: 'excel',
    propSchema: {
      data: {
        default: '[]' // 2D array of cells JSON string
      }
    },
    content: 'none'
  },
  {
    render: (props) => {
      const workbookRef = useRef<any>(null)
      const [isFullScreen, setIsFullScreen] = useState(false)

      let sheetData = []
      try {
        const parsed = JSON.parse(props.block.props.data)
        if (Array.isArray(parsed) && parsed.length > 0) {
          sheetData = parsed
        }
      } catch (e) {}

      if (sheetData.length === 0) {
        // Fallback default sheet data
        sheetData = [{ name: 'Sheet1', celldata: [], status: 1 }]
      }

      const handleSave = () => {
        if (!workbookRef.current) return
        try {
          const allData = workbookRef.current.getAllSheets()
          props.editor.updateBlock(props.block.id, {
            type: 'excel',
            props: { data: JSON.stringify(allData) }
          })
        } catch (e) {
          console.error('Failed to save excel data', e)
        }
      }

      return (
        <div style={{ position: 'relative', margin: '8px 0', width: '100%' }}>
          {isFullScreen ? (
            <div
              style={{
                position: 'fixed',
                top: 0,
                left: 0,
                width: '100vw',
                height: '100vh',
                backgroundColor: 'rgba(0, 0, 0, 0.8)',
                zIndex: 99999,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <div
                style={{
                  width: '95%',
                  height: '95%',
                  backgroundColor: '#fff',
                  borderRadius: '8px',
                  display: 'flex',
                  flexDirection: 'column',
                  overflow: 'hidden'
                }}
              >
                <div style={{ padding: '8px 16px', backgroundColor: 'var(--bg-glass)', borderBottom: '1px solid var(--border-muted)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 600 }}>Excel Block (Fullscreen)</span>
                  <div>
                    <button onClick={() => { handleSave(); setIsFullScreen(false) }} style={{ padding: '4px 12px', background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', marginRight: '8px' }}>Save & Close</button>
                    <button onClick={() => setIsFullScreen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={20} /></button>
                  </div>
                </div>
                <div style={{ flex: 1, position: 'relative' }}>
                  <Workbook ref={workbookRef} data={sheetData} lang="en" onChange={handleSave} />
                </div>
              </div>
            </div>
          ) : (
            <div style={{ width: '100%', height: '400px', border: '1px solid var(--border-muted)', borderRadius: '8px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              <div style={{ padding: '4px 8px', backgroundColor: 'var(--bg-glass-active)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-muted)' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Excel Spreadsheet</span>
                <button
                  onClick={() => setIsFullScreen(true)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: 'var(--text-main)' }}
                  title="Fullscreen Editor"
                >
                  <Maximize2 size={14} />
                </button>
              </div>
              <div style={{ flex: 1, position: 'relative' }}>
                <Workbook ref={workbookRef} data={sheetData} lang="en" onChange={handleSave} />
              </div>
            </div>
          )}
        </div>
      )
    }
  }
)
