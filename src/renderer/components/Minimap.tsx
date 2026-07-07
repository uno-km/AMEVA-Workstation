import React, { useState, useEffect, useRef } from 'react'

interface MinimapProps {
  editor: any
  editorContainerRef: React.RefObject<HTMLDivElement | null>
  blocks: any[]
}

export function Minimap({ editor, editorContainerRef, blocks }: MinimapProps) {
  const [scrollState, setScrollState] = useState({
    scrollTop: 0,
    scrollHeight: 1,
    clientHeight: 1,
  })
  
  const [isHovered, setIsHovered] = useState(false)
  const minimapRef = useRef<HTMLDivElement>(null)
  const isDragging = useRef(false)
  const dragStartY = useRef(0)
  const dragStartScrollTop = useRef(0)

  // 에디터 스크롤 컨테이너 가져오기
  const getScrollContainer = (): HTMLElement | null => {
    return editorContainerRef?.current || null
  }

  // 스크롤 및 크기 동기화
  // 스크롤 및 크기 동기화 (Ref 마운트 지연 대응 자가 폴링 감지 구조)
  useEffect(() => {
    let container: HTMLElement | null = null
    let observer: MutationObserver | null = null

    const handleScroll = () => {
      if (!container) return
      setScrollState({
        scrollTop: container.scrollTop,
        scrollHeight: container.scrollHeight,
        clientHeight: container.clientHeight,
      })
    }

    const attachListener = () => {
      const activeContainer = getScrollContainer()
      if (activeContainer && activeContainer !== container) {
        if (container) {
          container.removeEventListener('scroll', handleScroll)
        }
        if (observer) {
          observer.disconnect()
        }

        container = activeContainer
        container.addEventListener('scroll', handleScroll)

        observer = new MutationObserver(handleScroll)
        observer.observe(container, { childList: true, subtree: true, characterData: true })

        handleScroll()
      }
    }

    attachListener()

    // Ref 마운트 지연 대응을 위해 200ms 마다 폴링 확인
    const interval = setInterval(attachListener, 200)

    return () => {
      clearInterval(interval)
      if (container) {
        container.removeEventListener('scroll', handleScroll)
      }
      if (observer) {
        observer.disconnect()
      }
    }
  }, [editorContainerRef, blocks])

  const { scrollTop, scrollHeight, clientHeight } = scrollState
  const viewportTopPercent = (scrollTop / scrollHeight) * 100
  const viewHeightPercent = (clientHeight / scrollHeight) * 100

  // 클릭 및 드래그 스크롤 통합 제어
  const handleMapMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const container = getScrollContainer()
    if (!container || !minimapRef.current) return

    const rect = minimapRef.current.getBoundingClientRect()
    const clickY = e.clientY - rect.top
    const clickRatio = clickY / rect.height
    
    // 클릭 위치로 실시간 즉각 점프
    container.scrollTop = clickRatio * container.scrollHeight - container.clientHeight / 2

    isDragging.current = true
    dragStartY.current = e.clientY
    dragStartScrollTop.current = container.scrollTop

    document.addEventListener('mousemove', handleDragMove)
    document.addEventListener('mouseup', handleDragEnd)
  }

  const handleDragMove = (e: MouseEvent) => {
    if (!isDragging.current || !minimapRef.current) return
    const container = getScrollContainer()
    if (!container) return

    const rect = minimapRef.current.getBoundingClientRect()
    const currentY = Math.max(0, Math.min(rect.height, e.clientY - rect.top))
    const ratio = currentY / rect.height

    // 마우스가 누르고 있는 위치를 에디터의 중심점으로 부드럽게 흡수
    container.scrollTop = ratio * container.scrollHeight - container.clientHeight / 2
  }

  const handleDragEnd = () => {
    isDragging.current = false
    document.removeEventListener('mousemove', handleDragMove)
    document.removeEventListener('mouseup', handleDragEnd)
  }

  // 에디터의 블록 구조를 긁어 텍스트 라인 리스트로 전환
  const extractTextLines = (): { text: string; type: string; level?: number }[] => {
    const lines: { text: string; type: string; level?: number }[] = []
    
    const traverse = (items: any[]) => {
      for (const item of items) {
        if (item.type === 'heading') {
          const text = item.content?.map((c: any) => c.text).join('') || 'Heading'
          lines.push({ text: '#'.repeat(item.props?.level || 1) + ' ' + text, type: 'heading', level: item.props?.level })
        } else if (item.type === 'codeBlock' || item.type === 'jupyter') {
          const codeText = item.props?.code || ''
          const splitLines = codeText.split('\n')
          splitLines.forEach((l: string) => {
            lines.push({ text: l || ' ', type: 'code' })
          })
        } else if (item.type === 'paragraph') {
          const text = item.content?.map((c: any) => c.text).join('') || ''
          const splitLines = text.split('\n')
          splitLines.forEach((l: string) => {
            lines.push({ text: l || ' ', type: 'text' })
          })
        } else if (item.type === 'image' || item.type === 'video') {
          lines.push({ text: `[Media: ${item.props?.url || 'file'}]`, type: 'media' })
        } else if (item.type === 'table') {
          lines.push({ text: '| Table content |', type: 'table' })
        }
        
        if (item.children && item.children.length > 0) {
          traverse(item.children)
        }
      }
    }
    
    traverse(blocks)
    return lines
  }

  const lines = extractTextLines()

  return (
    <div
      ref={minimapRef}
      onMouseDown={handleMapMouseDown}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        position: 'absolute',
        top: '16px',
        right: '16px',
        width: '64px', // 64px의 넉넉한 가로 폭
        height: 'calc(100% - 32px)',
        maxHeight: '460px',
        background: isHovered || isDragging.current ? 'rgba(20, 20, 25, 0.45)' : 'transparent',
        backdropFilter: isHovered || isDragging.current ? 'blur(10px)' : 'none',
        borderLeft: isHovered || isDragging.current ? '1px solid rgba(255, 255, 255, 0.05)' : '1px solid transparent',
        borderRadius: '6px',
        padding: '8px 2px',
        overflow: 'hidden',
        cursor: 'pointer',
        zIndex: 99,
        userSelect: 'none',
        transition: 'background 0.25s ease, border-color 0.25s ease',
      }}
    >
      {/* 10배 축소시킨 텍스트 미니어처 컨테이너 */}
      <div
        style={{
          width: '640px', // scale 0.1 대비 10배로 설정해 우측 삐져나감 방지
          transform: 'scale(0.1)',
          transformOrigin: 'top left',
          display: 'flex',
          flexDirection: 'column',
          lineHeight: '1.3',
          fontFamily: 'var(--font-mono)',
          fontSize: '11px',
          opacity: isHovered ? 0.95 : 0.6,
          transition: 'opacity 0.2s',
          pointerEvents: 'none',
        }}
      >
        {lines.length === 0 ? (
          <div style={{ color: 'rgba(255,255,255,0.2)' }}>AMEVA Document Minimap...</div>
        ) : (
          lines.map((line, idx) => {
            let color = 'rgba(255, 255, 255, 0.25)' // 일반 텍스트: 차분한 그레이
            let fontWeight = 'normal'
            let fontStyle = 'normal'

            if (line.type === 'heading') {
              color = '#f8fafc' // 헤더: 밝은 화이트
              fontWeight = 'bold'
            } else if (line.type === 'code') {
              color = 'var(--primary)' // 코드: 에디터 포인트 컬러 (실버 그레이)
            } else if (line.type === 'media') {
              color = 'rgba(249, 115, 22, 0.5)' // 미디어: 소프트 오렌지
              fontStyle = 'italic'
            } else if (line.type === 'table') {
              color = 'rgba(6, 182, 212, 0.5)' // 테이블: 소프트 시안
            }

            return (
              <div
                key={idx}
                style={{
                  color,
                  fontWeight,
                  fontStyle,
                  whiteSpace: 'pre',
                  textOverflow: 'ellipsis',
                  overflow: 'hidden',
                }}
              >
                {line.text}
              </div>
            )
          })
        )}
      </div>

      {/* 뷰포트 하이라이터 */}
      <div
        onMouseDown={handleMapMouseDown}
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: `${Math.min(90, Math.max(0, viewportTopPercent))}%`,
          height: `${Math.min(100, Math.max(12, viewHeightPercent))}%`,
          background: isHovered || isDragging.current ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255, 255, 255, 0.02)',
          borderLeft: '2px solid rgba(255, 255, 255, 0.35)',
          cursor: 'ns-resize',
          transition: isDragging.current ? 'none' : 'top 0.15s ease, height 0.15s ease',
        }}
      />
    </div>
  )
}
