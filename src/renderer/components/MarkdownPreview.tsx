import React, { useState, useEffect, useRef, useMemo } from 'react'
import { marked } from 'marked'
import mermaid from 'mermaid'
import { JupyterCodeViewer } from './JupyterCodeViewer'
import { type AmevaEditor } from '../editor/amevaBlockSchema'

const MERMAID_PLACEHOLDER_PREFIX = 'MERMAIDPLACEHOLDERINDEX'

function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
}

function buildPreviewSegments(markdown: string) {
  const customBlocks: { lang: string; code: string }[] = []

  const renderer = new marked.Renderer()
  renderer.image = function({ href, title, text }) {
    const isVideo = href.toLowerCase().endsWith('.mp4') || 
                    href.toLowerCase().endsWith('.webm') || 
                    href.toLowerCase().endsWith('.mov') || 
                    href.toLowerCase().endsWith('.ogg') ||
                    href.startsWith('data:video/')
    if (isVideo) {
      return `<video src="${href}" controls style="max-width: 100%; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.3); margin: 8px 0;"></video>`
    }
    return `<img src="${href}" alt="${text}" title="${title || ''}" style="max-width: 100%;" />`
  }

  const html = marked.parse(markdown, {
    renderer,
    walkTokens(token) {
      if (token.type === 'code') {
        const lang = (token.lang || '').toLowerCase()
        const rawCode = decodeHtmlEntities(token.text)
        const idx = customBlocks.length
        customBlocks.push({ lang, code: rawCode })

        token.type = 'html'
        token.text = `${MERMAID_PLACEHOLDER_PREFIX}${idx}`
      }
    }
  }) as string

  const fullHtml = html
  const segments: ({ type: 'html'; html: string } | { type: 'mermaid'; code: string } | { type: 'html-preview'; code: string } | { type: 'code-runner'; code: string; language: string })[] = []

  const SPLIT_RE = new RegExp(
    `<p>\\s*${MERMAID_PLACEHOLDER_PREFIX}(\\d+)\\s*<\\/p>` +
    `|${MERMAID_PLACEHOLDER_PREFIX}(\\d+)`,
    'g'
  )

  let lastIndex = 0
  let match: RegExpExecArray | null
  SPLIT_RE.lastIndex = 0

  while ((match = SPLIT_RE.exec(fullHtml)) !== null) {
    const before = fullHtml.slice(lastIndex, match.index)
    if (before.trim()) segments.push({ type: 'html', html: before })

    const idxStr = match[1] ?? match[2]
    const idx = Number(idxStr)
    if (!isNaN(idx) && customBlocks[idx] !== undefined) {
      const block = customBlocks[idx]
      if (block.lang === 'mermaid') {
        segments.push({ type: 'mermaid', code: block.code })
      } else if (block.lang === 'html') {
        segments.push({ type: 'html-preview', code: block.code })
      } else {
        segments.push({ type: 'code-runner', code: block.code, language: block.lang })
      }
    }
    lastIndex = SPLIT_RE.lastIndex
  }

  const remaining = fullHtml.slice(lastIndex)
  if (remaining.trim()) segments.push({ type: 'html', html: remaining })

  return segments
}

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

export function MarkdownPreview({ markdown, editor }: { markdown: string; editor: AmevaEditor | null }) {
  const segments = useMemo(() => buildPreviewSegments(markdown), [markdown])
  return (
    <div className="markdown-preview-body" style={{ padding: '10px 0', color: 'var(--text-main)', lineHeight: '1.7' }}>
      {segments.length === 0 && (
        <div style={{ color: 'var(--text-muted)', padding: '20px', textAlign: 'center', fontSize: '13px' }}>
          내용이 없습니다.
        </div>
      )}
      {segments.map((seg, idx) => {
        if (seg.type === 'mermaid') {
          return (
            <div key={idx} style={{ margin: '16px 0' }}>
              <InlineMermaidRenderer code={seg.code} />
            </div>
          )
        }
        if (seg.type === 'html-preview') {
          return (
            <div key={idx} style={{ margin: '16px 0' }}>
              <iframe
                sandbox="allow-scripts"
                title="HTML Preview Frame"
                srcDoc={seg.code}
                style={{ width: '100%', height: '380px', border: '1px solid rgba(249,115,22,0.3)', borderRadius: '10px', background: '#fff' }}
              />
            </div>
          )
        }
        if (seg.type === 'code-runner') {
          if (editor) {
            const runnerLang = seg.language === 'js' ? 'javascript' : seg.language === 'py' ? 'python' : (seg.language || 'javascript')
            return (
              <div key={idx} style={{ margin: '16px 0' }}>
                <JupyterCodeViewer
                  code={seg.code || ''}
                  language={runnerLang}
                />
              </div>
            )
          }
        }
        return <div key={idx} dangerouslySetInnerHTML={{ __html: 'html' in seg ? seg.html : '' }} />
      })}
    </div>
  )
}
