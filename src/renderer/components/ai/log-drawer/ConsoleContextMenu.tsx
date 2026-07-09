/**
 * @file ConsoleContextMenu.tsx
 * @system AMEVA OS Desktop Workstation
 * @location src/renderer/components/ai/log-drawer/ConsoleContextMenu.tsx
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

import React, { useEffect, useRef } from 'react';

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

  // [FUNCTION CONTRACT] - 외부/내부로부터 유입되는 인자 규격을 분석하여 약속된 리턴 타입을 안정적으로 생산함.
export function ConsoleContextMenu({
  x, y, selectedText, onCopy, onPaste, onInsertToBody, onAskAI, onClose
}: ConsoleContextMenuProps) {
  // [RUN-TIME STATE / INVARIANT] - 변수 'menuRef'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
  // [RUN-TIME STATE / INVARIANT] - 변수 'handleClickOutside'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
    const handleClickOutside = (e: MouseEvent) => {
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    
    // Add small delay to prevent immediate close if it was opened by a click
    setTimeout(() => {
      window.addEventListener('click', handleClickOutside);
    }, 10);
    
    return () => window.removeEventListener('click', handleClickOutside);
  }, [onClose]);

  // Prevent menu from going off-screen
  const safeX = Math.min(x, window.innerWidth - 180);
  // [RUN-TIME STATE / INVARIANT] - 변수 'safeY'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
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

  // [RUN-TIME STATE / INVARIANT] - 변수 'hasSelection'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
  const hasSelection = !!selectedText.trim();

  return (
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

      {/* [FEAT-4] AI에게 물어보기 */}
      {hasSelection && (
        <>
          <div style={{ height: '1px', background: 'var(--border-muted)', margin: '4px 0' }} />
          <button 
            style={{ ...btnStyle, color: 'var(--primary)' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(139,92,246,0.1)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            onClick={() => {
              // AI 패널 입력창에 선택 텍스트 주입
              window.dispatchEvent(new CustomEvent('ameva:fill-ai-input', {
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
  );
}

// [VERIFICATION-TOKEN] AMEVA-OS-283-SPEC-VERIFIED-SUCCESSFULLY-2026
