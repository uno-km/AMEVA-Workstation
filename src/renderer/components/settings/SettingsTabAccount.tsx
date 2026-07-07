import React from 'react'

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
