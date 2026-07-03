import React, { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { BlockNoteEditor } from '@blocknote/core'
import { Play, Eye, Copy, ChevronDown, Terminal, Globe } from 'lucide-react'
import { marked } from 'marked'
import mermaid from 'mermaid'
import hljs from 'highlight.js'
import 'highlight.js/styles/vs2015.css'
import { useCodeRuntime } from '../hooks/useCodeRuntime'

// ─── 언어 메타 ────────────────────────────────────────────────
interface LangMeta {
  color: string
  label: string
  runnable: boolean   // JS/TS/Python → Run 버튼
  previewable: boolean // HTML/Mermaid → Preview 버튼
  isHtml: boolean
  isMermaid: boolean
}

const LANG_META: Record<string, LangMeta> = {
  javascript: { color: '#f59e0b', label: 'JavaScript', runnable: true,  previewable: false, isHtml: false, isMermaid: false },
  js:         { color: '#f59e0b', label: 'JavaScript', runnable: true,  previewable: false, isHtml: false, isMermaid: false },
  typescript: { color: '#60a5fa', label: 'TypeScript', runnable: true,  previewable: false, isHtml: false, isMermaid: false },
  ts:         { color: '#60a5fa', label: 'TypeScript', runnable: true,  previewable: false, isHtml: false, isMermaid: false },
  python:     { color: '#3b82f6', label: 'Python',     runnable: true,  previewable: false, isHtml: false, isMermaid: false },
  py:         { color: '#3b82f6', label: 'Python',     runnable: true,  previewable: false, isHtml: false, isMermaid: false },
  html:       { color: '#f97316', label: 'HTML',       runnable: true,  previewable: true,  isHtml: true,  isMermaid: false },
  css:        { color: '#a78bfa', label: 'CSS',        runnable: false, previewable: false, isHtml: false, isMermaid: false },
  mermaid:    { color: '#8b5cf6', label: 'Mermaid',    runnable: false, previewable: true,  isHtml: false, isMermaid: true  },
  markdown:   { color: '#34d399', label: 'Markdown',   runnable: false, previewable: true,  isHtml: false, isMermaid: false },
  json:       { color: '#34d399', label: 'JSON',       runnable: false, previewable: false, isHtml: false, isMermaid: false },
  xml:        { color: '#fb923c', label: 'XML',        runnable: false, previewable: false, isHtml: false, isMermaid: false },
  sql:        { color: '#e879f9', label: 'SQL',        runnable: true,  previewable: false, isHtml: false, isMermaid: false },
  bash:       { color: '#94a3b8', label: 'Bash',       runnable: false, previewable: false, isHtml: false, isMermaid: false },
  sh:         { color: '#94a3b8', label: 'Shell',      runnable: false, previewable: false, isHtml: false, isMermaid: false },
  c:          { color: '#10b981', label: 'C',          runnable: false, previewable: false, isHtml: false, isMermaid: false },
  cpp:        { color: '#10b981', label: 'C++',        runnable: false, previewable: false, isHtml: false, isMermaid: false },
  java:       { color: '#f43f5e', label: 'Java',       runnable: false, previewable: false, isHtml: false, isMermaid: false },
  text:       { color: '#6b7280', label: 'Text',       runnable: false, previewable: false, isHtml: false, isMermaid: false },
}

export function getLangMeta(lang: string): LangMeta {
  return LANG_META[lang.toLowerCase()] ?? {
    color: '#6b7280', label: lang, runnable: false,
    previewable: false, isHtml: false, isMermaid: false,
  }
}

// HTML 미리보기 샌드박스 렌더러
function InlineHtmlRenderer({ code }: { code: string }) {
  return (
    <div style={{
      border: '1px solid rgba(249,115,22,0.35)',
      borderRadius: '10px',
      overflow: 'hidden',
      margin: '16px 0',
      background: '#fff',
      boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
    }}>
      <div style={{
        background: '#111827',
        padding: '8px 14px',
        fontSize: '11px',
        color: '#f97316',
        fontWeight: 700,
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        borderBottom: '1px solid rgba(249,115,22,0.2)',
        userSelect: 'none',
      }}>
        <Globe size={12} style={{ color: '#f97316' }} />
        HTML 실시간 렌더링 화면 (Live Sandbox)
      </div>
      <iframe
        sandbox="allow-scripts allow-modals"
        title="Inline HTML Preview"
        srcDoc={code}
        style={{
          width: '100%',
          height: '380px',
          border: 'none',
          background: '#fff',
        }}
      />
    </div>
  )
}

// HTML Full modal preview
function HtmlPreviewModal({ code, onClose }: { code: string; onClose: () => void }) {
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

// Mermaid Diagram 렌더러
function InlineMermaidRenderer({ code }: { code: string }) {
  const [svg, setSvg] = useState<string>('')
  const [error, setError] = useState<string | null>(null)
  const elementId = useRef(`mermaid-preview-${Math.random().toString(36).substr(2, 9)}`)

  useEffect(() => {
    let active = true
    const renderDiagram = async () => {
      try {
        const cleanCode = code.replace(/^(\s*)end([가-힣a-zA-Z]+)/gm, '$1end\n$1$2')
        const { svg: renderedSvg } = await mermaid.render(elementId.current, cleanCode)
        if (active) {
          setSvg(renderedSvg)
          setError(null)
        }
      } catch (err: any) {
        if (active) {
          setError(err.message || 'Mermaid 렌더링에 실패했습니다.')
        }
      }
    }
    renderDiagram()
    return () => { active = false }
  }, [code])

  if (error) {
    return (
      <div style={{
        padding: '12px 16px', borderRadius: '8px', background: 'rgba(239,68,68,0.08)',
        border: '1.5px solid rgba(239,68,68,0.25)', color: '#f87171', fontSize: '12px', textAlign: 'left'
      }}>
        <strong>[Mermaid Syntax Error]</strong>
        <pre style={{ margin: '6px 0 0 0', overflowX: 'auto', fontSize: '11px', opacity: 0.85 }}>{error}</pre>
      </div>
    )
  }

  return (
    <div
      className="mermaid-svg-container"
      style={{ display: 'flex', justifyContent: 'center', background: '#12121e', borderRadius: '8px', padding: '16px', overflowX: 'auto' }}
      dangerouslySetInnerHTML={{ __html: svg || '<span style="color:#6b7280; font-size:12px;">Mermaid 로딩 중...</span>' }}
    />
  )
}

export function JupyterCodeViewer({
  code,
  language,
  blockId,
}: {
  code: string
  language: string
  blockId: string
}) {
  // 메타데이터 주석 해독
  const lines = (code || '').split('\n')
  const firstLine = lines[0]?.trim()
  
  let resolvedLanguage = language
  let resolvedCode = code
  
  const amevaLangMatch = firstLine ? firstLine.match(/^(?:\/\/#|--|<!--)\s*\[AMEVA_LANG:([a-zA-Z0-9_-]+)\](?:\s*-->)?/) || firstLine.match(/^(?:\/\/|#|--)\s*\[AMEVA_LANG:([a-zA-Z0-9_-]+)\]/) : null
  if (amevaLangMatch) {
    resolvedLanguage = amevaLangMatch[1].toLowerCase()
    resolvedCode = lines.slice(1).join('\n')
  }

  const { isRunning, runJSCode, runPythonCode, runSQLCode } = useCodeRuntime()
  const meta = getLangMeta(resolvedLanguage)

  const [outputLines, setOutputLines] = useState<{ type: 'stdout' | 'stderr' | 'info'; text: string }[]>([])
  const [hasRun, setHasRun] = useState(false)
  const [success, setSuccess] = useState<boolean | null>(null)
  const [copied, setCopied] = useState(false)
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [tableData, setTableData] = useState<any>(null)

  const [showMermaidPreview, setShowMermaidPreview] = useState(resolvedLanguage === 'mermaid')
  const [showHtmlModal, setShowHtmlModal] = useState(false)
  const [showMdPreview, setShowMdPreview] = useState(false)

  const handleRun = async () => {
    setHasRun(true)
    setSuccess(null)
    setTableData(null)
    setOutputLines([{ type: 'info', text: `▶ ${meta.label} 코드 실행 중...` }])
    try {
      if (resolvedLanguage === 'html') {
        setSuccess(true)
        setOutputLines([{ type: 'info', text: '렌더링 완료' }])
        return
      }
      const result = (resolvedLanguage === 'python' || resolvedLanguage === 'py')
        ? await runPythonCode(resolvedCode)
        : (resolvedLanguage === 'sql')
        ? await runSQLCode(resolvedCode)
        : await runJSCode(resolvedCode)
      setSuccess(result.success)
      const lines = (result.output || '').split('\n')
        .filter((l, i, a) => !(i === a.length - 1 && l === ''))
      setOutputLines(lines.map(text => ({
        type: result.success ? 'stdout' : 'stderr', text,
      })))
      setTableData(result.tableData)
    } catch (err: any) {
      setSuccess(false)
      setOutputLines([{ type: 'stderr', text: err.message || '알 수 없는 에러' }])
    }
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(resolvedCode)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {}
  }

  const accentColor = meta.color

  return (
    <div
      className="jupyter-cell viewer-cell"
      style={{
        margin: '14px 0',
        borderRadius: '10px',
        border: `1.5px solid ${accentColor}33`,
        background: 'rgba(10,12,20,0.85)',
        overflow: 'visible',
        boxShadow: `0 4px 24px rgba(0,0,0,0.4), 0 0 0 1px ${accentColor}22`,
        fontFamily: '"JetBrains Mono","Fira Code","Cascadia Code",monospace',
        position: 'relative',
      }}
    >
      {/* ── 헤더 바 ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '8px',
        padding: '7px 12px',
        background: `linear-gradient(90deg, ${accentColor}22 0%, transparent 100%)`,
        borderBottom: `1px solid ${accentColor}33`,
        userSelect: 'none', flexWrap: 'wrap',
      }}>
        <div style={{
          fontSize: '10px', fontWeight: 800, padding: '3px 8px', borderRadius: '4px',
          background: `${accentColor}22`, color: accentColor, border: `1px solid ${accentColor}44`,
          textTransform: 'uppercase', letterSpacing: '0.5px'
        }}>
          ● {meta.label}
        </div>

        {meta.runnable && (
          <button
            onClick={handleRun}
            disabled={isRunning}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '5px',
              background: isRunning ? 'var(--text-muted)' : accentColor,
              color: '#fff', border: 'none', borderRadius: '4px',
              padding: '3px 10px', fontSize: '10px', fontWeight: 700, cursor: 'pointer',
              boxShadow: `0 2px 8px ${accentColor}40`, transition: 'all 0.15s ease',
            }}
          >
            <Play size={10} fill="#fff" />
            Run
          </button>
        )}

        {meta.isHtml && (
          <button
            onClick={() => setShowHtmlModal(v => !v)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '5px',
              background: '#f97316', color: '#fff', border: 'none', borderRadius: '4px',
              padding: '3px 10px', fontSize: '10px', fontWeight: 700, cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(249,115,22,0.4)', transition: 'all 0.15s ease',
            }}
          >
            <Eye size={10} />
            Preview
          </button>
        )}

        {meta.isMermaid && (
          <button
            onClick={() => setShowMermaidPreview(v => !v)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '5px',
              background: showMermaidPreview ? '#8b5cf6' : 'rgba(139,92,246,0.3)',
              color: '#fff', border: `1px solid ${showMermaidPreview ? 'transparent' : '#8b5cf6'}`, borderRadius: '4px',
              padding: '3px 10px', fontSize: '10px', fontWeight: 700, cursor: 'pointer',
              boxShadow: showMermaidPreview ? '0 2px 8px rgba(139,92,246,0.4)' : 'none',
              transition: 'all 0.15s ease',
            }}
          >
            <Eye size={10} />
            {showMermaidPreview ? 'Hide Diagram' : 'Show Diagram'}
          </button>
        )}

        {(meta.label === 'Markdown') && (
          <button
            onClick={() => setShowMdPreview(v => !v)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '5px',
              background: showMdPreview ? '#34d399' : 'rgba(52,211,153,0.3)',
              color: '#fff', border: `1px solid ${showMdPreview ? 'transparent' : '#34d399'}`, borderRadius: '4px',
              padding: '3px 10px', fontSize: '10px', fontWeight: 700, cursor: 'pointer',
              boxShadow: showMdPreview ? '0 2px 8px rgba(52,211,153,0.4)' : 'none',
              transition: 'all 0.15s ease',
            }}
          >
            <Eye size={10} />
            {showMdPreview ? 'Hide Render' : 'Show Render'}
          </button>
        )}

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <button
            onClick={() => setIsCollapsed(c => !c)}
            title={isCollapsed ? '펼치기' : '접기'}
            style={{
              background: 'transparent', border: 'none', cursor: 'pointer',
              color: 'var(--text-muted)', display: 'flex', padding: '2px',
              transform: isCollapsed ? 'rotate(-90deg)' : 'none', transition: 'transform 0.2s',
            }}
          >
            <ChevronDown size={14} />
          </button>
          <button
            onClick={handleCopy}
            title="코드 복사"
            style={{
              background: 'transparent', border: 'none', cursor: 'pointer',
              color: copied ? '#10b981' : 'var(--text-muted)', display: 'flex', padding: '2px',
            }}
          >
            <Copy size={12} />
          </button>
        </div>
      </div>

      {/* ── 코드 본문 뷰어 ── */}
      {!isCollapsed && resolvedCode.trim() && (
        <pre className="hljs-pre" style={{
          margin: 0,
          padding: '12px 16px',
          background: '#12131a',
          overflowX: 'auto',
          fontSize: '13px',
          borderBottom: `1px solid ${accentColor}18`,
          textAlign: 'left'
        }}>
          <code
            className={`hljs language-${resolvedLanguage}`}
            dangerouslySetInnerHTML={{
              __html: hljs.highlight(resolvedCode, { language: hljs.getLanguage(resolvedLanguage) ? resolvedLanguage : 'plaintext' }).value
            }}
            style={{ fontFamily: '"JetBrains Mono", monospace' }}
          />
        </pre>
      )}

      {/* ── Placeholder ── */}
      {!isCollapsed && !resolvedCode.trim() && (
        <div style={{
          padding: '12px 16px', fontSize: '11px', color: '#4b5563',
          fontStyle: 'italic', pointerEvents: 'none', userSelect: 'none',
          background: '#12131a', borderBottom: `1px solid ${accentColor}18`
        }}>
          {`// ${meta.label} 코드가 비어 있습니다.`}
        </div>
      )}

      {/* ── Mermaid 인라인 Preview ── */}
      {!isCollapsed && meta.isMermaid && showMermaidPreview && resolvedCode.trim() && (
        <div style={{ padding: '12px 16px', borderTop: `1px solid ${accentColor}22` }}>
          <InlineMermaidRenderer code={resolvedCode} />
        </div>
      )}

      {/* ── Markdown Preview ── */}
      {!isCollapsed && (meta.label === 'Markdown') && showMdPreview && resolvedCode.trim() && (
        <div
          className="markdown-rendered-body"
          dangerouslySetInnerHTML={{ __html: marked.parse(resolvedCode) }}
          style={{
            padding: '16px 20px',
            background: 'var(--bg-main)',
            color: 'var(--text-main)',
            borderTop: `1px solid ${accentColor}22`,
            fontSize: '14px',
            lineHeight: '1.7',
            textAlign: 'left',
          }}
        />
      )}

      {/* ── HTML Sandbox Preview ── */}
      {!isCollapsed && meta.isHtml && resolvedCode.trim() && (
        <div style={{ padding: '12px 16px', borderTop: `1px solid ${accentColor}22` }}>
          <InlineHtmlRenderer code={resolvedCode} />
        </div>
      )}

      {/* ── HTML Preview 모달 ── */}
      {showHtmlModal && (
        <HtmlPreviewModal code={resolvedCode} onClose={() => setShowHtmlModal(false)} />
      )}

      {/* ── 터미널 실행 결과창 (Jupyter style) ── */}
      {!isCollapsed && meta.runnable && hasRun && (
        <div style={{
          background: '#0a0b10',
          borderTop: `1px solid ${accentColor}22`,
          fontFamily: 'Consolas, Monaco, monospace',
          fontSize: '12px',
          textAlign: 'left',
          boxSizing: 'border-box',
          borderRadius: '0 0 8px 8px',
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '6px 14px', background: '#0e1017', borderBottom: '1px solid rgba(255,255,255,0.05)',
            userSelect: 'none'
          }}>
            <span style={{ color: 'var(--text-muted)', fontSize: '10px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '5px' }}>
              <Terminal size={11} />
              _ OUTPUT
            </span>
            {success !== null && (
              <span style={{
                color: success ? '#10b981' : '#f43f5e',
                background: success ? 'rgba(16,185,129,0.1)' : 'rgba(244,63,94,0.1)',
                border: `1px solid ${success ? '#10b98133' : '#f43f5e33'}`,
                padding: '1px 6px', borderRadius: '3px', fontSize: '9px', fontWeight: 'bold'
              }}>
                {success ? 'EXIT 0' : 'EXIT 1'}
              </span>
            )}
          </div>
          <div style={{
            padding: '12px 16px', maxHeight: '200px', overflowY: 'auto',
            color: '#e5e7eb',
            lineHeight: '1.5'
          }}>
            {resolvedLanguage === 'sql' && success && tableData ? (
              <table style={{ width: '100%', borderCollapse: 'collapse', color: '#e5e7eb', textAlign: 'left', fontSize: '12px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.03)' }}>
                    {tableData.columns.map((col: string, i: number) => (
                      <th key={i} style={{ padding: '6px 10px', fontWeight: 'bold', color: '#a78bfa' }}>{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tableData.values.map((row: any[], ri: number) => (
                    <tr key={ri} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      {row.map((val: any, ci: number) => (
                        <td key={ci} style={{ padding: '6px 10px', fontFamily: 'monospace' }}>{val !== null ? String(val) : <span style={{color:'#6b7280', fontStyle:'italic'}}>NULL</span>}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', fontFamily: 'monospace' }}>
                {outputLines.map((line, idx) => (
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
            )}
          </div>
        </div>
      )}
    </div>
  )
}
