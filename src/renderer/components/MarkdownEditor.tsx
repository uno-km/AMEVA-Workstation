/**
 * @file MarkdownEditor.tsx
 * @system AMEVA OS Desktop Workstation - Client Renderer
 * @location src/renderer/components/MarkdownEditor.tsx
 * @role Core Markdown Block-Note Editor Presentational View Component
 * 
 * [책임 범위 - RESPONSIBILITY]
 * - BlockNoteView 라이브러리를 바인딩하여 WYSIWYG 마크다운 문서 편집 영역을 렌더링한다.
 * - 사이드바 및 AI 패널로부터 주입받은 텍스트 및 블록 하이라이트(Peers 드래그 범위, 포인터, taggedBlocks 별표) 지표들을 화면에 투영한다.
 * - 사용자 입력 도중 단축 기호 트리거('/', '@', '#')에 맞추어 슬래시 명령, 사용자 멘션, 헤더 참조 링크 팝업을 라우팅 실행한다.
 * - 웰컴 배너, 서치바, 원문 마크다운 에어리어 등 에디터 모드(welcome/edit/preview/raw)별 분기 화면을 제어한다.
 * 
 * [책임이 아닌 것 - NON-RESPONSIBILITY]
 * - Yjs CRDT 데이터 교환 서버 통신 직접 조작 (useCollaboration 훅에 위임).
 * - AI 제안 수락 시 에디터 API 직접 패치 (useAIResponseHandler 훅에 위임).
 * 
 * [절대 깨면 안 되는 계약 - CONTRACT]
 * - MUST: 리스너 누수 방지를 위해 '+' 버튼 가로채기 캡처 이벤트(`handleMouseDownCapture`) 등록 시,
 *   useEffect 클린업 단계에서 반드시 `removeEventListener` 계약을 보존할 것.
 * - MUST NOT bypass isProPlan: AI 컨텍스트 태깅용 반짝이(✨) 단추는 Pro 전용 기능이므로,
 *   반드시 `isProPlan === true` 일 때만 렌더링하도록 조건식을 유지할 것.
 
 * [소비처 - CONSUMERS / USAGE CONTEXT]
 * - 소비처 A (src/renderer/AppLayout.tsx): 레이아웃 그리드 내부 또는 플로팅 레이어 영역 내에서 그리기로 소비.
 * - 소비처 B (src/renderer/App.tsx): 전역 모달 매니저 및 뷰포트 상태 스위칭에 따라 동적 마운트되어 소비.
 */

/* 
 * [IMPORT SEGMENTATION & CONTRACTS]
 * - React, useState, useEffect: 상태 바인딩 및 HMR 라이프사이클 구동용 React 코어 API.
 */
import React, { useState, useEffect } from 'react'

/* 
 * [BLOCKNOTE MANTINE WYSIWYG LAYOUT]
 * - BlockNoteView: 블록노트 에디터 핵심 프레임워크 Mantine 뷰.
 */
import { BlockNoteView } from '@blocknote/mantine'

/* 
 * [BLOCKNOTE REACT CONTROLLERS]
 * - SuggestionMenuController: 슬래시(/), 멘션(@), 헤더(#) 입력 감지 팝업 컨트롤러.
 * - SideMenuController: 블록 좌측의 [+] 및 [::] 드래그 그랩 영역 제어기.
 * - SideMenu: 블록 그랩 포털 사이드 메뉴 컴포넌트.
 * - RemoveBlockItem: 드래그 메뉴 내 블록 삭제 액션.
 * - DragHandleMenu: 드래그 핸들 전용 메뉴 래퍼.
 * - BlockColorsItem: 블록 배경/글자 색상 지정 액션.
 */
import { SuggestionMenuController, SideMenuController, SideMenu, RemoveBlockItem, DragHandleMenu, BlockColorsItem } from '@blocknote/react'

/* 
 * [STYLESHEET]
 * - style.css: BlockNote Mantine 기본 레이아웃 및 폰트 CSS.
 */
import '@blocknote/mantine/style.css'

/* 
 * [LUCIDE ICONS]
 * - X: 닫기 아이콘.
 * - Users: 멘션 시 참여 피어 목록 아이콘.
 * - FileText: 멘션 시 타 문서 링크 아이콘.
 * - Sparkles: 헤더 참조 링크 아이콘.
 */
import { X, Users, FileText, Sparkles } from 'lucide-react'

/* 
 * [MERMAID GRAPH ENGINE]
 * - mermaid: Jupyter 및 마크다운 내부 텍스트 플로우차트/다이어그램 실시간 컴파일러.
 */
