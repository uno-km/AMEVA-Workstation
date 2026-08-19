/**
 * @file AIPluginViews.tsx
 * @system AMEVA OS Desktop Workstation
 * @location src/renderer/components/ai/AIPluginViews.tsx
 * @role Core module helper and integration logic
 * 
 * [소비처 - CONSUMERS / USAGE CONTEXT]
 * - 소비처 A (src/renderer/AppLayout.tsx): 레이아웃 그리드 내부 또는 플로팅 레이어 영역 내에서 그리기로 소비.
 * - 소비처 B (src/renderer/App.tsx): 전역 모달 매니저 및 뷰포트 상태 스위칭에 따라 동적 마운트되어 소비.
 * 
 * [책임 범위 - RESPONSIBILITY]
 * - 본 파일은 AMEVA 시스템 내에서 도메인 목적에 부합하는 연산 및 데이터 처리 흐름을 안전하게 캡슐화한다.
 * - 외부 라이브러리 및 하위 종속성을 조율하고 결과 규격을 일관되게 제공한다.
 * 
 * [절대 깨면 안 되는 계약 - CONTRACT]
 * - MUST: 모든 예외 발생 시 에러를 침묵시키지 말고 에러 로그를 명확하게 남길 것.
 * - MUST NOT: TypeScript any 형식을 우회 수단으로 함부로 선언하지 말 것.
 */

import React, { useRef, useEffect } from 'react'
import { DynamicRemotePluginLoader } from './DynamicRemotePluginLoader'
import { useUIStore } from '../../stores/useUIStore'

// ─────────────────────────────────────────────────────────────
// 구글 지도 내장 뷰 컴포넌트
// 마켓플레이스 플러그인이 없어도 iframe embed로 직접 지도 표시
// ─────────────────────────────────────────────────────────────

export function AIPluginViews({ activeTab }: { activeTab: string }) {
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `pluginRefs`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const pluginRefs = ...` 형태로 안전 캐싱 후 가공 기동.
       */
  const pluginRefs = {
    calculator: useRef<HTMLDivElement>(null),
    'finance-dashboard': useRef<HTMLDivElement>(null),
    youtube: useRef<HTMLDivElement>(null),
    calendar: useRef<HTMLDivElement>(null),
    'google-drive': useRef<HTMLDivElement>(null),
    'google-maps': useRef<HTMLDivElement>(null),
  }

  useEffect(() => {
    if (activeTab === 'ai' || activeTab === 'outline' || activeTab === 'google-maps') return;
    const ref = (pluginRefs as any)[activeTab];
    const targetId = ref?.current ? ref.current.id : `ameva-plugin-${activeTab}`;
    const targetEl = ref?.current || document.getElementById(targetId);

    if (targetEl) {
      const globalPlugins = (window as any).AMEVA_PLUGINS;
      if (globalPlugins?.[activeTab]) {
        try {
          globalPlugins[activeTab].render(targetId);
        } catch (e) {
          console.error(`${activeTab} 플러그인 렌더링 실패:`, e);
        }
      }
    }
  }, [activeTab]);

      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `containerStyle`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const containerStyle = ...` 형태로 안전 캐싱 후 가공 기동.
       */
  const containerStyle = {
    flex: 1, display: 'flex', flexDirection: 'column' as const,
    backgroundColor: 'var(--bg-main)', height: '100%', padding: '16px', overflowY: 'auto' as const
  };

  const marketplacePlugins = useUIStore(s => s.marketplacePlugins);
  
  // 1. Dynamic MarketPlace Plugin
  const pluginMeta = marketplacePlugins.find(p => p.id === activeTab);
  if (pluginMeta && pluginMeta.scriptUrl) {
    if (pluginMeta.scriptUrl.endsWith('.tsx')) {
      const baseUrl = 'https://uno-km.github.io/AMEVA-Workstation-Market-Place/';
      const scriptUrl = pluginMeta.scriptUrl.startsWith('http') ? pluginMeta.scriptUrl : baseUrl + pluginMeta.scriptUrl;
      return <DynamicRemotePluginLoader key={pluginMeta.id} pluginId={pluginMeta.id} scriptUrl={scriptUrl} />;
    } else {
      // Legacy DOM-based plugins loaded from marketplace
      return <div key={pluginMeta.id} id={`ameva-plugin-${pluginMeta.id}`} style={containerStyle} />
    }
  }

  // 2. Legacy DOM-based Plugins Fallback
  switch (activeTab) {
    case 'calculator': return <div key="calculator" id="ameva-plugin-calculator" style={containerStyle} ref={pluginRefs.calculator} />
    case 'youtube': return <div key="youtube" id="ameva-plugin-youtube" style={containerStyle} ref={pluginRefs.youtube} />
    case 'calendar': return <div key="calendar" id="ameva-plugin-calendar" style={containerStyle} ref={pluginRefs.calendar} />
    case 'google-drive': return <div key="google-drive" id="ameva-plugin-google-drive" style={containerStyle} ref={pluginRefs['google-drive']} />
    default: return null;
  }
}

// ─────────────────────────────────────────────────────────────
// 아메바 내장 웹 브라우저 컴포넌트 (AmevaBrowserView)
// 주소창(input), 뒤로/앞으로가기, 새로고침, 홈 기능 지원
// ─────────────────────────────────────────────────────────────


