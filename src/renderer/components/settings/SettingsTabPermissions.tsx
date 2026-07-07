import type { AppSettings } from '../SettingsModal'

export interface SettingsTabPermissionsProps {
  activeTab: string
  settings: AppSettings
  onUpdateSettings: (newSettings: Partial<AppSettings>) => void
}

export function SettingsTabPermissions({
  activeTab,
  settings,
  onUpdateSettings,
}: SettingsTabPermissionsProps) {
  if (activeTab !== 'Permissions') return null

  return (
    <>
      <h3 style={{ fontSize: '13px', fontWeight: 700, margin: '0 0 6px' }}>Security & Permissions</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <label style={{ fontSize: '10px', color: 'var(--text-muted)' }}>보안 설정 모드 (Security Preset)</label>
          <select
            value={settings.securityPreset || 'turbo'}
            onChange={e => onUpdateSettings({ securityPreset: e.target.value as AppSettings['securityPreset'] })}
            style={{
              width: '100%', background: 'var(--bg-glass)',
              border: '1px solid var(--border-muted)', borderRadius: '6px',
              padding: '5px 8px', color: 'var(--text-main)', fontSize: '11px',
            }}
          >
            <option value="paranoiac">Paranoid Maximum (가장 안전 / 자동실행 금지)</option>
            <option value="turbo">Turbo Mode (기본 성능 중심)</option>
            <option value="restricted">Restricted Sandbox (격리 샌드박스 강제)</option>
          </select>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <label style={{ fontSize: '10px', color: 'var(--text-muted)' }}>아티팩트 자동 실행 허용 여부</label>
          <select
            value={settings.artifactReviewPolicy || 'ask'}
            onChange={e => onUpdateSettings({ artifactReviewPolicy: e.target.value as AppSettings['artifactReviewPolicy'] })}
            style={{
              width: '100%', background: 'var(--bg-glass)',
              border: '1px solid var(--border-muted)', borderRadius: '6px',
              padding: '5px 8px', color: 'var(--text-main)', fontSize: '11px',
            }}
          >
            <option value="always">항상 검토 없이 바로 실행 (Always Allow)</option>
            <option value="never">자동 실행 비활성화 (Always Block)</option>
            <option value="ask">실행 시 확인 창 띄우기 (Always Ask)</option>
          </select>
        </div>
      </div>
    </>
  )
}
