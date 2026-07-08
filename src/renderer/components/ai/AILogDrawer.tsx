import React, { useState } from 'react';
import { Terminal, ListTree } from 'lucide-react';
import { ConsoleLogTab } from './log-drawer/ConsoleLogTab';
import { ConsoleCommandTab } from './log-drawer/ConsoleCommandTab';

export function AILogDrawer({ isExpanded, onToggle }: any) {
  const [isHovered, setIsHovered] = useState(false);
  const [activeTab, setActiveTab] = useState<'log' | 'cmd'>('log');

  const scale = isHovered ? '1.1' : '1';
  const opacity = isHovered || isExpanded ? 1 : 0.4;

  const tabStyle = (isActive: boolean): React.CSSProperties => ({
    padding: '4px 12px',
    background: isActive ? 'var(--bg-glass-active)' : 'transparent',
    color: isActive ? 'var(--text-main)' : 'var(--text-muted)',
    border: 'none',
    borderBottom: isActive ? '2px solid var(--primary)' : '2px solid transparent',
    cursor: 'pointer',
    fontFamily: 'var(--font-sans)',
    fontSize: '11px',
    fontWeight: isActive ? 600 : 400,
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    transition: 'all 0.2s',
  });

  return (
    <div style={{
      position: 'absolute', bottom: 0, left: 0, right: 0,
      background: 'var(--bg-glass)', backdropFilter: 'blur(10px)',
      borderTop: '1px solid var(--border-muted)',
      boxShadow: '0 -4px 20px rgba(0,0,0,0.4)',
      transform: isExpanded ? 'translateY(0)' : 'translateY(100%)',
      transition: 'transform 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
      zIndex: 100,
      display: 'flex', flexDirection: 'column',
      height: '35vh'
    }}>
      {/* Hover Trigger Wrapper */}
      <div
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        style={{
          position: 'absolute',
          top: '0px',
          left: '50%',
          transform: `translate(-50%, -50%)`,
          width: '180px',
          height: '180px',
          borderRadius: '50%',
          zIndex: 101,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          pointerEvents: 'auto'
        }}
      >
        <div 
          onClick={onToggle}
          title={isExpanded ? '터미널 닫기' : '터미널 열기'}
          style={{
            transform: `translateY(${isExpanded ? '-20px' : (isHovered ? '-20px' : '0px')}) scale(${scale})`,
            width: '42px',
            height: '42px',
            borderRadius: '50%',
            background: isHovered ? 'var(--primary)' : 'var(--bg-glass-active)',
            padding: '2px', // Gradient border thickness
            boxShadow: isHovered 
              ? '0 0 20px var(--primary-glow)' 
              : '0 4px 12px rgba(0,0,0,0.15)',
            cursor: 'pointer', 
            opacity: opacity,
            transition: 'all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)',
            border: '1px solid var(--border-muted)',
          }}
        >
          <div style={{
            width: '100%', height: '100%', borderRadius: '50%',
            background: 'var(--bg-glass)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: isHovered ? '#fff' : 'var(--primary)',
            transition: 'background 0.3s ease',
          }}>
            <Terminal size={isHovered ? 20 : 18} style={{ transition: 'all 0.3s ease' }} />
          </div>
        </div>
      </div>
      
      {/* Tab Header */}
      <div style={{
        padding: '0 12px', background: 'var(--bg-glass)',
        borderBottom: '1px solid var(--border-muted)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end',
        height: '36px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', height: '100%' }}>
          <button style={tabStyle(activeTab === 'log')} onClick={() => setActiveTab('log')}>
            <ListTree size={12} />
            Engine Logs
          </button>
          <button style={tabStyle(activeTab === 'cmd')} onClick={() => setActiveTab('cmd')}>
            <Terminal size={12} />
            Terminal (CMD)
          </button>
        </div>
      </div>
      
      {/* Drawer Content */}
      <div style={{ 
        flex: 1, 
        display: 'flex', 
        flexDirection: 'column', 
        overflow: 'hidden',
        background: 'var(--term-bg)',
      }}>
        {activeTab === 'log' ? <ConsoleLogTab /> : <ConsoleCommandTab />}
      </div>
    </div>
  );
}
