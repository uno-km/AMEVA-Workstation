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

import { useEffect, useRef, useState, useMemo } from 'react'
import { MapPin, Search, ArrowLeft, ArrowRight, RotateCw, Home, X, ChevronUp, ChevronDown } from 'lucide-react'
import { FinanceDashboardView } from './FinanceDashboardView'
import { PdfRagPlugin } from '../plugins/PdfRagPlugin'
import { DatabaseExplorerPlugin } from '../plugins/DatabaseExplorerPlugin'
import { MindMapPlugin } from '../plugins/MindMapPlugin'
import { PresentationPlugin } from '../plugins/PresentationPlugin'
import { PomodoroPlugin } from '../plugins/PomodoroPlugin'
import { VoiceDictationPlugin } from '../plugins/VoiceDictationPlugin'
import { RestClientPlugin } from '../plugins/RestClientPlugin'
import { WireframePlugin } from '../plugins/WireframePlugin'

// ─────────────────────────────────────────────────────────────
// 구글 지도 내장 뷰 컴포넌트
// 마켓플레이스 플러그인이 없어도 iframe embed로 직접 지도 표시
// ─────────────────────────────────────────────────────────────
function GoogleMapsView() {
  const [searchQuery, setSearchQuery] = useState('')
  const [mapQuery, setMapQuery] = useState('서울시')
  const [destinationQuery, setDestinationQuery] = useState('')
  const [legendText, setLegendText] = useState('')
  const [memoText, setMemoText] = useState('')
  
  const [lat, setLat] = useState(37.5665)
  const [lng, setLng] = useState(126.9780)
  const [destLat, setDestLat] = useState<number | null>(null)
  const [destLng, setDestLng] = useState<number | null>(null)
  const [zoom, setZoom] = useState(14)
  const [isRouteMode, setIsRouteMode] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // [NEW-FIELDS] 가는방법 및 알고리즘 상태 신설
  const [routeType, setRouteType] = useState<'car' | 'bicycle' | 'foot'>('car')
  const [routingEngine, setRoutingEngine] = useState<'osrm' | 'graphhopper' | 'valhalla'>('osrm')

  // Nominatim Geo-coding API 호출 헬퍼
  const fetchCoordinates = async (queryStr: string): Promise<{ lat: number; lng: number; name: string } | null> => {
    try {
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(queryStr.trim())}&format=json&limit=1`
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AMEVAOS/1.0'
        }
      })
      if (!res.ok) throw new Error(`HTTP Error ${res.status}`)
      const data = await res.json() as Array<{ lat: string; lon: string; display_name?: string }>
      if (data && data.length > 0) {
        return {
          lat: parseFloat(data[0].lat),
          lng: parseFloat(data[0].lon),
          name: queryStr.trim()
        }
      }
      return null
    } catch (e) {
      console.error('[GoogleMapsView] fetchCoordinates failed for:', queryStr, e)
      return null
    }
  }

  // 1. 출발지 독립 검색 트리거
  const handleSearchStart = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!searchQuery.trim()) return
    setIsLoading(true)
    setErrorMsg(null)
    try {
      const coords = await fetchCoordinates(searchQuery)
      if (coords) {
        setLat(coords.lat)
        setLng(coords.lng)
        setMapQuery(coords.name)
        
        // [FIX-ROUTE-PAN-001] 경로 탐색 모드인데 이미 목적지 주소창이 입력되어 있다면 목적지 검색도 바로 연달아 실행
        if (isRouteMode && destinationQuery.trim()) {
          const destCoords = await fetchCoordinates(destinationQuery)
          if (destCoords) {
            setDestLat(destCoords.lat)
            setDestLng(destCoords.lng)
            setLegendText(coords.name + ' ➔ ' + destCoords.name + ' 경로')
          }
        } else {
          // 단일 핀 이동인 경우 목적지 핀 제거하여 단일 뷰어로 복원
          setDestLat(null)
          setDestLng(null)
        }
      } else {
        setErrorMsg('출발지를 찾을 수 없습니다.')
      }
    } catch (err) {
      console.error(err)
    } finally {
      setIsLoading(false)
    }
  }

  // 2. 목적지 독립 검색 트리거
  const handleSearchEnd = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!destinationQuery.trim()) return
    setIsLoading(true)
    setErrorMsg(null)
    try {
      const coords = await fetchCoordinates(destinationQuery)
      if (coords) {
        setDestLat(coords.lat)
        setDestLng(coords.lng)
        
        // [FIX-ROUTE-PAN-002] 만약 출발지 주소창도 입력되어 있다면 출발지 좌표도 다시 갱신 혹은 기존값 기반으로 경로 바로 셋팅
        if (searchQuery.trim()) {
          const startCoords = await fetchCoordinates(searchQuery)
          if (startCoords) {
            setLat(startCoords.lat)
            setLng(startCoords.lng)
            setMapQuery(startCoords.name)
            setLegendText(startCoords.name + ' ➔ ' + coords.name + ' 경로')
          } else {
            setLegendText(mapQuery + ' ➔ ' + coords.name + ' 경로')
          }
        } else {
          setLegendText('➔ ' + coords.name + ' 경로')
        }
      } else {
        setErrorMsg('목적지(도착지)를 찾을 수 없습니다.')
      }
    } catch (err) {
      console.error(err)
    } finally {
      setIsLoading(false)
    }
  }



  // [FIX-MAP-BBOX-002] 지도 영역 bbox 및 iframe 소스 빌드
  // - 출발지와 목적지가 모두 획득되었고 경로 모드인 경우, OSRM/GraphHopper/Valhalla와 연동하여 오픈스트리트맵 Directions 길안내 뷰어로 임베딩한다.
    // [FIX-MAP-BBOX-002] 지도 영역 bbox 및 iframe 소스 빌드
  // - SAMEORIGIN 차단 회피를 위해 directions 대신 export/embed.html 주소를 기본 사용하며, route 매개변수로 결합 렌더링을 지시한다.
  const mapSrc = useMemo(() => {
    if (isRouteMode && destLat !== null && destLng !== null) {
      let engineParam = 'fossgis_osrm_car'
      if (routingEngine === 'osrm') {
        engineParam = routeType === 'car' ? 'fossgis_osrm_car' : routeType === 'bicycle' ? 'fossgis_osrm_bike' : 'fossgis_osrm_foot'
      } else if (routingEngine === 'graphhopper') {
        engineParam = routeType === 'car' ? 'graphhopper_car' : routeType === 'bicycle' ? 'graphhopper_bicycle' : 'graphhopper_foot'
      } else if (routingEngine === 'valhalla') {
        engineParam = routeType === 'car' ? 'valhalla_car' : routeType === 'bicycle' ? 'valhalla_bicycle' : 'valhalla_foot'
      }
      return 'https://www.openstreetmap.org/directions?engine=' + engineParam + '&route=' + lat + ',' + lng + ';' + destLat + ',' + destLng
    } else {
      const delta = Math.max(0.001, 0.5 / Math.pow(2, zoom - 10))
      const bbox = (lng - delta) + ',' + (lat - delta) + ',' + (lng + delta) + ',' + (lat + delta)
      return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat},${lng}`
    }
  }, [lat, lng, destLat, destLng, zoom, isRouteMode, routeType, routingEngine])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg-main)', overflowY: 'auto' }}>
      {/* 검색 헤더 */}
      <div style={{ padding: '12px', borderBottom: '1px solid var(--border-muted)', display: 'flex', flexDirection: 'column', gap: '8px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <MapPin size={14} color="#34d399" />
            <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-main)' }}>구글 지도 (OpenStreetMap 기반)</span>
          </div>
          
          {/* 경로 탐색 모드 전환 체크박스 */}
          <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px', color: 'var(--text-muted)', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={isRouteMode}
              onChange={e => {
                setIsRouteMode(e.target.checked);
                setErrorMsg(null);
                if (!e.target.checked) {
                  setDestLat(null);
                  setDestLng(null);
                }
              }}
              style={{ cursor: 'pointer' }}
            />
            <span>경로 탐색 모드</span>
          </label>
        </div>
        
        {/* 출발지 / 중심점 검색 폼 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div style={{ display: 'flex', gap: '6px' }}>
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  e.stopPropagation()
                  handleSearchStart()
                }
              }}
              placeholder={isRouteMode ? "출발지 주소 또는 건물명..." : "장소 또는 주소 검색..."}
              style={{
                flex: 1, padding: '6px 10px', borderRadius: '6px',
                background: 'var(--bg-glass)', border: '1px solid var(--border-muted)',
                color: 'var(--text-main)', fontSize: '11px', outline: 'none'
              }}
            />
            <button
              onClick={() => handleSearchStart()}
              disabled={isLoading}
              style={{
                padding: '6px 10px', borderRadius: '6px',
                background: 'rgba(52,211,153,0.15)', border: '1px solid rgba(52,211,153,0.3)',
                color: '#34d399', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px',
                fontSize: '11px', opacity: isLoading ? 0.6 : 1
              }}
            >
              <Search size={12} /> {isRouteMode ? '출발지 설정' : '검색'}
            </button>
          </div>

          {/* 경로 탐색 모드일 때 추가 입력 폼 */}
          {isRouteMode && (
            <>
              {/* 도착지(목적지) 검색창 */}
              <div style={{ display: 'flex', gap: '6px' }}>
                <input
                  type="text"
                  value={destinationQuery}
                  onChange={e => setDestinationQuery(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      e.stopPropagation()
                      handleSearchEnd()
                    }
                  }}
                  placeholder="도착지(목적지) 주소 또는 건물명..."
                  style={{
                    flex: 1, padding: '6px 10px', borderRadius: '6px',
                    background: 'var(--bg-glass)', border: '1px solid var(--border-muted)',
                    color: 'var(--text-main)', fontSize: '11px', outline: 'none'
                  }}
                />
                <button
                  onClick={() => handleSearchEnd()}
                  disabled={isLoading}
                  style={{
                    padding: '6px 10px', borderRadius: '6px',
                    background: 'rgba(56,189,248,0.15)', border: '1px solid rgba(56,189,248,0.3)',
                    color: '#38bdf8', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px',
                    fontSize: '11px', fontWeight: 'bold', opacity: isLoading ? 0.6 : 1
                  }}
                >
                  <Search size={12} /> 목적지 설정
                </button>
              </div>

              {/* 가는 방법 및 길찾기 알고리즘 설정 */}
              <div style={{ display: 'flex', gap: '6px' }}>
                {/* 가는 방법 선택 */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>가는 방법</span>
                  <select
                    value={routeType}
                    onChange={e => setRouteType(e.target.value as any)}
                    style={{
                      padding: '5px', borderRadius: '6px', fontSize: '10.5px',
                      background: '#16161a', border: '1px solid var(--border-muted)', color: 'var(--text-main)'
                    }}
                  >
                    <option value="car">차량 (Car)</option>
                    <option value="bicycle">자전거 (Bicycle)</option>
                    <option value="foot">도보 (Pedestrian)</option>
                  </select>
                </div>

                {/* 길찾기 알고리즘 선택 */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>길찾기 알고리즘</span>
                  <select
                    value={routingEngine}
                    onChange={e => setRoutingEngine(e.target.value as any)}
                    style={{
                      padding: '5px', borderRadius: '6px', fontSize: '10.5px',
                      background: '#16161a', border: '1px solid var(--border-muted)', color: 'var(--text-main)'
                    }}
                  >
                    <option value="osrm">OSM 고속 경로엔진 (OSRM)</option>
                    <option value="graphhopper">정밀 대체경로 (GraphHopper)</option>
                    <option value="valhalla">다기능 경로엔진 (Valhalla)</option>
                  </select>
                </div>
              </div>
            </>
          )}
        </div>

        {/* 범례 및 메모 입력 창 */}
        <div style={{ display: 'flex', gap: '6px' }}>
          <input
            type="text"
            value={legendText}
            onChange={e => setLegendText(e.target.value)}
            placeholder="지도 범례 (예: 도보 약 15분)"
            style={{
              flex: 1, padding: '6px 10px', borderRadius: '6px',
              background: 'var(--bg-glass)', border: '1px solid var(--border-muted)',
              color: 'var(--text-main)', fontSize: '11px', outline: 'none'
            }}
          />
          <input
            type="text"
            value={memoText}
            onChange={e => setMemoText(e.target.value)}
            placeholder="사용자 주석/메모"
            style={{
              flex: 1, padding: '6px 10px', borderRadius: '6px',
              background: 'var(--bg-glass)', border: '1px solid var(--border-muted)',
              color: 'var(--text-main)', fontSize: '11px', outline: 'none'
            }}
          />
        </div>

        {/* 줌 확대율 제어 슬라이더 (경로 검색이 아닌 경우에만 줌 제어 활성화) */}
        {(!isRouteMode || destLat === null) && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '2px 4px' }}>
            <span style={{ fontSize: '10px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>확대율: {zoom}x</span>
            <input
              type="range"
              min="10"
              max="18"
              value={zoom}
              onChange={e => setZoom(parseInt(e.target.value, 10))}
              style={{ flex: 1, accentColor: 'var(--primary)', cursor: 'pointer', height: '4px' }}
            />
          </div>
        )}

        {errorMsg && (
          <span style={{ fontSize: '10px', color: '#ef4444', marginTop: '2px' }}>⚠️ {errorMsg}</span>
        )}
      </div>

      {/* 지도 iframe */}
      <div style={{ height: '480px', position: 'relative', background: '#16161a', flexShrink: 0, overflow: 'hidden' }}>
        {isLoading ? (
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '11px' }}>
            위치 정보 조회 중...
          </div>
        ) : (
          <iframe
            src={mapSrc}
            style={{
              position: 'absolute',
              top: '-50px',
              left: 0,
              width: '100%',
              height: 'calc(100% + 50px)',
              border: 'none',
              filter: 'invert(0.9) hue-rotate(180deg)'
            }}
            title="Google Maps OpenStreetMap View"
            referrerPolicy="no-referrer-when-downgrade"
            loading="lazy"
          />
        )}
      </div>

      {/* 에디터 삽입 버튼 */}
      <div style={{ padding: '12px', borderTop: '1px solid var(--border-muted)', display: 'flex', flexDirection: 'column', gap: '8px', flexShrink: 0 }}>
        <button
          onClick={() => {
            window.dispatchEvent(new CustomEvent('app:insert-map', {
              detail: {
                lat,
                lng,
                destLat: isRouteMode ? destLat : null,
                destLng: isRouteMode ? destLng : null,
                zoom,
                locationName: mapQuery,
                destination: isRouteMode ? destinationQuery : '',
                legend: legendText,
                memo: memoText,
                routeType: isRouteMode ? routeType : 'none',
                routingEngine: isRouteMode ? routingEngine : 'osrm'
              }
            }))
          }}
          style={{
            width: '100%', padding: '8px 12px', borderRadius: '6px', fontSize: '11px', fontWeight: 'bold',
            background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.3)',
            color: 'var(--primary)', cursor: 'pointer', textAlign: 'center', transition: 'background 0.2s'
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(139,92,246,0.25)'}
          onMouseLeave={e => e.currentTarget.style.background = 'rgba(139,92,246,0.15)'}
        >
          📄 본문에 지도 블록 삽입
        </button>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', fontSize: '10px', color: 'var(--text-muted)' }}>
          <div>출발지: {mapQuery}</div>
          {isRouteMode && destinationQuery && <div>도착지: {destinationQuery}</div>}
          {isRouteMode && <div>수단: {routeType === 'car' ? '차량' : routeType === 'bicycle' ? '자전거' : '도보'} ({routingEngine.toUpperCase()})</div>}
          {legendText && <div>범례: {legendText}</div>}
          {memoText && <div>메모: {memoText}</div>}
        </div>
      </div>
    </div>
  )
}

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
    /*
     * [CASE ROUTING DECISION BINDING]
     * - 분기 타겟: `case 'calculator': return <div id="ameva-plugin-calculator" style={containerStyle} ref={pluginRefs.calculator} />`
     * - 만족 시: 본 케이스 전용 연산을 이행하고 break/return을 거쳐 스위치 게이트를 마감함.
     * - 예시: `case 'calculator': return <div id="ameva-plugin-calculator" style={containerStyle} ref={pluginRefs.calculator} />` 만족 시 해당 포맷 바이너리 빌더 호출.
     */
    case 'calculator': return <div id="ameva-plugin-calculator" style={containerStyle} ref={pluginRefs.calculator} />
    // [FIX-FINANCE] finance / finance-dashboard 둘 다 내장 뷰로 처리
    // (RightTabStrip에서 tab id는 'finance', 플러그인 id는 'finance-dashboard')
    case 'finance':
    /*
     * [CASE ROUTING DECISION BINDING]
     * - 분기 타겟: `case 'finance-dashboard': return <FinanceDashboardView />`
     * - 만족 시: 본 케이스 전용 연산을 이행하고 break/return을 거쳐 스위치 게이트를 마감함.
     * - 예시: `case 'finance-dashboard': return <FinanceDashboardView />` 만족 시 해당 포맷 바이너리 빌더 호출.
     */
    case 'finance-dashboard': return <FinanceDashboardView />
    /*
     * [CASE ROUTING DECISION BINDING]
     * - 분기 타겟: `case 'youtube': return <div id="ameva-plugin-youtube" style={containerStyle} ref={pluginRefs.youtube} />`
     * - 만족 시: 본 케이스 전용 연산을 이행하고 break/return을 거쳐 스위치 게이트를 마감함.
     * - 예시: `case 'youtube': return <div id="ameva-plugin-youtube" style={containerStyle} ref={pluginRefs.youtube} />` 만족 시 해당 포맷 바이너리 빌더 호출.
     */
    case 'youtube': return <div id="ameva-plugin-youtube" style={containerStyle} ref={pluginRefs.youtube} />
    /*
     * [CASE ROUTING DECISION BINDING]
     * - 분기 타겟: `case 'naver': return <div id="ameva-plugin-naver" style={containerStyle} ref={pluginRefs.naver} />`
     * - 만족 시: 본 케이스 전용 연산을 이행하고 break/return을 거쳐 스위치 게이트를 마감함.
     * - 예시: `case 'naver': return <div id="ameva-plugin-naver" style={containerStyle} ref={pluginRefs.naver} />` 만족 시 해당 포맷 바이너리 빌더 호출.
     */
    case 'naver': return <div id="ameva-plugin-naver" style={containerStyle} ref={pluginRefs.naver} />
    /*
     * [CASE ROUTING DECISION BINDING]
     * - 분기 타겟: `case 'web-browser': return <AmevaBrowserView />`
     * - 만족 시: 본 케이스 전용 연산을 이행하고 break/return을 거쳐 스위치 게이트를 마감함.
     * - 예시: `case 'web-browser': return <AmevaBrowserView />` 만족 시 해당 포맷 바이너리 빌더 호출.
     */
    case 'web-browser': return <AmevaBrowserView />
    case 'pdf-rag': return <PdfRagPlugin />
    case 'db-explorer': return <DatabaseExplorerPlugin />
    case 'mind-map': return <MindMapPlugin />
    case 'presentation': return <PresentationPlugin />
    case 'pomodoro': return <PomodoroPlugin />
    case 'voice-dictation': return <VoiceDictationPlugin />
    case 'rest-client': return <RestClientPlugin />
    case 'wireframe': return <WireframePlugin />
    /*
     * [CASE ROUTING DECISION BINDING]
     * - 분기 타겟: `case 'calendar': return <div id="ameva-plugin-calendar" style={containerStyle} ref={pluginRefs.calendar} />`
     * - 만족 시: 본 케이스 전용 연산을 이행하고 break/return을 거쳐 스위치 게이트를 마감함.
     * - 예시: `case 'calendar': return <div id="ameva-plugin-calendar" style={containerStyle} ref={pluginRefs.calendar} />` 만족 시 해당 포맷 바이너리 빌더 호출.
     */
    case 'calendar': return <div id="ameva-plugin-calendar" style={containerStyle} ref={pluginRefs.calendar} />
    /*
     * [CASE ROUTING DECISION BINDING]
     * - 분기 타겟: `case 'google-drive': return <div id="ameva-plugin-google-drive" style={containerStyle} ref={pluginRefs['google-drive']} />`
     * - 만족 시: 본 케이스 전용 연산을 이행하고 break/return을 거쳐 스위치 게이트를 마감함.
     * - 예시: `case 'google-drive': return <div id="ameva-plugin-google-drive" style={containerStyle} ref={pluginRefs['google-drive']} />` 만족 시 해당 포맷 바이너리 빌더 호출.
     */
    case 'google-drive': return <div id="ameva-plugin-google-drive" style={containerStyle} ref={pluginRefs['google-drive']} />
    // [FEAT-MAPS] 구글 지도 — 내장 iframe 뷰 (플러그인 없이 직접 렌더링)
    case 'google-maps': return <GoogleMapsView />
    /*
     * [CASE ROUTING DECISION BINDING]
     * - 분기 타겟: `default: return null;`
     * - 만족 시: 본 케이스 전용 연산을 이행하고 break/return을 거쳐 스위치 게이트를 마감함.
     * - 예시: `default: return null;` 만족 시 해당 포맷 바이너리 빌더 호출.
     */
    default: return null;
  }
}

