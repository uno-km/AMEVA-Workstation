/**
 * @file AIStatusIndicator.tsx
 * @system AMEVA OS Desktop Workstation
 * @location src/renderer/components/statusbar/AIStatusIndicator.tsx
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
import * as ipc from '../../services/ipc/electronApiAdapter'

interface AIStatusIndicatorProps {
  aiSettings: any
  aiAvailable: boolean
  activeTooltip: string | null
  handleMouseEnter: (id: string) => void
  handleMouseLeave: () => void
  tooltipStyle: React.CSSProperties
}

  /*
   * [FUNCTION CONTRACT]
   * - 함수 명: `AIStatusIndicator`
   * - 역할: 인자 정보를 검수하고 비즈니스 계약 조건에 맞춰 최종 바인딩 결과물/바이너리 버퍼를 반환함.
   * - 예시: `AIStatusIndicator(...)` 호출 시 런타임 비동기/동기 연쇄 반응 유도.
   */
export function AIStatusIndicator({
  aiSettings,
  aiAvailable,
  activeTooltip,
  handleMouseEnter,
  handleMouseLeave,
  tooltipStyle
}: AIStatusIndicatorProps) {
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `!aiSettings`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (!aiSettings)` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
  if (!aiSettings) return null
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `type`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const type = ...` 형태로 안전 캐싱 후 가공 기동.
       */
  const type = aiSettings.apiType || 'local'
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `label`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const label = ...` 형태로 안전 캐싱 후 가공 기동.
       */
  let label = 'LMA'
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `detail`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const detail = ...` 형태로 안전 캐싱 후 가공 기동.
       */
  let detail = '로컬 온디바이스 llama.cpp 에이전트'
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `portInfo`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const portInfo = ...` 형태로 안전 캐싱 후 가공 기동.
       */
  let portInfo = '포트: 3010 (로컬)'
  
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `type === 'ollama'`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (type === 'ollama')` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
  if (type === 'ollama') {
    label = 'OLM'
    detail = '로컬 Ollama 에이전트 연동'
    portInfo = '포트: 11434 (로컬)'
  } else if (type === 'api') {
    label = 'API'
    detail = '클라우드 LLM API 게이트웨이 연동'
    portInfo = '외부 HTTPS (API Key)'
  } else if (type === 'wasm') {
    label = 'WGU'
    detail = '브라우저 내부 WebAssembly (Wasm) 실행'
    portInfo = '포트 없음 (클라이언트 구동)'
  }

      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `modelName`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const modelName = ...` 형태로 안전 캐싱 후 가공 기동.
       */
  const modelName = aiSettings.modelPath ? aiSettings.modelPath.split(/[\\/]/).pop() : '지정되지 않음'
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `statusColor`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const statusColor = ...` 형태로 안전 캐싱 후 가공 기동.
       */
  const statusColor = aiAvailable ? '#10b981' : '#f87171'

  return (
    <div 
      style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: '6px', 
        cursor: 'help',
        background: 'rgba(255, 255, 255, 0.03)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: '4px',
        padding: '2px 8px',
        height: '20px',
        position: 'relative'
      }}
      onMouseEnter={() => handleMouseEnter('ai')}
      onMouseLeave={handleMouseLeave}
    >
      <div
        style={{
          width: '6px',
          height: '6px',
          borderRadius: '50%',
          backgroundColor: statusColor,
          boxShadow: aiAvailable ? '0 0 5px #10b981' : '0 0 5px #f87171',
        }}
      />
      <strong style={{ fontSize: '10px', color: aiAvailable ? 'var(--text-main)' : 'var(--text-muted)' }}>
        {label}
      </strong>

      {/* 👑 커스텀 글래스모피즘 AI 툴팁 */}
      {activeTooltip === 'ai' && (
        <div 
          style={{ ...tooltipStyle, width: '280px', right: 0 }}
          onMouseEnter={() => handleMouseEnter('ai')}
          onMouseLeave={handleMouseLeave}
        >
          <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--primary)', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '4px', marginBottom: '4px' }}>
            🤖 AI 에이전트 인스턴스 사양
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', fontSize: '10px' }}>
            <div><strong>구동 방식:</strong> <span style={{ color: 'var(--secondary)' }}>{detail}</span></div>
            <div><strong>접속 주소:</strong> <span style={{ color: 'var(--text-muted)' }}>{portInfo}</span></div>
            <div><strong>사용 모델:</strong> <span style={{ color: 'var(--text-main)' }}>{modelName}</span></div>
            <div style={{ marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <strong>상태:</strong> 
                <span style={{ 
                  color: aiAvailable ? '#34d399' : '#f87171', 
                  fontSize: '9.5px', fontWeight: 700, 
                  background: aiAvailable ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                  padding: '1px 5px', borderRadius: '3px'
                }}>
                  {aiAvailable ? 'ACTIVE' : 'OFFLINE'}
                </span>
              </div>
              
              {/* 🤖 오프라인 시 재구동(Restart) 버튼 노출 */}
              {!aiAvailable && type !== 'api' && type !== 'wasm' && (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `type === 'ollama'`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (type === 'ollama')` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
                    if (type === 'ollama') {
                      ipc.llmAddLog({ text: '[System] Ollama 서버 상태를 확인합니다 (Ping)...', prefix: 'System' })
                      fetch(aiSettings?.apiEndpoint || 'http://localhost:11434/api/tags')
                        .then(() => ipc.llmAddLog({ text: '[System] Ollama 서버 응답 정상.', prefix: 'System' }))
                        .catch(err => ipc.llmAddLog({ text: `[Error] Ollama 연결 실패: ${err.message}`, prefix: 'System' }))
                      return
                    }
                    ipc.llmAddLog({ text: '[System] 재구동 요청을 메인 프로세스로 전송합니다...', prefix: 'System' })
                    ipc.llmRestart().then((res: any) => {
                      ipc.llmAddLog({ 
                        text: res.success ? '[System] 수동 재구동(웜업) 완료.' : `[Error] 재구동 실패: ${res.error}`,
                        prefix: 'System'
                      })
                    }).catch((err: any) => {
                      ipc.llmAddLog({ 
                        text: `[Error] 재구동 프로세스 예외 발생: ${err.message || String(err)}`,
                        prefix: 'System'
                      })
                    })
                  }}
                  style={{
                    background: 'rgba(239,68,68,0.2)',
                    border: '1px solid rgba(239,68,68,0.4)',
                    color: '#f87171',
                    borderRadius: '4px',
                    padding: '2px 6px',
                    fontSize: '9px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '3px'
                  }}
                >
                  ↻ 서버 재구동
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

