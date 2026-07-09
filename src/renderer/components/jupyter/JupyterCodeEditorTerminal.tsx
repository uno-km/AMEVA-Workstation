/**
 * @file JupyterCodeEditorTerminal.tsx
 * @system AMEVA OS Desktop Workstation
 * @location src/renderer/components/jupyter/JupyterCodeEditorTerminal.tsx
 * @role Core module helper and integration logic
 * 
 * [소비처 - CONSUMERS / USAGE CONTEXT]
 * - 소비처 A (src/renderer/AppLayout.tsx): 레이아웃 그리드 내부 또는 플로팅 레이어 영역 내에서 그리기로 소비.
 * - 소비처 B (src/renderer/App.tsx): 전역 모달 매니저 및 뷰포트 상태 스위칭에 따라 동적 마운트되어 소비.
 * 
 * [책임 범위 - RESPONSIBILITY]
 * - 본 파일은 AMEVA 시스템 내에서 도메인 목적에 부합하는 연산 및 데이터 처리 흐름을 안전하게 캡슐화한다.
 * - 외부 라이브러리 및 하위 종속성을 조율하고 결과 규격을 일관되게 제공한다.
 * 
 * [절대 깨면 안 되는 계약 - CONTRACT]
 * - MUST: 모든 예외 발생 시 에러를 침묵시키지 말고 에러 로그를 명확하게 남길 것.
 * - MUST NOT: TypeScript any 형식을 우회 수단으로 함부로 선언하지 말 것.
 */

import { useState, useEffect } from 'react'
import { Terminal, Eye, EyeOff, ChevronDown } from 'lucide-react'
import mermaid from 'mermaid'
import { getLangMeta } from './langMeta'
import { type RunState } from './RunState'

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
            background: 'var(--term-bg)',
            borderTop: '1px solid var(--term-border)',
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
              padding: '8px 14px', background: 'var(--bg-glass-active)', borderBottom: '1px solid var(--term-border)',
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
            whiteSpace: 'pre-wrap', wordBreak: 'break-all', color: 'var(--term-text)',
            lineHeight: '1.5'
          }}>
            {runState.outputLines.map((line, idx) => (
              <div
                key={idx}
                style={{
                  color: line.type === 'stderr' ? 'var(--danger)' : line.type === 'info' ? `${accentColor}cc` : 'var(--term-text)',
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
            background: 'var(--term-bg)',
            borderTop: '1px solid var(--term-border)',
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
              padding: '8px 14px', background: 'var(--bg-glass-active)', borderBottom: '1px solid var(--term-border)',
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
              <table style={{ width: '100%', borderCollapse: 'collapse', color: 'var(--term-text)', textAlign: 'left', fontSize: '12px' }}>
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
              <div style={{ color: runState.success ? 'var(--term-text)' : 'var(--danger)', whiteSpace: 'pre-wrap', fontFamily: 'monospace' }}>
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
            background: 'var(--term-bg)',
            borderTop: '1px solid var(--term-border)',
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
          background: 'var(--term-bg)',
          borderTop: '1px solid var(--term-border)',
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
