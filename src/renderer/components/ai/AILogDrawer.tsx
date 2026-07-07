
import React, { useEffect } from 'react'
import { Terminal } from 'lucide-react'
import { useAILogStore } from '../../stores/useAILogStore'

export function AILogDrawer({ isExpanded, onToggle, logContainerRef, logEndRef }: any) {
  

  useEffect(() => {
    const unsubscribe = useAILogStore.subscribe((state, prevState) => {
      if (state.sensorLogs === prevState.sensorLogs) return;
      const container = logContainerRef.current;
      if (!container) return;
      let htmlString = '';
      const logs = state.sensorLogs;
      for (let i = 0; i < logs.length; i++) {
        const line = logs[i];
        if (i > 0 && !line.trim()) continue;
        let color = '#a7f3d0';
        if (line.includes('[System]')) color = '#93c5fd';
        if (line.includes('[Error]') || line.includes('오류')) color = '#fca5a5';
        if (line.includes('[Plugin]')) color = '#fde047';
        htmlString += `<div style="color: ${color}; min-height: 1.2em;">${line}</div>`;
      }
      container.innerHTML = htmlString;
      container.scrollTop = container.scrollHeight;
    });
    return () => unsubscribe();
  }, []);

  return (
    <div style={{
      position: 'absolute', bottom: 0, left: 0, right: 0,
      background: 'rgba(15, 23, 42, 0.95)', backdropFilter: 'blur(10px)',
      borderTop: '1px solid rgba(6, 182, 212, 0.3)',
      boxShadow: '0 -4px 20px rgba(0,0,0,0.4)',
      transform: isExpanded ? 'translateY(0)' : 'translateY(100%)',
      transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      zIndex: 100,
      display: 'flex', flexDirection: 'column',
      height: '35vh'
    }}>
      <div 
        onClick={onToggle}
        title={isExpanded ? '터미널 닫기' : '터미널 열기'}
        style={{
          position: 'absolute', 
          top: '-50px', 
          left: '16px',
          width: '38px',
          height: '38px',
          borderRadius: '50%',
          background: 'rgba(15, 23, 42, 0.95)', 
          border: '1px solid rgba(6, 182, 212, 0.5)',
          boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
          cursor: 'pointer', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          color: 'var(--primary)', 
          transition: 'all 0.2s ease',
          zIndex: 101
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'rgba(30, 41, 59, 0.95)'
          e.currentTarget.style.transform = 'scale(1.05)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'rgba(15, 23, 42, 0.95)'
          e.currentTarget.style.transform = 'scale(1)'
        }}
      >
        <Terminal size={18} />
      </div>
      <div style={{
        padding: '8px 12px', background: 'rgba(0,0,0,0.3)',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981', boxShadow: '0 0 8px #10b981' }} />
          <span style={{ color: '#e2e8f0', fontSize: '12px', fontWeight: 600, fontFamily: 'monospace' }}>Engine Logs</span>
        </div>
      </div>
      <div 
        ref={logContainerRef}
        style={{
          flex: 1, overflowY: 'auto', padding: '12px',
          fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
          fontSize: '11px', lineHeight: '1.5', whiteSpace: 'pre-wrap',
        }}
      />
      <div ref={logEndRef} />
    </div>
  )
}
