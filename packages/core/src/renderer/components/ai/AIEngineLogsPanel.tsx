/**
 * @file AIEngineLogsPanel.tsx
 * @system AMEVA OS Desktop Workstation
 * @location src/renderer/components/ai/AIEngineLogsPanel.tsx
 * @role Core module helper and integration logic
 * 
 * [소비처 - CONSUMERS / USAGE CONTEXT]
 * - 소비처 A (src/renderer/AppLayout.tsx): 레이아웃 그리드 내부 또는 플로팅 레이어 영역 내에서 그리기로 소비.
 * - 소비처 B (src/renderer/App.tsx): 전역 모달 매니저 및 뷰포트 상태 스위칭에 따라 동적 마운트되어 소비.
 * 
 * [책임 범위 - RESPONSIBILITY]
 * - Llama.cpp 등 AI 엔진 실시간 터미널 로그 패널 컴포넌트.
 * - Zustand store를 직접 구독하여 React 리렌더링 없이 DOM을 업데이트하는 Transient Update 패턴을 고수한다.
 * - 마우스 우클릭을 감청하여 기본 브라우저 메뉴를 차단하고 커스텀 컨텍스트 메뉴를 정확하게 표출한다.
 * 
 * [절대 깨면 안 되는 계약 - CONTRACT]
 * - MUST: 모든 예외 발생 시 에러를 침묵시키지 말고 에러 로그를 명확하게 남길 것.
 * - MUST NOT: TypeScript any 형식을 우회 수단으로 함부로 선언하지 말 것.
 */

import React, { useRef, useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { useAILogStore } from '../../stores/useAILogStore'
import { ConsoleContextMenu } from './log-drawer/ConsoleContextMenu'
import { AI_TERMINAL_CONSTANTS } from '../../features/ai-terminal/constants'
import * as ipc from '../../services/ipc/electronApiAdapter'

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
 * 마우스 우클릭 시 브라우저 메뉴를 차단하고 자체 커스텀 컨텍스트 메뉴(Copy, Paste, Ask AI)를 연동한다.
 */
export const AIEngineLogsPanel: React.FC<AIEngineLogsPanelProps> = ({ onClose, onClearLogs }) => {
  const containerRef = useRef<HTMLDivElement>(null)
  
  // 컨텍스트 메뉴 위치 및 드래그 텍스트 상태
  const [contextMenu, setContextMenu] = useState<{ x: number, y: number, text: string } | null>(null);

  // Zustand 스토어의 sensorLogs 구독: React 렌더링 루프 우회하여 DOM 직접 업데이트
  useEffect(() => {
    const unsubscribe = useAILogStore.subscribe((state, prevState) => {
      if (state.sensorLogs === prevState.sensorLogs) return

      const container = containerRef.current
      if (!container) return

      let htmlString = ''
      const logs = state.sensorLogs
      const query = state.searchQuery.trim().toLowerCase();

      for (let i = 0; i < logs.length; i++) {
        const line = logs[i]
        if (i > 0 && !line.trim()) continue

        // 1. 전역 검색어 필터링 적용 (공유 검색어 동기화)
        if (query && !line.toLowerCase().includes(query)) {
          continue;
        }

        // 2. 색상 코드 설정 (System: 파란색, Error: 빨간색, Plugin: 노란색, 기본: 초록색)
        let color = '#a7f3d0'
        if (line.includes('[System]')) color = '#93c5fd'
        if (line.includes('[Error]') || line.includes('오류')) color = '#fca5a5'
        if (line.includes('[Plugin]')) color = '#fde047'

        // 3. 하이라이팅 적용
        let renderedText = line;
        if (query) {
          const escapedQuery = query.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
          const regex = new RegExp(`(${escapedQuery})`, 'gi');
          renderedText = line.replace(
            regex,
            `<mark style="background: ${AI_TERMINAL_CONSTANTS.HIGHLIGHT.BG}; color: ${AI_TERMINAL_CONSTANTS.HIGHLIGHT.COLOR}; border-radius: ${AI_TERMINAL_CONSTANTS.HIGHLIGHT.BORDER_RADIUS}; padding: ${AI_TERMINAL_CONSTANTS.HIGHLIGHT.PADDING};">$1</mark>`
          );
        }

        htmlString += `<div style="color: ${color}; min-height: 1.2em;">${renderedText}</div>`
      }

      container.innerHTML = htmlString
      // 자동 스크롤 (최하단 유지)
      container.scrollTop = container.scrollHeight
    })

    return () => unsubscribe()
  }, [])

  /*
   * [RUN-TIME STATE / INVARIANT]
   * - handleContextMenu
   * - Rationale: 기본 마우스 우클릭을 차단(e.preventDefault())하고 마우스 클라이언트 좌표를 획득하여 커스텀 메뉴 팝업 활성화.
   */
  useEffect(() => {
    return () => {
      ipc.setBypassNativeContextMenu(false);
    };
  }, []);

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    const selection = window.getSelection();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      text: selection?.toString() ?? ''
    });
  };

  return (
    <div 
      onContextMenu={handleContextMenu}
      onMouseEnter={() => ipc.setBypassNativeContextMenu(true)}
      onMouseLeave={() => ipc.setBypassNativeContextMenu(false)}
      style={{
        position: 'absolute',
        bottom: 0, left: 0, right: 0,
        height: '200px',
        background: '#0a0e1a',
        borderTop: '1px solid var(--border-muted)',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 50,
        fontFamily: '"Cascadia Code", "Fira Code", monospace',
      }}
    >
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

      {/* 커스텀 우클릭 컨텍스트 메뉴 */}
      {contextMenu && (
        <ConsoleContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          selectedText={contextMenu.text}
          onCopy={() => {
            if (contextMenu.text) navigator.clipboard.writeText(contextMenu.text);
          }}
          onPaste={async () => {
            try {
              const text = await navigator.clipboard.readText();
              window.dispatchEvent(new CustomEvent(AI_TERMINAL_CONSTANTS.EVENTS.FILL_AI_INPUT, { detail: text }));
            } catch (err) {
              console.error('[AIEngineLogsPanel] clipboard read failed:', err);
            }
          }}
          onInsertToBody={() => {
            const event = new CustomEvent(AI_TERMINAL_CONSTANTS.EVENTS.INSERT_TEXT, { detail: contextMenu.text });
            window.dispatchEvent(event);
          }}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  )
}
