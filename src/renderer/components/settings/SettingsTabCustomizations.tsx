import React from 'react'
import type { AppSettings } from '../SettingsModal'

export interface SettingsTabCustomizationsProps {
  activeTab: string
  settings: AppSettings
}

export function SettingsTabCustomizations({
  activeTab,
  settings,
}: SettingsTabCustomizationsProps) {
  if (activeTab !== 'Customizations') return null

  return (
    <>
      <h3 style={{ fontSize: '13px', fontWeight: 700, margin: '0 0 6px' }}>Customizations & Extensions</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <span style={{ fontSize: '10px', color: 'var(--text-muted)', lineHeight: 1.4 }}>
          에디터의 런타임 기능 확장을 로드하거나 마켓플레이스에서 추가한 외부 플러그인을 온/오프 토글합니다.
        </span>
        
        {[
          { id: 'outline', name: 'Outline Document Navigator', desc: 'H1~H3 문맥 개요 네비게이션 활성화' },
          { id: 'minimap', name: 'Minimap Visual Bar', desc: '에디터 우측 전체 문서 그래픽 미니맵 로딩' },
          { id: 'canvas', name: 'Free Drawing Canvas', desc: '자유 드로잉 및 다이어그램 스케치 삽입 플러그인' }
        ].map(p => {
          const isInstalled = (settings.installedPlugins || []).includes(p.id)
          return (
            <div key={p.id} style={{
              padding: '8px 12px', borderRadius: '6px',
              background: 'var(--bg-glass)', border: '1px solid var(--border-muted)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <div>
                <div style={{ fontSize: '11px', fontWeight: 700 }}>{p.name}</div>
                <div style={{ fontSize: '9px', color: 'var(--text-muted)', marginTop: '2px' }}>{p.desc}</div>
              </div>
              <span style={{
                fontSize: '9px', fontWeight: 800, padding: '2px 6px', borderRadius: '4px',
                background: isInstalled ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.05)',
                color: isInstalled ? '#10b981' : 'var(--text-muted)',
                border: isInstalled ? '1px solid rgba(16,185,129,0.3)' : '1px solid var(--border-muted)',
              }}>
                {isInstalled ? 'Loaded' : 'Inactive'}
              </span>
            </div>
          )
        })}
      </div>
    </>
  )
}
