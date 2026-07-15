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

import React, { useRef, useEffect, useState, useMemo } from 'react'
import { MapPin, Search, ArrowLeft, ArrowRight, RotateCw, Home, X, ChevronUp, ChevronDown } from 'lucide-react'
import { DynamicRemotePluginLoader } from './DynamicRemotePluginLoader'

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
    naver: useRef<HTMLDivElement>(null),
    google: useRef<HTMLDivElement>(null),
    calendar: useRef<HTMLDivElement>(null),
    'google-drive': useRef<HTMLDivElement>(null),
    'google-maps': useRef<HTMLDivElement>(null),
  }

  useEffect(() => {
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `activeTab === 'ai' || activeTab === 'outline' || activeTab === 'google-maps'`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (activeTab === 'ai' || activeTab === 'outline' || activeTab === 'google-maps')` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
    if (activeTab === 'ai' || activeTab === 'outline' || activeTab === 'google-maps') return;
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `ref`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const ref = ...` 형태로 안전 캐싱 후 가공 기동.
       */
    const ref = pluginRefs[activeTab as keyof typeof pluginRefs];
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `ref?.current`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (ref?.current)` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
    if (ref?.current) {
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `globalPlugins`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const globalPlugins = ...` 형태로 안전 캐싱 후 가공 기동.
       */
      const globalPlugins = (window as any).AMEVA_PLUGINS;
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `globalPlugins?.[activeTab]`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (globalPlugins?.[activeTab])` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
      if (globalPlugins?.[activeTab]) {
        try {
          globalPlugins[activeTab].render(ref.current.id);
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

      /*
       * [SWITCH ROUTING CASE]
       * - 라우팅 키: `switch (activeTab) {`
       * - 예상 시나리오: 유입된 상태 변수 분기값과 일치하는 케이스 블록으로 런타임 제어를 즉시 라우팅함.
       * - 예시: `switch (format)` 분기 시 매치되는 변환 포맷 서브 모듈이 가동됨.
       */
  switch (activeTab) {
    // [LEGACY DOM-BASED PLUGINS]
    case 'calculator': return <div key="calculator" id="ameva-plugin-calculator" style={containerStyle} ref={pluginRefs.calculator} />
    case 'youtube': return <div key="youtube" id="ameva-plugin-youtube" style={containerStyle} ref={pluginRefs.youtube} />
    case 'naver': return <div key="naver" id="ameva-plugin-naver" style={containerStyle} ref={pluginRefs.naver} />
    case 'calendar': return <div key="calendar" id="ameva-plugin-calendar" style={containerStyle} ref={pluginRefs.calendar} />
    case 'google-drive': return <div key="google-drive" id="ameva-plugin-google-drive" style={containerStyle} ref={pluginRefs['google-drive']} />
    case 'google': return <div key="google" id="ameva-plugin-google" style={containerStyle} ref={pluginRefs.google} />

    // [MARKET-PLACE DYNAMIC PLUGINS]
    case 'finance':
    case 'finance-dashboard': return <DynamicRemotePluginLoader key="finance-dashboard" pluginId="FinanceDashboardView" />
    case 'web-browser': return <DynamicRemotePluginLoader key="web-browser" pluginId="AmevaBrowserView" />
    case 'google-maps': return <DynamicRemotePluginLoader key="google-maps" pluginId="GoogleMapsView" />
    case 'kanban': return <DynamicRemotePluginLoader key="kanban" pluginId="KanbanBoard" />
    
    // The 8 Epic Plugins
    case 'pdf-rag': return <DynamicRemotePluginLoader key="pdf-rag" pluginId="PdfRagPlugin" />
    case 'db-explorer': return <DynamicRemotePluginLoader key="db-explorer" pluginId="DatabaseExplorerPlugin" />
    case 'voice-dictation': return <DynamicRemotePluginLoader key="voice-dictation" pluginId="VoiceDictationPlugin" />
    case 'presentation': return <DynamicRemotePluginLoader key="presentation" pluginId="PresentationPlugin" />
    case 'mind-map': return <DynamicRemotePluginLoader key="mind-map" pluginId="MindMapPlugin" />
    case 'pomodoro': return <DynamicRemotePluginLoader key="pomodoro" pluginId="PomodoroPlugin" />
    case 'rest-client': return <DynamicRemotePluginLoader key="rest-client" pluginId="RestClientPlugin" />
    case 'wireframe': return <DynamicRemotePluginLoader key="wireframe" pluginId="WireframePlugin" />

    default: return null;
  }
}

// ─────────────────────────────────────────────────────────────
// 아메바 내장 웹 브라우저 컴포넌트 (AmevaBrowserView)
// 주소창(input), 뒤로/앞으로가기, 새로고침, 홈 기능 지원
// ─────────────────────────────────────────────────────────────


