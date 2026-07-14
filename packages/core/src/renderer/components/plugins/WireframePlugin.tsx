import React, { useState } from 'react';
import { LayoutTemplate, PenTool, Square, Circle, MousePointer2, Image as ImageIcon } from 'lucide-react';

export function WireframePlugin() {
  const [activeTool, setActiveTool] = useState('pointer');
  
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'transparent', padding: '2px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', padding: '0 8px' }}>
        <div style={{ background: 'linear-gradient(135deg, #10b981, #14b8a6)', padding: '8px', borderRadius: '8px' }}>
          <LayoutTemplate size={18} color="#fff" />
        </div>
        <div>
          <h2 style={{ fontSize: '16px', fontWeight: 'bold', margin: 0 }}>Wireframe Builder</h2>
          <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: 0 }}>로컬 화이트보드 스케치 동기화</p>
        </div>
      </div>

      <div style={{ flex: 1, background: '#e2e8f0', borderRadius: '12px', border: '1px solid var(--border-muted)', margin: '0 8px 8px', overflow: 'hidden', display: 'flex', flexDirection: 'column', position: 'relative' }}>
        <div style={{ position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)', background: 'rgba(255,255,255,0.8)', backdropFilter: 'blur(10px)', padding: '6px', borderRadius: '8px', display: 'flex', gap: '4px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', zIndex: 10 }}>
          <button onClick={() => setActiveTool('pointer')} style={{ background: activeTool === 'pointer' ? 'rgba(16,185,129,0.2)' : 'transparent', color: activeTool === 'pointer' ? '#10b981' : '#475569', border: 'none', padding: '6px', borderRadius: '4px', cursor: 'pointer' }}><MousePointer2 size={16}/></button>
          <button onClick={() => setActiveTool('pen')} style={{ background: activeTool === 'pen' ? 'rgba(16,185,129,0.2)' : 'transparent', color: activeTool === 'pen' ? '#10b981' : '#475569', border: 'none', padding: '6px', borderRadius: '4px', cursor: 'pointer' }}><PenTool size={16}/></button>
          <button onClick={() => setActiveTool('rect')} style={{ background: activeTool === 'rect' ? 'rgba(16,185,129,0.2)' : 'transparent', color: activeTool === 'rect' ? '#10b981' : '#475569', border: 'none', padding: '6px', borderRadius: '4px', cursor: 'pointer' }}><Square size={16}/></button>
          <button onClick={() => setActiveTool('circle')} style={{ background: activeTool === 'circle' ? 'rgba(16,185,129,0.2)' : 'transparent', color: activeTool === 'circle' ? '#10b981' : '#475569', border: 'none', padding: '6px', borderRadius: '4px', cursor: 'pointer' }}><Circle size={16}/></button>
        </div>

        <div style={{ flex: 1, position: 'relative' }}>
          <svg width="100%" height="100%">
            <defs>
              <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
                <circle cx="2" cy="2" r="1" fill="#cbd5e1" />
              </pattern>
              <marker id="arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M 0 0 L 10 5 L 0 10 z" fill="#ef4444" />
              </marker>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
            
            <g transform="translate(40, 60)">
              <rect x="0" y="0" width="220" height="340" rx="24" fill="#fff" stroke="#94a3b8" strokeWidth="4" />
              <rect x="80" y="12" width="60" height="6" rx="3" fill="#cbd5e1" />
              <rect x="20" y="40" width="180" height="140" rx="12" fill="#e2e8f0" />
              <circle cx="110" cy="110" r="24" fill="#fff" />
              <rect x="20" y="200" width="180" height="24" rx="6" fill="#f1f5f9" stroke="#cbd5e1" strokeWidth="2" />
              <rect x="20" y="240" width="140" height="24" rx="6" fill="#f1f5f9" stroke="#cbd5e1" strokeWidth="2" />
              <rect x="20" y="280" width="180" height="40" rx="12" fill="#10b981" />
              <text x="110" y="305" textAnchor="middle" fill="#fff" fontSize="14" fontWeight="bold">Sign In</text>
            </g>

            <path d="M 280 200 Q 340 200 340 140" fill="none" stroke="#ef4444" strokeWidth="3" strokeDasharray="6 6" markerEnd="url(#arrow)" />
            <text x="350" y="120" fill="#ef4444" fontSize="14" fontWeight="bold">Main View</text>
          </svg>
        </div>

        <div style={{ padding: '12px', background: 'var(--bg-main)', borderTop: '1px solid var(--border-muted)', display: 'flex', gap: '8px' }}>
          <button onClick={() => alert('이미지로 저장되었습니다!')} style={{ flex: 1, background: 'var(--bg-glass)', border: '1px solid var(--border-muted)', color: 'var(--text-main)', padding: '8px', borderRadius: '6px', fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', cursor: 'pointer' }}>
            <ImageIcon size={14}/> 스케치 이미지 캡처
          </button>
          <button onClick={() => alert('에디터에 와이어프레임이 동기화되었습니다!')} style={{ flex: 1, background: '#10b981', border: 'none', color: '#fff', padding: '8px', borderRadius: '6px', fontSize: '12px', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', cursor: 'pointer' }}>
            <LayoutTemplate size={14}/> 마크다운에 동기화
          </button>
        </div>
      </div>
    </div>
  );
}
