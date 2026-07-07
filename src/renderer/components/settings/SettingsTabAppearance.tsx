import React from 'react'
import type { AppSettings } from '../SettingsModal'

export interface SettingsTabAppearanceProps {
  activeTab: string
  settings: AppSettings
  handleThemeChange: (theme: AppSettings['theme']) => void
  themes: { id: AppSettings['theme']; label: string; previewColor: string }[]
}

export function SettingsTabAppearance({
  activeTab,
  settings,
  handleThemeChange,
  themes,
}: SettingsTabAppearanceProps) {
  if (activeTab !== 'Appearance') return null

  return (
    <>
      <h3 style={{ fontSize: '13px', fontWeight: 700, margin: '0 0 6px' }}>Appearance</h3>
      <div>
        <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '8px' }}>
          시스템 테마 스위처
        </span>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          {themes.map((t) => (
            <button
              key={t.id}
              onClick={() => handleThemeChange(t.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                padding: '10px 12px', borderRadius: '6px',
                border: settings.theme === t.id ? '1px solid var(--primary)' : '1px solid var(--border-muted)',
                background: settings.theme === t.id ? 'var(--bg-glass-active)' : 'rgba(255,255,255,0.01)',
                color: settings.theme === t.id ? 'var(--primary)' : 'var(--text-main)',
                fontSize: '11.5px', fontWeight: 600, cursor: 'pointer', textAlign: 'left',
              }}
            >
              <div style={{
                width: '10px', height: '10px', borderRadius: '50%',
                backgroundColor: t.previewColor, border: '1px solid var(--text-dark)',
              }} />
              {t.label}
            </button>
          ))}
        </div>
      </div>
    </>
  )
}