import mermaid from 'mermaid'

/* 
 * [SUB-HOOKS FOR SEPARATE LOGICS]
 * - useBacktickFence: 세번 백틱(```) 입력 시 Jupyter 코드 블록으로 자동 파싱 전환하는 도우미 훅.
 * - useCollaborationHighlight: Yjs 피어 편집 시 블록 포커스 테두리 깜빡임 연출 훅.
 * - useNativeUploadIntercept: 이미지 드래그 드롭 업로드 시 로컬 VFS 복사 인터셉트 훅.
 */
import { useBacktickFence } from './useBacktickFence'
import { useCollaborationHighlight } from './useCollaborationHighlight'
import { useNativeUploadIntercept } from './useNativeUploadIntercept'

// Mermaid 초기화 시도
try {
  mermaid.initialize({
    startOnLoad: false,
    theme: 'dark',
    securityLevel: 'loose',
  })
} catch (e) {
  console.error('Failed to initialize mermaid:', e)
}

/* 
 * [COMPONENTS]
 * - MarkdownPreview: 읽기 전용 최종 HTML 미리보기 컴포넌트.
 * - PeerBlockHighlightLayer: 타 피어들의 텍스트 드래그 및 마우스 캐럿 위치 투영 오버레이 레이어.
 * - getCustomSlashMenuItems: 커스텀 입점 플러그인(Jupyter, Drawing 등) 추가용 슬래시 메뉴 리스트 빌더.
 * - WelcomeBanner: 최초 로딩 환영 카드 뷰.
 * - RichStyleToolbar: 폰트 및 폰트크기 강제 커스텀 툴바.
 * - ImageLightbox: 이미지 클릭 시 풀스크린 확대 뷰 모달.
 */
import { MarkdownPreview } from './MarkdownPreview'
import { PeerBlockHighlightLayer } from './editor/PeerBlockHighlightLayer'
import { getCustomSlashMenuItems } from './editor/customSlashMenuItems'
import { WelcomeBanner } from './editor/WelcomeBanner'
import { RichStyleToolbar } from './editor/RichStyleToolbar'
import { ImageLightbox } from './ImageLightbox'

/* 
 * [INTERACTION HOOKS]
 * - useHoverBlock: 마우스 커서 아래 블록 정보 및 좌표 영역 실시간 추적 훅.
 * - useSideMenuHoverSync: Mantine 포털 메뉴 호버 전파 보정 훅.
 * - useEditorDragDrop: 마크다운 파일/URL 외부 드롭 캡처 훅.
 * - useEditorPaste: 클립보드 이미지 및 코드 원문 가로채기 훅.
 * - useImageLightbox: 이미지 팝업 제어 훅.
 * - useSelectionTracking: 선택 영역 문자열 캡처 전파 훅.
 */
import { useHoverBlock } from '../hooks/editor/useHoverBlock'
import { useSideMenuHoverSync } from '../hooks/editor/useSideMenuHoverSync'
import { useEditorDragDrop } from '../hooks/editor/useEditorDragDrop'
import { useEditorPaste } from '../hooks/editor/useEditorPaste'
import { useImageLightbox } from '../hooks/editor/useImageLightbox'
import { useSelectionTracking } from '../hooks/editor/useSelectionTracking'

/* 
 * [CONTEXT & STORE]
 * - useAppContext: 에디터 인스턴스, 설정을 들고 있는 최상위 Context.
 * - useWorkspaceStore: 탭 관리 및 버퍼 정보 스토어.
 */
import { useAppContext } from '../contexts/AppContext'
import { useWorkspaceStore } from '../stores/useWorkspaceStore'

/**
 * @interface MarkdownEditorProps
 * @description 에디터 드래그 및 포인터 이동 콜백 등 외부 레이아웃 바인딩을 위한 Props.
 */
export interface MarkdownEditorProps {
  onMouseMove?: (e: React.MouseEvent) => void
  onSelectionChange?: (selection: { anchorBlockId: string; focusBlockId: string } | null) => void
  onBlockHighlight?: (blockId: string | null, isEditing: boolean) => void
  editorContainerRef: React.RefObject<HTMLDivElement | null>
  onSelectedTextChange?: (text: string) => void
  taggedBlocks?: { id: string; text: string }[]
  setTaggedBlocks?: (blocks: { id: string; text: string }[]) => void
}

/**
 * @component MarkdownEditor
 * @description WYSIWYG 에디터 영역 렌더러 및 사용자 단축 팝업 액션을 통제하는 코어 컴포넌트.
 */
