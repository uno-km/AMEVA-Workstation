import React, { useState, useEffect } from 'react'
import { Play, Copy, Terminal, Eye, EyeOff, ChevronDown } from 'lucide-react'
import { BlockNoteEditor } from '@blocknote/core'
import { useCodeRuntime } from '../hooks/useCodeRuntime'
import { getLangMeta } from './JupyterCodeViewer'
import mermaid from 'mermaid'

// Mermaid 초기화
mermaid.initialize({
  startOnLoad: false,
  theme: 'dark',
  securityLevel: 'loose',
})

export interface RunState {
  hasRun: boolean
  success: boolean | null
  outputLines: { type: 'stdout' | 'stderr' | 'info'; text: string }[]
  tableData?: any
}

// ─── 1. 에디터 상단 헤더 배너 ─────────────────────────────────────────
export function JupyterCodeEditorHeader({
  code,
  language,
  blockId,
  editor,
  onRunStart,
  onRunSuccess,
  onRunFailure,
  isInputCollapsed = false,
  onToggleInputCollapse,
}: {
  code: string
  language: string
  blockId: string
  editor: BlockNoteEditor
  onRunStart: () => void
  onRunSuccess: (success: boolean, lines: string[], tableData?: any) => void
  onRunFailure: (errMessage: string) => void
  isInputCollapsed?: boolean
  onToggleInputCollapse?: () => void
}) {
  console.debug("Unused vars (JupyterCodeEditor):", { React });
  const { isRunning, runJSCode, runPythonCode, runSQLCode } = useCodeRuntime()
  const meta = getLangMeta(language)
  const [copied, setCopied] = useState(false)

  const handleRun = async () => {
    onRunStart()
    try {
      if (language === 'html') {
        onRunSuccess(true, ['렌더링 완료'])
        return
      }
      const result = (language === 'python' || language === 'py')
        ? await runPythonCode(code)
        : (language === 'sql')
        ? await runSQLCode(code)
        : await runJSCode(code)
      onRunSuccess(result.success, (result.output || '').split('\n'), result.tableData)
    } catch (err: any) {
      onRunFailure(err.message || '알 수 없는 에러')
    }
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {}
  }

  const accentColor = meta.color

  return (
    <div
      className="jupyter-cell-header editor-cell-header"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '0 12px',
        height: '100%',
        background: '#161821',
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        borderTopLeftRadius: '8px',
        borderTopRightRadius: '8px',
        userSelect: 'none',
        boxSizing: 'border-box',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}
    >
      {/* 븡어빵틀 접기/펴기 (Chevron 토글) */}
      {onToggleInputCollapse && (
        <button
          onClick={onToggleInputCollapse}
          title={isInputCollapsed ? '코드 영역 펼치기' : '코드 영역 접기'}
          style={{
            background: 'transparent',
            border: 'none',
            color: '#9ca3af',
            cursor: 'pointer',
            padding: '2px',
            marginRight: '2px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            outline: 'none',
          }}
        >
          <ChevronDown
            size={14}
            style={{
              transform: isInputCollapsed ? 'rotate(-90deg)' : 'none',
              transition: 'transform 0.2s ease',
            }}
          />
        </button>
      )}

      <div style={{
        fontSize: '11px',
        fontWeight: 700,
        color: accentColor,
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        fontFamily: '"JetBrains Mono","Fira Code","Cascadia Code",monospace',
      }}>
        <span style={{
          width: '6px',
          height: '6px',
          borderRadius: '50%',
          backgroundColor: accentColor,
          display: 'inline-block'
        }} />
        <select
          value={language}
          onChange={(e) => {
            const val = e.target.value
            editor.updateBlock(blockId, {
              type: 'jupyter' as any,
              props: {
                ...editor.getBlock(blockId)?.props,
                language: val,
                runState: JSON.stringify({ hasRun: false, success: null, outputLines: [] })
              }
            } as any)
          }}
          style={{
            background: 'transparent',
            color: accentColor,
            border: 'none',
            outline: 'none',
            fontSize: '11px',
            fontWeight: 700,
            cursor: 'pointer',
            textTransform: 'uppercase',
            letterSpacing: '0.8px',
            fontFamily: '"JetBrains Mono","Fira Code",monospace',
            padding: '2px 4px',
            borderRadius: '4px',
            transition: 'background 0.2s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent'
          }}
        >
          <option value="javascript" style={{ background: '#12131a', color: '#f59e0b' }}>Javascript</option>
          <option value="python" style={{ background: '#12131a', color: '#3b82f6' }}>Python</option>
          <option value="sql" style={{ background: '#12131a', color: '#06b6d4' }}>SQL (SQLite)</option>
          <option value="html" style={{ background: '#12131a', color: '#14b8a6' }}>HTML Sandbox</option>
          <option value="mermaid" style={{ background: '#12131a', color: '#8b5cf6' }}>Mermaid</option>
          <option value="plaintext" style={{ background: '#12131a', color: '#6b7280' }}>Plaintext</option>
          <option value="text" style={{ background: '#12131a', color: '#6b7280' }}>Text</option>
          <option value="json" style={{ background: '#12131a', color: '#10b981' }}>JSON</option>
          <option value="bash" style={{ background: '#12131a', color: '#ec4899' }}>Bash</option>
        </select>
      </div>

      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px' }}>
        {meta.runnable && (
          <button
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              handleRun()
            }}
            disabled={isRunning}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              background: isRunning ? 'rgba(255, 255, 255, 0.1)' : accentColor,
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              padding: '4px 10px',
              fontSize: '11px',
              fontWeight: 700,
              cursor: isRunning ? 'not-allowed' : 'pointer',
              boxShadow: isRunning ? 'none' : `0 2px 8px ${accentColor}40`,
              transition: 'all 0.15s ease',
            }}
          >
            <Play size={10} fill="#fff" />
            Run
          </button>
        )}

        <button
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            handleCopy()
          }}
          title="코드 복사"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '5px',
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '4px',
            padding: '4px 10px',
            fontSize: '11px',
            fontWeight: 700,
            cursor: 'pointer',
            color: copied ? '#10b981' : '#e5e7eb',
            transition: 'all 0.15s ease',
          }}
        >
          <Copy size={11} />
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
    </div>
  )
}

