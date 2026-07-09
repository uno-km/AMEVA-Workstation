/**
 * @file SettingsTabAIEngine.tsx
 * @system AMEVA OS Desktop Workstation
 * @location src/renderer/components/settings/SettingsTabAIEngine.tsx
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

import React, { useState, useEffect } from 'react'
import { Cpu, Zap, SlidersHorizontal, Shield, Server, ExternalLink } from 'lucide-react'
import type { AISettings } from '../../types/aiTypes'
import { PROVIDER_MODELS } from '../../../shared/constants/aiSettings'

export interface SettingsTabAIEngineProps {
  activeTab: string
  aiSettings: AISettings
  onUpdateAISettings: (settings: Partial<AISettings>) => void
  gpuName?: string
}

export function SettingsTabAIEngine({
  activeTab,
  aiSettings,
  onUpdateAISettings,
  gpuName
}: SettingsTabAIEngineProps) {
  if (activeTab !== 'AIEngine') return null

  const { apiType = 'wasm', apiProvider = 'gemini', apiEndpoint = '', apiModel = '', gpuOnly = true, temperature = 0.7, maxTokens = 1024 } = aiSettings

  const [ollamaModels, setOllamaModels] = useState<{name: string}[]>([])
  const [isOllamaLoading, setIsOllamaLoading] = useState(false)

  useEffect(() => {
    if (apiType === 'ollama') {
      setIsOllamaLoading(true)
      fetch('http://127.0.0.1:11434/api/tags')
        .then(res => res.json())
        .then(data => {
          if (data.models && Array.isArray(data.models)) {
            setOllamaModels(data.models)
            // 첫 진입 시 선택된 모델이 없으면 가장 첫 번째 모델 자동 선택
            if (!apiModel && data.models.length > 0) {
              onUpdateAISettings({ apiModel: data.models[0].name })
            }
          }
        })
        .catch(err => {
          console.error('Ollama 모델 목록을 가져오는데 실패했습니다:', err)
          setOllamaModels([])
        })
        .finally(() => setIsOllamaLoading(false))
    }
  }, [apiType])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', height: '100%', overflowY: 'auto', paddingRight: '4px' }}>
      
      {/* 1. AI 실행 유형 설정 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div style={{ borderBottom: '1px solid var(--border-muted)', paddingBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Cpu size={14} color="var(--primary)" />
          <h4 style={{ fontSize: '12.5px', fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>AI 엔진 및 실행 유형</h4>
        </div>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)' }}>기본 실행 모드</label>
          <select
            value={apiType}
            onChange={e => onUpdateAISettings({ apiType: e.target.value as AISettings['apiType'] })}
            style={{
              width: '100%', padding: '8px 10px', borderRadius: '6px',
              background: 'var(--bg-glass)', border: '1px solid var(--border-muted)',
              color: 'var(--text-main)', fontSize: '11.5px', outline: 'none'
            }}
          >
            <option value="wasm">로컬 WebGPU 가속 (무설치)</option>
            <option value="local">로컬 고성능 엔진 (llama-cli)</option>
            <option value="ollama">로컬 백그라운드 서비스 (Ollama)</option>
            <option value="api">클라우드 외부 API (OpenAI 등)</option>
          </select>
          <p style={{ fontSize: '9.5px', color: 'var(--text-muted)', margin: 0 }}>
            {apiType === 'wasm' && 'WGU 모드를 사용하면 브라우저 내부에서 안전하게 로컬 모델이 실행됩니다.'}
            {apiType === 'local' && '사용자의 로컬 환경에 llama-cli를 구동하여 최대한의 고성능을 발휘합니다.'}
            {apiType === 'ollama' && '백그라운드에 구동 중인 Ollama 서버를 통해 외부 통신 없이 실행합니다.'}
            {apiType === 'api' && '보유하고 있는 API 키를 사용하여 강력한 클라우드 모델을 직접 호출합니다.'}
          </p>
        </div>

        {apiType !== 'api' && (
          <div style={{ padding: '12px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px solid var(--border-muted)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input
                type="checkbox"
                id="gpuOnly-checkbox"
                checked={gpuOnly}
                onChange={e => onUpdateAISettings({ gpuOnly: e.target.checked })}
                style={{ accentColor: 'var(--primary)' }}
              />
              <label htmlFor="gpuOnly-checkbox" style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-main)', cursor: 'pointer' }}>
                GPU 전용 가속 활성화 (권장)
              </label>
            </div>
            {gpuName && (
              <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginLeft: '22px' }}>
                감지된 그래픽 장치: <span style={{ color: 'var(--secondary)', fontWeight: 'bold' }}>{gpuName}</span>
              </div>
            )}
            <p style={{ fontSize: '9.5px', color: 'var(--text-muted)', margin: '0 0 0 22px' }}>
              해제 시 CPU 모드로 기동되어 속도가 크게 저하될 수 있습니다. 
              {apiType === 'local' && ' 로컬 고성능 엔진 사용 시 C:\\ameva\\llama\\llama-cli.exe 가 필요합니다.'}
            </p>
          </div>
        )}
      </div>

      {/* 2. 클라우드 API 상세 설정 */}
      {apiType === 'api' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '12px', background: 'rgba(52, 211, 153, 0.03)', border: '1px solid rgba(52, 211, 153, 0.2)', borderRadius: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Zap size={14} color="#34d399" />
            <h4 style={{ fontSize: '11.5px', fontWeight: 700, margin: 0, color: '#34d399' }}>클라우드 연동</h4>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ fontSize: '10.5px', fontWeight: 600, color: 'var(--text-main)' }}>API 제공사</label>
            <select
              value={apiProvider}
              onChange={e => onUpdateAISettings({ apiProvider: e.target.value as any })}
              style={{
                width: '100%', padding: '8px 10px', borderRadius: '6px',
                background: 'var(--bg-glass)', border: '1px solid var(--border-muted)',
                color: 'var(--text-main)', fontSize: '11px', outline: 'none'
              }}
            >
              <option value="gemini">Google Gemini (AI Studio)</option>
              <option value="openai">OpenAI</option>
              <option value="anthropic">Anthropic (Claude)</option>
              <option value="custom">Custom (직접 입력)</option>
            </select>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ fontSize: '10.5px', fontWeight: 600, color: 'var(--text-main)' }}>API 모델명</label>
            {apiProvider === 'custom' ? (
              <input
                type="text"
                value={apiModel}
                onChange={e => onUpdateAISettings({ apiModel: e.target.value })}
                placeholder="gpt-4o-mini | claude-3-5-sonnet"
                style={{
                  width: '100%', padding: '8px 10px', borderRadius: '6px',
                  background: 'var(--bg-glass)', border: '1px solid var(--border-muted)',
                  color: 'var(--text-main)', fontSize: '11px', outline: 'none'
                }}
              />
            ) : (
              <select
                value={apiModel}
                onChange={e => onUpdateAISettings({ apiModel: e.target.value })}
                style={{
                  width: '100%', padding: '8px 10px', borderRadius: '6px',
                  background: 'var(--bg-glass)', border: '1px solid var(--border-muted)',
                  color: 'var(--text-main)', fontSize: '11px', outline: 'none'
                }}
              >
                {((PROVIDER_MODELS as any)[apiProvider] || []).map((m: any) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ fontSize: '10.5px', fontWeight: 600, color: 'var(--text-main)' }}>Custom API 엔드포인트</label>
            <input
              type="text"
              value={apiEndpoint}
              onChange={e => onUpdateAISettings({ apiEndpoint: e.target.value })}
              disabled={apiProvider !== 'custom'}
              placeholder="https://api.openai.com/v1/chat/completions"
              style={{
                width: '100%', padding: '8px 10px', borderRadius: '6px',
                background: apiProvider === 'custom' ? 'var(--bg-glass)' : 'rgba(0,0,0,0.2)',
                border: '1px solid var(--border-muted)',
                color: apiProvider === 'custom' ? 'var(--text-main)' : 'var(--text-muted)',
                fontSize: '11px', outline: 'none',
                cursor: apiProvider === 'custom' ? 'text' : 'not-allowed'
              }}
            />
          </div>

          <div style={{ display: 'flex', gap: '6px', alignItems: 'flex-start', background: 'rgba(255,255,255,0.02)', padding: '10px', borderRadius: '6px' }}>
            <Shield size={14} color="var(--text-muted)" style={{ marginTop: '2px', flexShrink: 0 }} />
            <p style={{ margin: 0, fontSize: '9.5px', color: 'var(--text-muted)', lineHeight: '1.4' }}>
              API Key는 좌측의 <strong>Credentials</strong> 탭에서 안전하게 시스템 KeyChain에 등록할 수 있습니다.
              {apiProvider === 'anthropic' && <span style={{ color: 'var(--accent)', display: 'block', marginTop: '4px' }}>⚠️ Anthropic 공식 API는 헤더 규격이 달라 직접 연동 시 에러가 날 수 있습니다. OpenRouter 프록시 사용을 권장합니다.</span>}
            </p>
          </div>
        </div>
      )}

      {/* 2.5 Ollama 로컬 서비스 설정 */}
      {apiType === 'ollama' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '12px', background: 'rgba(59, 130, 246, 0.03)', border: '1px solid rgba(59, 130, 246, 0.2)', borderRadius: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Server size={14} color="#3b82f6" />
            <h4 style={{ fontSize: '11.5px', fontWeight: 700, margin: 0, color: '#3b82f6' }}>Ollama 로컬 연동</h4>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ fontSize: '10.5px', fontWeight: 600, color: 'var(--text-main)' }}>서버 엔드포인트</label>
            <input
              type="text"
              value={apiEndpoint}
              onChange={e => onUpdateAISettings({ apiEndpoint: e.target.value })}
              placeholder="http://127.0.0.1:11434"
              style={{
                width: '100%', padding: '8px 10px', borderRadius: '6px',
                background: 'var(--bg-glass)', border: '1px solid var(--border-muted)',
                color: 'var(--text-main)', fontSize: '11px', outline: 'none'
              }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ fontSize: '10.5px', fontWeight: 600, color: 'var(--text-main)' }}>사용할 모델 선택</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <select
                value={apiModel}
                onChange={e => onUpdateAISettings({ apiModel: e.target.value })}
                disabled={isOllamaLoading || ollamaModels.length === 0}
                style={{
                  flex: 1, padding: '8px 10px', borderRadius: '6px',
                  background: 'var(--bg-glass)', border: '1px solid var(--border-muted)',
                  color: 'var(--text-main)', fontSize: '11px', outline: 'none'
                }}
              >
                {isOllamaLoading ? (
                  <option value="">모델 불러오는 중...</option>
                ) : ollamaModels.length > 0 ? (
                  <>
                    <option value="" disabled>모델을 선택해주세요</option>
                    {ollamaModels.map(m => (
                      <option key={m.name} value={m.name}>{m.name}</option>
                    ))}
                  </>
                ) : (
                  <option value="">설치된 모델 없음</option>
                )}
              </select>
              <button 
                onClick={async () => {
                  setIsOllamaLoading(true)
                  try {
                    const res = await fetch((apiEndpoint || 'http://127.0.0.1:11434') + '/api/tags')
                    if (!res.ok) throw new Error('Ollama 서버 응답 없음')
                    const data = await res.json()
                    if (data.models) setOllamaModels(data.models)
                  } catch (e) {
                    console.error('Ollama 연결 실패:', e)
                  } finally {
                    setIsOllamaLoading(false)
                  }
                }}
                style={{ padding: '0 12px', background: 'var(--bg-glass-active)', border: '1px solid var(--border-muted)', borderRadius: '6px', color: 'var(--text-main)', fontSize: '11px', cursor: 'pointer' }}
              >
                새로고침
              </button>
            </div>
            {/* [FEAT-OLLAMA] Ollama 서버가 꺼져있을 때 시작 버튼 표시 */}
            {ollamaModels.length === 0 && !isOllamaLoading && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '10px', background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '6px' }}>
                <p style={{ margin: 0, fontSize: '10px', color: '#ef4444', fontWeight: 600 }}>
                  ⚠️ Ollama 서버가 꺼져있거나 응답이 없습니다.
                </p>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <button
                    onClick={async () => {
                      try {
                        if ((window as any).electronAPI?.executeTerminal) {
                          await (window as any).electronAPI.executeTerminal('ollama serve')
                          // 2초 뒤 재연결 시도
                          setTimeout(async () => {
                            try {
                              const res = await fetch((apiEndpoint || 'http://127.0.0.1:11434') + '/api/tags')
                              if (res.ok) {
                                const data = await res.json()
                                if (data.models) setOllamaModels(data.models)
                              }
                            } catch {}
                          }, 2000)
                        } else {
                          alert('터미널에서 "ollama serve" 명령을 실행해 서버를 시작한 후 새로고침하세요.')
                        }
                      } catch (e) {
                        console.error('Ollama serve 실행 실패:', e)
                      }
                    }}
                    style={{
                      padding: '6px 12px', background: 'rgba(59,130,246,0.15)',
                      border: '1px solid rgba(59,130,246,0.4)', borderRadius: '6px',
                      color: '#3b82f6', fontSize: '10.5px', cursor: 'pointer', fontWeight: 600
                    }}
                  >
                    ▶ Ollama 서버 시작 (ollama serve)
                  </button>
                  <p style={{ margin: 'auto 0', fontSize: '9.5px', color: 'var(--text-muted)' }}>
                    또는 터미널에서 직접 실행하세요.
                  </p>
                </div>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: '6px', alignItems: 'flex-start', background: 'rgba(255,255,255,0.02)', padding: '10px', borderRadius: '6px' }}>
            <ExternalLink size={14} color="var(--text-muted)" style={{ marginTop: '2px', flexShrink: 0 }} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <p style={{ margin: 0, fontSize: '9.5px', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                새로운 모델을 다운로드하려면 터미널(명령 프롬프트)을 열고 아래 명령어를 입력하세요.
              </p>
              <code style={{ fontSize: '10px', color: 'var(--accent)', background: 'rgba(0,0,0,0.3)', padding: '4px 8px', borderRadius: '4px', marginTop: '2px' }}>
                ollama run llama3.1
              </code>
              <a href="https://ollama.com/library" target="_blank" rel="noreferrer" style={{ fontSize: '9.5px', color: '#3b82f6', textDecoration: 'none', marginTop: '2px' }}>
                Ollama 공식 라이브러리에서 모델 찾기 →
              </a>
            </div>
          </div>
        </div>
      )}

      {/* 3. 모델 출력 세부 튜닝 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div style={{ borderBottom: '1px solid var(--border-muted)', paddingBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <SlidersHorizontal size={14} color="var(--primary)" />
          <h4 style={{ fontSize: '12.5px', fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>출력 파라미터 튜닝</h4>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '12px', background: 'var(--bg-glass)', borderRadius: '8px', border: '1px solid var(--border-muted)' }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
              <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-main)' }}>Temperature (창의성)</label>
              <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--primary)' }}>{temperature.toFixed(1)}</span>
            </div>
            <input
              type="range" min="0" max="1" step="0.1"
              value={temperature}
              onChange={e => onUpdateAISettings({ temperature: parseFloat(e.target.value) })}
              style={{ width: '100%', accentColor: 'var(--primary)' }}
            />
            <p style={{ fontSize: '9px', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
              값이 높을수록 다양하고 창의적인 답변이, 낮을수록 일관되고 정제된 답변이 출력됩니다.
            </p>
          </div>

          <div style={{ marginTop: '12px', borderTop: '1px solid var(--border-muted)', paddingTop: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
              <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-main)' }}>Max Tokens (최대 길이)</label>
              <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--primary)' }}>{maxTokens}</span>
            </div>
            <input
              type="range" min="128" max="4096" step="128"
              value={maxTokens}
              onChange={e => onUpdateAISettings({ maxTokens: parseInt(e.target.value) })}
              style={{ width: '100%', accentColor: 'var(--primary)' }}
            />
            <p style={{ fontSize: '9px', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
              모델이 한 번에 출력할 수 있는 최대 단어(토큰) 수를 제한합니다.
            </p>
          </div>
        </div>
      </div>
      
    </div>
  )
}
