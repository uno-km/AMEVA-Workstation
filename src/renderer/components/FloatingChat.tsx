import React, { useState, useEffect, useRef } from 'react'
import { ChatPanel } from './ChatPanel'
import { MessageCircle, Minimize2, Pin } from 'lucide-react'
import type { ChatMessage } from '../hooks/useChat'

import { useAppContext } from '../contexts/AppContext'
import { useUIStore } from '../stores/useUIStore'

export interface FloatingChatProps {}

export function FloatingChat({}: FloatingChatProps = {}) {
  const { chatMessages: messages, sendChatMessage: onSend, clearChatMessages: onClear, username, userColor, serverRunning } = useAppContext()
  const { hasChatUnread: hasUnread, setHasChatUnread, setIsChatFloating } = useUIStore()
  
  const onDockBack = () => setIsChatFloating(false)
  const onClearUnread = () => setHasChatUnread(false)
  // 위치 및 크기 상태
  const [pos, setPos] = useState({ x: window.innerWidth - 340, y: window.innerHeight - 520 })
  const [size, setSize] = useState({ width: 310, height: 460 })
  const [isMinimized, setIsMinimized] = useState(false)

  const dragStartRef = useRef<{ mouseX: number; mouseY: number; posX: number; posY: number } | null>(null)
  const resizeStartRef = useRef<{ mouseX: number; mouseY: number; width: number; height: number } | null>(null)

  // 안읽은 메시지 청소 (창 활성화/클릭 시)
  useEffect(() => {
    if (!isMinimized && hasUnread) {
      onClearUnread()
    }
  }, [messages, isMinimized, hasUnread, onClearUnread])

  // 창 크기 이탈 방지
  useEffect(() => {
    const handleResize = () => {
      setPos(prev => ({
        x: Math.min(window.innerWidth - (isMinimized ? 60 : size.width), Math.max(0, prev.x)),
        y: Math.min(window.innerHeight - (isMinimized ? 60 : size.height), Math.max(0, prev.y))
      }))
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [size, isMinimized])

  // ── 드래그 이동 로직 (스냅 기능 포함) ──
  const handleDragMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    dragStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      posX: pos.x,
      posY: pos.y,
    }
    document.addEventListener('mousemove', handleDragMouseMove)
    document.addEventListener('mouseup', handleDragMouseUp)
  }

  const handleDragMouseMove = (e: MouseEvent) => {
    if (!dragStartRef.current) return
    const dx = e.clientX - dragStartRef.current.mouseX
    const dy = e.clientY - dragStartRef.current.mouseY
    let newX = dragStartRef.current.posX + dx
    let newY = dragStartRef.current.posY + dy

    // 화면 경계 이탈 방지 (실시간)
    const W = window.innerWidth
    const H = window.innerHeight
    const currentWidth = isMinimized ? 52 : size.width
    const currentHeight = isMinimized ? 52 : size.height

    newX = Math.max(0, Math.min(W - currentWidth, newX))
    newY = Math.max(0, Math.min(H - currentHeight, newY))

    setPos({ x: newX, y: newY })
  }

  const handleDragMouseUp = () => {
    document.removeEventListener('mousemove', handleDragMouseMove)
    document.removeEventListener('mouseup', handleDragMouseUp)
    if (!dragStartRef.current) return
    dragStartRef.current = null

    // 🧲 마그네틱 자석 스냅 촥! (벽면 30px 이내 접근 시 밀착)
    const W = window.innerWidth
    const H = window.innerHeight
    const currentWidth = isMinimized ? 52 : size.width
    const currentHeight = isMinimized ? 52 : size.height
    const snapMargin = 30

    setPos(prev => {
      let nx = prev.x
      let ny = prev.y

      if (nx < snapMargin) nx = 0
      else if (nx > W - currentWidth - snapMargin) nx = W - currentWidth

      if (ny < snapMargin) ny = 0
      else if (ny > H - currentHeight - snapMargin) ny = H - currentHeight

      return { x: nx, y: ny }
    })
  }

  // ── 크기 조절 로직 ──
  const handleResizeMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    resizeStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      width: size.width,
      height: size.height,
    }
    document.addEventListener('mousemove', handleResizeMouseMove)
    document.addEventListener('mouseup', handleResizeMouseUp)
  }

  const handleResizeMouseMove = (e: MouseEvent) => {
    if (!resizeStartRef.current) return
    const dx = e.clientX - resizeStartRef.current.mouseX
    const dy = e.clientY - resizeStartRef.current.mouseY
    const newW = Math.max(260, Math.min(600, resizeStartRef.current.width + dx))
    const newH = Math.max(300, Math.min(800, resizeStartRef.current.height + dy))

    setSize({ width: newW, height: newH })
  }

  const handleResizeMouseUp = () => {
    document.removeEventListener('mousemove', handleResizeMouseMove)
    document.removeEventListener('mouseup', handleResizeMouseUp)
    resizeStartRef.current = null
  }

  // 최소화 버블 모드 렌더링
  if (isMinimized) {
    return (
      <div
        onClick={() => {
          setIsMinimized(false)
          onClearUnread()
        }}
        style={{
          position: 'fixed',
          left: pos.x,
          top: pos.y,
          width: '52px',
          height: '52px',
          borderRadius: '50%',
          background: 'linear-gradient(135deg, rgba(30, 27, 75, 0.85), rgba(15, 23, 42, 0.85))',
          backdropFilter: 'blur(20px)',
          border: '1.5px solid rgba(139, 92, 246, 0.5)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.5), 0 0 15px rgba(139, 92, 246, 0.3)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          zIndex: 9999,
          transition: 'transform 0.2s, border-color 0.2s',
          userSelect: 'none',
        }}
        onMouseDown={handleDragMouseDown}
        onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#a78bfa')}
        onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'rgba(139, 92, 246, 0.5)')}
        title="드래그하여 이동 / 클릭하여 열기"
      >
        <MessageCircle size={22} style={{ color: '#a78bfa' }} />

        {/* 🟠 주황색 알림 주황점 (Pulsing Orange Badge) */}
        {hasUnread && (
          <span
            style={{
              position: 'absolute',
              top: '2px',
              right: '2px',
              width: '12px',
              height: '12px',
              borderRadius: '50%',
              backgroundColor: '#f97316',
              boxShadow: '0 0 10px #f97316',
              border: '2px solid #0f172a',
              animation: 'floating-unread-pulse 1.4s infinite alternate',
            }}
          />
        )}

        <style>{`
          @keyframes floating-unread-pulse {
            0% { transform: scale(0.9); opacity: 0.85; }
            100% { transform: scale(1.2); opacity: 1; box-shadow: 0 0 14px #ea580c; }
          }
        `}</style>
      </div>
    )
  }

  // 일반 채팅창 모드 렌더링
  return (
    <div
      onClick={onClearUnread}
      style={{
        position: 'fixed',
        left: pos.x,
        top: pos.y,
        width: `${size.width}px`,
        height: `${size.height}px`,
        borderRadius: '12px',
        background: 'rgba(10, 11, 18, 0.9)',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(139, 92, 246, 0.3)',
        boxShadow: '0 12px 40px rgba(0, 0, 0, 0.6), 0 0 20px rgba(139, 92, 246, 0.15)',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 9990,
        overflow: 'hidden',
        fontFamily: 'var(--font-sans)',
      }}
    >
      {/* 플로팅 헤더 (드래그 핸들) */}
      <div
        onMouseDown={handleDragMouseDown}
        style={{
          padding: '8px 12px',
          background: 'linear-gradient(90deg, rgba(139, 92, 246, 0.15), transparent)',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'move',
          userSelect: 'none',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#8b5cf6', display: 'inline-block' }} />
          <span style={{ fontSize: '11px', fontWeight: 700, color: '#e5e7eb', letterSpacing: '0.5px' }}>
            CHAT (FLOATING)
          </span>
          {hasUnread && (
            <span style={{
              width: '6px', height: '6px', borderRadius: '50%',
              backgroundColor: '#f97316', display: 'inline-block',
              boxShadow: '0 0 6px #f97316'
            }} />
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          {/* 접기 */}
          <button
            onClick={() => setIsMinimized(true)}
            title="최소화 (버블 모드)"
            style={{
              background: 'transparent', border: 'none', cursor: 'pointer',
              color: '#9ca3af', display: 'flex', padding: '4px', borderRadius: '4px',
              transition: 'background 0.2s'
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            <Minimize2 size={12} />
          </button>
          {/* 사이드바 고정 */}
          <button
            onClick={onDockBack}
            title="사이드바에 도킹 고정"
            style={{
              background: 'transparent', border: 'none', cursor: 'pointer',
              color: '#9ca3af', display: 'flex', padding: '4px', borderRadius: '4px',
              transition: 'background 0.2s'
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            <Pin size={12} style={{ transform: 'rotate(45deg)' }} />
          </button>
        </div>
      </div>

      {/* 내부 채팅 패널 */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <ChatPanel
          messages={messages}
          onSend={onSend}
          onClear={onClear}
          username={username}
          userColor={userColor}
          serverRunning={serverRunning}
        />
      </div>

      {/* 리사이즈 핸들 (우측 하단 구석) */}
      <div
        onMouseDown={handleResizeMouseDown}
        style={{
          position: 'absolute',
          right: 0,
          bottom: 0,
          width: '15px',
          height: '15px',
          cursor: 'se-resize',
          zIndex: 10,
          background: 'linear-gradient(135deg, transparent 40%, rgba(139, 92, 246, 0.4) 100%)',
        }}
      />
    </div>
  )
}
