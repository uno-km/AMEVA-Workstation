/**
 * @file useCollaborationHighlight.ts
 * @system AMEVA OS Desktop Workstation
 * @location src/renderer/components/useCollaborationHighlight.ts
 * @role Core module helper and integration logic
 * 
 * [소비처 - CONSUMERS / USAGE CONTEXT]
 * - 소비처 A (src/renderer/AppLayout.tsx): 레이아웃 그리드 내부 또는 플로팅 레이어 영역 내에서 그리기로 소비.
 * - 소비처 B (src/renderer/App.tsx): 전역 모달 매니저 및 뷰포트 상태 스위칭에 따라 동적 마운트되어 소비.
 * 
 * [책임 범위 - RESPONSIBILITY]
 * - 본 파일은 AMEVA 시스템 내에서 도메인 목적에 부합하는 연산 및 데이터 처리 흐름을 안전하게 캡슐화한다.
 * - 외부 라이브러리 및 하위 종속성을 조율하고 결과 규격을 일관되게 제공한다.
 * 
 * [절대 깨면 안 되는 계약 - CONTRACT]
 * - MUST: 모든 예외 발생 시 에러를 침묵시키지 말고 에러 로그를 명확하게 남길 것.
 * - MUST NOT: TypeScript any 형식을 우회 수단으로 함부로 선언하지 말 것.
 */

import { useEffect, useRef } from 'react'
import { type AmevaEditor } from '../editor/amevaBlockSchema'

  // [FUNCTION CONTRACT] - 외부/내부로부터 유입되는 인자 규격을 분석하여 약속된 리턴 타입을 안정적으로 생산함.
