import { useState, useEffect, useCallback } from 'react'
import { ToggleLeft, ToggleRight, Plus, Trash2 } from 'lucide-react'
import { MCPClientManager } from '../../utils/mcpClient'
import * as ipc from '../../services/ipc/electronApiAdapter'

interface SettingsTabMCPProps {
  isProPlan: boolean
  isOpen: boolean
}

export function SettingsTabMCP({ isProPlan, isOpen }: SettingsTabMCPProps) {
  const [mcpServers, setMcpServers] = useState<any[]>([])
  const [newMcpName, setNewMcpName] = useState('')
  const [newMcpType, setNewMcpType] = useState<'stdio' | 'http'>('http')
  const [newMcpUrl, setNewMcpUrl] = useState('')
  const [newMcpCmd, setNewMcpCmd] = useState('')
  const [newMcpArgs, setNewMcpArgs] = useState('')
  
  const [mcpTools, setMcpTools] = useState<any[]>([])
  const [isLoadingTools, setIsLoadingTools] = useState(false)
  const [expandedTool, setExpandedTool] = useState<string | null>(null)

  const refreshMcpTools = useCallback(async () => {
    setIsLoadingTools(true)
    try {
      const tools = await MCPClientManager.fetchAllTools()
      setMcpTools(tools)
    } catch (e) {
      console.error(e)
    } finally {
      setIsLoadingTools(false)
    }
  }, [])

  useEffect(() => {
    if (isOpen) {
      const configs = MCPClientManager.loadConfigs()
      setMcpServers(configs)
      refreshMcpTools()
    }
  }, [isOpen, refreshMcpTools])

  const handleAddMcp = () => {
    if (!newMcpName.trim()) return alert('서버 이름을 입력해 주세요.')
    
    const newServer: any = {
      id: `mcp-${Date.now()}`,
      name: newMcpName.trim(),
      type: newMcpType,
      enabled: true
    }

    if (newMcpType === 'http') {
      if (!newMcpUrl.trim()) return alert('URL을 입력해 주세요.')
      newServer.url = newMcpUrl.trim()
    } else {
      if (!newMcpCmd.trim()) return alert('실행 명령어를 입력해 주세요.')
      newServer.command = newMcpCmd.trim()
      newServer.args = newMcpArgs.trim() ? newMcpArgs.split(/\s+/) : []
    }

    const updated = [...mcpServers, newServer]
    MCPClientManager.setConfigs(updated)
    setMcpServers(updated)
    
    setNewMcpName('')
    setNewMcpUrl('')
    setNewMcpCmd('')
    setNewMcpArgs('')

    setTimeout(() => refreshMcpTools(), 200)
  }

  const handleToggleMcp = (id: string) => {
    const updated = mcpServers.map(s => s.id === id ? { ...s, enabled: !s.enabled } : s)
    MCPClientManager.setConfigs(updated)
    setMcpServers(updated)
    setTimeout(() => refreshMcpTools(), 200)
  }

  const handleDeleteMcp = async (id: string) => {
    const updated = mcpServers.filter(s => s.id !== id)
    if (ipc.isElectronEnv()) {
      await ipc.mcpKill(id)
    }
    MCPClientManager.setConfigs(updated)
    setMcpServers(updated)
    setTimeout(() => refreshMcpTools(), 200)
  }

  if (!isProPlan) return null

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
        <h3 style={{ fontSize: '13px', fontWeight: 700, margin: 0 }}>MCP Server Manager</h3>
        <button
          onClick={refreshMcpTools}
          style={{
            fontSize: '10px', color: 'var(--primary)', background: 'none',
            border: 'none', cursor: 'pointer', fontWeight: 700, padding: 0
          }}
        >
          새로고침 🔄
        </button>
      </div>
      <div style={{ fontSize: '9.5px', color: 'var(--text-muted)', marginBottom: '8px' }}>
        외부 Stdio 자식 프로세스 또는 HTTP API 게이트웨이 기반의 MCP 도구(Tools) 서버를 하드코딩 없이 통합 제어합니다.
      </div>

      {/* 1. MCP 추가 폼 */}
      <div style={{
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid var(--border-muted)',
        borderRadius: '8px',
        padding: '10px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        marginBottom: '10px'
      }}>
        <strong style={{ fontSize: '10.5px', color: 'var(--primary)' }}>➕ 새 MCP 서버 추가</strong>
        <div style={{ display: 'flex', gap: '8px' }}>
          <input
            type="text"
            placeholder="서버 이름 (예: 파일 매니저)"
            value={newMcpName}
            onChange={e => setNewMcpName(e.target.value)}
            style={{
              flex: 1, padding: '5px 8px', background: 'rgba(0,0,0,0.2)',
              border: '1px solid var(--border-muted)', borderRadius: '4px',
              color: 'var(--text-main)', fontSize: '10.5px', outline: 'none'
            }}
          />
          <select
            value={newMcpType}
            onChange={e => setNewMcpType(e.target.value as any)}
            style={{
              padding: '4px 8px', background: 'rgba(0,0,0,0.2)',
              border: '1px solid var(--border-muted)', borderRadius: '4px',
              color: 'var(--text-main)', fontSize: '10.5px', outline: 'none'
            }}
          >
            <option value="http">HTTP Gateway</option>
            <option value="stdio">Stdio Process</option>
          </select>
        </div>

        {newMcpType === 'http' ? (
          <input
            type="text"
            placeholder="HTTP 게이트웨이 주소 URL (예: http://127.0.0.1:11553/mcp)"
            value={newMcpUrl}
            onChange={e => setNewMcpUrl(e.target.value)}
            style={{
              padding: '5px 8px', background: 'rgba(0,0,0,0.2)',
              border: '1px solid var(--border-muted)', borderRadius: '4px',
              color: 'var(--text-main)', fontSize: '10.5px', outline: 'none'
            }}
          />
        ) : (
          <div style={{ display: 'flex', gap: '6px' }}>
            <input
              type="text"
              placeholder="실행 명령어 (예: npx, python)"
              value={newMcpCmd}
              onChange={e => setNewMcpCmd(e.target.value)}
              style={{
                flex: 1, padding: '5px 8px', background: 'rgba(0,0,0,0.2)',
                border: '1px solid var(--border-muted)', borderRadius: '4px',
                color: 'var(--text-main)', fontSize: '10.5px', outline: 'none'
              }}
            />
            <input
              type="text"
              placeholder="파라미터 (예: -y @modelcontextprotocol/server-postgres)"
              value={newMcpArgs}
              onChange={e => setNewMcpArgs(e.target.value)}
              style={{
                flex: 1, padding: '5px 8px', background: 'rgba(0,0,0,0.2)',
                border: '1px solid var(--border-muted)', borderRadius: '4px',
                color: 'var(--text-main)', fontSize: '10.5px', outline: 'none'
              }}
            />
          </div>
        )}
        <button
          onClick={handleAddMcp}
          style={{
            padding: '6px', background: 'var(--primary)', border: 'none',
            borderRadius: '4px', color: '#fff', fontSize: '10.5px',
            fontWeight: 700, cursor: 'pointer', display: 'flex',
            alignItems: 'center', justifyContent: 'center', gap: '4px'
          }}
        >
          <Plus size={12} /> 서버 추가 등록
        </button>
      </div>

      {/* 2. 등록된 서버 리스트 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '140px', overflowY: 'auto', marginBottom: '10px' }}>
        <span style={{ fontSize: '10.5px', fontWeight: 700, color: 'var(--text-muted)' }}>⚙️ 활성 서버 인스턴스</span>
        {mcpServers.length === 0 ? (
          <div style={{ fontSize: '10px', color: 'var(--text-muted)', textAlign: 'center', padding: '10px' }}>
            등록된 MCP 서버가 없습니다.
          </div>
        ) : (
          mcpServers.map(server => (
            <div
              key={server.id}
              style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                background: 'var(--bg-glass)', border: '1px solid var(--border-muted)',
                borderRadius: '6px', padding: '6px 10px'
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <div style={{
                    width: '6px', height: '6px', borderRadius: '50%',
                    backgroundColor: server.enabled ? '#10b981' : 'var(--text-muted)'
                  }} />
                  <span style={{ fontSize: '11px', fontWeight: 700 }}>{server.name}</span>
                  <span style={{
                    fontSize: '8.5px', color: 'var(--primary)',
                    background: 'rgba(168,85,247,0.1)', padding: '1px 4px', borderRadius: '3px'
                  }}>
                    {server.type.toUpperCase()}
                  </span>
                </div>
                <div style={{ fontSize: '8.5px', color: 'var(--text-muted)' }}>
                  {server.type === 'http' ? server.url : `${server.command} ${(server.args || []).join(' ')}`}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  onClick={() => handleToggleMcp(server.id)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary)' }}
                >
                  {server.enabled ? <ToggleRight size={22} /> : <ToggleLeft size={22} style={{ color: 'var(--text-dark)' }} />}
                </button>
                <button
                  onClick={() => handleDeleteMcp(server.id)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#f87171' }}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* 3. 로드된 실제 도구 아코디언 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <span style={{ fontSize: '10.5px', fontWeight: 700, color: 'var(--text-muted)' }}>🛠️ 실시간 제공 도구 목록 ({mcpTools.length}개)</span>
        {isLoadingTools ? (
          <div style={{ fontSize: '10px', color: 'var(--text-muted)', textAlign: 'center', padding: '10px' }}>
            MCP 서버들로부터 도구 명세를 가져오는 중... 🔄
          </div>
        ) : mcpTools.length === 0 ? (
          <div style={{ fontSize: '10px', color: 'var(--text-muted)', textAlign: 'center', padding: '10px' }}>
            활성화된 서버가 없거나 제공하는 도구가 없습니다.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '150px', overflowY: 'auto' }}>
            {mcpTools.map(tool => {
              const isExpanded = expandedTool === tool.name
              return (
                <div
                  key={tool.name}
                  style={{
                    background: 'rgba(255,255,255,0.01)',
                    border: '1px solid var(--border-muted)',
                    borderRadius: '4px',
                    overflow: 'hidden'
                  }}
                >
                  <div
                    onClick={() => setExpandedTool(isExpanded ? null : tool.name)}
                    style={{
                      padding: '6px 10px', cursor: 'pointer', display: 'flex',
                      justifyContent: 'space-between', alignItems: 'center',
                      background: isExpanded ? 'rgba(255,255,255,0.03)' : 'transparent',
                      fontSize: '10.5px', fontWeight: 600
                    }}
                  >
                    <span style={{ color: 'var(--secondary)' }}>{tool.name}</span>
                    <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>
                      {isExpanded ? '접기 🔼' : '펼치기 🔽'}
                    </span>
                  </div>
                  {isExpanded && (
                    <div style={{
                      padding: '8px 10px', borderTop: '1px solid var(--border-muted)',
                      background: 'rgba(0,0,0,0.15)', display: 'flex', flexDirection: 'column', gap: '4px'
                    }}>
                      <div style={{ fontSize: '10px', color: 'var(--text-main)' }}>
                        {tool.description || '설명 없음'}
                      </div>
                      <div style={{ fontSize: '8.5px', color: 'var(--text-muted)', marginTop: '4px' }}>
                        <strong>입력 명세:</strong> {JSON.stringify(tool.inputSchema?.properties || {})}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </>
  )
}
