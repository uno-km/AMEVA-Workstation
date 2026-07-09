/**
 * @file useAppAISuggestions.ts
 * @system AMEVA OS Desktop Workstation - Client Renderer
 * @location src/renderer/hooks/app/useAppAISuggestions.ts
 * @role Editor block context tagging & AI generated patch applicator Hook
 * 
 * [책임 범위 - RESPONSIBILITY]
 * - 사용자가 지정한 에디터 블록 단락을 AI 지시 문맥으로 임시 태깅(`customSetTaggedBlocks`)하여 Toast 메시지를 팝업한다.
 * - 특정 블록 ID로 에디터 화면을 부드럽게 스크롤 시키고 일시적인 노란색 하이라이트 CSS(`data-highlighted-temp`)를 적용(`handleScrollToBlock`)한다.
 * - LLM이 제안한 EDIT 코드를 에디터 특정 블록에 덮어쓰거나(Jupyter 및 텍스트 문단), 드래그 선택 범위를 ProseMirror API(`tr.replaceSelectionWith`)로 치환 적용(`handleApplySuggestion`)한다.
 * - LLM이 제안한 신규 문단 블록(Paragraph, Heading 등)을 특정 단락 뒤에 끼워 넣고(`handleApplyInsertSuggestion`) 큐 완료 콜백을 가동한다.
 * 
 * [책임이 아닌 것 - NON-RESPONSIBILITY]
 * - 사용자의 직접 마크다운 드래그 선택 범위 캡처 감지 (useSelectionTracking 훅이 담당).
 * 
 * [절대 깨면 안 되는 계약 - CONTRACT]
 * - MUST NOT swallow editor modification errors: ProseMirror 트랜잭션 및 BlockNote API 조작 시 발생하는 예외는
 *   VFS 구조 붕괴 및 Yjs 협업 세션 비동기 파열을 유발할 수 있으므로, catch 블록에서 에러 로그(`console.error`)를 반드시 출력할 것.
 * - MUST: ProseMirror 뷰 포커스(`view.focus()`) 복원 시, DOM 트리 내에 해당 엘리먼트가 여전히 마운트되어 존재하는지(`document.body.contains(view.dom)`) 선행 검사한 후 실행하여 브라우저 NPE 크래시를 차단할 것.
 
 * [소비처 - CONSUMERS / USAGE CONTEXT]
 * - 소비처 A (src/renderer/App.tsx): 최상위 Facade 구조에 통합 마운트.
 * - 소비처 B (src/renderer/contexts/AppContext.tsx): 리액트 Context 훅 목록에 바인딩되어 하위 뷰에 전파.
 */

/* 
 * [IMPORT SEGMENTATION & CONTRACTS]
 * - useCallback: 에디터 DOM 제어 콜백이 하위 컴포넌트 프롭스 변경을 매번 촉발하지 않도록 메모이즈하는 기본 리액트 API.
 */
import { useCallback } from 'react'

/* 
 * [ZUSTAND GLOBAL STORES]
 * - useWorkspaceStore: 드래그 캡처 버퍼 및 태그 지정 블록 정보 스토어.
 * - useUIStore: 모달, AI 사이드바 가시성 및 토스트 팝업 알림 스토어.
 */
import { useWorkspaceStore } from '../../stores/useWorkspaceStore'
import { useUIStore } from '../../stores/useUIStore'

/* 
 * [SHARED SCHEMAS & TYPES]
 * - AmevaEditor: BlockNote 기반의 커스텀 블록 스키마 바인딩 형식.
 * - AmevaPartialBlock: 블록 수정 시 일부 속성만 넘겨 갱신하기 위한 타입 구조.
 */
import { type AmevaEditor, type AmevaPartialBlock } from '../../editor/amevaBlockSchema'

/**
 * @hook useAppAISuggestions
 * @description 에디터 블록 태깅 상태를 전조율하고 AI의 편집 제안을 실제 문서 캔버스에 이식/갱신하는 훅.
 */
