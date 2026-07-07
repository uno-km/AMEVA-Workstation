import React, { useState, useEffect, useRef } from 'react'
import mermaid from 'mermaid'

// Mermaid Diagram 렌더러
export function InlineMermaidRenderer({ code }: { code: string }) {
  const [svg, setSvg] = useState<string>('')
  const [error, setError] = useState<string | null>(null)
  const elementId = useRef(`mermaid-preview-${Math.random().toString(36).substr(2, 9)}`)

  useEffect(() => {
    let active = true
    const renderDiagram = async () => {
      try {
        const cleanCode = code.replace(/^(\s*)end([가-힣a-zA-Z]+)/gm, '$1end\n$1$2')
        
        document.querySelectorAll('[id^="dmermaid"]').forEach(el => el.remove())

        try {
          await mermaid.parse(cleanCode)
        } catch (parseErr: any) {
          if (active) {
            setError(parseErr.message || 'Mermaid 문법 오류가 감지되었습니다.')
          }
          return
        }

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
