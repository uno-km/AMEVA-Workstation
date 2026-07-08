import { useEffect } from 'react'

export function useSideMenuHoverSync() {
  useEffect(() => {
    let lastHoveredBlock: Element | null = null

    const handleSideMenuHover = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      // BlockNote 사이드 메뉴 클래스 혹은 버튼에 호버했는지 확인
      const isSideMenu = target.closest('.bn-side-menu') || target.closest('button[data-test-id="side-menu-button"]') || target.closest('button[data-test-id="drag-handle"]')
      
      if (isSideMenu) {
        // 아이콘 위치에서 우측으로 60px 이동한 지점의 요소를 찾아 블록을 매핑
        const el = document.elementFromPoint(e.clientX + 60, e.clientY)
        const blockOuter = el?.closest('.bn-block-outer')
        
        if (blockOuter && lastHoveredBlock !== blockOuter) {
          if (lastHoveredBlock) lastHoveredBlock.removeAttribute('data-bn-hover-sync')
          blockOuter.setAttribute('data-bn-hover-sync', 'true')
          lastHoveredBlock = blockOuter
        }
      } else {
        if (lastHoveredBlock) {
          lastHoveredBlock.removeAttribute('data-bn-hover-sync')
          lastHoveredBlock = null
        }
      }
    }

    window.addEventListener('mousemove', handleSideMenuHover)
    return () => {
      window.removeEventListener('mousemove', handleSideMenuHover)
      if (lastHoveredBlock) lastHoveredBlock.removeAttribute('data-bn-hover-sync')
    }
  }, [])
}
