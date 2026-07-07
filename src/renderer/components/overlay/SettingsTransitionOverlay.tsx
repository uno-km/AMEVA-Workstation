import { useState, useEffect } from 'react';
import { Loader2, Sparkles } from 'lucide-react';

interface SettingsTransitionOverlayProps {
  isVisible: boolean;
}

const TIPS = [
  "💡 팁: Ctrl + N을 누르면 언제든지 새 문서를 생성할 수 있습니다.",
  "💡 팁: 사이드바의 스냅샷 기능을 통해 작업 내역을 버전별로 저장해 보세요.",
  "💡 팁: 'Turbo' 모드를 활성화하면 파일 시스템 접근 권한 확인을 생략하여 속도를 높일 수 있습니다.",
  "💡 팁: AMEVA OS는 로컬 브라우저 상의 WASM 코어를 활용하므로 오프라인 환경에서도 작동합니다.",
  "💡 팁: Llama.cpp 또는 Ollama 엔진을 통해 강력한 온디바이스 AI 어시스턴트와 대화해보세요.",
  "💡 팁: 마켓플레이스에서 다양한 플러그인과 기술(Skill)을 다운로드하여 IDE를 확장할 수 있습니다."
];

export function SettingsTransitionOverlay({ isVisible }: SettingsTransitionOverlayProps) {
  const [currentTip, setCurrentTip] = useState(TIPS[0]);
  const [opacity, setOpacity] = useState(0);

  useEffect(() => {
    if (isVisible) {
      setOpacity(1);
      // Randomize tip
      setCurrentTip(TIPS[Math.floor(Math.random() * TIPS.length)]);
      
      const interval = setInterval(() => {
        setCurrentTip(TIPS[Math.floor(Math.random() * TIPS.length)]);
      }, 2500);
      return () => clearInterval(interval);
    } else {
      setOpacity(0);
    }
  }, [isVisible]);

  if (!isVisible && opacity === 0) return null;

  return (
    <div
      style={{
        position: 'absolute',
        top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(10, 10, 15, 0.85)',
        backdropFilter: 'blur(16px)',
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        opacity: opacity,
        transition: 'opacity 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
        pointerEvents: isVisible ? 'auto' : 'none'
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '24px' }}>
        <Loader2 className="animate-spin" size={48} color="var(--primary)" />
        
        <div style={{ textAlign: 'center' }}>
          <h2 style={{ 
            color: 'var(--text-main)', 
            fontSize: '18px', 
            fontWeight: 700, 
            marginBottom: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px'
          }}>
            <Sparkles size={18} color="#fcd34d" />
            엔진 재구동 및 시스템 동기화 중...
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
            새로운 설정을 워크스테이션 인스턴스에 주입하고 있습니다.
          </p>
        </div>

        <div style={{
          marginTop: '32px',
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.05)',
          padding: '12px 20px',
          borderRadius: '8px',
          maxWidth: '400px',
          minHeight: '48px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center'
        }}>
          <span style={{ 
            color: 'var(--text-muted)', 
            fontSize: '12.5px',
            lineHeight: 1.5,
            animation: 'fadeIn 0.3s ease-out'
          }}>
            {currentTip}
          </span>
        </div>
      </div>
      
      {/* Inline animation keyframes for tip fading */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(5px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
