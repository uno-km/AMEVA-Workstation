import React, { useState, useEffect, useRef } from 'react'
import { Settings, ZoomIn, Info, Check, WrapText, AlertTriangle } from 'lucide-react'
import type { PeerState } from '../../shared/types'
import { MCPClientManager } from '../utils/mcpClient' // [FIX-MCP-UI] MCP 도구 페치를 위함

interface StatusBarProps {
  filePath: string | null
  currentContent: string
  zoomLevel: number
  browserZoom?: number   // webFrame 사이드바 줌 (1.0 = 100%)
  peers: PeerState[]
  serverRunning: boolean
  wordWrap: boolean
  onToggleWordWrap: () => void
  onOpenSettings: () => void
  downloadStatus?: any
  isDirty?: boolean
  lastSavedTime?: Date | null
  aiSettings?: any
  aiAvailable?: boolean
  mcpServers?: any[] // [FIX-MCP-UI] MCP 설정 주입
  isProPlan?: boolean
}

export function StatusBar({
  filePath,
  currentContent,
  zoomLevel,
  browserZoom = 1.0,
  peers,
  serverRunning,
  wordWrap,
  onToggleWordWrap,
  onOpenSettings,
  downloadStatus,
  isDirty = false,
  lastSavedTime = null,
  aiSettings,
  aiAvailable = false,
  mcpServers,
  isProPlan = false,
}: StatusBarProps) {
  // 🦾 커스텀 툴팁 상태 관리
  const [activeTooltip, setActiveTooltip] = useState<string | null>(null)
  const tooltipTimerRef = useRef<any>(null)

  const handleMouseEnter = (id: string) => {
    if (tooltipTimerRef.current) clearTimeout(tooltipTimerRef.current)
    setActiveTooltip(id)
  }

  const handleMouseLeave = () => {
    tooltipTimerRef.current = setTimeout(() => {
      setActiveTooltip(null)
    }, 250)
  }

  const [mcpTools, setMcpTools] = useState<any[]>([])
  const [isLoadingTools, setIsLoadingTools] = useState(false)
  // 글자 수, 단어 수, 줄 수 계산
  const charCount = currentContent.length
  const wordCount = currentContent.trim() ? currentContent.trim().split(/\s+/).length : 0
  const lineCount = currentContent ? currentContent.split('\n').length : 0

  // MCP 서버 제공 툴 목록 로드
  useEffect(() => {
    const loadTools = async () => {
      setIsLoadingTools(true)
      try {
        const tools = await MCPClientManager.fetchAllTools()
        setMcpTools(tools)
      } catch (e) {
        console.warn('[StatusBar] MCP 도구 명세 수집 실패:', e)
      } finally {
        setIsLoadingTools(false)
      }
    }
    if (isProPlan && mcpServers && mcpServers.length > 0) {
      loadTools()
    } else {
      setMcpTools([])
    }
  }, [mcpServers, isProPlan])

  // 공통 커스텀 툴팁 스타일 (글래스모피즘 + 섀도우)
  const tooltipStyle: React.CSSProperties = {
    position: 'absolute',
    bottom: '32px',
    background: 'rgba(15, 15, 20, 0.88)',
    backdropFilter: 'blur(14px)',
    border: '1px solid rgba(139, 92, 246, 0.35)',
    boxShadow: '0 10px 30px rgba(0,0,0,0.65), inset 0 1px 1px rgba(255,255,255,0.05)',
    borderRadius: '8px',
    padding: '12px 14px',
    zIndex: 9999,
    pointerEvents: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    textAlign: 'left',
    color: 'var(--text-main)',
    fontFamily: 'var(--font-sans)',
  }
  
  // zoomLevel은 이제 CSS zoom 배율 (1.0 = 100%, 0.5 = 50%, 2.0 = 200%)
  const zoomPercent = Math.round(zoomLevel * 100)

  // 최근 저장 시간 포맷
  const formatSavedTime = (date: Date | null) => {
    if (!date) return '최근 저장 시간 기록 없음 (새 문서)'
    const yyyy = date.getFullYear()
    const mm = String(date.getMonth() + 1).padStart(2, '0')
    const dd = String(date.getDate()).padStart(2, '0')
    const hh = String(date.getHours()).padStart(2, '0')
    const min = String(date.getMinutes()).padStart(2, '0')
    const ss = String(date.getSeconds()).padStart(2, '0')
    return `최근 저장 시간: ${yyyy}-${mm}-${dd} ${hh}:${min}:${ss}`
  }

  // 에이전트 서버 상태 뱃지 생성
  const getAgentServerBadge = () => {
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
                      if (window.electronAPI?.llmRestart) {
                        if (window.electronAPI?.llmAddLog) {
                          window.electronAPI.llmAddLog({ text: '[System] 재구동 요청을 메인 프로세스로 전송합니다...', prefix: 'System' })
                        }
                        window.electronAPI.llmRestart().then(res => {
                          if (window.electronAPI?.llmAddLog) {
                            window.electronAPI.llmAddLog({ 
                              text: res.success ? '[System] 수동 재구동(웜업) 완료.' : `[Error] 재구동 실패: ${res.error}`,
                              prefix: 'System'
                            })
                          }
                        }).catch(err => {
                          if (window.electronAPI?.llmAddLog) {
                            window.electronAPI.llmAddLog({ 
                              text: `[Error] 재구동 프로세스 예외 발생: ${err.message || String(err)}`,
                              prefix: 'System'
                            })
                          }
                        })
                      }
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

  // 🤖 MCP 상태 뱃지 생성
  const getMCPStatusBadge = () => {
    if (!isProPlan || !mcpServers || mcpServers.length === 0) return null
    const activeServers = mcpServers.filter(s => s.enabled)
    const hasActive = activeServers.length > 0
    const statusColor = hasActive ? '#10b981' : '#f87171'
    
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
        onMouseEnter={() => handleMouseEnter('mcp')}
        onMouseLeave={handleMouseLeave}
      >
        <div
          style={{
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            backgroundColor: statusColor,
            boxShadow: hasActive ? '0 0 5px #10b981' : '0 0 5px #f87171',
          }}
        />
        <strong style={{ fontSize: '10px', color: hasActive ? 'var(--text-main)' : 'var(--text-muted)' }}>
          MCP ({activeServers.length}/{mcpServers.length})
        </strong>

        {/* 👑 커스텀 글래스모피즘 MCP 툴팁 (도구 명세 연동형) */}
        {activeTooltip === 'mcp' && (
          <div 
            style={{ ...tooltipStyle, width: '340px', right: 0 }}
            onMouseEnter={() => handleMouseEnter('mcp')}
            onMouseLeave={handleMouseLeave}
          >
            <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--primary)', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '4px', marginBottom: '4px' }}>
              🔌 AMEVA MCP 통합 게이트웨이
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {mcpServers.map(s => {
                const serverTools = mcpTools.filter(t => t.serverId === s.id)
                return (
                  <div key={s.id} style={{ display: 'flex', flexDirection: 'column', gap: '3px', fontSize: '10.5px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontWeight: 700 }}>
                      <span style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: s.enabled ? '#10b981' : 'var(--text-muted)' }} />
                      <span style={{ color: '#fff' }}>{s.name}</span>
                      <span style={{ fontSize: '8px', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.03)', padding: '1px 3px', borderRadius: '2px' }}>
                        {s.type.toUpperCase()}
                      </span>
                    </div>
                    {s.enabled ? (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', paddingLeft: '10px', marginTop: '2px' }}>
                        {isLoadingTools ? (
                          <span style={{ fontSize: '8.5px', color: 'var(--text-muted)' }}>로딩 중... 🔄</span>
                        ) : serverTools.length === 0 ? (
                          <span style={{ fontSize: '8.5px', color: 'var(--text-muted)' }}>제공 도구 없음</span>
                        ) : (
                          serverTools.map(t => (
                            <span 
                              key={t.name}
                              style={{ 
                                fontSize: '8.5px', 
                                color: 'var(--secondary)', 
                                background: 'rgba(6, 182, 212, 0.08)',
                                border: '1px solid rgba(6, 182, 212, 0.15)',
                                padding: '1px 5px',
                                borderRadius: '3px',
                                fontFamily: 'monospace'
                              }}
                            >
                              🛠️ {t.name}
                            </span>
                          ))
                        )}
                      </div>
                    ) : (
                      <div style={{ fontSize: '8.5px', color: 'var(--text-muted)', paddingLeft: '10px' }}>
                        비활성화 상태
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div
      className="glass-panel"
      style={{
        height: '28px',
        width: '100%',
        borderTop: '1px solid var(--border-muted)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 16px',
        backgroundColor: 'rgba(5, 5, 10, 0.5)',
        zIndex: 101,
        userSelect: 'none',
      }}
    >
      {/* 1. 파일 상태 정보 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <Info size={12} style={{ color: 'var(--primary)' }} />
          <span style={{ textOverflow: 'ellipsis', whiteSpace: 'nowrap', overflow: 'hidden', maxWidth: '260px' }}>
            {filePath ? filePath.split(/[\\/]/).pop() : '무제 문서.md'}
          </span>
        </div>
        <div style={{ width: '1px', height: '12px', backgroundColor: 'var(--border-muted)' }} />
        {isDirty ? (
          <span 
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '4px', 
              color: '#fb923c', // 주황색 계열 (수정 중)
              cursor: 'help',
              fontWeight: 600,
              fontSize: '11px',
              position: 'relative'
            }}
            onMouseEnter={() => setActiveTooltip('save')}
            onMouseLeave={() => setActiveTooltip(null)}
          >
            <AlertTriangle size={11} style={{ color: '#fb923c' }} /> 저장되지 않음

            {activeTooltip === 'save' && (
              <div style={{ ...tooltipStyle, width: '280px', left: 0 }}>
                <div style={{ fontSize: '11px', fontWeight: 700, color: '#fb923c', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '4px', marginBottom: '4px' }}>
                  ⚠️ 미저장 수정사항 존재
                </div>
                <div style={{ fontSize: '10px', color: 'var(--text-main)', lineHeight: '1.4' }}>
                  에디터 본문에 저장되지 않은 변경사항이 있습니다. <br />
                  <span style={{ color: 'var(--primary)', fontWeight: 700 }}>Ctrl+S</span> 단축키를 눌러 디스크에 안전하게 저장하십시오.
                </div>
              </div>
            )}
          </span>
        ) : (
          <span 
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '4px', 
              color: 'var(--success)', 
              cursor: 'help',
              fontSize: '11px',
              position: 'relative'
            }}
            onMouseEnter={() => setActiveTooltip('save')}
            onMouseLeave={() => setActiveTooltip(null)}
          >
            <Check size={11} style={{ color: 'var(--success)' }} /> 저장됨

            {activeTooltip === 'save' && (
              <div style={{ ...tooltipStyle, width: '260px', left: 0 }}>
                <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--success)', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '4px', marginBottom: '4px' }}>
                  ✓ 문서가 디스크에 동기화됨
                </div>
                <div style={{ fontSize: '10px', color: 'var(--text-main)' }}>
                  {formatSavedTime(lastSavedTime)}
                </div>
              </div>
            )}
          </span>
        )}
        <div style={{ width: '1px', height: '12px', backgroundColor: 'var(--border-muted)' }} />
        <span>
          줄 수: <strong>{lineCount}</strong>줄 | 공백 포함: <strong>{charCount}</strong>자 | 단어: <strong>{wordCount}</strong>개
        </span>
      </div>

      {/* 📥 모델 다운로드 실시간 진행률 표시 */}
      {downloadStatus && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          background: 'rgba(6, 182, 212, 0.08)',
          border: '1px solid rgba(6, 182, 212, 0.25)',
          borderRadius: '6px',
          padding: '2px 10px',
          color: 'var(--secondary)',
          fontWeight: 600,
          fontSize: '10.5px',
          height: '20px',
        }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            📥 {downloadStatus.filename.split(/[\\/]/).pop()}: {downloadStatus.progress}%
          </span>
          <div style={{ width: '70px', height: '4px', background: 'rgba(255,255,255,0.08)', borderRadius: '2px', overflow: 'hidden' }}>
            <div style={{ width: `${downloadStatus.progress}%`, height: '100%', background: 'linear-gradient(90deg, var(--primary), var(--secondary))' }} />
          </div>
          <span style={{ fontSize: '9px', opacity: 0.85 }}>({downloadStatus.speed || 0} MB/s)</span>
        </div>
      )}

      {/* 2. 우측 제어 및 단축키 안내 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        {/* MCP 서버 상태 뱃지 */}
        {getMCPStatusBadge()}
        {isProPlan && mcpServers && mcpServers.length > 0 && <div style={{ width: '1px', height: '12px', backgroundColor: 'var(--border-muted)' }} />}

        {/* AI 에이전트 서버 상태 뱃지 */}
        {getAgentServerBadge()}
        {aiSettings && <div style={{ width: '1px', height: '12px', backgroundColor: 'var(--border-muted)' }} />}

        {/* 협업 상태 및 피어 아바타 목록 */}
        {serverRunning && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div
              style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                backgroundColor: 'var(--success)',
                animation: 'pulse 1.5s infinite',
              }}
            />
            <span style={{ color: 'var(--success)' }}>
              협업 ({peers.length + 1}명)
            </span>
            {/* 아바타 목록 시각화 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '3px', marginLeft: '2px' }}>
              {peers.map((peer) => (
                <div
                  key={peer.id}
                  style={{
                    width: '16px',
                    height: '16px',
                    borderRadius: '50%',
                    backgroundColor: peer.color,
                    color: '#ffffff',
                    fontSize: '8px',
                    fontWeight: 800,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    cursor: 'help',
                  }}
                  title={`${peer.name} (접속 중)`}
                >
                  {peer.name.charAt(0)}
                </div>
              ))}
            </div>
          </div>
        )}

        {serverRunning && <div style={{ width: '1px', height: '12px', backgroundColor: 'var(--border-muted)' }} />}

        {/* 상하좌우 고정 기능 (줄바꿈 방지 토글) */}
        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            cursor: 'pointer',
            color: !wordWrap ? 'var(--secondary)' : 'var(--text-muted)',
            fontWeight: !wordWrap ? 600 : 400,
            transition: 'var(--transition-fast)',
          }}
          title="줄바꿈을 끄고 본문을 한 줄로 길게 보이며 가로 스크롤을 활성화합니다."
        >
          <input
            type="checkbox"
            checked={!wordWrap}
            onChange={onToggleWordWrap}
            style={{ cursor: 'pointer', accentColor: 'var(--secondary)' }}
          />
          <WrapText size={12} />
          <span>줄바꿈 비활성화 (가로 스크롤)</span>
        </label>

        <div style={{ width: '1px', height: '12px', backgroundColor: 'var(--border-muted)' }} />

        {/* 줌 배율 — 문서(CSS zoom) + UI(브라우저 zoom) 분리 표시 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <ZoomIn size={12} />
          <span>
            문서: <strong>{zoomPercent}%</strong>
            {browserZoom !== 1.0 && (
              <span style={{ color: 'var(--secondary)', marginLeft: '6px' }}>
                UI: <strong>{Math.round(browserZoom * 100)}%</strong>
              </span>
            )}
          </span>
        </div>

        <div style={{ width: '1px', height: '12px', backgroundColor: 'var(--border-muted)' }} />

        {/* 환경 설정 버튼 */}
        <button
          onClick={onOpenSettings}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--text-main)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            padding: '2px 4px',
            borderRadius: '4px',
            transition: 'var(--transition-fast)',
          }}
          title="환경 설정"
        >
          <Settings size={12} style={{ color: 'var(--primary)' }} />
          <span>설정</span>
        </button>
      </div>
    </div>
  )
}
