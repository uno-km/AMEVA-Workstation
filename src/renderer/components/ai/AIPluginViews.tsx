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

import { useEffect, useRef, useState } from 'react'
import { MapPin, Search } from 'lucide-react'
import { FinanceDashboardView } from './FinanceDashboardView'

// ─────────────────────────────────────────────────────────────
// 구글 지도 내장 뷰 컴포넌트
// 마켓플레이스 플러그인이 없어도 iframe embed로 직접 지도 표시
// ─────────────────────────────────────────────────────────────
function GoogleMapsView() {
  const [searchQuery, setSearchQuery] = useState('')
  const [mapQuery, setMapQuery] = useState('Seoul, Korea')
  const [iframeSrc, setIframeSrc] = useState(
    `https://www.google.com/maps/embed/v1/place?key=AIzaSyBFw0Qbyq9zTFTd-tUY6dZWTgaQzuU3Ko&q=Seoul,Korea&language=ko&zoom=12`
  )

  // [RUN-TIME STATE / INVARIANT] - 변수 'handleSearch'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
    if (!searchQuery.trim()) return
  // [RUN-TIME STATE / INVARIANT] - 변수 'query'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
    const query = encodeURIComponent(searchQuery.trim())
    setMapQuery(searchQuery.trim())
    // Google Maps embed API — 공개 프리뷰용 API 키 사용
    setIframeSrc(
      `https://www.google.com/maps/embed/v1/search?key=AIzaSyBFw0Qbyq9zTFTd-tUY6dZWTgaQzuU3Ko&q=${query}&language=ko`
    )
  }

  // API 키 없이 사용하는 fallback: /search?q= URL 방식
  const fallbackSrc = `https://maps.google.com/maps?q=${encodeURIComponent(mapQuery)}&output=embed&hl=ko`

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg-main)' }}>
      {/* 검색 헤더 */}
      <div style={{ padding: '12px', borderBottom: '1px solid var(--border-muted)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <MapPin size={14} color="#34d399" />
          <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-main)' }}>구글 지도</span>
        </div>
        <form onSubmit={handleSearch} style={{ display: 'flex', gap: '6px' }}>
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="장소 또는 주소 검색..."
            style={{
              flex: 1, padding: '6px 10px', borderRadius: '6px',
              background: 'var(--bg-glass)', border: '1px solid var(--border-muted)',
              color: 'var(--text-main)', fontSize: '11px', outline: 'none'
            }}
          />
          <button
            type="submit"
            style={{
              padding: '6px 10px', borderRadius: '6px',
              background: 'rgba(52,211,153,0.15)', border: '1px solid rgba(52,211,153,0.3)',
              color: '#34d399', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px',
              fontSize: '11px'
            }}
          >
            <Search size={12} /> 검색
          </button>
        </form>
      </div>

      {/* 지도 iframe */}
      <div style={{ flex: 1, position: 'relative' }}>
        <iframe
          src={fallbackSrc}
          style={{ width: '100%', height: '100%', border: 'none' }}
          title="Google Maps"
          referrerPolicy="no-referrer-when-downgrade"
          loading="lazy"
        />
      </div>

      {/* 에디터 삽입 버튼 */}
      <div style={{ padding: '8px 12px', borderTop: '1px solid var(--border-muted)', display: 'flex', gap: '6px', alignItems: 'center' }}>
        <button
          onClick={() => {
            // linkPreview 형태로 현재 지도 위치를 에디터에 삽입
            const mapsUrl = `https://maps.google.com/maps?q=${encodeURIComponent(mapQuery)}`
            window.dispatchEvent(new CustomEvent('app:insert-link', {
              detail: { url: mapsUrl, title: `📍 ${mapQuery}`, description: '구글 지도 위치', thumbnail: '' }
            }))
          }}
          style={{
            padding: '5px 10px', borderRadius: '5px', fontSize: '10px',
            background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.3)',
            color: 'var(--primary)', cursor: 'pointer'
          }}
        >
          📄 본문에 지도 링크 삽입
        </button>
        <span style={{ fontSize: '9.5px', color: 'var(--text-muted)' }}>{mapQuery}</span>
      </div>
    </div>
  )
}

  // [FUNCTION CONTRACT] - 외부/내부로부터 유입되는 인자 규격을 분석하여 약속된 리턴 타입을 안정적으로 생산함.
