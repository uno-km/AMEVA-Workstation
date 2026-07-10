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

import { useState, useEffect, useRef, useCallback } from 'react'
import { Cpu, Zap, SlidersHorizontal, Shield, Server, ExternalLink, HardDriveDownload, CheckCircle2, AlertCircle } from 'lucide-react'
import type { AISettings } from '../../types/aiTypes'
import { PROVIDER_MODELS } from '../../../shared/constants/aiSettings'
import { WebLLMEngine } from '../../services/ai/WebLLMEngine'
import { WebCPUEngine } from '../../services/ai/WebCPUEngine'

export interface SettingsTabAIEngineProps {
  activeTab: string
  aiSettings: AISettings
  onUpdateAISettings: (settings: Partial<AISettings>) => void
  gpuName?: string
}

  /*
   * [FUNCTION CONTRACT]
   * - 함수 명: `SettingsTabAIEngine`
   * - 역할: 인자 정보를 검수하고 비즈니스 계약 조건에 맞춰 최종 바인딩 결과물/바이너리 버퍼를 반환함.
   * - 예시: `SettingsTabAIEngine(...)` 호출 시 런타임 비동기/동기 연쇄 반응 유도.
   */
export function SettingsTabAIEngine({
  activeTab,
  aiSettings,
  onUpdateAISettings,
  gpuName
}: SettingsTabAIEngineProps) {
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `activeTab !== 'AIEngine'`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (activeTab !== 'AIEngine')` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
  if (activeTab !== 'AIEngine') return null

  const { apiType = 'wasm', apiProvider = 'gemini', apiEndpoint = '', apiModel = '', gpuOnly = true, temperature = 0.7, maxTokens = 1024 } = aiSettings

  const [ollamaModels, setOllamaModels] = useState<{name: string}[]>([])
  const [isOllamaLoading, setIsOllamaLoading] = useState(false)

  /*
   * [FEAT-WEBGPU-STATE] WebGPU (WASM) 엔진 로딩 상태 및 진단 변수
   */
  const [wasmLoading, setWasmLoading] = useState(false)
  const [wasmProgressText, setWasmProgressText] = useState('')
  const [wasmLoaded, setWasmLoaded] = useState(() => WebLLMEngine.getInstance().isModelLoaded())
  const [wasmDiagnostic, setWasmDiagnostic] = useState<{ supported: boolean; message: string } | null>(null)

  const WEBGPU_CATALOG = [
    { label: 'Qwen2.5 1.5B Instruct (가장 빠름, 추천)', value: 'Qwen2.5-1.5B-Instruct-q4f16_1-MLC' },
    { label: 'Llama 3.2 1B Instruct (가벼움, 초고속)', value: 'Llama-3.2-1B-Instruct-q4f16_1-MLC' },
    { label: 'Llama 3.2 3B Instruct (정확성 우수)', value: 'Llama-3.2-3B-Instruct-q4f16_1-MLC' },
    { label: 'Gemma 2 2B IT (구글 최신)', value: 'gemma-2-2b-it-q4f16_1-MLC' },
    { label: 'SmolLM2 1.7B Instruct (최경량 코딩/챗)', value: 'SmolLM2-1.7B-Instruct-q4f16_1-MLC' },
  ] as const

  /*
   * [FIX-OLLAMA-STATE] Ollama 자동화 상태 변수 그룹
   * - ollamaInstalled: Ollama CLI 바이너리 설치 여부 (null=미확인, true=설치됨, false=미설치)
   * - ollamaServerStarting: ollama serve IPC 진행 중 플래그
   * - ollamaPulling: 현재 다운로드 중인 모델 이름 (없으면 null)
   * - ollamaPullPercent: 다운로드 진행률 (0~100)
   * - ollamaPullLog: 최신 다운로드 상태 텍스트
   */
  const [ollamaInstalled, setOllamaInstalled] = useState<boolean | null>(null)
  const [ollamaServerStarting, setOllamaServerStarting] = useState(false)
  const [ollamaPulling, setOllamaPulling] = useState<string | null>(null)
  const [installedModelNames, setInstalledModelNames] = useState<string[]>([])

  /*
   * [RUN-TIME STATE / INVARIANT]
   * - 변수 명: `downloadQueue`, `queueStatus`
   * - 자료형: string[], Record<string, { percent: number, log: string, status: 'queued' | 'downloading' }>
   * - 시나리오: 여러 개의 모델 다운로드 클릭 시 즉시 큐 대기열에 적재하고 순차적으로 풀(pull) 처리를 관리하는 시스템.
   */
  const [downloadQueue, setDownloadQueue] = useState<string[]>([])
  const [queueStatus, setQueueStatus] = useState<Record<string, { percent: number; log: string; status: 'queued' | 'downloading' }>>({})

  const queueRef = useRef<string[]>([])
  const queueStatusRef = useRef<Record<string, { percent: number; log: string; status: 'queued' | 'downloading' }>>({})

  useEffect(() => {
    queueRef.current = downloadQueue
  }, [downloadQueue])

  useEffect(() => {
    queueStatusRef.current = queueStatus
  }, [queueStatus])

  /*
   * [FEAT-OLLAMA-CATALOG] 다운로드 가능한 대표 모델 카탈로그 상수 (3종 × 3사이즈)
   * - 각 항목: { label, model, sizeMB } 형태
   * - 메인 프로세스의 ollama:pull-model IPC 채널로 다운로드를 실행한다.
   */
  const OLLAMA_CATALOG = [
    { group: 'Qwen 2.5', color: '#10b981', models: [
      { label: 'Qwen2.5 1.5B', model: 'qwen2.5:1.5b', sizeGb: '1.0GB' },
      { label: 'Qwen2.5 3B',   model: 'qwen2.5:3b',   sizeGb: '2.0GB' },
      { label: 'Qwen2.5 7B',   model: 'qwen2.5:7b',   sizeGb: '4.7GB' },
    ]},
    { group: 'Gemma 3', color: '#6366f1', models: [
      { label: 'Gemma3 1B',    model: 'gemma3:1b',    sizeGb: '0.9GB' },
      { label: 'Gemma3 2B',    model: 'gemma3:2b',    sizeGb: '1.9GB' },
      { label: 'Gemma3 8B',    model: 'gemma3:8b',    sizeGb: '5.1GB' },
    ]},
    { group: 'Llama', color: '#f59e0b', models: [
      { label: 'Llama3.2 1B',  model: 'llama3.2:1b',  sizeGb: '1.3GB' },
      { label: 'Llama3.2 3B',  model: 'llama3.2:3b',  sizeGb: '2.0GB' },
      { label: 'Llama3.1 8B',  model: 'llama3.1:8b',  sizeGb: '5.0GB' },
    ]},
  ] as const

  // WPU(CPU/GPU) 환경 자동 진단 및 싱글톤 로드 상태 실시간 매핑
  useEffect(() => {
    if (apiType === 'wasm') {
      WebLLMEngine.getInstance().checkWebGPUSupport().then(res => {
        setWasmDiagnostic(res)
      })
      
      /*
       * [SIDE EFFECT / POLLING]
       * - 싱글톤인 WebLLMEngine/WebCPUEngine의 로딩 상태는 React 생명주기 외부에서 비동기로 완료됩니다.
       * - 따라서 0.5초 주기로 실제 로드 여부 및 현재 활성화된 모델 ID와 프리셋 매칭을 감시하여 배지를 실시간 동기화합니다.
       */
      const interval = setInterval(() => {
        const engine = gpuOnly ? WebLLMEngine.getInstance() : WebCPUEngine.getInstance()
        const engineLoaded = engine.isModelLoaded()
        const currentId = engine.getCurrentModelId()
        setWasmLoaded(engineLoaded && currentId === apiModel)
      }, 500)

      return () => clearInterval(interval)
    }
  }, [apiType, apiModel, gpuOnly])

  /**
   * [FEAT-WEBGPU-INIT] WebGPU 온디바이스 모델을 브라우저 캐시에 수동 로드/다운로드하는 핸들러
   */
  const handleLoadWebGPUModel = async (modelIdToLoad: string) => {
    setWasmLoading(true)
    setWasmProgressText('초기화 준비 중...')
    try {
      const success = gpuOnly
        ? await WebLLMEngine.getInstance().initModel(modelIdToLoad, (report) => {
            setWasmProgressText(report.text)
          })
        : await WebCPUEngine.getInstance().initModel(modelIdToLoad, (report) => {
            setWasmProgressText(report.text)
          })

      if (success) {
        setWasmLoaded(true)
        onUpdateAISettings({ apiModel: modelIdToLoad })
      }
    } catch (e: unknown) {
      /*
       * [ERROR HANDLING - EXCEPTION LOGGING]
       * - WPU 모델 다운로드/초기화 실패 시 에러 메시지를 로그로 기록하고 UI에 상태를 전파한다.
       * - e.message 접근 전 instanceof Error 타입 가드로 안전하게 메시지를 추출한다.
       */
      const errorMsg = e instanceof Error ? e.message : String(e)
      console.error('[SettingsTabAIEngine] WPU 모델 로딩 실패:', errorMsg)
      setWasmProgressText(`로딩 실패: ${errorMsg}`)
    } finally {
      setWasmLoading(false)
    }
  }

  // 📥 [FEAT-OLLAMA-QUEUE] 다운로드 대기열 순차 처리기
  const triggerNextQueueDownload = useCallback(async () => {
    const currentQueue = queueRef.current
    if (currentQueue.length === 0) return

    const nextModel = currentQueue[0]
    
    // 현재 진행 중인 다운로드 활성화
    setOllamaPulling(nextModel)

    setQueueStatus(prev => ({
      ...prev,
      [nextModel]: { percent: 0, log: '다운로드 준비 중...', status: 'downloading' }
    }))

    const eAPI = (window as Window & { electronAPI?: { pullOllamaModel?: (model: string) => Promise<{ success: boolean; error?: string }> } }).electronAPI
    if (!eAPI?.pullOllamaModel) {
      setOllamaPulling(null)
      return
    }

    try {
      const res = await eAPI.pullOllamaModel(nextModel)
      if (res.success) {
        // 다운로드 완료 시 1초 후 대기열에서 제거하고 목록 갱신 및 후속 다운로드 트리거
        setTimeout(async () => {
          setDownloadQueue(prev => prev.filter(m => m !== nextModel))
          setQueueStatus(prev => {
            const nextMap = { ...prev }
            delete nextMap[nextModel]
            return nextMap
          })
          setOllamaPulling(null)

          // 모델 목록 갱신
          try {
            const tagsRes = await fetch('http://127.0.0.1:11434/api/tags')
            if (tagsRes.ok) {
              const tagsData = await tagsRes.json()
              if (tagsData.models) {
                setOllamaModels(tagsData.models)
                setInstalledModelNames(tagsData.models.map((m: any) => m.name))
              }
            }
          } catch (err) {
            console.error('모델 목록 자동 갱신 실패:', err)
          }

          // 재귀적 다음 다운로드 스케줄링
          setTimeout(() => {
            triggerNextQueueDownload()
          }, 100)
        }, 1000)
      } else {
        console.error('[OllamaDownload] 실패:', res.error)
        handleQueueFailure(nextModel)
      }
    } catch (e) {
      console.error('[OllamaDownload] 예외:', e)
      handleQueueFailure(nextModel)
    }
  }, [])

  // 다운로드 중 오류 발생 시의 예외 대기열 건너뛰기
  const handleQueueFailure = (model: string) => {
    setDownloadQueue(prev => prev.filter(m => m !== model))
    setQueueStatus(prev => {
      const nextMap = { ...prev }
      delete nextMap[model]
      return nextMap
    })
    setOllamaPulling(null)

    // 실패하더라도 멈추지 않고 대기열 내 다음 모델로 진행
    setTimeout(() => {
      triggerNextQueueDownload()
    }, 500)
  }

  // 📥 [FEAT-OLLAMA-QUEUE] 사용자의 다운로드 버튼 클릭 시 대기열에 적재
  const handleAddToDownloadQueue = useCallback((model: string) => {
    if (installedModelNames.includes(model) || queueRef.current.includes(model)) {
      return
    }

    setDownloadQueue(prev => {
      const nextQueue = [...prev, model]
      
      setQueueStatus(qs => ({
        ...qs,
        [model]: { percent: 0, log: '대기열 등록 완료 (대기 중...)', status: 'queued' }
      }))

      // 현재 다운로드 중인 모델이 없다면 즉시 트리거 개시
      if (!ollamaPulling) {
        setTimeout(() => {
          triggerNextQueueDownload()
        }, 50)
      }

      return nextQueue
    })
  }, [installedModelNames, ollamaPulling, triggerNextQueueDownload])

  // apiType이 ollama로 진입할 때 설치 여부 자동 체크 및 모델 목록 조회
  useEffect(() => {
    if (apiType === 'ollama') {
      setIsOllamaLoading(true)

      /*
       * [FIX-OLLAMA-CHECK] 설치 여부를 IPC로 확인한다.
       * - checkOllamaInstalled() 미지원 환경(웹 등)이면 기존 fetch 방식을 폴백으로 사용한다.
       */
      const api = (window as Window & { electronAPI?: {
        checkOllamaInstalled?: () => Promise<{ installed: boolean }>
        startOllamaServer?: () => Promise<{ success: boolean; pending?: boolean }>
        pullOllamaModel?: (model: string) => Promise<{ success: boolean; error?: string }>
        onOllamaPullProgress?: (cb: (d: { modelName: string; percent: number; text: string }) => void) => () => void
      }}).electronAPI

      if (api?.checkOllamaInstalled) {
        api.checkOllamaInstalled()
          .then(res => setOllamaInstalled(res.installed))
          .catch(() => setOllamaInstalled(false))
      }

      // Ollama API에서 직접 모델 목록을 취득한다.
      fetch('http://127.0.0.1:11434/api/tags')
        .then(res => res.json())
        .then(data => {
          if (data.models && Array.isArray(data.models)) {
            setOllamaModels(data.models)
            setInstalledModelNames((data.models as { name: string }[]).map(m => m.name))
            if (!apiModel && data.models.length > 0) {
              onUpdateAISettings({ apiModel: (data.models as { name: string }[])[0].name })
            }
          }
        })
        .catch(err => {
          console.error('Ollama 모델 목록을 가져오는데 실패했습니다:', err)
          setOllamaModels([])
        })
        .finally(() => setIsOllamaLoading(false))

      // pull 진행률 구독 등록
      if (api?.onOllamaPullProgress) {
        const unsub = api.onOllamaPullProgress((d) => {


          // 대기열 세부 맵 정보 실시간 업데이트
          setQueueStatus(prev => {
            if (prev[d.modelName]) {
              return {
                ...prev,
                [d.modelName]: {
                  ...prev[d.modelName],
                  percent: d.percent,
                  log: d.text,
                  status: 'downloading'
                }
              }
            }
            return prev
          })
        })
        return unsub
      }
    }
  }, [apiType, triggerNextQueueDownload])

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
            <option value="wasm">로컬 웹LM 가속 (무설치, CPU/GPU)</option>
            <option value="local">로컬 고성능 엔진 (llama-cli)</option>
            <option value="ollama">로컬 백그라운드 서비스 (Ollama)</option>
            <option value="api">클라우드 외부 API (OpenAI 등)</option>
          </select>
          <p style={{ fontSize: '9.5px', color: 'var(--text-muted)', margin: 0 }}>
            {apiType === 'wasm' && '웹LM 모드를 사용하면 브라우저 내부에서 안전하게 로컬 모델(CPU/GPU)이 실행됩니다.'}
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

      {/* 1.5 WPU 온디바이스 설정 */}
      {apiType === 'wasm' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '12px', background: 'rgba(168, 85, 247, 0.03)', border: '1px solid rgba(168, 85, 247, 0.2)', borderRadius: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Cpu size={14} color="#a855f7" />
            <h4 style={{ fontSize: '11.5px', fontWeight: 700, margin: 0, color: '#a855f7' }}>
              {gpuOnly ? '웹LM (WebGPU 가속) 온디바이스 AI (@mlc-ai/web-llm)' : '웹LM (Wasm CPU) 온디바이스 AI (폴백 런타임)'}
            </h4>
            <span style={{ marginLeft: 'auto', fontSize: '9.5px', padding: '2px 8px', borderRadius: '99px',
              background: wasmLoaded ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)',
              color: wasmLoaded ? '#10b981' : '#f59e0b', fontWeight: 700 }}>
              {wasmLoaded ? (gpuOnly ? '⚡ GPU 캐시 로드됨 (준비 완료)' : '🟢 CPU Wasm 가동 중 (준비 완료)') : '⏳ 미초기화 / 다운로드 필요'}
            </span>
          </div>

          {gpuOnly && wasmDiagnostic && (
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center', background: wasmDiagnostic.supported ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)', padding: '8px 10px', borderRadius: '6px', border: `1px solid ${wasmDiagnostic.supported ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}` }}>
              {wasmDiagnostic.supported ? <CheckCircle2 size={14} color="#10b981" /> : <AlertCircle size={14} color="#ef4444" />}
              <div style={{ fontSize: '10px', color: 'var(--text-main)', lineHeight: '1.4' }}>
                <strong style={{ display: 'block', color: wasmDiagnostic.supported ? '#10b981' : '#ef4444' }}>
                  {wasmDiagnostic.supported ? '웹LM (WebGPU 가속) 사용 가능' : '웹LM (WebGPU) 진단 알림'}
                </strong>
                <span>{wasmDiagnostic.message}</span>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ fontSize: '10.5px', fontWeight: 600, color: 'var(--text-main)' }}>웹LM 온디바이스 모델 프리셋 선택</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <select
                value={WEBGPU_CATALOG.some(m => m.value === apiModel) ? apiModel : WEBGPU_CATALOG[0].value}
                onChange={e => {
                  onUpdateAISettings({ apiModel: e.target.value })
                  const engine = gpuOnly ? WebLLMEngine.getInstance() : WebCPUEngine.getInstance()
                  setWasmLoaded(engine.isModelLoaded() && engine.getCurrentModelId() === e.target.value)
                }}
                disabled={wasmLoading}
                style={{
                  flex: 1, padding: '8px 10px', borderRadius: '6px',
                  background: 'var(--bg-glass)', border: '1px solid var(--border-muted)',
                  color: 'var(--text-main)', fontSize: '11px', outline: 'none'
                }}
              >
                {WEBGPU_CATALOG.map(m => (
                  <option key={m.value} value={m.value}>{m.label} ({m.value})</option>
                ))}
              </select>

              <button
                type="button"
                onClick={() => {
                  const modelToLoad = WEBGPU_CATALOG.some(m => m.value === apiModel) ? apiModel : WEBGPU_CATALOG[0].value
                  handleLoadWebGPUModel(modelToLoad)
                }}
                disabled={wasmLoading || (gpuOnly && !wasmDiagnostic?.supported)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '4px',
                  padding: '0 12px', borderRadius: '6px', fontSize: '11px', fontWeight: 600,
                  background: wasmLoading ? 'var(--border-muted)' : '#a855f7',
                  color: '#fff', border: 'none', cursor: wasmLoading ? 'not-allowed' : 'pointer',
                  whiteSpace: 'nowrap', transition: 'all 0.15s'
                }}
              >
                <HardDriveDownload size={13} />
                {wasmLoading ? '초기화 중...' : (wasmLoaded ? '다시 로드' : '모델 다운로드/로드')}
              </button>
            </div>
          </div>

          {wasmProgressText && (
            <div style={{ padding: '8px 10px', background: 'rgba(255,255,255,0.03)', borderRadius: '6px', border: '1px solid var(--border-muted)' }}>
              <div style={{ fontSize: '10px', color: '#a855f7', fontWeight: 600, marginBottom: '2px' }}>
                {wasmLoading ? '🔄 처리 중...' : 'ℹ️ 최근 로딩 상태'}
              </div>
              <div style={{ fontSize: '9.5px', color: 'var(--text-muted)', fontFamily: 'monospace', wordBreak: 'break-all' }}>
                {wasmProgressText}
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: '6px', alignItems: 'flex-start', background: 'rgba(255,255,255,0.02)', padding: '10px', borderRadius: '6px' }}>
            <Shield size={14} color="var(--text-muted)" style={{ marginTop: '2px', flexShrink: 0 }} />
            <p style={{ margin: 0, fontSize: '9.5px', color: 'var(--text-muted)', lineHeight: '1.4' }}>
              <strong>100% 완전 독립 작동:</strong> Llama.cpp 네이티브 바이너리나 Ollama 서버가 필요하지 않으며,
              그래픽 카드의 VRAM 및 셰이더를 사용하여 브라우저 렌더러 내부에서 독립 추론합니다. 다운로드된 모델은 브라우저 Cache Storage에 안전하게 보관됩니다.
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
            {/* 설치 여부 배지 */}
            {ollamaInstalled !== null && (
              <span style={{ marginLeft: 'auto', fontSize: '9.5px', padding: '2px 8px', borderRadius: '99px',
                background: ollamaInstalled ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
                color: ollamaInstalled ? '#10b981' : '#ef4444', fontWeight: 700 }}>
                {ollamaInstalled ? '✅ 설치됨' : '❌ 미설치'}
              </span>
            )}
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
                    const data = await res.json() as { models?: { name: string }[] }
                    if (data.models) {
                      setOllamaModels(data.models)
                      setInstalledModelNames(data.models.map(m => m.name))
                    }
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

            {/* Ollama 서버가 꺼져있을 때: 스마트 자동 시작 버튼 */}
            {ollamaModels.length === 0 && !isOllamaLoading && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '10px', background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '6px' }}>
                <p style={{ margin: 0, fontSize: '10px', color: '#ef4444', fontWeight: 600 }}>
                  ⚠️ Ollama 서버가 응답하지 않습니다.
                </p>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {/*
                   * [FIX-OLLAMA-START] executeTerminal 대신 startOllamaServer IPC를 직접 호출한다.
                   * - 기존 executeTerminal('ollama serve')는 해당 IPC 채널이 차단(blocking) 실행이어서
                   *   Electron 렌더러에서 응답을 받지 못하고 무한 대기하는 버그가 있었다.
                   * - startOllamaServer()는 detached spawn으로 비동기 기동하고 헬스체크 결과를 반환한다.
                   */}
                  <button
                    disabled={ollamaServerStarting}
                    onClick={async () => {
                      setOllamaServerStarting(true)
                      try {
                        const eAPI = (window as Window & { electronAPI?: { startOllamaServer?: () => Promise<{ success: boolean }> } }).electronAPI
                        if (eAPI?.startOllamaServer) {
                          await eAPI.startOllamaServer()
                        }
                        // 기동 후 모델 목록 재조회
                        const res = await fetch((apiEndpoint || 'http://127.0.0.1:11434') + '/api/tags')
                        if (res.ok) {
                          const data = await res.json() as { models?: { name: string }[] }
                          if (data.models) {
                            setOllamaModels(data.models)
                            setInstalledModelNames(data.models.map(m => m.name))
                          }
                        }
                      } catch (e) {
                        console.error('Ollama 서버 시작 실패:', e)
                      } finally {
                        setOllamaServerStarting(false)
                      }
                    }}
                    style={{
                      padding: '6px 12px', background: 'rgba(59,130,246,0.15)',
                      border: '1px solid rgba(59,130,246,0.4)', borderRadius: '6px',
                      color: ollamaServerStarting ? 'var(--text-muted)' : '#3b82f6',
                      fontSize: '10.5px', cursor: ollamaServerStarting ? 'not-allowed' : 'pointer', fontWeight: 600
                    }}
                  >
                    {ollamaServerStarting ? '⏳ 기동 중...' : '▶ Ollama 서버 자동 시작'}
                  </button>
                  <p style={{ margin: 'auto 0', fontSize: '9.5px', color: 'var(--text-muted)' }}>
                    또는 터미널에서 <code>ollama serve</code>를 실행하세요.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* 모델 카탈로그 다운로드 카드 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', borderTop: '1px solid var(--border-muted)', paddingTop: '10px' }}>
              <span style={{ fontSize: '10.5px', fontWeight: 700, color: 'var(--text-main)' }}>📦 모델 카탈로그 — 원클릭 다운로드</span>
            </div>

            {/* 다운로드 진행 바 대기열 현황판 (대기열에 한 개 이상 모델이 존재할 때 표시) */}
            {downloadQueue.length > 0 && (
              <div style={{ padding: '10px 12px', background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.25)', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <span style={{ fontSize: '10.5px', color: '#6366f1', fontWeight: 700 }}>
                  📥 모델 다운로드 대기열 관리 ({downloadQueue.length}개 모델)
                </span>
                
                {downloadQueue.map((qModel, idx) => {
                  const info = queueStatus[qModel]
                  const isCurrent = qModel === ollamaPulling
                  const percent = info ? info.percent : 0
                  const logText = info ? info.log : '대기 중...'
                  
                  return (
                    <div key={qModel} style={{ padding: '6px 8px', background: isCurrent ? 'rgba(99,102,241,0.08)' : 'rgba(255,255,255,0.02)', border: `1px solid ${isCurrent ? 'rgba(99,102,241,0.3)' : 'var(--border-muted)'}`, borderRadius: '6px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                        <span style={{ fontSize: '10px', color: isCurrent ? '#818cf8' : 'var(--text-muted)', fontWeight: isCurrent ? 700 : 500 }}>
                          {idx + 1}. {isCurrent ? '▶ 다운로드 중' : '⏳ 대기 중'}: {qModel}
                        </span>
                        <span style={{ fontSize: '10px', color: isCurrent ? '#818cf8' : 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                          {percent}%
                        </span>
                      </div>
                      
                      {isCurrent && (
                        <>
                          <div style={{ height: '3px', background: 'rgba(255,255,255,0.1)', borderRadius: '99px', overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${percent}%`, background: '#6366f1', borderRadius: '99px', transition: 'width 0.3s ease' }} />
                          </div>
                          {logText && (
                            <p style={{ margin: '4px 0 0', fontSize: '9px', color: 'var(--text-muted)', fontFamily: 'monospace', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {logText}
                            </p>
                          )}
                        </>
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            {OLLAMA_CATALOG.map(group => (
              <div key={group.group} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ fontSize: '9.5px', fontWeight: 700, color: group.color, letterSpacing: '0.04em', textTransform: 'uppercase' }}>{group.group}</span>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {group.models.map(m => {
                    const isInstalled = installedModelNames.includes(m.model)
                    const isQueued = downloadQueue.includes(m.model) && ollamaPulling !== m.model
                    const isPulling = ollamaPulling === m.model
                    const statusInfo = queueStatus[m.model]
                    const percent = statusInfo ? statusInfo.percent : 0
                    
                    const isDisabled = isInstalled || isQueued || isPulling

                    let buttonLabel = `⬇ ${m.label} (${m.sizeGb})`
                    if (isInstalled) {
                      buttonLabel = `✅ ${m.label}`
                    } else if (isQueued) {
                      buttonLabel = `⏳ 대기 중 (${m.label})`
                    } else if (isPulling) {
                      buttonLabel = `⬇️ 다운로드 중 ${percent}% (${m.label})`
                    }

                    return (
                      <button
                        key={m.model}
                        disabled={isDisabled}
                        onClick={() => handleAddToDownloadQueue(m.model)}
                        style={{
                          padding: '5px 10px', borderRadius: '6px', fontSize: '10px', fontWeight: 600, 
                          cursor: isDisabled ? 'not-allowed' : 'pointer',
                          background: isInstalled 
                            ? 'rgba(16,185,129,0.12)' 
                            : isQueued 
                              ? 'rgba(245,158,11,0.08)' 
                              : isPulling 
                                ? 'rgba(99,102,241,0.2)' 
                                : 'rgba(255,255,255,0.04)',
                          border: `1px solid ${
                            isInstalled 
                              ? 'rgba(16,185,129,0.4)' 
                              : isQueued 
                                ? 'rgba(245,158,11,0.35)' 
                                : isPulling 
                                  ? 'rgba(99,102,241,0.5)' 
                                  : 'var(--border-muted)'
                          }`,
                          color: isInstalled 
                            ? '#10b981' 
                            : isQueued 
                              ? '#f59e0b' 
                              : isPulling 
                                ? '#6366f1' 
                                : 'var(--text-main)',
                          transition: 'all 0.15s'
                        }}
                      >
                        {buttonLabel}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: '6px', alignItems: 'flex-start', background: 'rgba(255,255,255,0.02)', padding: '10px', borderRadius: '6px' }}>
            <ExternalLink size={14} color="var(--text-muted)" style={{ marginTop: '2px', flexShrink: 0 }} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <p style={{ margin: 0, fontSize: '9.5px', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                추가 모델은 Ollama 공식 라이브러리에서 검색할 수 있습니다.
              </p>
              <a href="https://ollama.com/library" target="_blank" rel="noreferrer" style={{ fontSize: '9.5px', color: '#3b82f6', textDecoration: 'none' }}>
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

