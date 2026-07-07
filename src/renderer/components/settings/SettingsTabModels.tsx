
import type { AppSettings } from '../SettingsModal'
import type { ModelInfo } from '../../services/ipc/ipcTypes'

export interface SettingsTabModelsProps {
  activeTab: string
  settings: AppSettings
  onUpdateSettings: (newSettings: Partial<AppSettings>) => void
  downloadStatus: { filename: string; progress: number; speed?: string } | null
  localModels: ModelInfo[]
  localCodeModels: ModelInfo[]
  formatBytes: (bytes: number) => string
  startModelDownload: (url: string, filename: string, type: 'llm' | 'code') => Promise<void>
}

export function SettingsTabModels({
  activeTab,
  settings,
  onUpdateSettings,
  downloadStatus,
  localModels,
  localCodeModels,
  formatBytes,
  startModelDownload,
}: SettingsTabModelsProps) {
  if (activeTab !== 'Models') return null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', height: '100%', overflowY: 'auto', paddingRight: '4px' }}>
      
      {/* 다운로드 진행률 Toast 바 (모달 내부 노출) */}
      {downloadStatus && (
        <div style={{
          padding: '10px 14px', borderRadius: '8px',
          background: 'rgba(139, 92, 246, 0.15)', border: '1px solid rgba(139, 92, 246, 0.3)',
          display: 'flex', flexDirection: 'column', gap: '6px',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: 'bold' }}>
            <span>📥 모델 다운로드 중: {downloadStatus.filename}</span>
            <span>{downloadStatus.progress}%</span>
          </div>
          <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '3px', overflow: 'hidden' }}>
            <div style={{
              width: `${downloadStatus.progress}%`, height: '100%',
              background: 'linear-gradient(90deg, var(--primary) 0%, #a78bfa 100%)',
              transition: 'width 0.2s ease-out'
            }} />
          </div>
          {downloadStatus.speed && (
            <span style={{ fontSize: '9px', color: 'var(--text-muted)', textAlign: 'right' }}>속도: {downloadStatus.speed}</span>
          )}
        </div>
      )}

      {/* 2열 레이아웃 */}
      <div style={{ display: 'flex', gap: '16px' }}>
        
        {/* 1열: 일반 대화형 모델 (LLM) */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '12px', minWidth: 0 }}>
          <div style={{ borderBottom: '1px solid var(--border-muted)', paddingBottom: '6px' }}>
            <h4 style={{ fontSize: '12.5px', fontWeight: 700, margin: 0, color: 'var(--primary)' }}>💬 일반 대화형 LLM 모델</h4>
            <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>C:\ameva\models\llm</span>
          </div>

          {/* 활성 모델 선택기 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '10.5px', fontWeight: 600, color: 'var(--text-muted)' }}>기본 대화 모델 활성화</label>
            <select
              value={settings.modelPath || ''}
              onChange={(e) => onUpdateSettings({ modelPath: e.target.value })}
              style={{
                width: '100%', padding: '6px 10px', borderRadius: '6px',
                background: 'var(--bg-glass)', border: '1px solid var(--border-muted)',
                color: 'var(--text-main)', fontSize: '11.5px', outline: 'none'
              }}
            >
              <option value="">(활성 모델 없음)</option>
              {localModels.map(m => (
                <option key={m.path} value={m.path}>{m.name} ({formatBytes(m.size || 0)})</option>
              ))}
            </select>
          </div>

          {/* 감지된 로컬 모델 목록 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <span style={{ fontSize: '10.5px', fontWeight: 600, color: 'var(--text-muted)' }}>감지된 로컬 모델 파일</span>
            {localModels.length === 0 ? (
              <div style={{ padding: '12px', borderRadius: '6px', background: 'rgba(255,255,255,0.01)', border: '1px dashed var(--border-muted)', textAlign: 'center', fontSize: '10.5px', color: 'var(--text-muted)' }}>
                다운로드된 일반 모델이 없습니다.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', maxHeight: '110px', overflowY: 'auto' }}>
                {localModels.map(m => (
                  <div key={m.path} style={{ padding: '6px 10px', borderRadius: '6px', background: 'var(--bg-glass)', border: '1px solid var(--border-muted)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '11px', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginRight: '8px' }} title={m.filename}>{m.filename}</span>
                    <span style={{ fontSize: '9.5px', color: 'var(--primary)', flexShrink: 0 }}>{formatBytes(m.size || 0)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 추천 및 다운로드 허브 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <span style={{ fontSize: '10.5px', fontWeight: 600, color: 'var(--text-muted)' }}>추천 대화 모델 빠른 설치</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
              {[
                {
                  name: 'Gemma 2 2B (구글)',
                  size: '1.6 GB',
                  desc: '빠른 응답 속도와 우수한 한국어 능력',
                  url: 'https://huggingface.co/lmstudio-community/gemma-2-2b-it-GGUF/resolve/main/gemma-2-2b-it-Q4_K_M.gguf',
                  filename: 'gemma-2-2b-it-q4_k_m.gguf'
                },
                {
                  name: 'EXAONE 3.0 2.4B (LG)',
                  size: '1.7 GB',
                  desc: 'LG AI 연구원의 고성능 국산 모델',
                  url: 'https://huggingface.co/mradermacher/EXAONE-3.0-2.4B-Instruct-GGUF/resolve/main/EXAONE-3.0-2.4B-Instruct.Q4_K_M.gguf',
                  filename: 'exaone-3.0-2.4b-instruct-q4_k_m.gguf'
                },
                {
                  name: 'Qwen 2.5 3B (스탠다드)',
                  size: '2.2 GB',
                  desc: '논리력과 밸런스가 뛰어난 스탠다드 모델',
                  url: 'https://huggingface.co/Qwen/Qwen2.5-3B-Instruct-GGUF/resolve/main/qwen2.5-3b-instruct-q4_k_m.gguf',
                  filename: 'qwen2.5-3b-instruct-q4_k_m.gguf'
                }
              ].map(model => {
                const isInstalled = localModels.some(m => m.filename.toLowerCase() === model.filename.toLowerCase())
                return (
                  <div key={model.filename} style={{ padding: '6px 10px', borderRadius: '6px', background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-muted)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', overflow: 'hidden' }}>
                      <span style={{ fontSize: '11px', fontWeight: 700 }}>{model.name} <span style={{ fontSize: '9px', color: 'var(--text-muted)', fontWeight: 500 }}>({model.size})</span></span>
                      <span style={{ fontSize: '9px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{model.desc}</span>
                    </div>
                    <button
                      disabled={isInstalled || !!downloadStatus}
                      onClick={() => void startModelDownload(model.url, model.filename, 'llm')}
                      style={{
                        padding: '4px 8px', borderRadius: '4px',
                        background: isInstalled ? 'rgba(52, 211, 153, 0.15)' : 'var(--primary)',
                        color: isInstalled ? '#fff' : '#fff',
                        border: 'none', fontSize: '9.5px', fontWeight: 'bold',
                        cursor: isInstalled ? 'default' : 'pointer',
                        flexShrink: 0
                      }}
                    >
                      {isInstalled ? '설치됨' : '설치'}
                    </button>
                  </div>
                )
              })}
            </div>
          </div>

        </div>

        {/* 2열: 코딩 특화 모델 (Code) */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '12px', minWidth: 0 }}>
          <div style={{ borderBottom: '1px solid var(--border-muted)', paddingBottom: '6px' }}>
            <h4 style={{ fontSize: '12.5px', fontWeight: 700, margin: 0, color: '#34d399' }}>💻 코딩 특화 Coder 모델</h4>
            <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>C:\ameva\models\code</span>
          </div>

          {/* 활성 모델 선택기 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '10.5px', fontWeight: 600, color: 'var(--text-muted)' }}>코딩 특화 모델 활성화</label>
            <select
              value={settings.codeModelPath || ''}
              onChange={(e) => onUpdateSettings({ codeModelPath: e.target.value })}
              style={{
                width: '100%', padding: '6px 10px', borderRadius: '6px',
                background: 'var(--bg-glass)', border: '1px solid var(--border-muted)',
                color: 'var(--text-main)', fontSize: '11.5px', outline: 'none'
              }}
            >
              <option value="">(코딩 시 일반 모델로 폴백)</option>
              {localCodeModels.map(m => (
                <option key={m.path} value={m.path}>{m.name} ({formatBytes(m.size || 0)})</option>
              ))}
            </select>
          </div>

          {/* 감지된 로컬 코딩 모델 목록 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <span style={{ fontSize: '10.5px', fontWeight: 600, color: 'var(--text-muted)' }}>감지된 로컬 코딩 모델 파일</span>
            {localCodeModels.length === 0 ? (
              <div style={{ padding: '12px', borderRadius: '6px', background: 'rgba(255,255,255,0.01)', border: '1px dashed var(--border-muted)', textAlign: 'center', fontSize: '10.5px', color: 'var(--text-muted)' }}>
                다운로드된 코딩 모델이 없습니다.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', maxHeight: '110px', overflowY: 'auto' }}>
                {localCodeModels.map(m => (
                  <div key={m.path} style={{ padding: '6px 10px', borderRadius: '6px', background: 'var(--bg-glass)', border: '1px solid var(--border-muted)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '11px', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginRight: '8px' }} title={m.filename}>{m.filename}</span>
                    <span style={{ fontSize: '9.5px', color: '#34d399', flexShrink: 0 }}>{formatBytes(m.size || 0)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 추천 및 다운로드 허브 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <span style={{ fontSize: '10.5px', fontWeight: 600, color: 'var(--text-muted)' }}>추천 코딩 모델 빠른 설치</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
              {[
                {
                  name: 'Qwen 2.5 Coder 1.5B (경량)',
                  size: '1.1 GB',
                  desc: '경량 코딩 최적화, 노트북에 적극 권장',
                  url: 'https://huggingface.co/Qwen/Qwen2.5-Coder-1.5B-Instruct-GGUF/resolve/main/qwen2.5-coder-1.5b-instruct-q4_k_m.gguf',
                  filename: 'qwen2.5-coder-1.5b-instruct-q4_k_m.gguf'
                },
                {
                  name: 'Qwen 2.5 Coder 3B (스탠다드)',
                  size: '2.2 GB',
                  desc: '속도와 코딩 코어 성능의 완벽한 밸런스',
                  url: 'https://huggingface.co/Qwen/Qwen2.5-Coder-3B-Instruct-GGUF/resolve/main/qwen2.5-coder-3b-instruct-q4_k_m.gguf',
                  filename: 'qwen2.5-coder-3b-instruct-q4_k_m.gguf'
                },
                {
                  name: 'Qwen 2.5 Coder 7B (고성능)',
                  size: '4.7 GB',
                  desc: '복잡한 설계 및 알고리즘 구현 최적화 (Public)',
                  url: 'https://huggingface.co/Qwen/Qwen2.5-Coder-7B-Instruct-GGUF/resolve/main/qwen2.5-coder-7b-instruct-q4_k_m.gguf',
                  filename: 'qwen2.5-coder-7b-instruct-q4_k_m.gguf'
                }
              ].map(model => {
                const isInstalled = localCodeModels.some(m => m.filename.toLowerCase() === model.filename.toLowerCase())
                return (
                  <div key={model.filename} style={{ padding: '6px 10px', borderRadius: '6px', background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-muted)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', overflow: 'hidden' }}>
                      <span style={{ fontSize: '11px', fontWeight: 700 }}>{model.name} <span style={{ fontSize: '9px', color: 'var(--text-muted)', fontWeight: 500 }}>({model.size})</span></span>
                      <span style={{ fontSize: '9px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{model.desc}</span>
                    </div>
                    <button
                      disabled={isInstalled || !!downloadStatus}
                      onClick={() => void startModelDownload(model.url, model.filename, 'code')}
                      style={{
                        padding: '4px 8px', borderRadius: '4px',
                        background: isInstalled ? 'rgba(52, 211, 153, 0.15)' : '#34d399',
                        color: isInstalled ? '#34d399' : '#000',
                        border: 'none', fontSize: '9.5px', fontWeight: 'bold',
                        cursor: isInstalled ? 'default' : 'pointer',
                        flexShrink: 0
                      }}
                    >
                      {isInstalled ? '설치됨' : '설치'}
                    </button>
                  </div>
                )
              })}
            </div>
          </div>

        </div>

      </div>
    </div>
  )
}
