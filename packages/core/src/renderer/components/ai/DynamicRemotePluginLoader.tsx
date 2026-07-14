import React, { useState, useEffect } from 'react';
import * as LucideIcons from 'lucide-react';
import { useLLMInference } from '../../hooks/ai/useLLMInference';
import * as Babel from '@babel/standalone';

// 클라이언트 코어 컨텍스트를 전역으로 노출하여 원격 플러그인이 참조할 수 있도록 함
(window as any).AMEVA_CORE = { React, LucideIcons, useLLMInference };

export function DynamicRemotePluginLoader({ pluginId }: { pluginId: string }) {
  const [Component, setComponent] = useState<React.FC | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    async function fetchAndLoad() {
      try {
        // 실제 운영 환경에서는 /api/plugins/download/:id 엔드포인트에 Auth 토큰을 실어 요청해야 함
        // 지금은 보안 아키텍처 증명을 위해 서버의 프리미엄 디렉토리에서 바로 로드
        const res = await fetch(`http://localhost:3010/plugins/premium/${pluginId}.tsx`);
        if (!res.ok) throw new Error("플러그인 다운로드에 실패했습니다. 유효한 라이센스인지 확인하세요.");
        let code = await res.text();

        // 1. 모든 import 구문 제거 (원격 모듈은 로컬 파일 시스템에 접근 불가)
        code = code.replace(/import\s+.*?from\s+['"].*?['"];?/g, '');
        
        // 2. AMEVA 코어 객체에서 필수 라이브러리 및 훅 추출하는 코드 헤더에 주입
        const injection = `
          const React = window.AMEVA_CORE.React;
          const { useState, useEffect, useRef, useMemo, useCallback } = React;
          const { useLLMInference } = window.AMEVA_CORE;
          const Lucide = window.AMEVA_CORE.LucideIcons;
          // 자주 쓰는 아이콘들 미리 추출
          const { Search, MapPin, ArrowLeft, ArrowRight, RotateCw, Home, ChevronUp, ChevronDown, X, Play, Square, Save, Trash2, Edit3, Image, FileText, Code, Database, Mic, Video, Camera, FileVideo, Activity, BrainCircuit, Globe, KanbanSquare, Table, PieChart, VideoIcon, Calculator } = Lucide;
        `;

        // export 키워드 제거
        code = injection + "\n" + code.replace(/export\s+default\s+function/g, 'function').replace(/export\s+function/g, 'function');

        // 3. Babel을 통한 실시간 JSX/TSX 컴파일 (클라이언트 런타임에서 JIT 컴파일)
        const compiled = Babel.transform(code, { 
          presets: ['react', 'typescript'], 
          filename: 'plugin.tsx' 
        }).code;

        // 4. 컴포넌트 이름 추론 및 실행
        const match = code.match(/function\s+([A-Z]\w+)/);
        const compName = match ? match[1] : null;

        if (compName) {
           const executor = new Function(`
             ${compiled}
             return ${compName};
           `);
           const Comp = executor();
           if (isMounted) setComponent(() => Comp);
        } else {
           throw new Error("컴포넌트 진입점을 찾을 수 없습니다.");
        }
      } catch (e: any) {
        console.error(e);
        if (isMounted) setError(e.message);
      }
    }
    fetchAndLoad();
    return () => { isMounted = false; }
  }, [pluginId]);

  if (error) return <div style={{ padding: 20, color: '#ef4444', fontSize: '12px' }}>⚠️ 원격 모듈 로드 에러: {error}</div>;
  if (!Component) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--primary)', fontSize: '13px', background: 'var(--bg-main)' }}>
      <LucideIcons.CloudDownload size={18} style={{ marginRight: 8, animation: 'pulse 2s infinite' }} />
      마켓플레이스에서 보안 플러그인 다운로드 중...
    </div>
  );
  
  return <Component />;
}
