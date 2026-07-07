const fs = require('fs');

const createComponent = (name, content) => {
  fs.writeFileSync(`src/renderer/components/ai/${name}.tsx`, content, 'utf-8');
  console.log(`Created ${name}.tsx`);
};

// 1. AIWelcomeScreen
createComponent('AIWelcomeScreen', `
import React from 'react'

export function AIWelcomeScreen({ QUICK_ACTIONS, isAvailable, onAction }: any) {
  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      color: 'var(--text-muted)', padding: '40px 20px', textAlign: 'center'
    }}>
      <div style={{ marginBottom: '24px', opacity: 0.8 }}>
        <div style={{
          width: '64px', height: '64px', borderRadius: '50%',
          background: 'linear-gradient(135deg, rgba(6,182,212,0.1), rgba(124,58,237,0.1))',
          display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px'
        }}>
          <img src="https://avatars.githubusercontent.com/u/150068467?v=4" alt="AMEVA" style={{ width: '40px', height: '40px', borderRadius: '50%', opacity: 0.9 }} />
        </div>
        <h3 style={{ margin: '0 0 8px 0', color: 'var(--text-main)', fontSize: '16px', fontWeight: 600 }}>
          AMEVA AI Assistant
        </h3>
        <p style={{ margin: 0, fontSize: '13px', lineHeight: '1.5' }}>
          무엇을 도와드릴까요?
        </p>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', width: '100%', maxWidth: '280px' }}>
        {QUICK_ACTIONS.map((action: any) => (
          <button
            key={action.id}
            onClick={() => onAction(action.prompt)}
            disabled={!isAvailable}
            style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              padding: '10px 12px', borderRadius: '10px',
              background: 'var(--bg-glass-active)', border: '1px solid var(--border-muted)',
              color: 'var(--text-main)', cursor: isAvailable ? 'pointer' : 'not-allowed',
              opacity: isAvailable ? 1 : 0.5,
              fontSize: '12px', textAlign: 'left', transition: 'all 0.2s',
            }}
          >
            <action.icon size={14} style={{ color: 'var(--primary)' }} />
            {action.label}
          </button>
        ))}
      </div>
    </div>
  )
}
`);

// 2. AILogDrawer
createComponent('AILogDrawer', `
import React, { useEffect, useRef } from 'react'
import { Terminal } from 'lucide-react'
import { useAILogStore } from '../../stores/useAILogStore'

export function AILogDrawer({ isExpanded, onToggle, logEndRef }: any) {
  const sensorLogContainerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const unsubscribe = useAILogStore.subscribe((state, prevState) => {
      if (state.sensorLogs === prevState.sensorLogs) return;
      const container = sensorLogContainerRef.current;
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
        htmlString += \`<div style="color: \${color}; min-height: 1.2em;">\${line}</div>\`;
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
        style={{
          position: 'absolute', top: '-28px', left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(15, 23, 42, 0.95)', padding: '4px 16px',
          borderTopLeftRadius: '8px', borderTopRightRadius: '8px',
          borderTop: '1px solid rgba(6, 182, 212, 0.3)',
          borderLeft: '1px solid rgba(6, 182, 212, 0.3)',
          borderRight: '1px solid rgba(6, 182, 212, 0.3)',
          cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px',
          color: 'var(--primary)', fontSize: '11px', fontWeight: 600
        }}
      >
        <Terminal size={12} />
        {isExpanded ? '터미널 닫기' : '터미널 열기'}
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
        ref={sensorLogContainerRef}
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
`);

// 3. AIDownloadProgress
createComponent('AIDownloadProgress', `
import React from 'react'
import { formatBytes } from '../../../utils/aiFormatters'

export function AIDownloadProgress({ downloadStatus, onCancel, onShowDetails }: any) {
  if (!downloadStatus || !downloadStatus.status) return null

  return (
    <>
      <div style={{
        position: 'absolute', bottom: '10px', right: '10px',
        width: '240px', background: 'var(--bg-glass)',
        border: '1px solid rgba(6,182,212,0.3)', borderRadius: '8px',
        padding: '10px', zIndex: 110,
        boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
        display: 'flex', flexDirection: 'column', gap: '6px'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-main)' }}>
            모델 다운로드 중...
          </span>
          <span style={{ fontSize: '10px', color: 'var(--primary)' }}>
            {Math.round(downloadStatus.progress || 0)}%
          </span>
        </div>
        <div style={{ width: '100%', height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', overflow: 'hidden' }}>
          <div style={{ 
            width: \`\${downloadStatus.progress || 0}%\`, height: '100%', 
            background: 'var(--primary)', transition: 'width 0.3s' 
          }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--text-muted)' }}>
          <span>{formatBytes(downloadStatus.downloaded)} / {formatBytes(downloadStatus.total)}</span>
          <span>{formatBytes(downloadStatus.speed)}/s</span>
        </div>
        <div style={{ display: 'flex', gap: '4px', marginTop: '4px' }}>
          <button 
            onClick={onCancel}
            style={{ flex: 1, padding: '4px', fontSize: '10px', background: 'transparent', border: '1px solid var(--border-muted)', borderRadius: '4px', color: 'var(--text-muted)', cursor: 'pointer' }}
          >
            취소
          </button>
          <button 
            onClick={onShowDetails}
            style={{ flex: 1, padding: '4px', fontSize: '10px', background: 'var(--primary)', border: 'none', borderRadius: '4px', color: '#fff', cursor: 'pointer' }}
          >
            상세보기
          </button>
        </div>
      </div>
    </>
  )
}
`);
