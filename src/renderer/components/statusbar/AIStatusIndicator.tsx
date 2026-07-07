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

export function AIStatusIndicator({
  aiSettings,
  aiAvailable,
  activeTooltip,
  handleMouseEnter,
  handleMouseLeave,
  tooltipStyle
}: AIStatusIndicatorProps) {
  if (!aiSettings) return null
  const type = aiSettings.apiType || 'local'
  let label = 'LMA'
  let detail = '로컬 온디바이스 llama.cpp 에이전트'
  let portInfo = '포트: 3010 (로컬)'
  
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

  const modelName = aiSettings.modelPath ? aiSettings.modelPath.split(/[\\/]/).pop() : '지정되지 않음'
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
              {!aiAvailable && type !== 'api' && (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
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