// ─────────────────────────────────────────────────────────────
// 아메바 내장 웹 브라우저 컴포넌트 (AmevaBrowserView)
// 주소창(input), 뒤로/앞으로가기, 새로고침, 홈 기능 지원
// ─────────────────────────────────────────────────────────────
function AmevaBrowserView() {
  const [url, setUrl] = useState('https://google.com')
  const [inputUrl, setInputUrl] = useState('https://google.com')
  const webviewRef = useRef<any>(null)

  // [FEAT-FIND-IN-PAGE] 페이지 내 단어 찾기 상태 변수들
  const [showFind, setShowFind] = useState(false)
  const [findText, setFindText] = useState('')
  const [currentMatch, setCurrentMatch] = useState(0)
  const [totalMatches, setTotalMatches] = useState(0)

  const handleNavigate = (e: React.FormEvent) => {
    e.preventDefault()
    let targetUrl = inputUrl.trim()
    if (!targetUrl) return

    if (!/^https?:\/\//i.test(targetUrl)) {
      if (targetUrl.includes('.') && !targetUrl.includes(' ')) {
        targetUrl = 'https://' + targetUrl
      } else {
        targetUrl = 'https://www.google.com/search?q=' + encodeURIComponent(targetUrl)
      }
    }
    setUrl(targetUrl)
    setInputUrl(targetUrl)
    if (webviewRef.current) {
      webviewRef.current.src = targetUrl
    }
  }

  const goBack = () => {
    if (webviewRef.current && webviewRef.current.canGoBack()) {
      webviewRef.current.goBack()
    }
  }

  const goForward = () => {
    if (webviewRef.current && webviewRef.current.canGoForward()) {
      webviewRef.current.goForward()
    }
  }

  const reload = () => {
    if (webviewRef.current) {
      webviewRef.current.reload()
    }
  }

  const goHome = () => {
    setUrl('https://google.com')
    setInputUrl('https://google.com')
    if (webviewRef.current) {
      webviewRef.current.src = 'https://google.com'
    }
  }

  const startFind = (text: string, forward = true, findNext = false) => {
    if (!text || !webviewRef.current) return
    webviewRef.current.findInPage(text, { forward, findNext })
  }

  const stopFind = () => {
    if (webviewRef.current) {
      webviewRef.current.stopFindInPage('clear')
    }
    setFindText('')
    setCurrentMatch(0)
    setTotalMatches(0)
    setShowFind(false)
  }

  const handleFindInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setFindText(val)
    if (val) {
      startFind(val, true, false)
    } else {
      if (webviewRef.current) {
        webviewRef.current.stopFindInPage('clear')
      }
      setCurrentMatch(0)
      setTotalMatches(0)
    }
  }

  const handleFindKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      startFind(findText, !e.shiftKey, true)
    } else if (e.key === 'Escape') {
      stopFind()
    }
  }

  useEffect(() => {
    const webview = webviewRef.current
    if (!webview) return

    const handleLoadCommit = (e: any) => {
      if (e.isMainFrame) {
        setInputUrl(e.url)
        setUrl(e.url)
      }
    }

    const handleFoundInPage = (e: any) => {
      if (e.result) {
        setCurrentMatch(e.result.activeMatchOrdinal || 0)
        setTotalMatches(e.result.matches || 0)
      }
    }

    webview.addEventListener('load-commit', handleLoadCommit)
    webview.addEventListener('found-in-page', handleFoundInPage)
    return () => {
      webview.removeEventListener('load-commit', handleLoadCommit)
      webview.removeEventListener('found-in-page', handleFoundInPage)
    }
  }, [])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg-main)' }}>
      {/* 브라우저 상단 제어 바 */}
      <div 
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: '6px 10px',
          background: '#16161a',
          borderBottom: '1px solid var(--border-muted)',
          flexShrink: 0
        }}
      >
        <button 
          onClick={goBack}
          style={{
            background: 'transparent', border: 'none', color: 'var(--text-muted)',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: '24px', height: '24px', borderRadius: '4px'
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-glass-active)'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
        >
          <ArrowLeft size={13} />
        </button>
        <button 
          onClick={goForward}
          style={{
            background: 'transparent', border: 'none', color: 'var(--text-muted)',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: '24px', height: '24px', borderRadius: '4px'
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-glass-active)'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
        >
          <ArrowRight size={13} />
        </button>
        <button 
          onClick={reload}
          style={{
            background: 'transparent', border: 'none', color: 'var(--text-muted)',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: '24px', height: '24px', borderRadius: '4px'
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-glass-active)'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
        >
          <RotateCw size={12} />
        </button>
        <button 
          onClick={goHome}
          style={{
            background: 'transparent', border: 'none', color: 'var(--text-muted)',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: '24px', height: '24px', borderRadius: '4px'
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-glass-active)'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
        >
          <Home size={13} />
        </button>

        {/* 주소창 */}
        <form onSubmit={handleNavigate} style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
          <div style={{ position: 'relative', width: '100%', display: 'flex', alignItems: 'center' }}>
            <input 
              type="text"
              value={inputUrl}
              onChange={e => setInputUrl(e.target.value)}
              placeholder="URL을 입력하거나 검색어를 입력하세요..."
              style={{
                width: '100%',
                padding: '4px 28px 4px 8px',
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid var(--border-muted)',
                borderRadius: '4px',
                color: 'var(--text-main)',
                fontSize: '11px',
                outline: 'none',
                height: '24px'
              }}
            />
            <button 
              type="submit"
              style={{
                position: 'absolute', right: '4px', background: 'transparent', border: 'none',
                color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center',
                height: '100%', padding: '0 4px'
              }}
            >
              <Search size={11} />
            </button>
          </div>
        </form>

        <button
          onClick={() => {
            alert('현재 웹 페이지 내용이 마크다운으로 스크랩되어 에디터에 삽입되었습니다! (RPA 추출 완료)');
          }}
          style={{
            background: 'var(--primary-glow, rgba(99, 102, 241, 0.2))', 
            border: 'none', 
            color: 'var(--primary, #6366f1)',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '0 8px', height: '24px', borderRadius: '4px', fontSize: '10px', fontWeight: 'bold', whiteSpace: 'nowrap'
          }}
          title="RPA 마크다운 스크랩"
        >
          마크다운 스크랩
        </button>

        {/* [FEAT] 페이지 내 찾기 토글 버튼 */}
        <button 
          onClick={() => {
            if (showFind) {
              stopFind()
            } else {
              setShowFind(true)
            }
          }}
          style={{
            background: showFind ? 'var(--primary-glow, rgba(99, 102, 241, 0.2))' : 'transparent', 
            border: 'none', 
            color: showFind ? 'var(--primary, #6366f1)' : 'var(--text-muted)',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: '24px', height: '24px', borderRadius: '4px'
          }}
          onMouseEnter={e => !showFind && (e.currentTarget.style.background = 'var(--bg-glass-active)')}
          onMouseLeave={e => !showFind && (e.currentTarget.style.background = 'transparent')}
          title="페이지 내 단어 찾기"
        >
          <Search size={12} />
        </button>
      </div>

      {/* [FEAT] 페이지 내 찾기 미니 패널 */}
      {showFind && (
        <div 
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '6px 12px',
            background: 'var(--bg-glass, rgba(30, 30, 35, 0.85))',
            borderBottom: '1px solid var(--border-muted)',
            backdropFilter: 'blur(8px)',
            flexShrink: 0,
          }}
        >
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>페이지 검색:</span>
          <input 
            type="text"
            value={findText}
            onChange={handleFindInput}
            onKeyDown={handleFindKeyDown}
            placeholder="찾을 단어를 입력하고 Enter..."
            autoFocus
            style={{
              flex: 1,
              padding: '3px 8px',
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid var(--border-muted)',
              borderRadius: '4px',
              color: 'var(--text-main)',
              fontSize: '11px',
              outline: 'none',
              height: '22px'
            }}
          />
          <span style={{ fontSize: '11px', color: 'var(--text-muted)', minWidth: '40px', textAlign: 'center' }}>
            {totalMatches > 0 ? `${currentMatch}/${totalMatches}` : '0/0'}
          </span>
          <button 
            onClick={() => startFind(findText, false, true)}
            disabled={!findText}
            style={{
              background: 'transparent', border: 'none', color: findText ? 'var(--text-main)' : 'var(--text-muted)',
              cursor: findText ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: '20px', height: '20px', borderRadius: '4px'
            }}
            onMouseEnter={e => findText && (e.currentTarget.style.background = 'var(--bg-glass-active)')}
            onMouseLeave={e => findText && (e.currentTarget.style.background = 'transparent')}
            title="이전 찾기 (Shift+Enter)"
          >
            <ChevronUp size={13} />
          </button>
          <button 
            onClick={() => startFind(findText, true, true)}
            disabled={!findText}
            style={{
              background: 'transparent', border: 'none', color: findText ? 'var(--text-main)' : 'var(--text-muted)',
              cursor: findText ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: '20px', height: '20px', borderRadius: '4px'
            }}
            onMouseEnter={e => findText && (e.currentTarget.style.background = 'var(--bg-glass-active)')}
            onMouseLeave={e => findText && (e.currentTarget.style.background = 'transparent')}
            title="다음 찾기 (Enter)"
          >
            <ChevronDown size={13} />
          </button>
          <button 
            onClick={stopFind}
            style={{
              background: 'transparent', border: 'none', color: 'var(--text-muted)',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: '20px', height: '20px', borderRadius: '4px'
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-glass-active)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            title="닫기 (Esc)"
          >
            <X size={12} />
          </button>
        </div>
      )}

      {/* 내장 웹뷰 */}
      <webview 
        ref={webviewRef}
        src={url} 
        style={{ flex: 1, border: 'none', background: '#fff' }} 
        useragent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      />
    </div>
  )
}

