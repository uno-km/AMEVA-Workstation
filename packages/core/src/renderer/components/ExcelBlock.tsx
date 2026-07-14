/**
 * @file ExcelBlock.tsx
 * @system AMEVA OS Desktop Workstation
 * @location packages/core/src/renderer/components/editor/blocks/ExcelBlock.tsx
 * @role BlockNote Custom Block for Excel Viewer/Editor
 */

import React, { useRef, useState, useEffect, lazy, Suspense } from 'react'
import { createReactBlockSpec } from '@blocknote/react'
import { Maximize2, X, Table } from 'lucide-react'

const LazyWorkbook = lazy(() =>
  import('@fortune-sheet/react').then((m) => {
    // Dynamic import for CSS
    import('@fortune-sheet/react/dist/index.css' as any)
    return { default: m.Workbook }
  })
)

// 블록 사양 정의
const ExcelBlockSpec = createReactBlockSpec(
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
      const [isMounted, setIsMounted] = useState(false)

      useEffect(() => {
        setIsMounted(true)
        const timer = setTimeout(() => {
          window.dispatchEvent(new Event('resize'))
        }, 150)
        return () => clearTimeout(timer)
      }, [])

      let sheetData = []
      try {
        const parsed = JSON.parse(props.block.props.data)
        if (Array.isArray(parsed) && parsed.length > 0) {
          sheetData = parsed.map(sheet => ({
            ...sheet,
            row: sheet.row || 36,
            column: sheet.column || 18,
            defaultRowHeight: sheet.defaultRowHeight || 19,
            defaultColWidth: sheet.defaultColWidth || 73
          }))
        }
      } catch (e) {}

      if (sheetData.length === 0) {
        // Fallback default sheet data
        sheetData = [{ 
          name: 'Sheet1', 
          id: 'sheet_01',
          celldata: [], 
          status: 1,
          row: 36,
          column: 18,
          defaultRowHeight: 19,
          defaultColWidth: 73
        }]
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
      const handleExportTable = async () => {
        if (!workbookRef.current) return
        try {
          const allData = workbookRef.current.getAllSheets()
          const sheet = allData[0]
          if (!sheet || !sheet.celldata) return
          
          let maxR = 0
          let maxC = 0
          sheet.celldata.forEach((cell: any) => {
            if (cell.r > maxR) maxR = cell.r
            if (cell.c > maxC) maxC = cell.c
          })
          
          if (maxR === 0 && maxC === 0 && (!sheet.celldata[0] || (!sheet.celldata[0].v?.m && !sheet.celldata[0].v?.v))) {
             return // Empty sheet
          }

          const matrix: string[][] = Array.from({ length: maxR + 1 }, () => Array(maxC + 1).fill(''))
          sheet.celldata.forEach((cell: any) => {
            const val = cell.v?.m || cell.v?.v || ''
            matrix[cell.r][cell.c] = String(val).replace(/\|/g, '\\|')
          })
          
          let mdTable = ''
          matrix.forEach((row, r) => {
            mdTable += '| ' + row.join(' | ') + ' |\n'
            if (r === 0) {
              mdTable += '|' + row.map(() => '---').join('|') + '|\n'
            }
          })
          
          const blocks = await props.editor.tryParseMarkdownToBlocks(mdTable)
          props.editor.insertBlocks(blocks, props.block.id, 'after')
        } catch (e) {
          console.error('Failed to export table', e)
        }
      }

      return (
        <div 
          contentEditable={false}
          style={{ position: 'relative', margin: '8px 0', width: '100%' }}
          onKeyDown={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          onMouseUp={(e) => e.stopPropagation()}
          onMouseMove={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          onPointerMove={(e) => e.stopPropagation()}
          onPointerUp={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          onFocus={(e) => e.stopPropagation()}
          onBlur={(e) => {
            e.stopPropagation()
            handleSave()
          }}
          onMouseLeave={handleSave}
        >
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
                <div style={{ flex: 1, position: 'relative', color: '#000' }}>
                  {isMounted && (
                    <Suspense fallback={<div style={{ padding: '20px' }}>Loading Excel...</div>}>
                      <LazyWorkbook ref={workbookRef} data={sheetData} lang="en" onChange={handleSave} />
                    </Suspense>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div style={{ width: '100%', height: '400px', border: '1px solid var(--border-muted)', borderRadius: '8px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              <div style={{ padding: '4px 8px', backgroundColor: 'var(--bg-glass-active)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-muted)' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Excel Spreadsheet</span>
                <div>
                  <button
                    onClick={handleExportTable}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: 'var(--text-main)', marginRight: '8px' }}
                    title="Export as Markdown Table"
                  >
                    <Table size={14} />
                  </button>
                  <button
                    onClick={() => setIsFullScreen(true)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: 'var(--text-main)' }}
                    title="Fullscreen Editor"
                  >
                    <Maximize2 size={14} />
                  </button>
                </div>
              </div>
              <div style={{ flex: 1, position: 'relative', color: '#000' }}>
                {isMounted && (
                  <Suspense fallback={<div style={{ padding: '20px' }}>Loading Excel...</div>}>
                    <LazyWorkbook ref={workbookRef} data={sheetData} lang="en" onChange={handleSave} />
                  </Suspense>
                )}
              </div>
            </div>
          )}
        </div>
      )
    },
    toExternalHTML: ({ block }) => {
      let sheetData = []
      try {
        sheetData = JSON.parse(block.props.data)
      } catch(e) {}
      
      const sheet = sheetData[0]
      if (!sheet || !sheet.celldata) {
        return <p>Empty Excel Block</p>
      }

      let maxR = 0; let maxC = 0;
      sheet.celldata.forEach((cell: any) => {
        if (cell.r > maxR) maxR = cell.r;
        if (cell.c > maxC) maxC = cell.c;
      });

      if (maxR === 0 && maxC === 0 && (!sheet.celldata[0] || (!sheet.celldata[0].v?.m && !sheet.celldata[0].v?.v))) {
        return <p>Empty Excel Spreadsheet</p>
      }

      const matrix: string[][] = Array.from({ length: maxR + 1 }, () => Array(maxC + 1).fill(''));
      sheet.celldata.forEach((cell: any) => {
        matrix[cell.r][cell.c] = cell.v?.m || cell.v?.v || '';
      });

      return (
        <div data-content-type="excel" style={{ overflowX: 'auto', margin: '16px 0' }}>
          <table style={{ borderCollapse: 'collapse', width: '100%', border: '1px solid #ccc', textAlign: 'left' }}>
            <tbody>
              {matrix.map((row, i) => (
                <tr key={i}>
                  {row.map((cell, j) => (
                    <td key={j} style={{ border: '1px solid #ccc', padding: '6px 12px' }}>
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
    }
  }
)

export const ExcelBlock = ExcelBlockSpec()
