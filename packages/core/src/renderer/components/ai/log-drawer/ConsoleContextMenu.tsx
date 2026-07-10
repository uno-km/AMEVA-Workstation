/**
 * @file ConsoleContextMenu.tsx
 * @system AMEVA OS Desktop Workstation
 * @location src/renderer/components/ai/log-drawer/ConsoleContextMenu.tsx
 * @role Core module helper and integration logic
 * 
 * [소비처 - CONSUMERS / USAGE CONTEXT]
 * - 소비처 A (src/renderer/components/ai/log-drawer/ConsoleLogTab.tsx): 로그 터미널 탭 우클릭 시 컨텍스트 메뉴로 마운트.
 * - 소비처 B (src/renderer/components/ai/log-drawer/ConsoleCommandTab.tsx): Host OS 터미널 탭 우클릭 시 마운트.
 * - 소비처 C (src/renderer/components/ai/AIEngineLogsPanel.tsx): AI 엔진 실시간 로그 패널 우클릭 시 마운트.
 * 
 * [책임 범위 - RESPONSIBILITY]
 * - 터미널 로그 내 드래그 텍스트의 복사, 클립보드 붙여넣기, AI 패널 프롬프트 주입(Ask AI) 기능 제공.
 * - 마우스 클릭 시 화면을 덮는 전역 투명 백드롭(Backdrop) 오버레이를 통해 즉시 닫기 액션을 오작동 없이 제어.
 * 
 * [절대 깨면 안 되는 계약 - CONTRACT]
 * - MUST: 메뉴 밖 클릭 시 예외 없이 즉각 onClose가 실행되도록 전역 투명 오버레이 백드롭을 유지할 것.
 * - MUST NOT: 복잡한 윈도우 click 리스너 혼선으로 마운트 직후 오동작 닫힘 루프가 발생하지 않도록 할 것.
 */

import React, { useRef } from 'react';
import { AI_TERMINAL_CONSTANTS } from '../../../features/ai-terminal/constants';

export interface ConsoleContextMenuProps {
  x: number;
  y: number;
  selectedText: string;
  onCopy: () => void;
  onPaste?: () => void;
  onInsertToBody?: () => void;
  onAskAI?: () => void;
  onClose: () => void;
}

  /*
   * [FUNCTION CONTRACT]
   * - 함수 명: `ConsoleContextMenu`
   * - 역할: 마우스 우클릭 좌표 및 드래그 텍스트를 인자로 받아 커스텀 옵션 메뉴와 전역 투명 닫기 백드롭을 제공.
   * - 예시: `ConsoleContextMenu(...)` 호출 시 zIndex가 최상위인 GUI 팝업 드로잉.
   */
export function ConsoleContextMenu({
  x, y, selectedText, onCopy, onPaste, onInsertToBody, onAskAI, onClose
}: ConsoleContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  // Prevent menu from going off-screen (최대 넓이 180px, 높이 200px 기준 마진 방어)
  const safeX = Math.min(x, window.innerWidth - 180);
  const safeY = Math.min(y, window.innerHeight - 200);

  const btnStyle: React.CSSProperties = {
    background: 'transparent',
    border: 'none',
    color: 'var(--text-main)',
    padding: '8px 12px',
    textAlign: 'left',
    cursor: 'pointer',
    fontSize: '12px',
    borderRadius: '4px',
    width: '100%',
    transition: 'background 0.2s',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  };

  const hasSelection = !!selectedText.trim();

  return (
    <>
      {/* 
        [BACKDROP OVERLAY LAYER]
        - Rationale: window.click 리스너는 우클릭 mouseup 연쇄 click 신호와 충돌하여 팝업이 즉시 닫히는 오작동을 유발하므로,
          메뉴 영역 뒷단 전체를 채우는 투명 div 오버레이를 배치해 클릭 시 부드럽게 닫히도록 완벽히 방어한다.
      */}
      <div 
        onClick={onClose}
        onContextMenu={(e) => { e.preventDefault(); onClose(); }}
        style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'transparent',
          zIndex: 99998,
          cursor: 'default',
        }}
      />

      <div 
        ref={menuRef}
        style={{
          position: 'fixed',
          top: safeY,
          left: safeX,
          background: 'var(--bg-glass)',
          border: '1px solid var(--border-muted)',
          borderRadius: '8px',
          padding: '4px',
          display: 'flex',
          flexDirection: 'column',
          zIndex: 99999,
          boxShadow: '0 8px 32px rgba(0,0,0,0.6), inset 0 1px 1px rgba(255,255,255,0.08)',
          fontFamily: 'var(--font-sans)',
          minWidth: '160px',
          backdropFilter: 'blur(12px)',
        }}
      >
        {/* 복사 — 선택된 텍스트가 있을 때만 활성화 */}
        <button 
          style={{ ...btnStyle, opacity: hasSelection ? 1 : 0.4 }}
          disabled={!hasSelection}
          onMouseEnter={e => hasSelection && (e.currentTarget.style.background = 'var(--bg-glass-active)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          onClick={() => { if (hasSelection) { onCopy(); onClose(); }}}
        >
          <span>📋</span> 복사 (Copy)
        </button>
        
        {onPaste && (
          <button 
            style={btnStyle} 
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-glass-active)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            onClick={() => { onPaste(); onClose(); }}
          >
            <span>📌</span> 붙여넣기 (Paste)
          </button>
        )}
        
        {onInsertToBody && hasSelection && (
          <>
            <div style={{ height: '1px', background: 'var(--border-muted)', margin: '4px 0' }} />
            <button 
              style={btnStyle} 
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-glass-active)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              onClick={() => { onInsertToBody(); onClose(); }}
            >
              <span>📄</span> 본문에 삽입 (Insert)
            </button>
          </>
        )}

        {/* AI에게 물어보기 */}
        {hasSelection && (
          <>
            <div style={{ height: '1px', background: 'var(--border-muted)', margin: '4px 0' }} />
            <button 
              style={{ ...btnStyle, color: 'var(--primary)' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(139,92,246,0.1)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              onClick={() => {
                // AI 패널 입력창에 선택 텍스트 주입 커스텀 이벤트 디스패치
                window.dispatchEvent(new CustomEvent(AI_TERMINAL_CONSTANTS.EVENTS.FILL_AI_INPUT, {
                  detail: `다음 터미널 출력에 대해 설명해줘:\n\`\`\`\n${selectedText}\n\`\`\``
                }));
                onClose();
              }}
            >
              <span>✨</span> AI에게 물어보기
            </button>
          </>
        )}
      </div>
    </>
  );
}