export function useAppAISuggestions(
  /*
   * [HOOK CONFIG PARAMETERS]
   * - editor: BlockNote API 본체.
   * - updateInsertSuggestionStatus: 삽입 제안의 승인/거절 수동 상태를 갱신하기 위한 부모 콜백.
   */
  editor: AmevaEditor | null,
  updateInsertSuggestionStatus?: (
    msgId: string,
    status: 'pending' | 'accepted' | 'rejected',
    newAfterBlockId?: string,
    newSiblingIndex?: number,
    suggestionIndex?: number
  ) => void
) {
  /*
   * [ZUSTAND WORKSPACE SELECTORS]
   * - taggedBlocks: 현재 참조 태그된 단락 목록.
   * - setTaggedBlocks: 참조 태그 목록 세터.
   * - setSelectedText: 드래그 텍스트 해제용 세터.
   */
  const { taggedBlocks, setTaggedBlocks, setSelectedText } = useWorkspaceStore()
  
  /*
   * [ZUSTAND UI SELECTORS]
   * - setShowAIPanel: AI 패널 가시성 세터.
   * - setActiveRightTab: 우측 탭 활성 세터.
   * - setToastMessage: 전역 토스트 팝업 텍스트 세터.
   */
  const {
    setShowAIPanel,
    setActiveRightTab,
    setToastMessage
  } = useUIStore()

  /**
   * [CONTRACT - Custom Set Tagged Blocks]
   * - Rationale: 블록 태그 개수가 늘어났을 때, 우측 AI 패널을 자동으로 오픈하고 토스트 메세지를 3초간 띄운다.
   */
  const customSetTaggedBlocks = useCallback((
    val: { id: string; text: string }[]
  ) => {
    const prev = taggedBlocks
    const next = val
    setTaggedBlocks(next)
    
    // 블록이 새로 추가된 경우에만 반응 자동화
    if (next.length > prev.length) {
      setShowAIPanel(true)
      setActiveRightTab('ai')
      setToastMessage('선택한 블록이 AI 어시스턴트에 참조 태그되었습니다.')
      
      // 3초 후 토스트 자동 소멸 계약
      setTimeout(() => {
        setToastMessage(null)
      }, 3000)
    }
  }, [taggedBlocks, setTaggedBlocks, setShowAIPanel, setActiveRightTab, setToastMessage])

  /**
   * [CONTRACT - Scroll and Highlight Block]
   * - Rationale: 특정 블록 ID를 타깃하여 포커스를 강제하고, DOM 엘리먼트를 부드럽게 중앙으로 스크롤 이동시킨 후 1.5초간 노란색 테두리 광원을 입힌다.
   */
  const handleScrollToBlock = useCallback((blockId: string) => {
    if (editor) {
      try {
        // 블록노트 포커스 및 캐럿 이동
        editor.focus()
        editor.setTextCursorPosition(blockId, 'end')
      } catch (err) {
        console.warn('editor.setTextCursorPosition failed:', err)
      }
    }
    
    // DOM 엘리먼트 획득 및 부드러운 스크롤 실행
    const el = document.querySelector(`[data-id="${blockId}"], [data-block-id="${blockId}"]`)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      const outer = el.closest('.bn-block-outer') || el
      if (outer) {
        // 1.5초 지연 임시 하이라이트 CSS 플래그 주입
        outer.setAttribute('data-highlighted-temp', 'true')
        setTimeout(() => {
          outer.removeAttribute('data-highlighted-temp')
        }, 1500)
      }
    }
  }, [editor])

  /**
   * [CONTRACT - Apply AI Edit Suggestion]
   * - Rationale: EDIT 명령 수락 시, Jupyter 코드 셀인지 일반 단락인지 분기하여 덮어쓰고,
   *   드래그 영역이 유효하다면 ProseMirror API(`tr.replaceSelectionWith`)를 사용하여 선택부를 직접 변경한다.
   */
  const handleApplySuggestion = useCallback((text: string, mode: 'replace' | 'insert', blockId?: string, isCodeBlock?: boolean, lang?: string) => {
    if (!editor) return
    try {
      // 1. 코딩 블록 삽입 요청인 경우 Jupyter 셀로 자동 변환 생성
      if (isCodeBlock) {
        try {
          const finalLang = lang === 'js' ? 'javascript' : lang === 'ts' ? 'typescript' : lang === 'py' ? 'python' : (lang || 'javascript')
          const blockPayload = {
            type: 'jupyter' as const,
            props: {
              language: finalLang,
              code: text,
              runState: JSON.stringify({ hasRun: false, success: null, outputLines: [] })
            }
          }
          
          const doc = editor.document || []
          const activeBlock = editor.getTextCursorPosition()?.block
          
          // 현재 커서 뒤에 삽입하거나, 문서 최하단 뒤에 이어 붙임
          if (activeBlock) {
            editor.insertBlocks([blockPayload], activeBlock, 'after')
          } else {
            editor.insertBlocks([blockPayload], doc[doc.length - 1], 'after')
          }
          return
        } catch (jErr) {
          console.error('[Jupyter Auto-Insert Failed]', jErr)
        }
      }

      // 2. 특정 타깃 블록 ID가 지정되어 단락을 직접 교체해야 하는 경우
      if (blockId) {
        try {
          const targetBlock = editor.getBlock(blockId)
          if (targetBlock) {
            if (targetBlock.type === 'jupyter') {
              editor.updateBlock(blockId, {
                type: 'jupyter',
                props: { ...targetBlock.props, code: text }
              } as AmevaPartialBlock)
            } else {
              editor.updateBlock(blockId, {
                content: text
              } as AmevaPartialBlock)
            }
            return
          }
        } catch (bErr) {
          console.warn('블록 단위 직접 업데이트 실패, selection 폴백 실행:', bErr)
        }
      }

      // 3. 드래그 선택 범위에 대한 ProseMirror 저수준 트랜잭션 치환 폴백
      const view = (editor as any).proseMirrorView || (editor as any)._tiptapEditor?.view
      if (view) {
        const { state, dispatch } = view
        const { tr, selection } = state
        if (mode === 'replace') {
          dispatch(tr.replaceSelectionWith(state.schema.text(text)))
        } else {
          dispatch(tr.insertText(text, selection.to))
        }
        
        // 20ms 프레임 지연 후 에디터 DOM 포커스 및 텍스트 해제
        setTimeout(() => {
          try {
            // CONTRACT: DOM 안착 여부를 미리 검사하여 포커스 크래시 차단
            if (view && view.dom && document.body.contains(view.dom) && typeof view.focus === 'function') {
              view.focus()
            }
          } catch (e) {
            console.warn('Failed to focus editor view:', e)
          }
          setSelectedText('')
        }, 20)
      }
    } catch (err) {
      console.error('AI 제안 에디터 반영 실패:', err)
    }
  }, [editor, setSelectedText])

  /**
   * [CONTRACT - Apply AI Insert Suggestion]
   * - Rationale: 특정 지점(START/END/BlockID)을 표기하여 그 자리에 신규 블록을 삽입하고, 수동 승인 락을 acceptance로 갱신해 준다.
   */
  const handleApplyInsertSuggestion = useCallback((
    msgId: string,
    afterBlockId: string,
    blockType: string,
    content: string,
    level?: number,
    suggestionIndex?: number
  ) => {
    if (!editor) return
    try {
      // 신규 삽입용 블록 사양 객체 빌드
      const blockPayload: any = {
        id: Math.random().toString(36).substring(2, 10),
        type: blockType === 'heading' ? 'heading'
          : blockType === 'bulletListItem' ? 'bulletListItem'
          : blockType === 'numberedListItem' ? 'numberedListItem'
          : 'paragraph',
        content: [{ type: 'text', text: content, styles: {} }],
      }
      
      // 헤딩 블록일 때 level 속성 바인딩 제한 (H1 ~ H3 범위 보장)
      if (blockType === 'heading' && level) {
        blockPayload.props = { level: Math.min(3, Math.max(1, level)) as 1 | 2 | 3 }
      }

      const doc = editor.document
      
      // 문서 전체가 비어있을 경우 덮어쓰기
      if (!doc || doc.length === 0) {
        editor.replaceBlocks(doc, [blockPayload as AmevaPartialBlock])
      } 
      // 문서 최선두에 삽입
      else if (afterBlockId === 'START') {
        editor.insertBlocks([blockPayload as AmevaPartialBlock], doc[0], 'before')
      } 
      // 문서 맨 마지막 뒤에 삽입
      else if (afterBlockId === 'END') {
        editor.insertBlocks([blockPayload as AmevaPartialBlock], doc[doc.length - 1], 'after')
      } 
      // 특정 블록 ID를 찾아 바로 뒤에 삽입
      else {
        const flatBlocks = (function flatten(blocks: any[]): any[] {
          return blocks.flatMap((b: any) => [b, ...flatten(b.children || [])])
        })(doc)
        const targetBlock = flatBlocks.find(b => b.id === afterBlockId)
        
        if (targetBlock) {
          editor.insertBlocks([blockPayload as AmevaPartialBlock], targetBlock, 'after')
        } else {
          editor.insertBlocks([blockPayload as AmevaPartialBlock], doc[doc.length - 1], 'after')
        }
      }

      // CONTRACT: 삽입 결과를 호출 큐 상태기에 Accepted 완료 승인 피드백 처리
      if (updateInsertSuggestionStatus) {
        updateInsertSuggestionStatus(msgId, 'accepted', afterBlockId, undefined, suggestionIndex)
      }
    } catch (err) {
      console.error('Failed to apply insert suggestion:', err)
    }
  }, [editor, updateInsertSuggestionStatus])

  return {
    customSetTaggedBlocks,
    handleScrollToBlock,
    handleApplySuggestion,
    handleApplyInsertSuggestion
  }
}

/**
 * ============================================================================
 * FUTURE DEVELOPMENT GUIDE (AI Agent Instruction Layer)
 * ============================================================================
 * 1. 신규 블록 타입(예: 'callout' 인용구, 'table' 표 등) 삽입 제안을 확장하고자 할 때:
 *    - `handleApplyInsertSuggestion` 내부의 `blockPayload` 분기식에 해당 타입 주입 논리를 보완할 것.
 * ============================================================================
 */
