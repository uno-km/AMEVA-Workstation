import React, { useState } from 'react';
import { MonitorPlay, Play, ChevronLeft, ChevronRight, Maximize } from 'lucide-react';

export function PresentationPlugin() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [slideIdx, setSlideIdx] = useState(0);

  const slides = [
    { title: 'AMEVA Workstation', content: '차세대 엣지 컴퓨팅 OS' },
    { title: 'Core Features', content: '1. AI Assistant\n2. Local RAG\n3. Offline Mode' },
    { title: 'Future Roadmap', content: '플러그인 생태계 확장 및 B2B 엔터프라이즈 도입' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'transparent', padding: '2px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', padding: '0 8px' }}>
        <div style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)', padding: '8px', borderRadius: '8px' }}>
          <MonitorPlay size={18} color="#fff" />
        </div>
        <div>
          <h2 style={{ fontSize: '16px', fontWeight: 'bold', margin: 0 }}>Presentation</h2>
          <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: 0 }}>문서를 슬라이드로 변환</p>
        </div>
      </div>

      <div style={{ flex: 1, background: '#1e1e24', borderRadius: '12px', border: '1px solid var(--border-muted)', margin: '0 8px 8px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {!isPlaying ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <MonitorPlay size={48} color="var(--border-muted)" style={{ marginBottom: '16px' }} />
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>'---' 구분자를 통해 총 {slides.length}장의 슬라이드가 인식되었습니다.</p>
            <button onClick={() => setIsPlaying(true)} style={{ background: '#f59e0b', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '8px', fontSize: '14px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <Play size={16}/> 슬라이드쇼 시작
            </button>
          </div>
        ) : (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#000', color: '#fff', position: 'relative' }}>
            <div style={{ position: 'absolute', top: 16, right: 16, display: 'flex', gap: '8px' }}>
              <button onClick={() => setIsPlaying(false)} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', cursor: 'pointer' }}>종료 (Esc)</button>
              <button style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff', padding: '6px', borderRadius: '6px', cursor: 'pointer' }}><Maximize size={14}/></button>
            </div>
            
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px', textAlign: 'center' }}>
              <h1 style={{ fontSize: '28px', fontWeight: 'bold', marginBottom: '24px', color: '#f59e0b' }}>{slides[slideIdx].title}</h1>
              <p style={{ fontSize: '18px', lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>{slides[slideIdx].content}</p>
            </div>

            <div style={{ padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.05)' }}>
              <button disabled={slideIdx === 0} onClick={() => setSlideIdx(s => Math.max(0, s - 1))} style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', padding: '8px', borderRadius: '50%', cursor: slideIdx === 0 ? 'not-allowed' : 'pointer', opacity: slideIdx === 0 ? 0.3 : 1 }}>
                <ChevronLeft size={20} />
              </button>
              <span style={{ fontSize: '14px', color: '#aaa' }}>{slideIdx + 1} / {slides.length}</span>
              <button disabled={slideIdx === slides.length - 1} onClick={() => setSlideIdx(s => Math.min(slides.length - 1, s + 1))} style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', padding: '8px', borderRadius: '50%', cursor: slideIdx === slides.length - 1 ? 'not-allowed' : 'pointer', opacity: slideIdx === slides.length - 1 ? 0.3 : 1 }}>
                <ChevronRight size={20} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
