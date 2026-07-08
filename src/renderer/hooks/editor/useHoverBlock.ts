import { useState, useCallback } from 'react'
import type { AmevaEditor } from '../../editor/amevaBlockSchema'
import type { EditorMode } from '../../../shared/types'

export function useHoverBlock(
  editor: AmevaEditor | null,
  editorMode: EditorMode,
  editorContainerRef: React.RefObject<HTMLDivElement | null>,
  onMouseMove: (e: React.MouseEvent) => void,
  isProPlan: boolean
) {
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
  }, [editor, editorMode, onMouseMove, editorContainerRef, hoverBlock, isProPlan])

  return { hoverBlock, setHoverBlock, handleEditorMouseMove }
}
