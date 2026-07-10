/**
 * @file SidebarTabCollab.tsx
 * @system AMEVA OS Desktop Workstation
 * @location src/renderer/components/sidebar/SidebarTabCollab.tsx
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
import { Server, Share2 } from 'lucide-react'
import type { PeerState } from '../../../shared/types'

import { useAppContext } from '../../contexts/AppContext'

export interface SidebarTabCollabProps {
  sectionLabel: (text: string) => React.ReactNode
}

  /*
   * [FUNCTION CONTRACT]
   * - 함수 명: `SidebarTabCollab`
   * - 역할: 인자 정보를 검수하고 비즈니스 계약 조건에 맞춰 최종 바인딩 결과물/바이너리 버퍼를 반환함.
   * - 예시: `SidebarTabCollab(...)` 호출 시 런타임 비동기/동기 연쇄 반응 유도.
   */
export function SidebarTabCollab({ sectionLabel }: SidebarTabCollabProps) {
  const {
    peers, serverRunning, serverPort, setServerPort, serverHost, setServerHost,
    useLocalServer, setUseLocalServer, toggleLocalServer, collaborationLink, isConnected,
  } = useAppContext()
  
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `onToggleServer`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const onToggleServer = ...` 형태로 안전 캐싱 후 가공 기동.
       */
  const onToggleServer = () => toggleLocalServer(serverPort)
  return (
    <div
      data-focus-region="sidebar-collab"
      style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px', flex: 1, position: 'relative' }}
    >
      {sectionLabel('로컬 협업 서버')}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {/* 포트 설정 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Server size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
          <span style={{ fontSize: '12px', color: 'var(--text-muted)', width: '38px' }}>포트</span>
          <input
            type="number"
            value={serverPort}
            disabled={serverRunning}
            onChange={e => setServerPort(Number(e.target.value))}
            style={{
              width: '80px', background: 'var(--bg-glass)',
              border: '1px solid var(--border-muted)', borderRadius: '6px',
              padding: '4px 8px', color: 'var(--text-main)', fontSize: '12px',
            }}
          />
        </div>

        {/* 호스트 설정 (접속 호스트 주소 입력 — 언제나 노출) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Server size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
          <span style={{ fontSize: '12px', color: 'var(--text-muted)', width: '38px' }}>호스트</span>
          <input
            type="text"
            value={serverHost}
            disabled={serverRunning}
            onChange={e => {
              // 한글 오타 및 불필요 문자 차단 (영문, 숫자, 마침표, 콜론, 슬래시 등만 허용)
              const cleaned = e.target.value.replace(/[^a-zA-Z0-9.:/_-]/g, '')
              setServerHost(cleaned)
            }}
            style={{
              width: '120px', background: 'var(--bg-glass)',
              border: '1px solid var(--border-muted)', borderRadius: '6px',
              padding: '4px 8px', color: 'var(--text-main)', fontSize: '12px',
            }}
          />
        </div>

        {/* 로컬 서버 옵션 */}
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '12px' }}>
          <input
            type="checkbox"
            checked={useLocalServer}
            onChange={e => setUseLocalServer(e.target.checked)}
            style={{ cursor: 'pointer', accentColor: 'var(--primary)' }}
          />
          <span style={{ color: 'var(--text-main)' }}>내 PC를 서버로 만들기</span>
        </label>

        {/* 서버 제어 버튼 */}
        <button
          className={`btn ${serverRunning ? 'btn-secondary' : 'btn-primary'}`}
          onClick={onToggleServer}
          style={{ fontSize: '13px' }}
        >
          <Share2 size={14} /> {serverRunning ? '협업 서버 중지' : '협업 서버 시작'}
        </button>

        {/* 상태 표시 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px' }}>
          <div style={{
            width: '8px', height: '8px', borderRadius: '50%',
            backgroundColor: serverRunning ? 'var(--success)' : 'var(--danger)',
            boxShadow: serverRunning ? '0 0 8px rgba(16,185,129,0.6)' : 'none',
          }} />
          <span>
            서버: {serverRunning ? '실행 중' : '중지됨'}
            {serverRunning && isConnected && <span style={{ color: 'var(--success)', marginLeft: '4px' }}>· 연결됨</span>}
          </span>
        </div>

        {serverRunning && collaborationLink && (
          <div style={{
            padding: '8px 10px', borderRadius: '6px',
            background: 'var(--bg-card)', border: '1px solid var(--border-muted)',
          }}>
            <div style={{ fontSize: '10px', color: 'var(--secondary)', fontWeight: 600, marginBottom: '4px' }}>연결 주소</div>
            <code style={{ fontSize: '11px', color: 'var(--text-main)', wordBreak: 'break-all' }}>{collaborationLink}</code>
          </div>
        )}
      </div>

      {/* 접속 중인 피어 목록 */}
      {sectionLabel(`접속 중인 피어 (${peers.length}명)`)}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {peers.length === 0 ? (
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center', padding: '10px 0', opacity: 0.6 }}>
            현재 연결된 피어가 없습니다.
          </div>
        ) : (
          peers.map((peer) => (
            <div
              key={peer.id}
              style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                padding: '8px 10px', borderRadius: '6px',
                background: 'var(--bg-glass)',
                borderLeft: `3px solid ${peer.color}`,
              }}
            >
              <div style={{
                width: '22px', height: '22px', borderRadius: '50%',
                backgroundColor: peer.color,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '10px', fontWeight: 800, color: '#fff', flexShrink: 0,
              }}>
                {peer.name.charAt(0)}
              </div>
              <span style={{ fontSize: '12px', fontWeight: 600 }}>{peer.name}</span>
              <div style={{
                marginLeft: 'auto', width: '6px', height: '6px', borderRadius: '50%',
                backgroundColor: 'var(--success)', boxShadow: '0 0 6px rgba(16,185,129,0.6)',
              }} />
            </div>
          ))
        )}
      </div>
    </div>
  )
}