// ─── 2. 에디터 하단 터미널 및 Mermaid 라이브 프리뷰 ────────────────────
export function JupyterCodeEditorTerminal({
  language,
  runState,
  code,
  blockId,
}: {
  language: string
  runState?: RunState
  code: string
  blockId: string
}) {
  if (!runState) return null

  const meta = getLangMeta(language)
  const accentColor = meta.color

  // 1. Mermaid 실시간 라이브 프리뷰 상태 및 터미널 접기 상태
  const [showMermaidPreview, setShowMermaidPreview] = useState(false)
  const [mermaidSvg, setMermaidSvg] = useState<string>('')
  const [mermaidError, setMermaidError] = useState<string | null>(null)
  const [isCollapsed, setIsCollapsed] = useState(false)

  useEffect(() => {
    if (language !== 'mermaid' || !showMermaidPreview || !code.trim()) {
      setMermaidSvg('')
      setMermaidError(null)
      return
    }

    const renderId = `mermaid-editor-svg-${blockId}`
    const drawDiagram = async () => {
      try {
        const temp = document.getElementById(renderId)
        if (temp) temp.remove()
        
        document.querySelectorAll('[id^="dmermaid"]').forEach(el => el.remove())

        try {
          await mermaid.parse(code, { suppressErrors: true })
        } catch (parseErr: any) {
          setMermaidError(parseErr.message || 'Mermaid 문법 오류가 감지되었습니다.')
          return
        }

        const { svg } = await mermaid.render(renderId, code)
        setMermaidSvg(svg)
        setMermaidError(null)
      } catch (err: any) {
        setMermaidError(err.message || '다이어그램 렌더링 오류')
      }
    }

    const timer = setTimeout(drawDiagram, 150)
    return () => clearTimeout(timer)
  }, [code, language, showMermaidPreview, blockId])

  return (
    <div style={{ width: '100%' }}>
      {/* Mermaid 전용 라이브 토글 액션 툴바 */}
      {language === 'mermaid' && (
        <div style={{
          padding: '6px 14px',
          background: 'rgba(255, 255, 255, 0.02)',
          borderTop: '1px solid rgba(255, 255, 255, 0.05)',
          display: 'flex',
          justifyContent: 'flex-start',
        }}>
          <button
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              setShowMermaidPreview(!showMermaidPreview)
            }}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '6px',
              background: showMermaidPreview ? '#10b981' : 'rgba(255,255,255,0.06)',
              color: showMermaidPreview ? '#fff' : '#e5e7eb',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '4px',
              padding: '3px 12px', fontSize: '10px', fontWeight: 800, cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            {showMermaidPreview ? <EyeOff size={11} /> : <Eye size={11} />}
            {showMermaidPreview ? 'Hide Diagram' : 'Show Diagram'}
          </button>
        </div>
      )}

      {/* JS/Python 실행 터미널 창 */}
      {meta.runnable && runState && runState.hasRun && language !== 'sql' && (
        <div
          className="jupyter-cell-terminal editor-cell-terminal"
          style={{
            background: '#07080b',
            borderTop: '1px solid rgba(255, 255, 255, 0.08)',
            fontFamily: 'Consolas, Monaco, monospace',
            fontSize: '12px',
            textAlign: 'left',
            boxSizing: 'border-box',
            borderBottomLeftRadius: '8px',
            borderBottomRightRadius: '8px',
            overflow: 'hidden',
          }}
        >
          <div 
            onClick={() => setIsCollapsed(!isCollapsed)}
            style={{
              display: 'flex', alignItems: 'center',
              padding: '8px 14px', background: '#0e1017', borderBottom: '1px solid rgba(255,255,255,0.05)',
              userSelect: 'none', justifyContent: 'space-between', cursor: 'pointer'
            }}
          >
            <span style={{ color: '#9ca3af', fontSize: '11px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <ChevronDown
                size={12}
                style={{
                  transform: isCollapsed ? 'rotate(-90deg)' : 'none',
                  transition: 'transform 0.2s ease',
                }}
              />
              <Terminal size={12} />
              Output
            </span>
            {runState.success !== null && (
              <span style={{
                color: runState.success ? '#10b981' : '#f43f5e',
                background: runState.success ? 'rgba(16,185,129,0.1)' : 'rgba(244,63,94,0.1)',
                border: `1px solid ${runState.success ? '#10b98133' : '#f43f5e33'}`,
                padding: '2px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: 'bold'
              }}>
                {runState.success ? 'Success' : 'Error'}
              </span>
            )}
          </div>
          <div style={{
            padding: isCollapsed ? '0px 16px' : '12px 16px',
            maxHeight: isCollapsed ? '0px' : '180px',
            overflowY: 'auto',
            transition: 'max-height 0.25s ease-out, padding 0.25s ease-out',
            whiteSpace: 'pre-wrap', wordBreak: 'break-all', color: '#e5e7eb',
            lineHeight: '1.5'
          }}>
            {runState.outputLines.map((line, idx) => (
              <div
                key={idx}
                style={{
                  color: line.type === 'stderr' ? '#f87171' : line.type === 'info' ? `${accentColor}cc` : '#e5e7eb',
                  marginBottom: '2px',
                }}
              >
                {line.text}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SQL 가상 DB 실행 테이블 뷰어 */}
      {language === 'sql' && runState && runState.hasRun && (
        <div
          className="jupyter-cell-terminal editor-cell-terminal"
          onMouseMove={(e) => e.stopPropagation()}
          onMouseEnter={(e) => e.stopPropagation()}
          onMouseLeave={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          onMouseUp={(e) => e.stopPropagation()}
          style={{
            background: '#07080b',
            borderTop: '1px solid rgba(255, 255, 255, 0.08)',
            fontFamily: 'system-ui, -apple-system, sans-serif',
            fontSize: '12px',
            textAlign: 'left',
            boxSizing: 'border-box',
            borderBottomLeftRadius: '8px',
            borderBottomRightRadius: '8px',
            overflow: 'hidden',
          }}
        >
          <div 
            onClick={() => setIsCollapsed(!isCollapsed)}
            style={{
              display: 'flex', alignItems: 'center',
              padding: '8px 14px', background: '#0e1017', borderBottom: '1px solid rgba(255,255,255,0.05)',
              userSelect: 'none', justifyContent: 'space-between', cursor: 'pointer'
            }}
          >
            <span style={{ color: '#9ca3af', fontSize: '11px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <ChevronDown
                size={12}
                style={{
                  transform: isCollapsed ? 'rotate(-90deg)' : 'none',
                  transition: 'transform 0.2s ease',
                }}
              />
              <Terminal size={12} />
              SQL Database Output
            </span>
            {runState.success !== null && (
              <span style={{
                color: runState.success ? '#10b981' : '#f43f5e',
                background: runState.success ? 'rgba(16,185,129,0.1)' : 'rgba(244,63,94,0.1)',
                border: `1px solid ${runState.success ? '#10b98133' : '#f43f5e33'}`,
                padding: '2px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: 'bold'
              }}>
                {runState.success ? 'Success' : 'Error'}
              </span>
            )}
          </div>
          <div style={{
            padding: isCollapsed ? '0px 16px' : '12px 16px',
            maxHeight: isCollapsed ? '0px' : '220px',
            overflowY: 'auto',
            transition: 'max-height 0.25s ease-out, padding 0.25s ease-out',
          }}>
            {runState.success && runState.tableData ? (
              <table style={{ width: '100%', borderCollapse: 'collapse', color: '#e5e7eb', textAlign: 'left', fontSize: '12px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.03)' }}>
                    {runState.tableData.columns.map((col: string, i: number) => (
                      <th key={i} style={{ padding: '8px 12px', fontWeight: 'bold', color: '#a78bfa' }}>{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {runState.tableData.values.map((row: any[], ri: number) => (
                    <tr key={ri} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      {row.map((val: any, ci: number) => (
                        <td key={ci} style={{ padding: '8px 12px', fontFamily: 'monospace' }}>{val !== null ? String(val) : <span style={{color:'#6b7280', fontStyle:'italic'}}>NULL</span>}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div style={{ color: runState.success ? '#e5e7eb' : '#f87171', whiteSpace: 'pre-wrap', fontFamily: 'monospace' }}>
                {runState.outputLines.map(l => l.text).join('\n')}
              </div>
            )}
          </div>
        </div>
      )}

      {/* HTML 격리 샌드박스 렌더러 */}
      {language === 'html' && runState && runState.hasRun && (
        <div 
          onMouseMove={(e) => e.stopPropagation()}
          onMouseEnter={(e) => e.stopPropagation()}
          onMouseLeave={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          onMouseUp={(e) => e.stopPropagation()}
          style={{
            background: '#0a0b10',
            borderTop: '1px solid rgba(255, 255, 255, 0.08)',
            borderBottomLeftRadius: '8px',
            borderBottomRightRadius: '8px',
            padding: '12px',
            boxSizing: 'border-box'
          }}
        >
          <div style={{ color: '#9ca3af', fontSize: '11px', fontWeight: 'bold', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px', userSelect: 'none' }}>
            <Eye size={12} />
            Live HTML Renderer Sandbox
          </div>
          <iframe
            srcDoc={code}
            title="HTML Preview Sandbox"
            sandbox="allow-scripts allow-modals"
            style={{
              width: '100%',
              height: '350px',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '6px',
              background: '#ffffff',
            }}
          />
        </div>
      )}

      {/* Mermaid 라이브 프리뷰 패널 */}
      {language === 'mermaid' && showMermaidPreview && (
        <div style={{
          background: '#0a0b10',
          borderTop: '1px solid rgba(255, 255, 255, 0.08)',
          borderBottomLeftRadius: '8px',
          borderBottomRightRadius: '8px',
          padding: '16px',
          textAlign: 'center',
          overflowX: 'auto',
        }}>
          {mermaidError ? (
            <div style={{
              color: '#f87171',
              fontFamily: 'monospace',
              fontSize: '11px',
              textAlign: 'left',
              whiteSpace: 'pre-wrap',
            }}>
              Mermaid 에러:<br />
              {mermaidError}
            </div>
          ) : mermaidSvg ? (
            <div
              className="mermaid-svg-holder"
              dangerouslySetInnerHTML={{ __html: mermaidSvg }}
              style={{
                display: 'inline-block',
                background: '#ffffff',
                padding: '12px',
                borderRadius: '6px',
              }}
            />
          ) : (
            <div style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '11px' }}>
              다이어그램 생성 중...
            </div>
          )}
        </div>
      )}
    </div>
  )
}
