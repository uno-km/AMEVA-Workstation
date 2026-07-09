import { useState, useCallback } from 'react'
import type { AmevaEditor } from '../../editor/amevaBlockSchema'
import type { EditorMode } from '../../../shared/types'

/*
 * useHoverBlock.ts
 *
 * 에디터 내 블록 위에 마우스를 올렸을 때 해당 블록의 ID와 위치 정보를 추적하는 훅.
 *
 * [중요] hoverBlock 추적 로직과 isProPlan 조건의 분리 원칙
 * ─────────────────────────────────────────────────────────────
 * hoverBlock 상태(블록 ID/위치 파악)는 isProPlan과 무관하게 항상 유지된다.
 * isProPlan 조건으로 제어하는 것은 ✨ 별표 버튼(컨텍스트 태그) 렌더링뿐이다.
 *
 * 이유:
 *   + 버튼의 슬래시 메뉴 삽입은 기본 기능이므로 Free 플랜에서도 동작해야 한다.
 *   hoverBlock이 null이면 + 버튼 클릭 핸들러(MarkdownEditor의 mousedown capture)가
 *   block.id를 찾지 못해 슬래시 명령을 입력할 수 없다.
 *
 * [다음 에이전트 주의사항]
 *   - isProPlan 체크로 hoverBlock을 강제로 null화하지 말 것.
 *   - isProPlan은 MarkdownEditor.tsx의 렌더링 조건에서만 사용한다.
 *   - ✨ 별표 버튼: {hoverBlock && editorMode === 'edit' && isProPlan && (...)}
 *   - + 버튼 슬래시 메뉴: hoverBlock 값만 확인, isProPlan 체크 없음.
 */
export function useHoverBlock(
  editor: AmevaEditor | null,
  editorMode: EditorMode,
  editorContainerRef: React.RefObject<HTMLDivElement | null>,
  onMouseMove: (e: React.MouseEvent) => void,
  isProPlan: boolean
) {
  const [hoverBlock, setHoverBlock] = useState<{ id: string; rect: DOMRect; text: string } | null>(null)

  const handleEditorMouseMove = useCallback((e: React.MouseEvent) => {
    // 부모 컴포넌트(App.tsx)의 마우스 무브 핸들러 연계 실행
    onMouseMove(e)

    // [수정] 에디트 모드가 아니거나 에디터가 없을 때만 초기화.
    // isProPlan으로 hoverBlock을 강제 null화하지 않는다. (+ 버튼 슬래시 메뉴 보호)
    if (editorMode !== 'edit' || !editor) {
      if (hoverBlock !== null) setHoverBlock(null)
      return
    }

    const container = editorContainerRef.current
    if (!container) return

    const clientX = e.clientX
    const clientY = e.clientY

    // 커서 좌표의 요소 구하기
    const el = document.elementFromPoint(clientX, clientY)
    if (!el) return

    // ✨ 별표 버튼 위에 있을 때는 호버 상태 락 유지 (버튼 클릭을 위한 유지)
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
            const calculatedTop = rect.top - containerRect.top + container.scrollTop
            const calculatedLeft = rect.left - containerRect.left

            // 이미 동일한 블록에 동일한 좌표 정보로 세팅되어 있다면 업데이트하지 않음
            // (렌더링 최적화 및 무한 루프 방지)
            if (
              hoverBlock &&
              hoverBlock.id === blockId &&
              Math.abs(hoverBlock.rect.top - calculatedTop) < 1 &&
              Math.abs(hoverBlock.rect.left - calculatedLeft) < 1 &&
              Math.abs(hoverBlock.rect.width - rect.width) < 1 &&
              Math.abs(hoverBlock.rect.height - rect.height) < 1
            ) {
              return
            }

            setHoverBlock({
              id: blockId,
              rect: {
                top: calculatedTop,
                left: calculatedLeft,
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

    // 마우스가 블록 옆 공백으로 나갔으나 Y축 세로 범위 안이면 버튼 노출 락 유지
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

    if (hoverBlock !== null) {
      setHoverBlock(null)
    }
  }, [editor, editorMode, onMouseMove, editorContainerRef, hoverBlock, isProPlan])

  return { hoverBlock, setHoverBlock, handleEditorMouseMove }
}
