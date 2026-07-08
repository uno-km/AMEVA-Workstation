import { createReactBlockSpec } from '@blocknote/react'
import { MapPin, Lock } from 'lucide-react'

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

export const MapBlock = MapBlockSpec()
