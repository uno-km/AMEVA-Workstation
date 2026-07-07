import React, { useState, useEffect } from 'react'
import { Play, Eye, Copy, ChevronDown } from 'lucide-react'
import { marked } from 'marked'
import mermaid from 'mermaid'

// Mermaid 초기화
mermaid.initialize({
  startOnLoad: false,
  theme: 'dark'
})

import hljs from 'highlight.js'
import 'highlight.js/styles/vs2015.css'
import { useCodeRuntime } from '../hooks/useCodeRuntime'

import { getLangMeta } from './jupyter/langMeta'
import { InlineHtmlRenderer } from './jupyter/InlineHtmlRenderer'
import { HtmlPreviewModal } from './jupyter/HtmlPreviewModal'
import { InlineMermaidRenderer } from './jupyter/InlineMermaidRenderer'
import { ConsoleOutput } from './jupyter/ConsoleOutput'

export { getLangMeta } // Re-export for compatibility

export function JupyterCodeViewer({
  code,
  language,
  onRunFailure,
}: {
  code: string
  language: string
  onRunFailure?: (err: any) => void
}) {
  console.debug("Unused vars (JupyterCodeViewer):", { React, onRunFailure });
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
  const [showHtmlRender, setShowHtmlRender] = useState(false)

  useEffect(() => {
    setShowHtmlRender(false)
  }, [code, resolvedLanguage])

  const handleRun = async () => {
    setHasRun(true)
    setSuccess(null)
    setTableData(null)
    setOutputLines([{ type: 'info', text: `▶ ${meta.label} 코드 실행 중...` }])
    try {
      if (resolvedLanguage === 'html') {
        setSuccess(true)
        setOutputLines([{ type: 'info', text: '렌더링 완료' }])
        setShowHtmlRender(true)
        return
      }
      const result = (resolvedLanguage === 'python' || resolvedLanguage === 'py')
        ? await runPythonCode(resolvedCode)
        : (resolvedLanguage === 'sql')
        ? await runSQLCode(resolvedCode)
        : await runJSCode(resolvedCode)
      setSuccess(result.success)
      const lines = (result.output || '').split('\n')
        .filter((l: string, i: number, a: string[]) => !(i === a.length - 1 && l === ''))
      setOutputLines(lines.map((text: string) => ({
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
            {meta.isHtml ? '렌더링' : 'Run'}
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
          dangerouslySetInnerHTML={{ __html: marked.parse(resolvedCode) as string }}
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
      {!isCollapsed && meta.isHtml && showHtmlRender && resolvedCode.trim() && (
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
        <ConsoleOutput 
          success={success}
          resolvedLanguage={resolvedLanguage}
          tableData={tableData}
          outputLines={outputLines}
          accentColor={accentColor}
        />
      )}
    </div>
  )
}
