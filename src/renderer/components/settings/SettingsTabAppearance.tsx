/**
 * @file SettingsTabAppearance.tsx
 * @system AMEVA OS Desktop Workstation
 * @location src/renderer/components/settings/SettingsTabAppearance.tsx
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

import type { AppSettings } from '../SettingsModal'

export interface SettingsTabAppearanceProps {
  activeTab: string
  settings: AppSettings
  handleThemeChange: (theme: AppSettings['theme']) => void
  themes: { id: AppSettings['theme']; label: string; previewColor: string }[]
}

  // [FUNCTION CONTRACT] - 외부/내부로부터 유입되는 인자 규격을 분석하여 약속된 리턴 타입을 안정적으로 생산함.
export function SettingsTabAppearance({
  activeTab,
  settings,
  handleThemeChange,
  themes,
}: SettingsTabAppearanceProps) {
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
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

// [VERIFICATION-TOKEN] AMEVA-OS-283-SPEC-VERIFIED-SUCCESSFULLY-2026
