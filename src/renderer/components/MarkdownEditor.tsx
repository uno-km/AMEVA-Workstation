import React, { useState, useEffect, useRef, useCallback } from 'react'
import { BlockNoteView } from '@blocknote/mantine'
import { type AmevaEditor } from '../editor/amevaBlockSchema'
import { getDefaultReactSlashMenuItems, SuggestionMenuController } from '@blocknote/react'
import '@blocknote/mantine/style.css'
import type { PeerState } from '../../shared/types'
import { ImageLightbox } from './ImageLightbox'
import { Terminal, Code2, Eye, Globe, X, Users, FileText, Sparkles, FileImage } from 'lucide-react'

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
import { useBacktickFence } from './useBacktickFence'
import { useCollaborationHighlight } from './useCollaborationHighlight'
import { MarkdownPreview } from './MarkdownPreview'
import { PeerBlockHighlightLayer } from './editor/PeerBlockHighlightLayer'
import { getCustomSlashMenuItems } from './editor/customSlashMenuItems'
import { WelcomeBanner } from './editor/WelcomeBanner'

import type { EditorMode } from '../../shared/types'

interface MarkdownEditorProps {
  editor: AmevaEditor | null
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
  setTaggedBlocks: (blocks: { id: string; text: string }[]) => void
  tabs?: Array<{ id: string; filePath: string | null; content: string; blocks: any[] }>
  isProPlan?: boolean
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
  console.debug("Unused vars (MarkdownEditor):", { X, showCodeRunner, taggedBlocks });
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

    const sel = editor.getSelection()
    if (sel && sel.blocks && sel.blocks.length > 0) {
      onSelectionChange({ anchorBlockId: sel.blocks[0].id, focusBlockId: sel.blocks[sel.blocks.length - 1].id })
    } else {
      onSelectionChange(null)
    }
  }

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
              if (taggedBlocks.some(b => b.id === hoverBlock.id)) return
              const snippet = hoverBlock.text.length > 20
                ? hoverBlock.text.slice(0, 20) + '...'
                : hoverBlock.text || '본문 문단'
              setTaggedBlocks([...taggedBlocks, { id: hoverBlock.id, text: snippet }])
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
          <WelcomeBanner
            onStartWelcomeEdit={onStartWelcomeEdit}
            onStartNewDocument={onStartNewDocument}
            onOpenFile={onOpenFile}
            currentContent={currentContent}
            editor={editor}
          />
        ) : editorMode === 'edit' ? (
          <BlockNoteView editor={editor} theme={theme === 'white' ? 'light' : 'dark'} editable slashMenu={false}>
            <SuggestionMenuController
              triggerCharacter="/"
              getItems={async (query) => {
                const items = getCustomSlashMenuItems(editor, installedPlugins)
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

export { PeerBlockHighlightLayer } from './editor/PeerBlockHighlightLayer'
export { getCustomSlashMenuItems } from './editor/customSlashMenuItems'
export { WelcomeBanner } from './editor/WelcomeBanner'