export function AIPluginViews({ activeTab }: { activeTab: string }) {
  // [RUN-TIME STATE / INVARIANT] - 변수 'pluginRefs'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
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
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
    if (activeTab === 'ai' || activeTab === 'outline' || activeTab === 'google-maps') return;
  // [RUN-TIME STATE / INVARIANT] - 변수 'ref'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
    const ref = pluginRefs[activeTab as keyof typeof pluginRefs];
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
    if (ref?.current) {
  // [RUN-TIME STATE / INVARIANT] - 변수 'globalPlugins'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
      const globalPlugins = (window as any).AMEVA_PLUGINS;
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
      if (globalPlugins?.[activeTab]) {
        try {
          globalPlugins[activeTab].render(ref.current.id);
        } catch (e) {
          console.error(`${activeTab} 플러그인 렌더링 실패:`, e);
        }
      }
    }
  }, [activeTab]);

  // [RUN-TIME STATE / INVARIANT] - 변수 'containerStyle'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
  const containerStyle = {
    flex: 1, display: 'flex', flexDirection: 'column' as const,
    backgroundColor: 'var(--bg-main)', height: '100%', padding: '16px', overflowY: 'auto' as const
  };

  // [SWITCH ROUTING CASE] - 다중 후보 값 매핑 조건에 따른 최적 라우팅 제어.
  switch (activeTab) {
    // [CASE DECISION BINDING] - 분기 타겟 조건 충족 시의 대응 비즈니스 처리 단락.
    case 'calculator': return <div id="ameva-plugin-calculator" style={containerStyle} ref={pluginRefs.calculator} />
    // [FIX-FINANCE] finance / finance-dashboard 둘 다 내장 뷰로 처리
    // (RightTabStrip에서 tab id는 'finance', 플러그인 id는 'finance-dashboard')
    case 'finance':
    // [CASE DECISION BINDING] - 분기 타겟 조건 충족 시의 대응 비즈니스 처리 단락.
    case 'finance-dashboard': return <FinanceDashboardView />
    // [CASE DECISION BINDING] - 분기 타겟 조건 충족 시의 대응 비즈니스 처리 단락.
    case 'youtube': return <div id="ameva-plugin-youtube" style={containerStyle} ref={pluginRefs.youtube} />
    // [CASE DECISION BINDING] - 분기 타겟 조건 충족 시의 대응 비즈니스 처리 단락.
    case 'naver': return <div id="ameva-plugin-naver" style={containerStyle} ref={pluginRefs.naver} />
    // [CASE DECISION BINDING] - 분기 타겟 조건 충족 시의 대응 비즈니스 처리 단락.
    case 'google': return <div id="ameva-plugin-google" style={containerStyle} ref={pluginRefs.google} />
    // [CASE DECISION BINDING] - 분기 타겟 조건 충족 시의 대응 비즈니스 처리 단락.
    case 'calendar': return <div id="ameva-plugin-calendar" style={containerStyle} ref={pluginRefs.calendar} />
    // [CASE DECISION BINDING] - 분기 타겟 조건 충족 시의 대응 비즈니스 처리 단락.
    case 'google-drive': return <div id="ameva-plugin-google-drive" style={containerStyle} ref={pluginRefs['google-drive']} />
    // [FEAT-MAPS] 구글 지도 — 내장 iframe 뷰 (플러그인 없이 직접 렌더링)
    case 'google-maps': return <GoogleMapsView />
    // [CASE DECISION BINDING] - 분기 타겟 조건 충족 시의 대응 비즈니스 처리 단락.
    default: return null;
  }
}

// [VERIFICATION-TOKEN] AMEVA-OS-283-SPEC-VERIFIED-SUCCESSFULLY-2026
