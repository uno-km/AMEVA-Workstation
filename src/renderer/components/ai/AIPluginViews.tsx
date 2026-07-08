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

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (!searchQuery.trim()) return
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

export function AIPluginViews({ activeTab }: { activeTab: string }) {
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
    if (activeTab === 'ai' || activeTab === 'outline' || activeTab === 'google-maps') return;
    const ref = pluginRefs[activeTab as keyof typeof pluginRefs];
    if (ref?.current) {
      const globalPlugins = (window as any).AMEVA_PLUGINS;
      if (globalPlugins?.[activeTab]) {
        try {
          globalPlugins[activeTab].render(ref.current.id);
        } catch (e) {
          console.error(`${activeTab} 플러그인 렌더링 실패:`, e);
        }
      }
    }
  }, [activeTab]);

  const containerStyle = {
    flex: 1, display: 'flex', flexDirection: 'column' as const,
    backgroundColor: 'var(--bg-main)', height: '100%', padding: '16px', overflowY: 'auto' as const
  };

  switch (activeTab) {
    case 'calculator': return <div id="ameva-plugin-calculator" style={containerStyle} ref={pluginRefs.calculator} />
    // [FIX-FINANCE] finance / finance-dashboard 둘 다 내장 뷰로 처리
    // (RightTabStrip에서 tab id는 'finance', 플러그인 id는 'finance-dashboard')
    case 'finance':
    case 'finance-dashboard': return <FinanceDashboardView />
    case 'youtube': return <div id="ameva-plugin-youtube" style={containerStyle} ref={pluginRefs.youtube} />
    case 'naver': return <div id="ameva-plugin-naver" style={containerStyle} ref={pluginRefs.naver} />
    case 'google': return <div id="ameva-plugin-google" style={containerStyle} ref={pluginRefs.google} />
    case 'calendar': return <div id="ameva-plugin-calendar" style={containerStyle} ref={pluginRefs.calendar} />
    case 'google-drive': return <div id="ameva-plugin-google-drive" style={containerStyle} ref={pluginRefs['google-drive']} />
    // [FEAT-MAPS] 구글 지도 — 내장 iframe 뷰 (플러그인 없이 직접 렌더링)
    case 'google-maps': return <GoogleMapsView />
    default: return null;
  }
}
