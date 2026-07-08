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
      <h3 style={{ fontSize: '13px', fontWeight: 700, margin: '0 0 6px' }}>Agent security mode</h3>
      <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '0 0 16px' }}>Select one of the three options. Agent settings and permissions can be further customized below.</p>
      
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '24px' }}>
        {[
          { id: 'turbo', title: 'Turbo Mode', desc: '기본 성능 중심. 빠른 실행을 우선합니다.' },
          { id: 'restricted', title: 'Restricted Sandbox', desc: '에이전트를 안전한 샌드박스 내에서만 실행합니다.' },
          { id: 'paranoiac', title: 'Paranoid Maximum', desc: '가장 강력한 보안. 자동 실행을 완전히 금지합니다.' }
        ].map(item => {
          const isActive = (settings.securityPreset || 'turbo') === item.id;
          return (
            <div
              key={item.id}
              onClick={() => onUpdateSettings({ securityPreset: item.id as AppSettings['securityPreset'] })}
              style={{
                background: isActive ? 'var(--bg-glass-active)' : 'transparent',
                border: isActive ? '1px solid var(--primary)' : '1px solid var(--border-muted)',
                borderRadius: '8px',
                padding: '16px',
                cursor: 'pointer',
                transition: 'all 0.2s',
                opacity: isActive ? 1 : 0.6
              }}
            >
              <div style={{ fontSize: '13px', color: isActive ? 'var(--primary)' : 'var(--text-main)', marginBottom: '8px' }}>{item.title}</div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: '1.4' }}>{item.desc}</div>
            </div>
          );
        })}
      </div>

      <h3 style={{ fontSize: '13px', fontWeight: 700, margin: '0 0 6px' }}>Artifact Auto-execution</h3>
      <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '0 0 16px' }}>아티팩트 자동 실행 허용 여부를 설정합니다.</p>
      
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
        {[
          { id: 'always', title: 'Always Allow', desc: '항상 검토 없이 바로 실행합니다.' },
          { id: 'ask', title: 'Always Ask', desc: '실행 시 항상 확인 창을 띄웁니다.' },
          { id: 'never', title: 'Always Block', desc: '자동 실행을 완전히 비활성화합니다.' }
        ].map(item => {
          const isActive = (settings.artifactReviewPolicy || 'ask') === item.id;
          return (
            <div
              key={item.id}
              onClick={() => onUpdateSettings({ artifactReviewPolicy: item.id as AppSettings['artifactReviewPolicy'] })}
              style={{
                background: isActive ? 'var(--bg-glass-active)' : 'transparent',
                border: isActive ? '1px solid var(--primary)' : '1px solid var(--border-muted)',
                borderRadius: '8px',
                padding: '16px',
                cursor: 'pointer',
                transition: 'all 0.2s',
                opacity: isActive ? 1 : 0.6
              }}
            >
              <div style={{ fontSize: '13px', color: isActive ? 'var(--primary)' : 'var(--text-main)', marginBottom: '8px' }}>{item.title}</div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: '1.4' }}>{item.desc}</div>
            </div>
          );
        })}
      </div>
    </>
  )
}
