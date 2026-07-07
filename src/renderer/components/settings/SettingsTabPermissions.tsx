
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
          <label style={{ fontSize: '10px', color: 'var(--text-muted)' }}>ë³´ì•ˆ ?¤ì • ëª¨ë“œ (Security Preset)</label>
          <select
            value={settings.securityPreset || 'turbo'}
            onChange={e => onUpdateSettings({ securityPreset: e.target.value as AppSettings['securityPreset'] })}
            style={{
              width: '100%', background: 'var(--bg-glass)',
              border: '1px solid var(--border-muted)', borderRadius: '6px',
              padding: '5px 8px', color: 'var(--text-main)', fontSize: '11px',
            }}
          >
            <option value="paranoiac">Paranoid Maximum (ê°€???ˆì „ / ?ë™?¤í–‰ ê¸ˆì?)</option>
            <option value="turbo">Turbo Mode (ê¸°ë³¸ ?±ëŠ¥ ì¤‘ì‹¬)</option>
            <option value="restricted">Restricted Sandbox (ê²©ë¦¬ ?Œë“œë°•ìŠ¤ ê°•ì œ)</option>
          </select>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <label style={{ fontSize: '10px', color: 'var(--text-muted)' }}>?„í‹°?©íŠ¸ ?ë™ ?¤í–‰ ?ˆìš© ?¬ë?</label>
          <select
            value={settings.artifactReviewPolicy || 'ask'}
            onChange={e => onUpdateSettings({ artifactReviewPolicy: e.target.value as AppSettings['artifactReviewPolicy'] })}
            style={{
              width: '100%', background: 'var(--bg-glass)',
              border: '1px solid var(--border-muted)', borderRadius: '6px',
              padding: '5px 8px', color: 'var(--text-main)', fontSize: '11px',
            }}
          >
            <option value="always">??ƒ ê²€???†ì´ ë°”ë¡œ ?¤í–‰ (Always Allow)</option>
            <option value="never">?ë™ ?¤í–‰ ë¹„í™œ?±í™” (Always Block)</option>
            <option value="ask">?¤í–‰ ???•ì¸ ì°??„ìš°ê¸?(Always Ask)</option>
          </select>
        </div>
      </div>
    </>
  )
}
