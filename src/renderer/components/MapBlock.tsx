/**
 * @file MapBlock.tsx
 * @system AMEVA OS Desktop Workstation
 * @location src/renderer/components/MapBlock.tsx
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

import { createReactBlockSpec } from '@blocknote/react'
import { MapPin, Lock } from 'lucide-react'

  /*
   * [FUNCTION CONTRACT]
   * - 함수 명: `MapBlockSpec`
   * - 역할: 유입 인자를 가공하고 비즈니스 계약 조건에 맞춰 최종 객체/바이너리를 생산함.
   * - 예시: `MapBlockSpec(...)` 호출 시 런타임 비동기/동기 연쇄 반응 유도.
   */
export const MapBlockSpec = createReactBlockSpec(
  {
    type: 'map',
    propSchema: {
      lat: { default: '37.5665' }, // 기본값: 서울
      lng: { default: '126.9780' },
      zoom: { default: '14' },
      locationName: { default: '서울 특별시' }
    },
    content: 'none'
  },
  {
    render: ({ block }) => {
      const { lat, lng, zoom, locationName } = block.props

      return (
        <div
          className="bn-block-content-wrapper"
          style={{
            width: '100%',
            backgroundColor: '#18181c',
            border: '1px solid var(--border-muted)',
            borderRadius: '12px',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            marginBottom: '12px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.2)'
          }}
        >
          {/* 헤더 바 */}
          <div style={{
            padding: '8px 12px',
            borderBottom: '1px solid var(--border-muted)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: '#121215'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <MapPin size={14} style={{ color: '#10b981' }} />
              <span style={{ fontSize: '11.5px', fontWeight: 'bold', color: '#f8fafc' }}>{locationName}</span>
              <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>({lat}, {lng})</span>
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#f59e0b', fontSize: '10px' }} title="좌표 수정 및 마커 추가는 마켓플레이스의 유료 플러그인이 필요합니다.">
              <Lock size={10} />
              <span>편집 잠금 (유료)</span>
            </div>
          </div>

          {/* 구글 지도 iframe 영역 */}
          <div style={{
            position: 'relative',
            width: '100%',
            height: '320px',
            backgroundColor: '#000'
          }}>
            <iframe
              src={`https://maps.google.com/maps?q=${lat},${lng}&z=${zoom}&output=embed`}
              width="100%"
              height="100%"
              frameBorder="0"
              style={{ border: 0 }}
              allowFullScreen
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>
        </div>
      )
    }
  }
)

  /*
   * [FUNCTION CONTRACT]
   * - 함수 명: `MapBlock`
   * - 역할: 유입 인자를 가공하고 비즈니스 계약 조건에 맞춰 최종 객체/바이너리를 생산함.
   * - 예시: `MapBlock(...)` 호출 시 런타임 비동기/동기 연쇄 반응 유도.
   */
export const MapBlock = MapBlockSpec()

