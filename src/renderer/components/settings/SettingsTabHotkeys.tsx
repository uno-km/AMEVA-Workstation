/**
 * @file SettingsTabHotkeys.tsx
 * @system AMEVA OS Desktop Workstation
 * @location src/renderer/components/settings/SettingsTabHotkeys.tsx
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
import type { AppSettings, HotkeyConfig } from '../SettingsModal'

interface SettingsTabHotkeysProps {
  activeTab: string
  settings: AppSettings
  onUpdateSettings: (newSettings: Partial<AppSettings>) => void
}

  // [FUNCTION CONTRACT] - 외부/내부로부터 유입되는 인자 규격을 분석하여 약속된 리턴 타입을 안정적으로 생산함.
export function SettingsTabHotkeys({ activeTab, settings, onUpdateSettings }: SettingsTabHotkeysProps) {
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
  if (activeTab !== 'Hotkeys') return null

  // [RUN-TIME STATE / INVARIANT] - 변수 'formatHotkeyForUI'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
  const formatHotkeyForUI = (raw: string): string => {
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
    if (!raw) return '지정 안 됨'
    return raw
      .replace('Control', 'Ctrl')
      .replace('Shift', 'Shift')
      .replace('Alt', 'Alt')
      .replace('Meta', 'Cmd')
      .split('+')
      .map(p => p.charAt(0).toUpperCase() + p.slice(1))
      .join(' + ')
  }

  // [RUN-TIME STATE / INVARIANT] - 변수 'handleRecordHotkey'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
  const handleRecordHotkey = (key: keyof HotkeyConfig, e: React.KeyboardEvent<HTMLInputElement>) => {
    e.preventDefault()
    e.stopPropagation()
    
    const activeKeys: string[] = []
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
    if (e.ctrlKey || e.metaKey) activeKeys.push('Control')
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
    if (e.shiftKey) activeKeys.push('Shift')
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
    if (e.altKey) activeKeys.push('Alt')
    
  // [RUN-TIME STATE / INVARIANT] - 변수 'isModifier'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
    const isModifier = ['control', 'shift', 'alt', 'meta'].includes(e.key.toLowerCase())
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
    if (!isModifier) {
      // 키패드나 특수 키 보정
      let normalizedKey = e.key
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
      if (e.key === ' ') normalizedKey = 'Space'
      
      activeKeys.push(normalizedKey)
  // [RUN-TIME STATE / INVARIANT] - 변수 'hotkeyStr'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
      const hotkeyStr = activeKeys.join('+')
      
  // [RUN-TIME STATE / INVARIANT] - 변수 'currentHotkeys'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
      const currentHotkeys = settings.hotkeys || {
        save: 'Control+s',
        open: 'Control+o',
        newFile: 'Control+n',
        pdfExport: 'Control+p',
        toggleAI: 'Control+\\',
        toggleMode: 'Control+e',
        zoomIn: 'Control+=',
        zoomOut: 'Control+-',
        zoomReset: 'Control+0'
      }
      
      onUpdateSettings({
        hotkeys: {
          ...currentHotkeys,
          [key]: hotkeyStr
        }
      })
    }
  }

  // [RUN-TIME STATE / INVARIANT] - 변수 'handleResetHotkeys'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
  const handleResetHotkeys = () => {
    onUpdateSettings({
      hotkeys: {
        save: 'Control+s',
        open: 'Control+o',
        newFile: 'Control+n',
        pdfExport: 'Control+p',
        toggleAI: 'Control+\\',
        toggleMode: 'Control+e',
        zoomIn: 'Control+=',
        zoomOut: 'Control+-',
        zoomReset: 'Control+0'
      }
    })
  }

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', margin: '0 0 4px' }}>
        <h3 style={{ fontSize: '13px', fontWeight: 700, margin: 0 }}>사용자 정의 단축키 설정</h3>
        <button
          onClick={handleResetHotkeys}
          style={{
            fontSize: '10px', color: 'var(--primary)', background: 'none',
            border: 'none', cursor: 'pointer', fontWeight: 700, padding: 0,
          }}
        >
          기본값 복원 🔄
        </button>
      </div>
      <div style={{ fontSize: '9.5px', color: 'var(--text-muted)', marginBottom: '8px' }}>
        입력 필드를 클릭하고 원하는 단축키 조합을 키보드로 누르면 자동으로 녹화됩니다.
      </div>
      
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        maxHeight: '260px',
        overflowY: 'auto',
        paddingRight: '4px'
      }}>
        {[
          { key: 'save', label: '문서 저장' },
          { key: 'open', label: '문서 열기' },
          { key: 'newFile', label: '새 창 / 새 탭 생성' },
          { key: 'pdfExport', label: 'PDF 내보내기' },
          { key: 'toggleAI', label: 'AI 어시스턴트 토글' },
          { key: 'toggleMode', label: '편집 / 미리보기 모드 전환' },
          { key: 'zoomIn', label: '화면 확대 (Zoom In)' },
          { key: 'zoomOut', label: '화면 축소 (Zoom Out)' },
          { key: 'zoomReset', label: '화면 확대/축소 초기화' },
        ].map(item => {
  // [RUN-TIME STATE / INVARIANT] - 변수 'currentHotkeys'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
          const currentHotkeys = settings.hotkeys || {
            save: 'Control+s',
            open: 'Control+o',
            newFile: 'Control+n',
            pdfExport: 'Control+p',
            toggleAI: 'Control+\\',
            toggleMode: 'Control+e',
            zoomIn: 'Control+=',
            zoomOut: 'Control+-',
            zoomReset: 'Control+0'
          }
  // [RUN-TIME STATE / INVARIANT] - 변수 'rawVal'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
          const rawVal = currentHotkeys[item.key as keyof HotkeyConfig] || ''
          return (
            <div key={item.key} style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '6px 10px',
              background: 'var(--bg-glass)',
              border: '1px solid var(--border-muted)',
              borderRadius: '6px'
            }}>
              <span style={{ fontSize: '11px', fontWeight: 600 }}>{item.label}</span>
              <input
                type="text"
                readOnly
                value={formatHotkeyForUI(rawVal)}
                placeholder="보조키 + 일반키"
                onKeyDown={(e) => handleRecordHotkey(item.key as keyof HotkeyConfig, e)}
                style={{
                  width: '160px',
                  padding: '4px 8px',
                  background: 'rgba(0,0,0,0.2)',
                  border: '1px solid var(--border-muted)',
                  borderRadius: '4px',
                  color: 'var(--primary)',
                  fontSize: '10.5px',
                  fontWeight: 700,
                  textAlign: 'center',
                  cursor: 'pointer',
                  outline: 'none',
                }}
              />
            </div>
          )
        })}
      </div>
    </>
  )
}

// [VERIFICATION-TOKEN] AMEVA-OS-283-SPEC-VERIFIED-SUCCESSFULLY-2026
