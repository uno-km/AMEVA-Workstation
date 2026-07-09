/**
 * @file CollabIndicator.tsx
 * @system AMEVA OS Desktop Workstation
 * @location src/renderer/components/statusbar/CollabIndicator.tsx
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

import React from 'react'
import type { PeerState } from '../../../shared/types'

interface CollabIndicatorProps {
  peers: PeerState[]
}

export function CollabIndicator({ peers }: CollabIndicatorProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
      <div
        style={{
          width: '6px',
          height: '6px',
          borderRadius: '50%',
          backgroundColor: 'var(--success)',
          animation: 'pulse 1.5s infinite',
        }}
      />
      <span style={{ color: 'var(--success)' }}>
        협업 ({peers.length + 1}명)
      </span>
      {/* 아바타 목록 시각화 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '3px', marginLeft: '2px' }}>
        {peers.map((peer) => (
          <div
            key={peer.id}
            style={{
              width: '16px',
              height: '16px',
              borderRadius: '50%',
              backgroundColor: peer.color,
              color: '#ffffff',
              fontSize: '8px',
              fontWeight: 800,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              cursor: 'help',
            }}
            title={`${peer.name} (접속 중)`}
          >
            {peer.name.charAt(0)}
          </div>
        ))}
      </div>
    </div>
  )
}
