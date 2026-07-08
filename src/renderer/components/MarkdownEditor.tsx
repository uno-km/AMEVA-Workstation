import React, { useState, useEffect } from 'react'
import { BlockNoteView } from '@blocknote/mantine'
import { SuggestionMenuController, SideMenuController, SideMenu, RemoveBlockItem, DragHandleMenu, BlockColorsItem } from '@blocknote/react'
import '@blocknote/mantine/style.css'
import { X, Users, FileText, Sparkles } from 'lucide-react'
import mermaid from 'mermaid'
import { useBacktickFence } from './useBacktickFence'
import { useCollaborationHighlight } from './useCollaborationHighlight'
import { useNativeUploadIntercept } from './useNativeUploadIntercept'

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
import { MarkdownPreview } from './MarkdownPreview'
import { PeerBlockHighlightLayer } from './editor/PeerBlockHighlightLayer'
import { getCustomSlashMenuItems } from './editor/customSlashMenuItems'
import { WelcomeBanner } from './editor/WelcomeBanner'
import { RichStyleToolbar } from './editor/RichStyleToolbar'
import { ImageLightbox } from './ImageLightbox'

import { useHoverBlock } from '../hooks/editor/useHoverBlock'
import { useSideMenuHoverSync } from '../hooks/editor/useSideMenuHoverSync'
import { useEditorDragDrop } from '../hooks/editor/useEditorDragDrop'
import { useEditorPaste } from '../hooks/editor/useEditorPaste'
import { useImageLightbox } from '../hooks/editor/useImageLightbox'
import { useSelectionTracking } from '../hooks/editor/useSelectionTracking'

import { useAppContext } from '../contexts/AppContext'
import { useWorkspaceStore } from '../stores/useWorkspaceStore'

export interface MarkdownEditorProps {
  onMouseMove?: (e: React.MouseEvent) => void
  onSelectionChange?: (selection: { anchorBlockId: string; focusBlockId: string } | null) => void
  onBlockHighlight?: (blockId: string | null, isEditing: boolean) => void
  editorContainerRef: React.RefObject<HTMLDivElement | null>
  onSelectedTextChange?: (text: string) => void
  taggedBlocks?: { id: string; text: string }[]
  setTaggedBlocks?: (blocks: { id: string; text: string }[]) => void
}

// ─────────────────────────────────────────────────────────────
// 🏁 MarkdownEditor 메인 컴포넌트
// ─────────────────────────────────────────────────────────────
export function MarkdownEditor({
  onMouseMove = () => {},
  onSelectionChange = () => {},
  onBlockHighlight = () => {},
  editorContainerRef,
  onSelectedTextChange,
  taggedBlocks = [],
  setTaggedBlocks = () => {},
}: MarkdownEditorProps) {
  const { editor, editorMode, peers, settings, isProPlan, handleOpenFile, handleStartWelcomeEdit, handleStartNewDocument } = useAppContext()
  const { currentContent, setCurrentContent, tabs } = useWorkspaceStore()
  
  const wordWrap = settings?.wordWrap || false
  const showCodeRunner = settings?.showCodeConsole || false
  const theme = settings?.theme || 'dark'
  const installedPlugins = settings?.installedPlugins || []

  console.debug("Unused vars (MarkdownEditor):", { X, showCodeRunner, taggedBlocks });
  const [selectedFont, setSelectedFont] = useState('Pretendard')
  const [selectedSize, setSelectedSize] = useState('14px')

  const { hoverBlock, handleEditorMouseMove } = useHoverBlock(
    editor, editorMode, editorContainerRef, onMouseMove, isProPlan
  )

  // 🖱️ 사이드 메뉴(+ ::) 포털 렌더링 시 CSS hover 우회 문제 해결 (JS 기반 호버 동기화)
  useSideMenuHoverSync()

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

  // 드롭 & 페이스트 (URL 렌더링) 처리 훅
  const { onDropCapture } = useEditorDragDrop(editor, editorMode)
  const { onPasteCapture } = useEditorPaste(editor, editorMode)

  // 1. 이미지 클릭 라이트박스
  const { selectedImg, setSelectedImg } = useImageLightbox(editorContainerRef)

  // 2. 드래그 셀렉션 트래킹
  const { handleSelection } = useSelectionTracking(editor, onSelectedTextChange, onSelectionChange)

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
      {hasRichStyling && (
        <RichStyleToolbar
          editor={editor}
          editorMode={editorMode}
          hasRichStyling={hasRichStyling}
          selectedFont={selectedFont}
          setSelectedFont={setSelectedFont}
          selectedSize={selectedSize}
          setSelectedSize={setSelectedSize}
        />
      )}
      <div
        ref={editorContainerRef}
        onMouseMove={handleEditorMouseMove}
        onMouseUp={handleSelection}
        onKeyUp={handleSelection}
        onDropCapture={onDropCapture}
        onPasteCapture={onPasteCapture}
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
            onStartWelcomeEdit={handleStartWelcomeEdit}
            onStartNewDocument={handleStartNewDocument}
            onOpenFile={handleOpenFile}
            currentContent={currentContent}
            editor={editor}
          />
        ) : editorMode === 'edit' ? (
          <BlockNoteView editor={editor} theme={theme === 'white' ? 'light' : 'dark'} editable>
            <SideMenuController
              sideMenu={(props) => (
                <SideMenu
                  {...props}
                  dragHandleMenu={(props) => (
                    <DragHandleMenu {...props}>
                      <RemoveBlockItem {...props}>삭제 (Delete)</RemoveBlockItem>
                      <BlockColorsItem {...props}>색상 (Colors)</BlockColorsItem>
                    </DragHandleMenu>
                  )}
                />
              )}
            />
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
                    editor.insertInlineContent([{ type: 'text', text: `@${p.name} `, styles: { bold: true } as any }])
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
                          styles: { underline: true } as any 
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
                          styles: { italic: true } as any
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
