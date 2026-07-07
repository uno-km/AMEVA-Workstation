import React, { useState, useEffect } from 'react'
import { MCPClientManager } from '../../utils/mcpClient'

interface MCPStatusIndicatorProps {
  isProPlan: boolean
  mcpServers: any[]
  activeTooltip: string | null
  handleMouseEnter: (id: string) => void
  handleMouseLeave: () => void
  tooltipStyle: React.CSSProperties
}

export function MCPStatusIndicator({
  isProPlan,
  mcpServers,
  activeTooltip,
  handleMouseEnter,
  handleMouseLeave,
  tooltipStyle
}: MCPStatusIndicatorProps) {
  const [mcpTools, setMcpTools] = useState<any[]>([])
  const [isLoadingTools, setIsLoadingTools] = useState(false)

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

  if (!isProPlan || !mcpServers || mcpServers.length === 0) return null

  const activeServers = mcpServers.filter((s: any) => s.enabled)
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
            {mcpServers.map((s: any) => {
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
