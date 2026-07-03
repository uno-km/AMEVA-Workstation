import React, { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { BlockNoteView } from '@blocknote/mantine'
import { BlockNoteEditor } from '@blocknote/core'
import { getDefaultReactSlashMenuItems, SuggestionMenuController } from '@blocknote/react'
import '@blocknote/mantine/style.css'
import type { PeerState } from '../../shared/types'
import { ImageLightbox } from './ImageLightbox'
import { Terminal, Code2, Eye, Globe, X } from 'lucide-react'
import { marked } from 'marked'

// ─── 기능별 이원화 컴포넌트 및 커스텀 훅 임포트 ─────────────────────
import { JupyterCodeViewer, getLangMeta } from './JupyterCodeViewer'
import { JupyterCodeEditorHeader, JupyterCodeEditorTerminal } from './JupyterCodeEditor'
import type { RunState } from './JupyterCodeEditor'
import { useBacktickFence } from './useBacktickFence'
import { useCollaborationHighlight } from './useCollaborationHighlight'
import { useNativeUploadIntercept } from './useNativeUploadIntercept'

interface MarkdownEditorProps {
  editor: BlockNoteEditor | null
  editorMode: 'edit' | 'preview'
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

  const html = marked.parse(markdown, {
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
          // 뷰어 모드 전용으로 롤백 복원
          return (
            <div key={idx} style={{ margin: '16px 0' }}>
              <div
                className="mermaid-svg-container"
                style={{ display: 'flex', justifyContent: 'center', background: '#12121e', borderRadius: '8px', padding: '16px', overflowX: 'auto' }}
                dangerouslySetInnerHTML={{
                  __html: `<div id="mermaid-rendered-${idx}">${marked.parse('```mermaid\n' + seg.code + '\n```')}</div>`
                }}
              />
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
}: MarkdownEditorProps) {
  const [selectedImg, setSelectedImg] = useState<string | null>(null)

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

    return [...filtered, ...codeItems]
  }, [])

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
      <div
        ref={editorContainerRef}
        onMouseMove={onMouseMove}
        onMouseUp={handleSelection}
        onKeyUp={handleSelection}
        className={!wordWrap ? 'wrap-disabled' : ''}
        style={{ flex: 1, overflowY: 'auto', padding: '40px 60px', position: 'relative' }}
      >
        <PeerBlockHighlightLayer peers={peers} containerRef={editorContainerRef} />

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

        {editorMode === 'edit' ? (
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
          </BlockNoteView>
        ) : (
          <MarkdownPreview markdown={currentContent} editor={editor} />
        )}

      </div>

      {selectedImg && (
        <ImageLightbox url={selectedImg} onClose={() => setSelectedImg(null)} />
      )}
    </div>
  )
}
