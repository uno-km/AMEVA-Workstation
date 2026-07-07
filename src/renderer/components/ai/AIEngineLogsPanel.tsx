/**
 * AIEngineLogsPanel.tsx
 *
 * AI 엔진 실시간 터미널 로그 패널 컴포넌트.
 * AIPanel.tsx에 인라인으로 정의되어 있던 엔진 로그 뷰어를 독립 컴포넌트로 분리한다.
 * Zustand store를 직접 구독하여 React 리렌더링 없이 DOM을 업데이트한다 (Transient Update 패턴).
 *
 * [단일 책임]
 * - 엔진 로그 배열(sensorLogs) 실시간 DOM 렌더링
 * - 색상 코딩 (System: 파란색, Error: 빨간색, Plugin: 노란색, 기본: 초록색)
 * - 자동 스크롤 (최하단 유지)
 * - 로그 초기화 버튼
 */

import React, { useRef, useEffect } from 'react'
import { X } from 'lucide-react'
import { useAILogStore } from '../../stores/useAILogStore'

export interface AIEngineLogsPanelProps {
  /** 패널 닫기 콜백 */
  onClose: () => void
  /** 로그 수동 초기화 콜백 (옵션) */
  onClearLogs?: () => void
}

/**
 * AIEngineLogsPanel
 * 실시간 LLM 엔진 로그를 렌더링하는 패널.
 * Zustand 스토어를 직접 구독하여 React 리렌더링 오버헤드 없이 DOM을 업데이트한다.
 */
export const AIEngineLogsPanel: React.FC<AIEngineLogsPanelProps> = ({ onClose, onClearLogs }) => {
  const containerRef = useRef<HTMLDivElement>(null)

  // Zustand 스토어의 sensorLogs 구독: React 렌더링 루프 우회하여 DOM 직접 업데이트
  useEffect(() => {
    const unsubscribe = useAILogStore.subscribe((state, prevState) => {
      if (state.sensorLogs === prevState.sensorLogs) return

      const container = containerRef.current
      if (!container) return

      let htmlString = ''
      const logs = state.sensorLogs
      for (let i = 0; i < logs.length; i++) {
        const line = logs[i]
        if (i > 0 && !line.trim()) continue

        let color = '#a7f3d0'
        if (line.includes('[System]')) color = '#93c5fd'
        if (line.includes('[Error]') || line.includes('오류')) color = '#fca5a5'
        if (line.includes('[Plugin]')) color = '#fde047'

        htmlString += `<div style="color: ${color}; min-height: 1.2em;">${line}</div>`
      }

      container.innerHTML = htmlString
      // 자동 스크롤 (최하단 유지)
      container.scrollTop = container.scrollHeight
    })

    return () => unsubscribe()
  }, [])

  return (
    <div style={{
      position: 'absolute',
      bottom: 0, left: 0, right: 0,
      height: '200px',
      background: '#0a0e1a',
      borderTop: '1px solid var(--border-muted)',
      display: 'flex',
      flexDirection: 'column',
      zIndex: 50,
      fontFamily: '"Cascadia Code", "Fira Code", monospace',
    }}>
      {/* 패널 헤더 */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '4px 10px',
        borderBottom: '1px solid rgba(255,255,255,0.1)',
        flexShrink: 0,
      }}>
        <span style={{ fontSize: '10px', color: '#6ee7b7', fontWeight: 700 }}>
          ◆ ENGINE TERMINAL
        </span>
        <div style={{ display: 'flex', gap: '4px' }}>
          {onClearLogs && (
            <button
              onClick={onClearLogs}
              style={{
                background: 'transparent', border: 'none',
                color: '#6b7280', cursor: 'pointer', fontSize: '9px',
                padding: '2px 4px', borderRadius: '3px',
              }}
            >
              CLEAR
            </button>
          )}
          <button
            onClick={onClose}
            style={{
              background: 'transparent', border: 'none',
              color: '#6b7280', cursor: 'pointer',
              display: 'flex', alignItems: 'center', padding: '2px',
            }}
          >
            <X size={12} />
          </button>
        </div>
      </div>

      {/* 로그 컨텐츠 영역 (DOM 직접 업데이트) */}
      <div
        ref={containerRef}
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '6px 10px',
          fontSize: '10px',
          lineHeight: 1.5,
          wordBreak: 'break-all',
        }}
      />
    </div>
  )
}