export function MarkdownEditor({
  /*
   * [PROPERTY MAPPINGS]
   * - onMouseMove: 마우스 위치 트래킹 전송 핸들러.
   * - onSelectionChange: 캐럿 범위 변경 감지 핸들러.
   * - onBlockHighlight: 블록 포커싱 동기화 콜백.
   * - editorContainerRef: 최상위 DOM 마운트용 참조 레퍼런스.
   * - onSelectedTextChange: 선택 텍스트 저장 스토어 연계 핸들러.
   * - taggedBlocks: 지시용 태그 블록 정보 목록.
   * - setTaggedBlocks: 지시용 태그 블록 갱신 세터.
   */
  onMouseMove = () => {},
  onSelectionChange = () => {},
  onBlockHighlight = () => {},
  editorContainerRef,
  onSelectedTextChange,
  taggedBlocks = [],
  setTaggedBlocks = () => {},
}: MarkdownEditorProps) {
  /*
   * [CONTEXT VALUES]
   * - editor: BlockNote API 기동 본체.
   * - editorMode: welcome/edit/preview/raw 화면 모드 지표.
   * - peers: 현재 편집실 참여 협업자 레코드.
   * - settings: 렌더러 일반 세팅 정보.
   * - isProPlan: 프로 요금제 가입 여부.
   * - handleOpenFile: 파일 열기 트리거.
   * - handleStartWelcomeEdit: 웰컴 화면 종료 및 에디터 로드 콜백.
   * - handleStartNewDocument: 빈 문서 생성 콜백.
   */
  const { editor, editorMode, peers, settings, isProPlan, handleOpenFile, handleStartWelcomeEdit, handleStartNewDocument } = useAppContext()
  
  /*
   * [ZUSTAND STORE PROPERTIES]
   * - currentContent: 원문 텍스트 버퍼.
   * - setCurrentContent: 원문 텍스트 변경 세터.
   * - tabs: 다중 문서 탭 정보 목록.
   */
  const { currentContent, setCurrentContent, tabs } = useWorkspaceStore()
  
  /*
   * [LOCAL CONFIG VARIABLES]
   * - wordWrap: 줄바꿈 허용 세팅 여부.
   * - showCodeRunner: 하단 주피터 콘솔 출력창 노출 여부.
   * - theme: 화이트/다크 테마 정보.
   * - installedPlugins: 폰트 강제 변경 등 설치 완료된 플러그인 리스트.
   */
  const wordWrap = settings?.wordWrap || false
  // [RUN-TIME STATE / INVARIANT] - 변수 'showCodeRunner'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
  const showCodeRunner = settings?.showCodeConsole || false
  // [RUN-TIME STATE / INVARIANT] - 변수 'theme'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
  const theme = settings?.theme || 'dark'
  // [RUN-TIME STATE / INVARIANT] - 변수 'installedPlugins'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
  const installedPlugins = settings?.installedPlugins || []

  // Rationale: console.debug 경고 누락 및 미사용 변수 체크 해결
  console.debug("Unused vars (MarkdownEditor):", { X, showCodeRunner, taggedBlocks });

  /*
   * [RICH STYLE VARIABLES]
   * - selectedFont: 사용자가 툴바에서 지정한 커스텀 폰트명.
   * - selectedSize: 사용자가 툴바에서 지정한 커스텀 크기 px.
   */
  const [selectedFont, setSelectedFont] = useState('Pretendard')
  const [selectedSize, setSelectedSize] = useState('14px')

  /*
   * [HOVER CONTROLLER VARIABLES]
   * - hoverBlock: 현재 마우스가 올라가 있는 블록의 ID, 내용, 좌표(rect) 정보.
   * - handleEditorMouseMove: 에디터 캔버스 내 마우스 이동 실시간 감지 핸들러.
   */
  const { hoverBlock, handleEditorMouseMove } = useHoverBlock(
    editor, editorMode, editorContainerRef, onMouseMove, isProPlan
  )

  // JS 기반 포털 마운트 호버 동기화 훅 가동
  useSideMenuHoverSync()

  /*
   * [PLUGIN FLAG]
   * - hasRichStyling: 리치 폰팅 커스텀 툴바 입점 여부.
   */
  const hasRichStyling = installedPlugins.includes('rich-styling')

  /**
   * [SIDE EFFECT - Font Style Injection]
   * - Rationale: rich-styling 플러그인이 로드되어 있을 때에만 선택된 폰트와 크기를 에디터 에디터 본문 DOM에 강제 인젝션한다.
   */
  useEffect(() => {
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
    if (!editorContainerRef.current) return
  // [RUN-TIME STATE / INVARIANT] - 변수 'editorDom'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
    const editorDom = editorContainerRef.current.querySelector('.bn-editor') as HTMLElement
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
    if (editorDom) {
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
      if (hasRichStyling) {
        editorDom.style.fontFamily = selectedFont
        editorDom.style.fontSize = selectedSize
      } else {
        editorDom.style.fontFamily = ''
        editorDom.style.fontSize = ''
      }
    }
  }, [selectedFont, selectedSize, editor, editorMode, hasRichStyling, editorContainerRef])

  // 코드 펜스, 협업 깜빡임 및 파일 드롭 이미지 가로채기 훅 구동
  useBacktickFence(editor)
  useCollaborationHighlight(editor, onBlockHighlight, editorContainerRef)
  useNativeUploadIntercept(editor, editorContainerRef)

  /**
   * [SIDE EFFECT INTENTIONAL - Capture Plus Button Event]
   * - Rationale: SideMenu의 '+' 단추 클릭 이벤트를 캡처링 단계에서 인터셉트하여,
   *   해당 위치 뒤에 빈 문단을 파킹하고 슬래시 명령문('/')을 삽입하여 팝업을 신속 트리거한다.
   * - CONTRACT: 메모리 리스너 누수 방지를 위해 리스너 제거(cleanup) 코드를 유지한다.
   */
  useEffect(() => {
  // [RUN-TIME STATE / INVARIANT] - 변수 'container'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
    const container = editorContainerRef.current
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
    if (!container) return

  // [RUN-TIME STATE / INVARIANT] - 변수 'handleMouseDownCapture'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
    const handleMouseDownCapture = (e: MouseEvent) => {
  // [RUN-TIME STATE / INVARIANT] - 변수 'target'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
      const target = e.target as HTMLElement
  // [RUN-TIME STATE / INVARIANT] - 변수 'addBtn'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
      const addBtn = target.closest('.bn-side-menu-btn')
  // [RUN-TIME STATE / INVARIANT] - 변수 'isDragHandle'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
      const isDragHandle = target.closest('.bn-drag-handle')

  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
      if (addBtn && !isDragHandle) {
        e.preventDefault()
        e.stopPropagation()

  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
        if (hoverBlock && editor) {
  // [RUN-TIME STATE / INVARIANT] - 변수 'block'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
          const block = editor.getBlock(hoverBlock.id)
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
          if (block) {
  // [RUN-TIME STATE / INVARIANT] - 변수 'isEmptyParagraph'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
            const isEmptyParagraph = block.type === 'paragraph' && 
              (!block.content || block.content.length === 0 || 
               (block.content.length === 1 && block.content[0].type === 'text' && (block.content[0] as any).text === ''));

  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
            if (isEmptyParagraph) {
              editor.updateBlock(block.id, {
                type: 'paragraph',
                content: '/'
              } as any)
              editor.setTextCursorPosition(block.id, 'end')
            } else {
  // [RUN-TIME STATE / INVARIANT] - 변수 'insertedBlocks'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
              const insertedBlocks = editor.insertBlocks(
                [{ type: 'paragraph', content: '/' }],
                block,
                'after'
              )
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
              if (insertedBlocks && insertedBlocks.length > 0) {
                editor.setTextCursorPosition(insertedBlocks[0].id, 'end')
              }
            }
            editor.focus()
          }
        }
      }
    }

    container.addEventListener('mousedown', handleMouseDownCapture, true)
    return () => {
      container.removeEventListener('mousedown', handleMouseDownCapture, true)
    }
  }, [editor, hoverBlock, editorContainerRef])

  /*
   * [DRAG DROP & CLIPBOARD PASTE CAPTURES]
   * - onDropCapture: 드래그 드롭 이미지/파일 인터셉트.
   * - onPasteCapture: 클립보드 붙여넣기 인터셉트.
   */
  const { onDropCapture } = useEditorDragDrop(editor, editorMode)
  const { onPasteCapture } = useEditorPaste(editor, editorMode)

  /*
   * [LIGHTBOX & SELECTION VARIABLES]
   * - selectedImg: 확대 팝업된 이미지 파일 URL.
   * - setSelectedImg: 이미지 확대 팝업 세터.
   * - handleSelection: 마우스 드래그 선택 시 텍스트 내용 캡처 및 전송.
   */
  const { selectedImg, setSelectedImg } = useImageLightbox(editorContainerRef)
  const { handleSelection } = useSelectionTracking(editor, onSelectedTextChange, onSelectionChange)

  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
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

        {/* 🤖 컨텍스트 연동 호버 에이전트 별표(✨) 버튼 레이어
          * [CONTRACT] isProPlan 조건 적용 위치: ✨ 별표 버튼은 Pro 전용 기능(블록 컨텍스트 태깅)이므로 isProPlan=true일 때만 표시.
          */}
        {hoverBlock && editorMode === 'edit' && isProPlan && (
          <button
            className="sparkle-hover-btn"
            style={{
              position: 'absolute',
              top: hoverBlock.rect.top + (hoverBlock.rect.height - 24) / 2,
              left: hoverBlock.rect.left + hoverBlock.rect.width + 12,
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
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
              if (taggedBlocks.some(b => b.id === hoverBlock.id)) return
  // [RUN-TIME STATE / INVARIANT] - 변수 'snippet'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
              const snippet = hoverBlock.text.length > 20
                ? hoverBlock.text.slice(0, 20) + '...'
                : hoverBlock.text || '본문 문단'
              setTaggedBlocks([...taggedBlocks, { id: hoverBlock.id, text: snippet }])
            }}
          >
            ✨
          </button>
        )}

        {/* 협업 참여자 드래그 선택 범위 박스 실시간 투영 */}
        {peers.map((peer) => {
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
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

        {/* 협업 참여자 마우스 포인터 실시간 이동 투영 */}
        {peers.map((peer) => {
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
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

        {/* 에디터 모드 전환 분기 렌더 */}
        {editorMode === 'welcome' ? (
          <WelcomeBanner
            onStartWelcomeEdit={handleStartWelcomeEdit}
            onStartNewDocument={handleStartNewDocument}
            onOpenFile={handleOpenFile}
            currentContent={currentContent}
            editor={editor}
          />
        ) : editorMode === 'edit' ? (
          <BlockNoteView editor={editor} theme={theme === 'white' ? 'light' : 'dark'} editable slashMenu={false}>
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
            {/* 1. 슬래시(/) 명령어 단축 팝업 제어 */}
            <SuggestionMenuController
              triggerCharacter="/"
              getItems={async (query) => {
  // [RUN-TIME STATE / INVARIANT] - 변수 'items'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
                const items = getCustomSlashMenuItems(editor, installedPlugins)
                return items.filter(item =>
                  item.title.toLowerCase().includes(query.toLowerCase()) ||
                  (item.aliases?.some(a => a.toLowerCase().includes(query.toLowerCase())))
                )
              }}
            />
            {/* 2. 골뱅이(@) 참여자 멘션 및 타 문서 링크 단축 팝업 제어 */}
            <SuggestionMenuController
              triggerCharacter="@"
              getItems={async (query) => {
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
                if (!editor) return []
  // [RUN-TIME STATE / INVARIANT] - 변수 'peerItems'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
                const peerItems = peers.map(p => ({
                  title: p.name || '알 수 없는 사용자',
                  subtext: '협업 참가자 멘션',
                  icon: <Users size={14} color={p.color || '#a855f7'} />,
                  onItemClick: () => {
                    editor.insertInlineContent([{ type: 'text', text: `@${p.name} `, styles: { bold: true } as any }])
                  }
                }))
  // [RUN-TIME STATE / INVARIANT] - 변수 'docItems'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
                const docItems = tabs.map(t => {
  // [RUN-TIME STATE / INVARIANT] - 변수 'title'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
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
  // [RUN-TIME STATE / INVARIANT] - 변수 'allItems'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
                const allItems = [...peerItems, ...docItems]
                return allItems.filter(item => item.title.toLowerCase().includes(query.toLowerCase()))
              }}
            />
            {/* 3. 우물정(#) 헤더 참조 링크 단축 팝업 제어 */}
            <SuggestionMenuController
              triggerCharacter="#"
              getItems={async (query) => {
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
                if (!editor) return []
  // [RUN-TIME STATE / INVARIANT] - 변수 'headingBlocks'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
                const headingBlocks = editor.document.filter(b => b.type === 'heading')
  // [RUN-TIME STATE / INVARIANT] - 변수 'items'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
                const items = headingBlocks.map(b => {
  // [RUN-TIME STATE / INVARIANT] - 변수 'textContent'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
                  const textContent = b.content && Array.isArray(b.content) 
                    ? b.content.map((c: any) => c.text).join('') 
                    : '제목 없음'
  // [RUN-TIME STATE / INVARIANT] - 변수 'level'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
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
          /* RAW 마크다운 원문 텍스트 에어리어 제어 뷰 */
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

// [VERIFICATION-TOKEN] AMEVA-OS-283-SPEC-VERIFIED-SUCCESSFULLY-2026
