import React, { useState, useEffect } from 'react';
import { Timer, Play, Pause, RotateCcw, BarChart2 } from 'lucide-react';

export function PomodoroPlugin() {
  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [sessionCount, setSessionCount] = useState(0);

  useEffect(() => {
    let timer: any;
    if (isRunning && timeLeft > 0) {
      timer = setInterval(() => setTimeLeft(t => t - 1), 1000);
    } else if (timeLeft === 0 && isRunning) {
      setIsRunning(false);
      setSessionCount(c => c + 1);
      alert('뽀모도로 세션이 완료되었습니다!');
      setTimeLeft(25 * 60);
    }
    return () => clearInterval(timer);
  }, [isRunning, timeLeft]);

  const mins = Math.floor(timeLeft / 60);
  const secs = timeLeft % 60;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'transparent', padding: '2px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', padding: '0 8px' }}>
        <div style={{ background: 'linear-gradient(135deg, #ef4444, #dc2626)', padding: '8px', borderRadius: '8px' }}>
          <Timer size={18} color="#fff" />
        </div>
        <div>
          <h2 style={{ fontSize: '16px', fontWeight: 'bold', margin: 0 }}>Focus & Pomodoro</h2>
          <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: 0 }}>타이머 및 생산성 분석</p>
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '12px', margin: '0 8px 8px' }}>
        <div style={{ background: '#1e1e24', borderRadius: '12px', border: '1px solid var(--border-muted)', padding: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>
          <div style={{ position: 'relative', width: '200px', height: '200px', borderRadius: '50%', border: '8px solid var(--bg-glass)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: 'inset 0 0 20px rgba(0,0,0,0.5)' }}>
            <svg style={{ position: 'absolute', top: -8, left: -8, width: 200, height: 200, pointerEvents: 'none' }}>
              <circle cx="100" cy="100" r="96" fill="none" stroke="#ef4444" strokeWidth="8" strokeDasharray="603" strokeDashoffset={603 - (timeLeft / (25 * 60)) * 603} style={{ transition: 'stroke-dashoffset 1s linear', transform: 'rotate(-90deg)', transformOrigin: 'center' }} />
            </svg>
            <span style={{ fontSize: '48px', fontWeight: 'bold', color: 'var(--text-main)', fontFamily: 'monospace' }}>
              {mins.toString().padStart(2, '0')}:{secs.toString().padStart(2, '0')}
            </span>
          </div>

          <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
            <button onClick={() => setIsRunning(!isRunning)} style={{ background: isRunning ? 'var(--bg-glass)' : '#ef4444', border: '1px solid var(--border-muted)', color: '#fff', width: '48px', height: '48px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.2s' }}>
              {isRunning ? <Pause size={20} /> : <Play size={20} style={{ transform: 'translateX(2px)' }} />}
            </button>
            <button onClick={() => { setIsRunning(false); setTimeLeft(25 * 60); }} style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-muted)', color: 'var(--text-main)', width: '48px', height: '48px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.2s' }}>
              <RotateCcw size={20} />
            </button>
          </div>
        </div>

        <div style={{ flex: 1, background: '#1e1e24', borderRadius: '12px', border: '1px solid var(--border-muted)', padding: '16px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '16px' }}>
            <BarChart2 size={14} color="#ef4444" />
            <span style={{ fontSize: '13px', fontWeight: 'bold' }}>오늘의 생산성</span>
          </div>
          <div style={{ display: 'flex', gap: '16px' }}>
            <div style={{ flex: 1, background: 'var(--bg-glass)', padding: '12px', borderRadius: '8px', textAlign: 'center' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>완료한 세션</div>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#ef4444', marginTop: '4px' }}>{sessionCount}</div>
            </div>
            <div style={{ flex: 1, background: 'var(--bg-glass)', padding: '12px', borderRadius: '8px', textAlign: 'center' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>집중 시간</div>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#ef4444', marginTop: '4px' }}>{sessionCount * 25}m</div>
            </div>
            <div style={{ flex: 1, background: 'var(--bg-glass)', padding: '12px', borderRadius: '8px', textAlign: 'center' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>타이핑 속도</div>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#10b981', marginTop: '4px' }}>82 WPM</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
