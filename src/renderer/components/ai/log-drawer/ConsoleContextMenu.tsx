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

export function ConsoleContextMenu({
  x, y, selectedText, onCopy, onPaste, onInsertToBody, onAskAI, onClose
}: ConsoleContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
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
