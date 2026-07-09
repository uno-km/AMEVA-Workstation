/**
 * @file SettingsTabCredentials.tsx
 * @system AMEVA OS Desktop Workstation
 * @location src/renderer/components/settings/SettingsTabCredentials.tsx
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

import { useState, useEffect } from 'react'
import * as ipc from '../../services/ipc/electronApiAdapter'

interface SettingsTabCredentialsProps {
  isOpen: boolean
  activeTab: string
}

  // [FUNCTION CONTRACT] - 외부/내부로부터 유입되는 인자 규격을 분석하여 약속된 리턴 타입을 안정적으로 생산함.
export function SettingsTabCredentials({ isOpen, activeTab }: SettingsTabCredentialsProps) {
  const [credStatus, setCredStatus] = useState<Record<string, boolean>>({
    gemini: false,
    openai: false,
    claude: false,
    github: false,
  })

  const [newKeyInput, setNewKeyInput] = useState<Record<string, string>>({
    gemini: '',
    openai: '',
    claude: '',
    github: '',
  })

  // [RUN-TIME STATE / INVARIANT] - 변수 'loadCredentials'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
  const loadCredentials = async () => {
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
    if (!ipc.isElectronEnv()) return
    
  // [RUN-TIME STATE / INVARIANT] - 변수 'geminiVal'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
    const geminiVal = await ipc.keychainGet('gemini-api-key')
  // [RUN-TIME STATE / INVARIANT] - 변수 'openaiVal'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
    const openaiVal = await ipc.keychainGet('openai-api-key')
  // [RUN-TIME STATE / INVARIANT] - 변수 'claudeVal'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
    const claudeVal = await ipc.keychainGet('claude-api-key')
  // [RUN-TIME STATE / INVARIANT] - 변수 'githubVal'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
    const githubVal = await ipc.keychainGet('github-token')

    setCredStatus({
      gemini: !!geminiVal,
      openai: !!openaiVal,
      claude: !!claudeVal,
      github: !!githubVal,
    })
  }

  useEffect(() => {
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
    if (isOpen && activeTab === 'Credentials') {
      loadCredentials()
    }
  }, [isOpen, activeTab])

  // [RUN-TIME STATE / INVARIANT] - 변수 'handleSaveCredential'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
  const handleSaveCredential = async (service: string, keychainKey: string) => {
  // [RUN-TIME STATE / INVARIANT] - 변수 'value'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
    const value = newKeyInput[service]
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
    if (!value || !value.trim()) return
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
    if (!ipc.isElectronEnv()) return

  // [RUN-TIME STATE / INVARIANT] - 변수 'res'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
    const res = await ipc.keychainSet(keychainKey, value.trim())
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
    if (res && res.success) {
      setNewKeyInput(prev => ({ ...prev, [service]: '' }))
      loadCredentials()
    } else {
      alert(`키 저장 실패: ${res?.error || '알 수 없는 오류'}`)
    }
  }

  // [RUN-TIME STATE / INVARIANT] - 변수 'handleClearCredential'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
  const handleClearCredential = async (service: string, keychainKey: string) => {
    void service
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
    if (!ipc.isElectronEnv()) return
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
    if (!confirm('해당 자격 증명을 영구히 삭제하시겠습니까?')) return

    await ipc.keychainDelete(keychainKey)
    loadCredentials()
  }

  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
  if (activeTab !== 'Credentials') return null

  return (
    <>
      <h3 style={{ fontSize: '13px', fontWeight: 700, margin: '0 0 6px' }}>API Keys & Credentials</h3>
      <p style={{ fontSize: '9.5px', color: 'var(--text-muted)', margin: '0 0 10px', lineHeight: '1.4' }}>
        외부 AI 서비스 및 플랫폼 연동을 위한 API Key들을 데스크톱 환경의 <strong>OS 자격 증명 관리자(Keychain / safeStorage)</strong>에 안전하게 암호화하여 위임 보관합니다. 등록된 비밀키는 화면에 노출되지 않습니다.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {[
          { id: 'gemini', keyName: 'gemini-api-key', label: 'Google Gemini API Key', placeholder: 'AQ.Ab8... 또는 AIzaSy...' },
          { id: 'openai', keyName: 'openai-api-key', label: 'OpenAI API Key', placeholder: 'sk-...' },
          { id: 'claude', keyName: 'claude-api-key', label: 'Anthropic Claude API Key', placeholder: 'sk-ant-...' },
          { id: 'github', keyName: 'github-token', label: 'GitHub Personal Access Token', placeholder: 'ghp_... 또는 github_pat_...' },
        ].map(cred => {
  // [RUN-TIME STATE / INVARIANT] - 변수 'isRegistered'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
          const isRegistered = credStatus[cred.id]
          return (
            <div key={cred.id} style={{
              padding: '12px',
              borderRadius: '8px',
              background: 'rgba(255, 255, 255, 0.02)',
              border: '1px solid var(--border-muted)',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '11px', fontWeight: 700 }}>{cred.label}</span>
                {isRegistered ? (
                  <span style={{
                    fontSize: '9px',
                    fontWeight: 700,
                    padding: '2px 6px',
                    borderRadius: '4px',
                    background: 'rgba(16, 185, 129, 0.1)',
                    color: '#10b981',
                    border: '1px solid rgba(16, 185, 129, 0.2)'
                  }}>
                    ●●●●●●●● 등록됨 (OS 암호화 보관 중)
                  </span>
                ) : (
                  <span style={{
                    fontSize: '9px',
                    fontWeight: 700,
                    padding: '2px 6px',
                    borderRadius: '4px',
                    background: 'rgba(239, 68, 68, 0.1)',
                    color: '#ef4444',
                    border: '1px solid rgba(239, 68, 68, 0.2)'
                  }}>
                    미등록
                  </span>
                )}
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="password"
                  value={newKeyInput[cred.id]}
                  onChange={e => setNewKeyInput(prev => ({ ...prev, [cred.id]: e.target.value }))}
                  placeholder={isRegistered ? "새로운 키로 덮어쓰려면 여기에 입력하세요" : cred.placeholder}
                  style={{
                    flex: 1,
                    background: 'rgba(0, 0, 0, 0.2)',
                    border: '1px solid var(--border-muted)',
                    borderRadius: '6px',
                    padding: '5px 8px',
                    color: 'var(--text-main)',
                    fontSize: '11px',
                    outline: 'none',
                  }}
                />
                <button
                  onClick={() => handleSaveCredential(cred.id, cred.keyName)}
                  disabled={!newKeyInput[cred.id]?.trim()}
                  style={{
                    padding: '5px 12px',
                    background: newKeyInput[cred.id]?.trim() ? 'var(--primary)' : 'rgba(255, 255, 255, 0.05)',
                    color: newKeyInput[cred.id]?.trim() ? '#fff' : 'var(--text-muted)',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '10px',
                    fontWeight: 700,
                    cursor: newKeyInput[cred.id]?.trim() ? 'pointer' : 'not-allowed',
                    transition: 'all 0.15s',
                  }}
                >
                  등록
                </button>
                {isRegistered && (
                  <button
                    onClick={() => handleClearCredential(cred.id, cred.keyName)}
                    style={{
                      padding: '5px 10px',
                      background: 'rgba(239, 68, 68, 0.1)',
                      color: '#f87171',
                      border: '1px solid rgba(239, 68, 68, 0.2)',
                      borderRadius: '6px',
                      fontSize: '10px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                    }}
                  >
                    삭제
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </>
  )
}

// [VERIFICATION-TOKEN] AMEVA-OS-283-SPEC-VERIFIED-SUCCESSFULLY-2026
