import { useState } from 'react'
import { Play, Copy, ChevronDown } from 'lucide-react'
import { type AmevaEditor } from '../../editor/amevaBlockSchema'
import { useCodeRuntime } from '../../hooks/useCodeRuntime'
import { getLangMeta } from './langMeta'

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
  editor: AmevaEditor
  onRunStart: () => void
  onRunSuccess: (success: boolean, lines: string[], tableData?: any) => void
  onRunFailure: (errMessage: string) => void
  isInputCollapsed?: boolean
  onToggleInputCollapse?: () => void
}) {
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
