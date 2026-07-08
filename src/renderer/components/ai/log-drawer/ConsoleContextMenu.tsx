import React, { useEffect, useRef } from 'react';

export interface ConsoleContextMenuProps {
  x: number;
  y: number;
  onCopy: () => void;
  onPaste?: () => void;
  onInsertToBody?: () => void;
  onClose: () => void;
}

export function ConsoleContextMenu({ x, y, onCopy, onPaste, onInsertToBody, onClose }: ConsoleContextMenuProps) {
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
  const safeX = Math.min(x, window.innerWidth - 160);
  const safeY = Math.min(y, window.innerHeight - 120);

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
  };

  return (
    <div 
      ref={menuRef}
      style={{
        position: 'fixed',
        top: safeY,
        left: safeX,
        background: 'var(--bg-panel)',
        border: '1px solid var(--border-muted)',
        borderRadius: '6px',
        padding: '4px',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 99999,
        boxShadow: '0 8px 24px rgba(0,0,0,0.5), inset 0 1px 1px rgba(255,255,255,0.1)',
        fontFamily: 'var(--font-sans)',
        minWidth: '140px'
      }}
    >
      <button 
        style={btnStyle} 
        onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-glass-active)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
        onClick={() => { onCopy(); onClose(); }}
      >
        복사 (Copy)
      </button>
      
      {onPaste && (
        <button 
          style={btnStyle} 
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-glass-active)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          onClick={() => { onPaste(); onClose(); }}
        >
          붙여넣기 (Paste)
        </button>
      )}
      
      {onInsertToBody && (
        <>
          <div style={{ height: '1px', background: 'var(--border-muted)', margin: '4px 0' }} />
          <button 
            style={btnStyle} 
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-glass-active)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            onClick={() => { onInsertToBody(); onClose(); }}
          >
            본문에 삽입 (Insert)
          </button>
        </>
      )}
    </div>
  );
}