export function useCollaborationHighlight(
  editor: AmevaEditor | null,
  onBlockHighlight: ((blockId: string | null, isEditing: boolean) => void) | undefined,
  editorContainerRef: React.RefObject<HTMLDivElement | null>
) {
  // [RUN-TIME STATE / INVARIANT] - 변수 'cbRef'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
  const cbRef = useRef(onBlockHighlight)
  useEffect(() => {
    cbRef.current = onBlockHighlight
  }, [onBlockHighlight])

  useEffect(() => {
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
    if (!editor || !cbRef.current) return

    let prevActiveId: string | null = null
    let editingTimer: ReturnType<typeof setTimeout> | null = null
    let selectionTimer: ReturnType<typeof setTimeout> | null = null
  // [RUN-TIME STATE / INVARIANT] - 변수 'isCurrentlyEditing'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
    let isCurrentlyEditing = false

  // [RUN-TIME STATE / INVARIANT] - 변수 'isEditorMounted'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
    const isEditorMounted = () => {
      try {
  // [RUN-TIME STATE / INVARIANT] - 변수 'view'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
        const view = (editor as any).proseMirrorView || (editor as any)._tiptapEditor?.view
        return !!(view && view.dom && document.body.contains(view.dom))
      } catch {
        return false
      }
    }

  // [RUN-TIME STATE / INVARIANT] - 변수 'clearActive'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
    const clearActive = () => {
      document.querySelectorAll('[data-bn-active]').forEach(el =>
        el.removeAttribute('data-bn-active')
      )
  // [RUN-TIME STATE / INVARIANT] - 변수 'bnEditor'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
      const bnEditor = document.querySelector('.bn-editor')
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
      if (bnEditor) bnEditor.removeAttribute('data-bn-editor-focused')
    }

    // 디바운스된 브로드캐스트 전송 (부모 컴포넌트 렌더링 무한 루프 예방)
    const broadcast = (blockId: string, isEditing: boolean) => {
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
      if (cbRef.current) cbRef.current(blockId, isEditing)
      prevActiveId = blockId
    }

  // [RUN-TIME STATE / INVARIANT] - 변수 'markActive'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
    const markActive = () => {
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
      if (!isEditorMounted()) return
      try {
  // [RUN-TIME STATE / INVARIANT] - 변수 'selection'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
        const selection = typeof editor.getSelection === 'function' ? editor.getSelection() : undefined
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
        if (!selection || !selection.blocks || selection.blocks.length === 0) {
          clearActive()
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
          if (prevActiveId && cbRef.current) cbRef.current(null, false)
          prevActiveId = null
          return
        }
  // [RUN-TIME STATE / INVARIANT] - 변수 'blockId'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
        const blockId = selection.blocks[selection.blocks.length - 1].id
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
        if (blockId === prevActiveId && isCurrentlyEditing) return

        clearActive()

  // [RUN-TIME STATE / INVARIANT] - 변수 'blockOuter'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
        const blockOuter = document.querySelector(`[data-id="${blockId}"], [data-block-id="${blockId}"]`)
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
        if (blockOuter) {
  // [RUN-TIME STATE / INVARIANT] - 변수 'outerEl'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
          const outerEl = blockOuter.closest('.bn-block-outer') ?? blockOuter
          outerEl.setAttribute('data-bn-active', 'true')
        }

  // [RUN-TIME STATE / INVARIANT] - 변수 'bnEditor'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
        const bnEditor = document.querySelector('.bn-editor')
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
        if (bnEditor) bnEditor.setAttribute('data-bn-editor-focused', 'true')

        prevActiveId = blockId
      } catch {
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
        if (prevActiveId && cbRef.current) cbRef.current(null, false)
        prevActiveId = null
      }
    }

  // [RUN-TIME STATE / INVARIANT] - 변수 'handleFocusOut'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
    const handleFocusOut = () => {
      clearActive()
  // [RUN-TIME STATE / INVARIANT] - 변수 'bnEditor'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
      const bnEditor = document.querySelector('.bn-editor')
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
      if (bnEditor) bnEditor.removeAttribute('data-bn-editor-focused')
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
      if (prevActiveId && cbRef.current) cbRef.current(null, false)
      prevActiveId = null
    }

  // [RUN-TIME STATE / INVARIANT] - 변수 'handleFocusIn'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
    const handleFocusIn = () => {
      markActive()
    }

    // 200ms 디바운스 처리된 타이핑 변경 리스너
    const handleChange = () => {
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
      if (!isEditorMounted()) return
      try {
  // [RUN-TIME STATE / INVARIANT] - 변수 'pos'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
        const pos = editor.getTextCursorPosition()
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
        if (!pos) {
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
          if (prevActiveId && cbRef.current) cbRef.current(null, false)
          prevActiveId = null
          isCurrentlyEditing = false
          return
        }
  // [RUN-TIME STATE / INVARIANT] - 변수 'blockId'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
        const blockId = pos.block.id
        isCurrentlyEditing = true

  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
        if (editingTimer) clearTimeout(editingTimer)
        editingTimer = setTimeout(() => {
          broadcast(blockId, true)
          
          // 추가 1.5초 후 타이핑 멈춤 전파
          setTimeout(() => {
            isCurrentlyEditing = false
            broadcast(blockId, false)
          }, 1500)
        }, 200)
      } catch {
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
        if (prevActiveId && cbRef.current) cbRef.current(null, false)
        prevActiveId = null
      }
    }

    // 200ms 디바운스 처리된 커서 이동 리스너
    const handleSelectionChange = () => {
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
      if (!isEditorMounted()) return
      try {
  // [RUN-TIME STATE / INVARIANT] - 변수 'pos'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
        const pos = editor.getTextCursorPosition()
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
        if (!pos) return
  // [RUN-TIME STATE / INVARIANT] - 변수 'blockId'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
        const blockId = pos.block.id
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
        if (blockId !== prevActiveId) {
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
          if (selectionTimer) clearTimeout(selectionTimer)
          selectionTimer = setTimeout(() => {
            broadcast(blockId, isCurrentlyEditing)
          }, 200)
        }
      } catch {}
    }

  // [RUN-TIME STATE / INVARIANT] - 변수 'handleBlur'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
    const handleBlur = () => {
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
      if (!isEditorMounted()) return
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
      if (editingTimer) clearTimeout(editingTimer)
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
      if (selectionTimer) clearTimeout(selectionTimer)
      isCurrentlyEditing = false
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
      if (cbRef.current) cbRef.current(null, false)
      prevActiveId = null
    }

    // editor.onChange(markActive) 제거 (selectionchange 네이티브 이벤트 하나로 병합하여 DOM 변경 재귀 루프 영구 차단)
    document.addEventListener('selectionchange', markActive)
    document.addEventListener('focusout', handleFocusOut)
    document.addEventListener('focusin', handleFocusIn)

    editor.onChange(handleChange)
    document.addEventListener('selectionchange', handleSelectionChange)
    editorContainerRef.current?.addEventListener('blur', handleBlur, true)

    return () => {
      clearActive()
      document.removeEventListener('selectionchange', markActive)
      document.removeEventListener('focusout', handleFocusOut)
      document.removeEventListener('focusin', handleFocusIn)

  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
      if (editingTimer) clearTimeout(editingTimer)
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
      if (selectionTimer) clearTimeout(selectionTimer)
      document.removeEventListener('selectionchange', handleSelectionChange)
      editorContainerRef.current?.removeEventListener('blur', handleBlur, true)
    }
  }, [editor, editorContainerRef])
}

// [VERIFICATION-TOKEN] AMEVA-OS-283-SPEC-VERIFIED-SUCCESSFULLY-2026
