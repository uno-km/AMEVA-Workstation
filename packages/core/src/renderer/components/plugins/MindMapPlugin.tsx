import React, { useState } from 'react';
import { Network, ZoomIn, ZoomOut, Maximize, Play } from 'lucide-react';

export function MindMapPlugin() {
  const [nodes, setNodes] = useState<{id: string, label: string, x: number, y: number}[]>([]);
  const [edges, setEdges] = useState<{source: string, target: string}[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);

  const generateMap = () => {
    setIsGenerating(true);
    setTimeout(() => {
      setIsGenerating(false);
      setNodes([
        { id: '1', label: '마켓플레이스 기획', x: 250, y: 150 },
        { id: '2', label: '칸반 보드', x: 100, y: 80 },
        { id: '3', label: 'PDF RAG', x: 100, y: 220 },
        { id: '4', label: '웹 브라우저', x: 400, y: 80 },
        { id: '5', label: 'DB 탐색기', x: 400, y: 220 },
      ]);
      setEdges([
        { source: '1', target: '2' },
        { source: '1', target: '3' },
        { source: '1', target: '4' },
        { source: '1', target: '5' },
      ]);
    }, 1200);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'transparent', padding: '2px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', padding: '0 8px' }}>
        <div style={{ background: 'linear-gradient(135deg, #10b981, #059669)', padding: '8px', borderRadius: '8px' }}>
          <Network size={18} color="#fff" />
        </div>
        <div>
          <h2 style={{ fontSize: '16px', fontWeight: 'bold', margin: 0 }}>Mind Map</h2>
          <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: 0 }}>현재 문서를 노드 그래프로 시각화</p>
        </div>
      </div>

      <div style={{ flex: 1, background: '#1e1e24', borderRadius: '12px', border: '1px solid var(--border-muted)', margin: '0 8px 8px', overflow: 'hidden', position: 'relative', display: 'flex', flexDirection: 'column' }}>
        <div style={{ position: 'absolute', top: 12, right: 12, display: 'flex', gap: '6px', zIndex: 10 }}>
          <button style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-muted)', color: 'var(--text-main)', padding: '6px', borderRadius: '6px', cursor: 'pointer' }}><ZoomIn size={14}/></button>
          <button style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-muted)', color: 'var(--text-main)', padding: '6px', borderRadius: '6px', cursor: 'pointer' }}><ZoomOut size={14}/></button>
          <button style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-muted)', color: 'var(--text-main)', padding: '6px', borderRadius: '6px', cursor: 'pointer' }}><Maximize size={14}/></button>
        </div>

        {nodes.length === 0 ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <Network size={48} color="var(--border-muted)" style={{ marginBottom: '16px' }} />
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>에디터의 문서를 기반으로 마인드맵을 생성합니다.</p>
            <button onClick={generateMap} disabled={isGenerating} style={{ background: '#10b981', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '8px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px', cursor: isGenerating ? 'not-allowed' : 'pointer' }}>
              {isGenerating ? '생성 중...' : <><Play size={14}/> 맵 생성하기</>}
            </button>
          </div>
        ) : (
          <div style={{ flex: 1, position: 'relative' }}>
            <svg width="100%" height="100%">
              {edges.map((e, i) => {
                const src = nodes.find(n => n.id === e.source);
                const tgt = nodes.find(n => n.id === e.target);
                if (!src || !tgt) return null;
                return (
                  <line key={i} x1={src.x} y1={src.y} x2={tgt.x} y2={tgt.y} stroke="var(--border-muted)" strokeWidth="2" />
                );
              })}
              {nodes.map(n => (
                <g key={n.id} transform={`translate(${n.x}, ${n.y})`} style={{ cursor: 'pointer' }}>
                  <rect x="-60" y="-20" width="120" height="40" rx="20" fill="var(--bg-glass)" stroke="#10b981" strokeWidth="2" />
                  <text x="0" y="4" textAnchor="middle" fill="#fff" fontSize="12" fontWeight="bold">{n.label}</text>
                </g>
              ))}
            </svg>
          </div>
        )}
      </div>
    </div>
  );
}
