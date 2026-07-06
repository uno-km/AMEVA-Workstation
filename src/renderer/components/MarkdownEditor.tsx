import React, { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { BlockNoteView } from '@blocknote/mantine'
import { BlockNoteEditor } from '@blocknote/core'
import { getDefaultReactSlashMenuItems, SuggestionMenuController } from '@blocknote/react'
import '@blocknote/mantine/style.css'
import type { PeerState } from '../../shared/types'
import { ImageLightbox } from './ImageLightbox'
import { Terminal, Code2, Eye, Globe, X, Users, FileText, Sparkles } from 'lucide-react'
import { marked } from 'marked'
import mermaid from 'mermaid'

// Mermaid 초기화
try {
  mermaid.initialize({
    startOnLoad: false,
    theme: 'dark',
    securityLevel: 'loose',
  })
} catch (e) {
  console.error('Failed to initialize mermaid:', e)
}

// ─── 기능별 이원화 컴포넌트 및 커스텀 훅 임포트 ─────────────────────
import { JupyterCodeViewer, getLangMeta } from './JupyterCodeViewer'
import { JupyterCodeEditorHeader, JupyterCodeEditorTerminal } from './JupyterCodeEditor'
import type { RunState } from './JupyterCodeEditor'
import { useBacktickFence } from './useBacktickFence'
import { useCollaborationHighlight } from './useCollaborationHighlight'
import { useNativeUploadIntercept } from './useNativeUploadIntercept'

import type { EditorMode } from '../../shared/types'

interface MarkdownEditorProps {
  editor: BlockNoteEditor | null
  editorMode: EditorMode
  peers: PeerState[]
  onMouseMove: (e: React.MouseEvent) => void
  onSelectionChange: (selection: { anchorBlockId: string; focusBlockId: string } | null) => void
  onBlockHighlight?: (blockId: string | null, isEditing: boolean) => void
  editorContainerRef: React.RefObject<HTMLDivElement | null>
  currentContent: string
  setCurrentContent: (content: string) => void
  wordWrap: boolean
  showCodeRunner: boolean
  theme: 'dark' | 'gray' | 'white' | 'hacker'
  onSelectedTextChange?: (text: string) => void
  installedPlugins?: string[]
  onOpenFile?: () => void
  onStartWelcomeEdit?: () => void
  onStartNewDocument?: () => void
  taggedBlocks: { id: string; text: string }[]
  setTaggedBlocks: React.Dispatch<React.SetStateAction<{ id: string; text: string }[]>>
  tabs?: Array<{ id: string; filePath: string | null; content: string; blocks: any[] }>
  isProPlan?: boolean
}

// ─────────────────────────────────────────────────────────────
// 타 사용자 블록 하이라이트 레이어 컴포넌트
// peers 배열의 blockHighlight 를 읽어 해당 블록 DOM 위치에 overlay 렌더링
// ─────────────────────────────────────────────────────────────
interface PeerBlockHighlightLayerProps {
  peers: PeerState[]
  containerRef: React.RefObject<HTMLDivElement | null>
}

interface BlockOverlay {
  peerId: string
  peerName: string
  peerColor: string
  isEditing: boolean
  top: number
  left: number
  width: number
  height: number
}

function PeerBlockHighlightLayer({ peers, containerRef }: PeerBlockHighlightLayerProps) {
  const [overlays, setOverlays] = useState<BlockOverlay[]>([])

  useEffect(() => {
    const activeList = peers.filter(p => p.blockHighlight?.blockId)
    if (activeList.length === 0) {
      setOverlays(prev => prev.length === 0 ? prev : [])
      return
    }

    const computeOverlays = () => {
      const container = containerRef.current
      if (!container) return

      const containerRect = container.getBoundingClientRect()
      const scrollTop = container.scrollTop
      const newOverlays: BlockOverlay[] = []

      for (const peer of activeList) {
        if (!peer.blockHighlight) continue
        const { blockId, isEditing } = peer.blockHighlight

        const blockDom = document.querySelector(`[data-id="${blockId}"], [data-block-id="${blockId}"]`)
        if (!blockDom) continue

        const outerEl = blockDom.closest('.bn-block-outer') || blockDom
        const rect = outerEl.getBoundingClientRect()

        newOverlays.push({
          peerId: peer.id,
          peerName: peer.name,
          peerColor: peer.color,
          isEditing,
          top: rect.top - containerRect.top + scrollTop,
          left: rect.left - containerRect.left,
          width: rect.width,
          height: rect.height,
        })
      }
      setOverlays(prev => {
        const isDifferent = newOverlays.length !== prev.length ||
          newOverlays.some((item, idx) => 
            item.peerId !== prev[idx]?.peerId || 
            item.isEditing !== prev[idx]?.isEditing ||
            item.top !== prev[idx]?.top ||
            item.height !== prev[idx]?.height ||
            item.width !== prev[idx]?.width
          )
        return isDifferent ? newOverlays : prev
      })
    }

    computeOverlays()
    const timer = setInterval(computeOverlays, 300)

    window.addEventListener('resize', computeOverlays)
    const container = containerRef.current
    if (container) container.addEventListener('scroll', computeOverlays)

    return () => {
      clearInterval(timer)
      window.removeEventListener('resize', computeOverlays)
      if (container) container.removeEventListener('scroll', computeOverlays)
    }
  }, [peers, containerRef])

  if (overlays.length === 0) return null

  // 같은 블록에 있는 피어들 라벨 세로 위치 조율용 Map
  const blockLabelCounts = new Map<string, number>()

  return (
    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, pointerEvents: 'none', zIndex: 5 }}>
      {overlays.map((ov) => {
        const blockKey = `${ov.top}_${ov.left}`
        const count = blockLabelCounts.get(blockKey) || 0
        blockLabelCounts.set(blockKey, count + 1)
        const labelTop = count * 22

        return (
          <React.Fragment key={ov.peerId}>
            <div
              style={{
                position: 'absolute',
                top: ov.top,
                left: ov.left - 4,
                width: ov.width + 8,
                height: ov.height,
                backgroundColor: ov.peerColor,
                opacity: ov.isEditing ? 0.14 : 0.08,
                pointerEvents: 'none',
                zIndex: 5,
                borderRadius: '4px',
                borderLeft: `3px solid ${ov.peerColor}`,
                transition: 'opacity 0.2s, top 0.12s, height 0.12s',
              }}
            />

            <div
              style={{
                position: 'absolute',
                top: ov.top - 20 + labelTop,
                left: ov.left,
                pointerEvents: 'none',
                zIndex: 20,
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                transition: 'top 0.12s',
              }}
            >
              <div style={{
                width: '14px', height: '14px', borderRadius: '50%',
                backgroundColor: ov.peerColor,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '8px', fontWeight: 800, color: '#fff',
                boxShadow: `0 0 6px ${ov.peerColor}80`,
                flexShrink: 0,
              }}>
                {ov.peerName.charAt(0).toUpperCase()}
              </div>

              <div style={{
                background: ov.peerColor,
                color: '#fff',
                fontSize: '9px',
                fontWeight: 700,
                padding: '2px 6px',
                borderRadius: '3px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
                whiteSpace: 'nowrap',
                display: 'flex',
                alignItems: 'center',
                gap: '3px',
                opacity: 0.95,
              }}>
                <span>{ov.peerName}</span>
                {ov.isEditing && (
                  <span style={{
                    fontSize: '8px', opacity: 0.9,
                    animation: 'collab-pulse 1.2s infinite alternate',
                  }}>
                    editing...
                  </span>
                )}
              </div>
            </div>
          </React.Fragment>
        )
      })}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// 🔥 Markdown Preview (Mermaid-aware) — preview 모드 전용
// ─────────────────────────────────────────────────────────────
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

    lastIndex = match.index + match[0].length
  }

  const remaining = fullHtml.slice(lastIndex)
  if (remaining.trim()) segments.push({ type: 'html', html: remaining })

  return segments
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

