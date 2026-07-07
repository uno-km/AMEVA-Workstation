import React, { useState } from 'react'
import { X, Check, Trash2, AlertCircle } from 'lucide-react'
import { PROVIDER_MODELS, API_ENDPOINTS } from "../../../shared/constants/aiSettings"
import type { AISettings } from '../../types/aiTypes'

export interface LocalModelInfo {
  name: string
  filename: string
  path: string
  size: number
}

export interface AISettingsPanelProps {
  settings: AISettings & { theme?: string }
  onUpdateSettings: (s: Partial<AISettings>) => void
  models: LocalModelInfo[]
  isKeySaved: Record<string, boolean>
  handleApiKeyChange: (val: string) => void
  handleSaveKey: () => void
  handleDeleteKey: () => void
  onClose: () => void
  setShowModelHub?: (val: boolean) => void
  importModel?: () => void
  gpuName?: string
}

const formatBytes = (bytes: number) => {
  if (!bytes) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

export function AISettingsPanel({
  settings,
  onUpdateSettings,
  models,
  isKeySaved,
  handleApiKeyChange,
  handleSaveKey,
  handleDeleteKey,
  onClose,
  setShowModelHub,
  importModel,
  gpuName
}: AISettingsPanelProps) {
  const { apiType = 'wasm', apiProvider = 'gemini', apiKey = '', apiEndpoint = '', apiModel = '', gpuOnly = true } = settings
  const isWhiteTheme = settings.theme === 'white'
  
  const [downloadStatus, setDownloadStatus] = useState<{ filename: string; progress: number; speed: number; downloadedBytes: number; totalBytes: number; timeRemaining: number } | null>(null)
  const isAvailable = true
  console.debug("Unused vars (AISettingsPanel):", { React, Check, Trash2, API_ENDPOINTS, isKeySaved, handleSaveKey, handleDeleteKey, isWhiteTheme });

  return (
    <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          zIndex: 1000,
          background: 'rgba(0, 0, 0, 0.4)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '16px'
        }} onClick={() => onClose()}>
          <div style={{
            width: '100%', maxWidth: '340px', maxHeight: '100%',
            overflowY: 'auto',
            background: 'var(--bg-glass-active)',
            border: '1px solid var(--border-muted)',
            borderRadius: '12px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
            padding: '16px',
            display: 'flex', flexDirection: 'column', gap: '12px'
          }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-main)' }}>AI 설정</span>
              <button onClick={() => onClose()} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={16} />
              </button>
            </div>
          {/* AI 실행 유형 선택 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '10px', color: 'var(--text-muted)' }}>AI 실행 유형</label>
            <select
              value={apiType}
              onChange={e => onUpdateSettings({ apiType: e.target.value as any })}
              style={{
                width: '100%',
                background: 'var(--bg-glass)',
                border: '1px solid var(--border-muted)',
                borderRadius: '6px',
                padding: '5px 8px',
                color: 'var(--text-main)',
                fontSize: '11px',
              }}
            >
              <option value="wasm">로컬 WebGPU 가속 (무설치)</option>
              <option value="local">로컬 고성능 엔진 (llama-cli)</option>
              <option value="ollama">로컬 백그라운드 서비스 (Ollama)</option>
              <option value="api">클라우드 외부 API (OpenAI 등)</option>
            </select>
          </div>

          {/* API Key 입력란 */}
          {apiType === 'api' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {/* API 제공사 선택 */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '10px', color: 'var(--text-muted)' }}>API 제공사</label>
                <select
                  value={apiProvider}
                  onChange={e => onUpdateSettings({ apiProvider: e.target.value })}
                  style={{
                    width: '100%',
                    background: 'var(--bg-glass)',
                    border: '1px solid var(--border-muted)',
                    borderRadius: '6px',
                    padding: '5px 8px',
                    color: 'var(--text-main)',
                    fontSize: '11px',
                  }}
                >
                  <option value="gemini">Google Gemini (AI Studio)</option>
                  <option value="openai">OpenAI</option>
                  <option value="anthropic">Anthropic (Claude)</option>
                  <option value="custom">Custom (직접 입력)</option>
                </select>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '10px', color: 'var(--text-muted)' }}>API Key</label>
                <input
                  type="password"
                  value={apiKey}
                  onChange={e => handleApiKeyChange(e.target.value)}
                  placeholder="키를 입력하면 제공사가 자동 감지됩니다"
                  style={{
                    width: '100%',
                    background: 'var(--bg-glass)',
                    border: '1px solid var(--border-muted)',
                    borderRadius: '6px',
                    padding: '5px 8px',
                    color: 'var(--text-main)',
                    fontSize: '11px',
                    outline: 'none',
                  }}
                />
              </div>
              {/* [FIX-W-003] 엔드포인트 입력란 */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '10px', color: 'var(--text-muted)' }}>API 엔드포인트 (URL)</label>
                <input
                  type="text"
                  value={apiEndpoint}
                  onChange={e => onUpdateSettings({ apiEndpoint: e.target.value })}
                  disabled={apiProvider !== 'custom'}
                  placeholder="https://api.openai.com/v1/chat/completions"
                  style={{
                    width: '100%',
                    background: apiProvider === 'custom' ? 'var(--bg-glass)' : 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid var(--border-muted)',
                    borderRadius: '6px',
                    padding: '5px 8px',
                    color: apiProvider === 'custom' ? 'var(--text-main)' : 'var(--text-muted)',
                    fontSize: '10px',
                    outline: 'none',
                    cursor: apiProvider === 'custom' ? 'text' : 'not-allowed',
                  }}
                />
              </div>
              {/* [FIX-W-003] 모델명 입력란 / 셀렉트박스 */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '10px', color: 'var(--text-muted)' }}>API 모델명</label>
                {apiProvider === 'custom' ? (
                  <input
                    type="text"
                    value={apiModel}
                    onChange={e => onUpdateSettings({ apiModel: e.target.value })}
                    placeholder="gpt-4o-mini | claude-3-5-sonnet-20241022"
                    style={{
                      width: '100%',
                      background: 'var(--bg-glass)',
                      border: '1px solid var(--border-muted)',
                      borderRadius: '6px',
                      padding: '5px 8px',
                      color: 'var(--text-main)',
                      fontSize: '10px',
                      outline: 'none',
                    }}
                  />
                ) : (
                  <select
                    value={apiModel}
                    onChange={e => onUpdateSettings({ apiModel: e.target.value })}
                    style={{
                      width: '100%',
                      background: 'var(--bg-glass)',
                      border: '1px solid var(--border-muted)',
                      borderRadius: '6px',
                      padding: '5px 8px',
                      color: 'var(--text-main)',
                      fontSize: '11px',
                    }}
                  >
                    {((PROVIDER_MODELS as Record<string, {value: string; label: string}[]>)[apiProvider] || []).map((m: any) => (
                      <option key={m.value} value={m.value}>{m.label}</option>
                    ))}
                  </select>
                )}
              </div>
              {/* Anthropic 선택 시 경고/주의 안내문구 추가 */}
              {apiProvider === 'anthropic' && (
                <div style={{ fontSize: '9px', color: '#fbbf24', marginTop: '2px', lineHeight: '1.2' }}>
                  ⚠️ Anthropic 공식 API는 헤더 규격이 달라 직접 연동 시 에러가 날 수 있습니다. OpenRouter나 OpenAI 호환 프록시를 사용할 때는 제공사를 Custom으로 지정하여 설정하세요.
                </div>
              )}
            </div>
          )}

          {/* 모델 선택 */}
          {apiType !== 'api' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <label style={{ fontSize: '10px', color: 'var(--text-muted)' }}>모델 선택</label>
                <button
                  onClick={() => setShowModelHub?.(true)}
                  style={{
                    fontSize: '9px', color: 'var(--primary)', background: 'none', border: 'none',
                    cursor: 'pointer', padding: 0, fontWeight: 700,
                  }}
                >
                  모델 허브 개방 📥
                </button>
              </div>
              {models.length === 0 ? (
                <div style={{
                  padding: '8px', borderRadius: '6px',
                  background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
                  fontSize: '11px', color: '#f87171',
                  display: 'flex', flexDirection: 'column', gap: '6px',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <AlertCircle size={12} />
                    <span>C:\ameva\models\llm 에 모델 없음</span>
                  </div>
                  <button
                    onClick={() => setShowModelHub?.(true)}
                    style={{
                      width: '100%', padding: '4px 8px', borderRadius: '4px',
                      background: 'var(--primary)', color: '#fff', border: 'none',
                      fontSize: '10px', fontWeight: 700, cursor: 'pointer',
                      textAlign: 'center',
                    }}
                  >
                    추천 AI 모델 다운로드 센터 열기
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                  <select
                    value={settings.modelPath}
                    onChange={e => onUpdateSettings({ modelPath: e.target.value })}
                    style={{
                      width: '100%',
                      background: 'var(--bg-glass)',
                      border: '1px solid var(--border-muted)',
                      borderRadius: '6px',
                      padding: '5px 8px',
                      color: 'var(--text-main)',
                      fontSize: '11px',
                    }}
                  >
                    {models.map(m => (
                      <option key={m.path} value={m.path} style={{ background: 'var(--bg-main)', color: 'var(--text-main)' }}>
                        {m.name} ({formatBytes(m.size)})
                      </option>
                    ))}
                  </select>
                  {importModel && (
                    <button
                      onClick={importModel}
                      style={{
                        alignSelf: 'flex-start',
                        fontSize: '9.5px', color: 'rgba(167,139,250,0.85)', background: 'none', border: 'none',
                        cursor: 'pointer', padding: '1px 0', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '2px'
                      }}
                    >
                      + 외부 다운로드한 모델 파일(.gguf) 직접 가져오기
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* 하드웨어 가속 옵션 */}
          {apiType !== 'api' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '2px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="checkbox"
                  id="gpuOnly-checkbox"
                  checked={gpuOnly}
                  onChange={e => onUpdateSettings({ gpuOnly: e.target.checked })}
                  style={{ accentColor: 'var(--primary)' }}
                />
                <label htmlFor="gpuOnly-checkbox" style={{ fontSize: '11px', color: 'var(--text-main)', cursor: 'pointer' }}>
                  GPU 전용 가속 활성화 (해제 시 CPU 모드로 기동)
                </label>
              </div>
              {gpuName && (
                <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginLeft: '22px' }}>
                  감지된 그래픽 장치: <span style={{ color: 'var(--secondary)', fontWeight: 'bold' }}>{gpuName}</span>
                </div>
              )}
            </div>
          )}

          {/* Temperature */}
          <div>
            <label style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
              <span>Temperature (창의성)</span>
              <span style={{ color: 'var(--primary)' }}>{settings.temperature.toFixed(1)}</span>
            </label>
            <input
              type="range" min="0" max="1" step="0.1"
              value={settings.temperature}
              onChange={e => onUpdateSettings({ temperature: parseFloat(e.target.value) })}
              style={{ width: '100%', accentColor: 'var(--primary)' }}
            />
          </div>

          {/* Max Tokens */}
          <div>
            <label style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
              <span>최대 토큰</span>
              <span style={{ color: 'var(--primary)' }}>{settings.maxTokens}</span>
            </label>
            <input
              type="range" min="128" max="2048" step="128"
              value={settings.maxTokens}
              onChange={e => onUpdateSettings({ maxTokens: parseInt(e.target.value) })}
              style={{ width: '100%', accentColor: 'var(--primary)' }}
            />
          </div>

          {/* Hugging Face 추천 모델 다운로드 마켓플레이스 */}
          <div style={{ marginTop: '10px', borderTop: '1px solid var(--border-muted)', paddingTop: '10px' }}>
            <label style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
              Hugging Face 추천 모델 원클릭 다운로드
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {[
                { name: 'Qwen 2.5 1.5B (GGUF)', file: 'qwen2.5-1.5b-instruct-q4_k_m.gguf', url: 'https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct-GGUF/resolve/main/qwen2.5-1.5b-instruct-q4_k_m.gguf' },
                { name: 'Qwen 2.5 3B (GGUF)', file: 'qwen2.5-3b-instruct-q4_k_m.gguf', url: 'https://huggingface.co/Qwen/Qwen2.5-3B-Instruct-GGUF/resolve/main/qwen2.5-3b-instruct-q4_k_m.gguf' },
                { name: 'Llama 3.1 8B (GGUF)', file: 'Meta-Llama-3.1-8B-Instruct-Q4_K_M.gguf', url: 'https://huggingface.co/QuantFactory/Meta-Llama-3.1-8B-Instruct-GGUF/resolve/main/Meta-Llama-3.1-8B-Instruct-Q4_K_M.gguf' }
              ].map(m => {
                const isDownloading = downloadStatus && downloadStatus.filename === m.file && downloadStatus.progress < 100
                return (
                  <div key={m.file} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    background: 'rgba(255,255,255,0.02)', padding: '6px 8px', borderRadius: '6px',
                    border: '1px solid var(--border-muted)'
                  }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-main)' }}>{m.name}</span>
                      <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>{m.file}</span>
                    </div>
                    <button
                      disabled={!!isDownloading}
                      onClick={async () => {
                        if ((window as any).electron) {
                          setDownloadStatus({ filename: m.file, progress: 0, speed: 0, downloadedBytes: 0, totalBytes: 0, timeRemaining: 0 })
                          const res = await (window as any).electron.invoke('llm:downloadModel', { url: m.url, filename: m.file })
                          if (res.success) {
                            alert('다운로드 완료! AI 모델이 활성화되었습니다.')
                          } else {
                            alert(`다운로드 실패: ${res.error}`)
                          }
                        }
                      }}
                      style={{
                        background: isDownloading ? 'rgba(255,255,255,0.05)' : 'linear-gradient(135deg, var(--primary), var(--secondary))',
                        border: 'none', color: '#fff', fontSize: '10px', padding: '4px 10px',
                        borderRadius: '4px', cursor: isDownloading ? 'not-allowed' : 'pointer', fontWeight: 700
                      }}
                    >
                      {isDownloading ? `${downloadStatus.progress}%` : '설치'}
                    </button>
                  </div>
                )
              })}
            </div>
          </div>

          {/* llama.cpp 설치 안내 (로컬 고성능 엔진 모드일 때만 안내 노출) */}
          {apiType === 'local' && !isAvailable && (
            <div style={{
              padding: '8px', borderRadius: '6px',
              background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.3)',
              fontSize: '10px', color: 'var(--text-muted)',
            }}>
              AI 사용을 위해 llama.cpp를 설치하세요:<br />
              C:\ameva\llama\llama-cli.exe
            </div>
          )}
        </div>
        </div>
      

      
  )
}
