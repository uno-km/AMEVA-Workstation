/**
 * @file SettingsTabAccount.tsx
 * @system AMEVA OS Desktop Workstation
 * @location src/renderer/components/settings/SettingsTabAccount.tsx
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

export interface SettingsTabAccountProps {
  activeTab: string
  tempName: string
  setTempName: (name: string) => void
  tempColor: string
  setTempColor: (color: string) => void
  handleSaveUser: () => void
}

export function SettingsTabAccount({
  activeTab,
  tempName,
  setTempName,
  tempColor,
  setTempColor,
  handleSaveUser,
}: SettingsTabAccountProps) {
  if (activeTab !== 'Account') return null

  return (
    <>
      <h3 style={{ fontSize: '13px', fontWeight: 700, margin: '0 0 6px' }}>Account Settings</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <label style={{ fontSize: '10px', color: 'var(--text-muted)' }}>사용자 닉네임</label>
          <input
            type="text"
            value={tempName}
            onChange={e => setTempName(e.target.value)}
            style={{
              padding: '6px 10px', background: 'var(--bg-glass)',
              border: '1px solid var(--border-muted)', borderRadius: '6px',
              color: 'var(--text-main)', fontSize: '11px', outline: 'none',
            }}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label style={{ fontSize: '10px', color: 'var(--text-muted)' }}>나의 식별 배지 테마 컬러</label>
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            <input
              type="color"
              value={tempColor}
              onChange={e => setTempColor(e.target.value)}
              style={{
                width: '32px', height: '24px', border: 'none',
                background: 'transparent', cursor: 'pointer',
              }}
            />
            <span style={{ fontSize: '11px', fontFamily: 'monospace' }}>{tempColor}</span>
          </div>
        </div>

        <button
          onClick={handleSaveUser}
          style={{
            alignSelf: 'flex-start', padding: '6px 14px', borderRadius: '6px',
            background: 'var(--primary)', border: 'none', color: '#fff',
            fontSize: '11px', fontWeight: 700, cursor: 'pointer', marginTop: '8px',
          }}
        >
          프로필 저장 적용
        </button>
      </div>
    </>
  )
}