function MarkdownPreview({ markdown, editor }: { markdown: string; editor: BlockNoteEditor | null }) {
  const segments = React.useMemo(() => buildPreviewSegments(markdown), [markdown])
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
                  blockId={`preview-cell-${idx}`}
                />
              </div>
            )
          }
        }
        return <div key={idx} dangerouslySetInnerHTML={{ __html: seg.html || '' }} />
      })}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// 🏁 MarkdownEditor 메인 컴포넌트
// ─────────────────────────────────────────────────────────────
export function MarkdownEditor({
  editor,
  editorMode,
  peers,
  onMouseMove,
  onSelectionChange,
  onBlockHighlight,
  editorContainerRef,
  currentContent,
  setCurrentContent,
  wordWrap,
  showCodeRunner,
  theme,
  onSelectedTextChange,
  installedPlugins = [],
  onOpenFile,
  onStartWelcomeEdit,
  onStartNewDocument,
  taggedBlocks,
  setTaggedBlocks,
  tabs = [],
  isProPlan = false,
}: MarkdownEditorProps) {
  const [selectedImg, setSelectedImg] = useState<string | null>(null)
  const [selectedFont, setSelectedFont] = useState('Pretendard')
  const [selectedSize, setSelectedSize] = useState('14px')

  // 🤖 AI 태깅용 마우스 호버 블록 상태 및 추적 핸들러
  const [hoverBlock, setHoverBlock] = useState<{ id: string; rect: DOMRect; text: string } | null>(null)

  const handleEditorMouseMove = useCallback((e: React.MouseEvent) => {
    // 부모 마우스 무브 연계 실행
    onMouseMove(e)

    if (!isProPlan) {
      if (hoverBlock) setHoverBlock(null)
      return
    }

    if (editorMode !== 'edit' || !editor) {
      setHoverBlock(null)
      return
    }

    const container = editorContainerRef.current
    if (!container) return

    const clientX = e.clientX
    const clientY = e.clientY

    // 커서 좌표의 요소 구하기
    const el = document.elementFromPoint(clientX, clientY)
    if (!el) return

    // 1. 별표 버튼 위에 있거나 근처일 때는 호버 상태 락 유지
    const isOverSparkle = el.closest('.sparkle-hover-btn')
    if (isOverSparkle) {
      return
    }

    const blockOuter = el.closest('.bn-block-outer') as HTMLElement
    if (blockOuter) {
      const blockId = blockOuter.getAttribute('data-id') || blockOuter.querySelector('[data-id]')?.getAttribute('data-id')
      if (blockId) {
        try {
          const targetBlock = editor.getBlock(blockId)
          if (targetBlock) {
            const textContent = targetBlock.content
              ? (targetBlock.content as any).map((c: any) => c.text).join('')
              : ''

            const rect = blockOuter.getBoundingClientRect()
            const containerRect = container.getBoundingClientRect()

            setHoverBlock({
              id: blockId,
              rect: {
                top: rect.top - containerRect.top + container.scrollTop,
                left: rect.left - containerRect.left,
                width: rect.width,
                height: rect.height,
              } as DOMRect,
              text: textContent.trim() || (targetBlock.type === 'heading' ? '제목 문단' : '본문 문단')
            })
            return
          }
        } catch {}
      }
    }

    // 2. 마우스가 블록 옆 공백으로 나갔으나 Y축 세로 범위 안이면 버튼 노출 락 유지
    if (hoverBlock) {
      const blockDom = document.querySelector(`[data-id="${hoverBlock.id}"], [data-block-id="${hoverBlock.id}"]`)
      if (blockDom) {
        const outer = blockDom.closest('.bn-block-outer') || blockDom
        const bRect = outer.getBoundingClientRect()
        if (clientY >= bRect.top - 8 && clientY <= bRect.bottom + 8) {
          return
        }
      }
    }

    setHoverBlock(null)
  }, [editor, editorMode, onMouseMove, editorContainerRef, hoverBlock])

  const hasRichStyling = installedPlugins.includes('rich-styling')

  useEffect(() => {
    if (!editorContainerRef.current) return
    const editorDom = editorContainerRef.current.querySelector('.bn-editor') as HTMLElement
    if (editorDom) {
      if (hasRichStyling) {
        editorDom.style.fontFamily = selectedFont
        editorDom.style.fontSize = selectedSize
      } else {
        editorDom.style.fontFamily = ''
        editorDom.style.fontSize = ''
      }
    }
  }, [selectedFont, selectedSize, editor, editorMode, hasRichStyling])

  // ─── 3가지 커스텀 기능별 훅 마운트 (코드 파편화 분리 완수) ───
  useBacktickFence(editor)
  useCollaborationHighlight(editor, onBlockHighlight, editorContainerRef)
  useNativeUploadIntercept(editor, editorContainerRef)

  // 1. 이미지 클릭 라이트박스
  useEffect(() => {
    if (!editorContainerRef.current) return
    const container = editorContainerRef.current
    const handleImgClick = (e: MouseEvent) => {
      const t = e.target as HTMLElement
      if (t.tagName === 'IMG') setSelectedImg((t as HTMLImageElement).src)
    }
    container.addEventListener('click', handleImgClick)
    return () => container.removeEventListener('click', handleImgClick)
  }, [editorContainerRef])

  // 2. 드래그 셀렉션 트래킹
  const handleSelection = () => {
    if (!editor) return

    const selText = window.getSelection()?.toString() || ''
    if (onSelectedTextChange) {
      onSelectedTextChange(selText)
    }

    const sel = editor.selection
    if (sel) {
      onSelectionChange({ anchorBlockId: sel.anchorBlock.id, focusBlockId: sel.focusBlock.id })
    } else {
      onSelectionChange(null)
    }
  }

  // 3. 슬래시 메뉴 — 언어별 항목 추가
  const getCustomSlashMenuItems = useCallback((editorInstance: BlockNoteEditor) => {
    const defaultItems = getDefaultReactSlashMenuItems(editorInstance)

    const filtered = defaultItems.filter(item =>
      !item.title.toLowerCase().includes('code block') &&
      !item.title.toLowerCase().includes('codeblock')
    )

    const insertCodeBlock = (lang: string) => () => {
      try {
        const pos = editorInstance.getTextCursorPosition()
        if (!pos) return
        editorInstance.updateBlock(pos.block.id, {
          type: 'jupyter',
          props: {
            language: lang,
            code: '',
            runState: JSON.stringify({ hasRun: false, success: null, outputLines: [] })
          },
        })
        editorInstance.setTextCursorPosition(pos.block.id, 'start')
        editorInstance.focus()
      } catch {}
    }

    const insertDrawingBlock = () => {
      try {
        const pos = editorInstance.getTextCursorPosition()
        if (!pos) return
        editorInstance.updateBlock(pos.block.id, {
          type: 'drawing',
          props: { data: '[]' }
        })
        editorInstance.setTextCursorPosition(pos.block.id, 'start')
        editorInstance.focus()
      } catch {}
    }

    const codeItems = [
      {
        title: 'JavaScript Code Block',
        onItemClick: insertCodeBlock('javascript'),
        aliases: ['js', 'javascript', 'node', 'code', 'snippet', 'cj', 'c'],
        group: 'Code',
        icon: <Code2 size={16} color="#f59e0b" />,
        subtext: 'JavaScript 실행 가능 코드 블록 삽입 (/cj 또는 /c)',
      },
      {
        title: 'Python Code Block',
        onItemClick: insertCodeBlock('python'),
        aliases: ['py', 'python', 'code', 'snippet', 'cp'],
        group: 'Code',
        icon: <Code2 size={16} color="#3b82f6" />,
        subtext: 'Python 실행 가능 코드 블록 삽입 (/cp)',
      },
      {
        title: 'SQL Code Block',
        onItemClick: insertCodeBlock('sql'),
        aliases: ['sql', 'sqlite', 'db', 'query', 'csql'],
        group: 'Code',
        icon: <Code2 size={16} color="#06b6d4" />,
        subtext: '가상 SQLite DB 실행 가능 SQL 코드 블록 삽입 (/csql)',
      },
      {
        title: 'HTML Sandbox Block',
        onItemClick: insertCodeBlock('html'),
        aliases: ['html', 'css', 'web', 'sandbox', 'ch'],
        group: 'Code',
        icon: <Globe size={16} color="#14b8a6" />,
        subtext: '실시간 프리뷰 지원 HTML/JS 샌드박스 삽입 (/ch)',
      },
      {
        title: 'Mermaid Diagram',
        onItemClick: insertCodeBlock('mermaid'),
        aliases: ['mermaid', 'diagram', 'flowchart', 'chart', 'cm'],
        group: 'Code',
        icon: <Eye size={16} color="#8b5cf6" />,
        subtext: 'Mermaid 다이어그램 블록 삽입 (/cm)',
      },
      {
        title: 'JSON Code Block',
        onItemClick: insertCodeBlock('json'),
        aliases: ['json', 'data', 'object'],
        group: 'Code',
        icon: <Code2 size={16} color="#10b981" />,
        subtext: 'JSON 데이터 구조화 코드 블록 삽입',
      },
      {
        title: 'Bash Code Block',
        onItemClick: insertCodeBlock('bash'),
        aliases: ['bash', 'sh', 'shell', 'terminal'],
        group: 'Code',
        icon: <Terminal size={16} color="#ec4899" />,
        subtext: 'Bash 쉘 스크립트 코드 블록 삽입',
      },
      {
        title: 'Plain Code Block',
        onItemClick: insertCodeBlock('plaintext'),
        aliases: ['code', 'codeblock', 'plain', 'text', 'ct'],
        group: 'Code',
        icon: <Code2 size={16} color="#6b7280" />,
        subtext: '기본 텍스트 및 기타 언어용 코드 블록 삽입 (/ct)',
      },
    ]

    const drawingSubscribed = installedPlugins.includes('drawing-board')
    const drawingItems = drawingSubscribed ? [
      {
        title: 'Drawing Board',
        onItemClick: insertDrawingBlock,
        aliases: ['drawing', 'draw', 'sketch', 'paint', 'canvas'],
        group: 'Media',
        icon: <FileImage size={16} color="#a855f7" />,
        subtext: 'Excalidraw 기반 화이트보드 드로잉 블록 삽입 (/draw)',
      }
    ] : []

    return [...filtered, ...codeItems, ...drawingItems]
  }, [installedPlugins])

  if (!editor) {
    return (
      <div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
        에디터를 준비 중입니다...
      </div>
    )
  }

  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column',
      height: '100%', position: 'relative', backgroundColor: 'var(--bg-main)',
    }}>
      {hasRichStyling && editorMode === 'edit' && (
        <div style={{
          padding: '8px 16px',
          borderBottom: '1px solid var(--border-muted)',
          backgroundColor: 'var(--bg-deep)',
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          zIndex: 50,
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Font</span>
            <select
              value={selectedFont}
              onChange={(e) => setSelectedFont(e.target.value)}
              style={{
                background: '#16161a',
                border: '1px solid #2e2e38',
                borderRadius: '4px',
                color: '#fff',
                fontSize: '11px',
                padding: '3px 6px',
                outline: 'none',
                cursor: 'pointer',
              }}
            >
              <option value="Pretendard">Pretendard (Gothic)</option>
              <option value="'Courier New', Courier, monospace">Monospace (Hacker)</option>
              <option value="'Gungsuh', '궁서', serif">궁서체 (Classic)</option>
              <option value="'Batang', '바탕', serif">바탕체 (Serif)</option>
              <option value="system-ui, sans-serif">System UI</option>
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Size</span>
            <select
              value={selectedSize}
              onChange={(e) => setSelectedSize(e.target.value)}
              style={{
                background: '#16161a',
                border: '1px solid #2e2e38',
                borderRadius: '4px',
                color: '#fff',
                fontSize: '11px',
                padding: '3px 6px',
                outline: 'none',
                cursor: 'pointer',
              }}
            >
              <option value="12px">12px (Compact)</option>
              <option value="14px">14px (Default)</option>
              <option value="16px">16px (Medium)</option>
              <option value="18px">18px (Large)</option>
              <option value="22px">22px (Huge)</option>
            </select>
          </div>
        </div>
      )}
      <div
        ref={editorContainerRef}
        onMouseMove={handleEditorMouseMove}
        onMouseUp={handleSelection}
        onKeyUp={handleSelection}
        className={!wordWrap ? 'wrap-disabled' : ''}
        style={{ flex: 1, overflowY: 'auto', padding: '40px 60px', position: 'relative' }}
      >
        <PeerBlockHighlightLayer peers={peers} containerRef={editorContainerRef} />

        {/* 🤖 컨텍스트 연동 호버 에이전트 별표(✨) 버튼 레이어 */}
        {hoverBlock && editorMode === 'edit' && (
          <button
            className="sparkle-hover-btn"
            style={{
              position: 'absolute',
              top: hoverBlock.rect.top + (hoverBlock.rect.height - 24) / 2,
              left: hoverBlock.rect.left + hoverBlock.rect.width + 12, // 본문 우측 마진 구역
              width: '24px',
              height: '24px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #8b5cf6 0%, #a78bfa 100%)',
              border: 'none',
              boxShadow: '0 2px 8px rgba(139, 92, 246, 0.4)',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '12px',
              cursor: 'pointer',
              zIndex: 30,
              padding: 0,
              transition: 'transform 0.15s',
            }}
            title="이 블록을 AI 채팅 컨텍스트로 태그하여 참조"
            onClick={(e) => {
              e.stopPropagation()
              setTaggedBlocks(prev => {
                if (prev.some(b => b.id === hoverBlock.id)) return prev
                const snippet = hoverBlock.text.length > 20
                  ? hoverBlock.text.slice(0, 20) + '...'
                  : hoverBlock.text || '본문 문단'
                return [...prev, { id: hoverBlock.id, text: snippet }]
              })
            }}
          >
            ✨
          </button>
        )}

        {peers.map((peer) => {
          if (!peer.dragSelection?.rects) return null
          return peer.dragSelection.rects.map((rect, idx) => (
            <div
              key={`${peer.id}-drag-${idx}`}
              style={{
                position: 'absolute', top: rect.top, left: rect.left,
                width: rect.width, height: rect.height,
                backgroundColor: peer.color, opacity: 0.25,
                pointerEvents: 'none', zIndex: 10, borderRadius: '2px',
              }}
            />
          ))
        })}

        {peers.map((peer) => {
          if (!peer.pointer) return null
          return (
            <div
              key={`${peer.id}-pointer`}
              style={{
                position: 'absolute', top: peer.pointer.y, left: peer.pointer.x,
                width: '12px', height: '12px', pointerEvents: 'none', zIndex: 99,
                transform: 'translate(-2px,-2px)',
                transition: 'top 0.08s ease, left 0.08s ease',
              }}
            >
              <svg viewBox="0 0 24 24" style={{ width: '100%', height: '100%', fill: peer.color }}>
                <path d="M4.5 3v15.2l4.8-4.8 5.7 5.7 2.5-2.5-5.7-5.7 6-1.9L4.5 3z" />
              </svg>
              <div style={{
                position: 'absolute', top: '12px', left: '12px',
                background: peer.color, color: '#fff',
                fontSize: '9px', fontWeight: 700,
                padding: '2px 6px', borderRadius: '3px',
                whiteSpace: 'nowrap', boxShadow: '0 2px 6px rgba(0,0,0,0.4)',
              }}>
                {peer.name}
              </div>
            </div>
          )
        })}

        {editorMode === 'welcome' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* 눈부신 웰컴 오로라 그래디언트 배너 */}
            <div style={{
              background: 'linear-gradient(135deg, rgba(139,92,246,0.18) 0%, rgba(249,115,22,0.12) 100%)',
              border: '1px solid rgba(139, 92, 246, 0.35)',
              borderRadius: '16px',
              padding: '24px 32px',
              boxShadow: '0 8px 32px rgba(139, 92, 246, 0.08)',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              position: 'relative',
              overflow: 'hidden',
            }}>
              <div style={{ zIndex: 2 }}>
                <h1 style={{ fontSize: '20px', fontWeight: 800, margin: '0 0 6px 0', background: 'linear-gradient(90deg, #a78bfa, #fdba74)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  🚀 AMEVA Workstation Guide Book
                </h1>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0, lineHeight: 1.5 }}>
                  아메바 워크스테이션에 오신 것을 환영합니다! 아래는 손실 없이 완전히 렌더링된 공식 안내 백서입니다.<br />
                  문서를 직접 작성하거나 웰컴 가이드를 편집하려면 아래 버튼 중 하나를 클릭해 편집을 바로 시작하십시오.
                </p>
              </div>

              {/* 아름다운 액션 버튼 그룹 */}
              <div style={{ display: 'flex', gap: '12px', zIndex: 2, flexWrap: 'wrap' }}>
                <button
                  className="btn btn-primary"
                  style={{
                    padding: '8px 16px',
                    fontSize: '12px',
                    fontWeight: 'bold',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    boxShadow: '0 4px 12px rgba(139, 92, 246, 0.3)',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                  onClick={onStartWelcomeEdit}
                >
                  <Code2 size={14} /> ✍ 가이드 문서 편집하기
                </button>
                
                <button
                  className="btn btn-glass"
                  style={{
                    padding: '8px 16px',
                    fontSize: '12px',
                    fontWeight: 'bold',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    background: 'rgba(255, 255, 255, 0.06)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    color: '#fff',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                  onClick={onStartNewDocument}
                >
                  ➕ 새 문서 작성하기
                </button>

                <button
                  className="btn btn-glass"
                  style={{
                    padding: '8px 16px',
                    fontSize: '12px',
                    fontWeight: 'bold',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    background: 'rgba(255, 255, 255, 0.06)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    color: '#fff',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                  onClick={onOpenFile}
                >
                  📂 기존 파일 열기
                </button>
              </div>
            </div>

            {/* 마크다운 원본의 완전 무결 렌더링 뷰포트 */}
            <div style={{
              background: 'var(--bg-deep)',
              border: '1px solid var(--border-muted)',
              borderRadius: '16px',
              padding: '24px 36px',
            }}>
              <MarkdownPreview markdown={currentContent} editor={editor} />
            </div>
          </div>
        ) : editorMode === 'edit' ? (
          <BlockNoteView editor={editor} theme={theme === 'white' ? 'light' : 'dark'} editable slashMenu={false}>
            <SuggestionMenuController
              triggerCharacter="/"
              getItems={async (query) => {
                const items = getCustomSlashMenuItems(editor)
                return items.filter(item =>
                  item.title.toLowerCase().includes(query.toLowerCase()) ||
                  (item.aliases?.some(a => a.toLowerCase().includes(query.toLowerCase())))
                )
              }}
            />
            <SuggestionMenuController
              triggerCharacter="@"
              getItems={async (query) => {
                if (!editor) return []
                const peerItems = peers.map(p => ({
                  title: p.name || '알 수 없는 사용자',
                  subtext: '협업 참가자 멘션',
                  icon: <Users size={14} color={p.color || '#a855f7'} />,
                  onItemClick: () => {
                    editor.insertInlineContent([{ type: 'text', text: `@${p.name} `, styles: { bold: true } }])
                  }
                }))
                const docItems = tabs.map(t => {
                  const title = t.filePath ? t.filePath.split(/[\\/]/).pop() || '문서' : '제목 없음'
                  return {
                    title: title,
                    subtext: t.filePath ? `문서 경로: ${t.filePath}` : '저장되지 않은 문서',
                    icon: <FileText size={14} color="#3b82f6" />,
                    onItemClick: () => {
                      editor.insertInlineContent([
                        { 
                          type: 'text', 
                          text: `[doc:${title}]`, 
                          styles: { underline: true } 
                        }
                      ])
                    }
                  }
                })
                const allItems = [...peerItems, ...docItems]
                return allItems.filter(item => item.title.toLowerCase().includes(query.toLowerCase()))
              }}
            />
            <SuggestionMenuController
              triggerCharacter="#"
              getItems={async (query) => {
                if (!editor) return []
                const headingBlocks = editor.document.filter(b => b.type === 'heading')
                const items = headingBlocks.map(b => {
                  const textContent = b.content && Array.isArray(b.content) 
                    ? b.content.map((c: any) => c.text).join('') 
                    : '제목 없음'
                  const level = b.props?.level || 1
                  return {
                    title: textContent,
                    subtext: `H${level} 헤더 참조 링크`,
                    icon: <Sparkles size={14} color="#10b981" />,
                    onItemClick: () => {
                      editor.insertInlineContent([
                        {
                          type: 'text',
                          text: `[${textContent}](#${b.id})`,
                          styles: { italic: true }
                        }
                      ])
                    }
                  }
                })
                return items.filter(item => item.title.toLowerCase().includes(query.toLowerCase()))
              }}
            />
          </BlockNoteView>
        ) : editorMode === 'preview' ? (
          <MarkdownPreview markdown={currentContent} editor={editor} />
        ) : (
          <div style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            padding: '16px 24px',
            boxSizing: 'border-box',
          }}>
            <textarea
              value={currentContent}
              onChange={(e) => setCurrentContent(e.target.value)}
              placeholder="여기에 마크다운 원문이 표시됩니다. 직접 수정할 수도 있습니다."
              style={{
                width: '100%',
                height: 'calc(100vh - 120px)',
                minHeight: '400px',
                background: 'rgba(5, 5, 10, 0.4)',
                border: '1px solid var(--border-muted)',
                borderRadius: '8px',
                color: 'var(--text-main)',
                fontFamily: 'Consolas, Monaco, "Courier New", Courier, monospace',
                fontSize: '13px',
                lineHeight: '1.6',
                padding: '16px',
                resize: 'none',
                outline: 'none',
                boxSizing: 'border-box',
                transition: 'all 0.2s',
              }}
              onFocus={(e) => e.currentTarget.style.borderColor = 'var(--primary)'}
              onBlur={(e) => e.currentTarget.style.borderColor = 'var(--border-muted)'}
            />
          </div>
        )}

      </div>

      {selectedImg && (
        <ImageLightbox url={selectedImg} onClose={() => setSelectedImg(null)} />
      )}
    </div>
  )
}
