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
    setComponent(null);
    setError(null);

    async function fetchAndLoad() {
      try {
        // 실제 운영 환경에서는 /api/plugins/download/:id 엔드포인트에 Auth 토큰을 실어 요청해야 함
        // 지금은 보안 아키텍처 증명을 위해 서버의 프리미엄 디렉토리에서 바로 로드
        const baseUrl = window.location.hostname === 'localhost'
          ? 'http://localhost:3010'
          : 'https://uno-km.github.io/AMEVA-Workstation-Market-Place';
        const res = await fetch(`${baseUrl}/plugins/premium/${pluginId}.tsx`);
        if (!res.ok) throw new Error("플러그인 다운로드에 실패했습니다. 유효한 라이센스인지 확인하세요.");
        let code = await res.text();

        // 1. React import 처리
        code = code.replace(/import\s+React(?:,\s*\{([^}]+)\})?\s+from\s+['"]react['"];?/gs, (m, p1) => {
          return `var React = window.AMEVA_CORE.React;\n${p1 ? `var {${p1}} = React;` : ''}`;
        });

        // 2. Lucide-react import 처리 (플러그인이 요구하는 아이콘을 동적으로 모두 추출)
        code = code.replace(/import\s+\{([^}]+)\}\s+from\s+['"]lucide-react['"];?/gs, 'var {$1} = window.AMEVA_CORE.LucideIcons;');

        // 3. 커스텀 훅 import 처리
        code = code.replace(/import\s+\{([^}]+)\}\s+from\s+['"].*?useLLMInference.*?['"];?/gs, 'var {$1} = window.AMEVA_CORE;');

        // 4. 나머지 모든 import 구문 제거 (지원되지 않는 모듈 방어)
        code = code.replace(/import\s+.*?from\s+['"].*?['"];?/gs, '');
        
        // 5. 공통 객체 주입 (var를 사용하여 중복 선언 에러 방지)
        const injection = `
          var React = window.AMEVA_CORE.React;
          var { useLLMInference } = window.AMEVA_CORE;
          var Lucide = window.AMEVA_CORE.LucideIcons;
        `;

        // export 키워드 제거
        code = injection + "\n" + code.replace(/export\s+default\s+function/g, 'function').replace(/export\s+function/g, 'function');

        // 3. Babel을 통한 실시간 JSX/TSX 컴파일 (클라이언트 런타임에서 JIT 컴파일)
        const compiled = Babel.transform(code, { 
          presets: [
            ['react', { runtime: 'classic' }], 
            'typescript'
          ], 
          filename: 'plugin.tsx' 
        }).code;

        // 4. 컴포넌트 이름 추론 및 실행
        let compName = null;
        if (code.includes(`function ${pluginId}`)) {
          compName = pluginId;
        } else {
          const match = code.match(/function\s+([A-Z]\w+)/);
          compName = match ? match[1] : null;
        }

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
