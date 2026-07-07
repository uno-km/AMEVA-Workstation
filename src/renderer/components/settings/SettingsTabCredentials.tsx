import React, { useState, useEffect } from 'react'
import * as ipc from '../../services/ipc/electronApiAdapter'

interface SettingsTabCredentialsProps {
  isOpen: boolean
  activeTab: string
}

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

  const loadCredentials = async () => {
    if (!ipc.isElectronEnv()) return
    
    const geminiVal = await ipc.keychainGet('gemini-api-key')
    const openaiVal = await ipc.keychainGet('openai-api-key')
    const claudeVal = await ipc.keychainGet('claude-api-key')
    const githubVal = await ipc.keychainGet('github-token')

    setCredStatus({
      gemini: !!geminiVal,
      openai: !!openaiVal,
      claude: !!claudeVal,
      github: !!githubVal,
    })
  }

  useEffect(() => {
    if (isOpen && activeTab === 'Credentials') {
      loadCredentials()
    }
  }, [isOpen, activeTab])

  const handleSaveCredential = async (service: string, keychainKey: string) => {
    const value = newKeyInput[service]
    if (!value || !value.trim()) return
    if (!ipc.isElectronEnv()) return

    const res = await ipc.keychainSet(keychainKey, value.trim())
    if (res && res.success) {
      setNewKeyInput(prev => ({ ...prev, [service]: '' }))
      loadCredentials()
    } else {
      alert(`키 저장 실패: ${res?.error || '알 수 없는 오류'}`)
    }
  }

  const handleClearCredential = async (service: string, keychainKey: string) => {
    void service
    if (!ipc.isElectronEnv()) return
    if (!confirm('해당 자격 증명을 영구히 삭제하시겠습니까?')) return

    await ipc.keychainDelete(keychainKey)
    loadCredentials()
  }

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
