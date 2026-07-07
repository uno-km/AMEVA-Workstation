
import React, { useEffect, useRef } from 'react'
import { Terminal } from 'lucide-react'
import { useAILogStore } from '../../stores/useAILogStore'

export function AILogDrawer({ isExpanded, onToggle }: any) {
  const logContainerRef = useRef<HTMLDivElement>(null)
  const logEndRef = useRef<HTMLDivElement>(null)
  const [isHovered, setIsHovered] = React.useState(false)

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

  const scale = isHovered ? '1.1' : '1';
  const opacity = isHovered || isExpanded ? 1 : 0.4;

  return (
    <div style={{
      position: 'absolute', bottom: 0, left: 0, right: 0,
      background: 'rgba(15, 23, 42, 0.95)', backdropFilter: 'blur(10px)',
      borderTop: '1px solid rgba(6, 182, 212, 0.3)',
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
            background: isHovered ? 'linear-gradient(135deg, rgba(6,182,212,1), rgba(139,92,246,1))' : 'rgba(6, 182, 212, 0.4)',
            padding: '2px', // Gradient border thickness
            boxShadow: isHovered 
              ? '0 0 24px rgba(6, 182, 212, 0.8), 0 0 12px rgba(139, 92, 246, 0.5)' 
              : '0 4px 16px rgba(0,0,0,0.7)',
            cursor: 'pointer', 
            opacity: opacity,
            transition: 'all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)',

          }}
        >
          <div style={{
            width: '100%', height: '100%', borderRadius: '50%',
            background: isHovered ? '#111827' : '#0a0a0f',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--primary)',
            transition: 'background 0.3s ease',
          }}>
            <Terminal size={isHovered ? 20 : 18} style={{ transition: 'all 0.3s ease' }} />
          </div>
        </div>
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
