import { Cpu, Zap, SlidersHorizontal, Shield } from 'lucide-react'
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
