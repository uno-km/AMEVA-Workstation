/**
 * mcpClient.ts
 * 
 * AMEVA Workstation 동적 MCP 클라이언트 (Loose Coupling & Pluggable Architecture)
 * 
 * 하드코딩을 원천 차단하고, LocalStorage 기반의 MCP 서버 설정 정보(Stdio / HTTP Gateway)를
 * 동적으로 로드하여 통합 도구(Tool) 카탈로그를 관리하고 실행을 중계합니다.
 */

export interface MCPServerConfig {
  id: string
  name: string
  type: 'stdio' | 'http'
  command?: string
  args?: string[]
  url?: string
  enabled: boolean
}

export interface MCPTool {
  name: string
  description: string
  inputSchema: {
    type: 'object'
    properties: Record<string, any>
    required: string[]
  }
  serverId: string
}

export class MCPClientManager {
  private static servers: MCPServerConfig[] = []
  private static cachedTools: Map<string, MCPTool[]> = new Map()

  /** 백엔드 플랜 상태와 동기화 (우회 시도 방지 및 교차 검증) */
  static async syncPlanStatus(): Promise<boolean> {
    if (window.electronAPI?.planGetStatus) {
      try {
        const backendPro = await window.electronAPI.planGetStatus()
        localStorage.setItem('is-pro-plan', String(backendPro))
        return backendPro
      } catch (e) {
        return false
      }
    }
    return localStorage.getItem('is-pro-plan') === 'true'
  }

  /** 로컬 설정 로드 */
  static loadConfigs(): MCPServerConfig[] {
    const isPro = localStorage.getItem('is-pro-plan') === 'true'
    if (!isPro) {
      this.servers = []
      return []
    }
    try {
      const stored = localStorage.getItem('mcp-servers-config')
      if (stored) {
        this.servers = JSON.parse(stored)
      } else {
        // 기본값: AMEVA OS WASM 게이트웨이가 추가된 상태로 폴백
        this.servers = [
          {
            id: 'mcp-wasm-gateway',
            name: 'AMEVA OS WASM Gateway',
            type: 'http',
            url: 'http://127.0.0.1:11553/mcp',
            enabled: true
          }
        ]
        this.saveConfigs()
      }
    } catch (e) {
      console.error('[MCPClientManager] 설정 로드 오류:', e)
    }
    return this.servers
  }

  /** 설정 저장 */
  static saveConfigs() {
    try {
      localStorage.setItem('mcp-servers-config', JSON.stringify(this.servers))
    } catch (e) {
      console.error('[MCPClientManager] 설정 저장 오류:', e)
    }
  }

  /** 서버 목록 갱신 */
  static setConfigs(newConfigs: MCPServerConfig[]) {
    this.servers = newConfigs
    this.saveConfigs()
  }

  /** 모든 활성화된 MCP 서버들로부터 도구 목록 동적 페치 */
  static async fetchAllTools(): Promise<MCPTool[]> {
    const isPro = await this.syncPlanStatus()
    if (!isPro) return []
    this.loadConfigs()
    const allTools: MCPTool[] = []
    this.cachedTools.clear()

    for (const server of this.servers) {
      if (!server.enabled) continue

      try {
        let toolsList: any[] = []

        if (server.type === 'http') {
          // HTTP Gateway 방식 (WASM Toolkit 등)
          if (!server.url) continue
          const response = await fetch(server.url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              jsonrpc: '2.0',
              method: 'tools/list',
              id: `list-${Date.now()}`
            })
          })
          if (response.ok) {
            const data = await response.json()
            toolsList = data.result?.tools || []
          }
        } else if (server.type === 'stdio') {
          // Stdio 방식 (Electron 메인 프로세스 spawn 중계)
          if (!window.electronAPI) continue
          if (!server.command) continue

          // 1. 메인 프로세스에 해당 서버 기동(spawn)
          const spawnResult = await window.electronAPI.mcpSpawn(server.id, server.command, server.args || [])
          if (spawnResult.success) {
            // 2. tools/list JSON-RPC 전송
            const response = await window.electronAPI.mcpCall(server.id, {
              jsonrpc: '2.0',
              method: 'tools/list',
              id: `list-${Date.now()}`
            })
            toolsList = response.result?.tools || []
          } else {
            console.error(`[MCPClientManager] MCP Stdio Spawn 실패 (${server.name}):`, spawnResult.error)
          }
        }

        const mappedTools: MCPTool[] = toolsList.map(t => ({
          name: t.name,
          description: t.description || '',
          inputSchema: t.inputSchema || { type: 'object', properties: {}, required: [] },
          serverId: server.id
        }))

        this.cachedTools.set(server.id, mappedTools)
        allTools.push(...mappedTools)

      } catch (err: any) {
        console.warn(`[MCPClientManager] MCP 서버 [${server.name}] 도구 로드 실패:`, err.message)
      }
    }

    return allTools
  }

  /** 특정 MCP 도구 동적 실행 */
  static async callTool(serverId: string, toolName: string, args: any): Promise<{ success: boolean; result: string; error?: string }> {
    const isPro = await this.syncPlanStatus()
    if (!isPro) {
      return { success: false, result: '', error: '무료 버전에서는 MCP 도구를 호출할 수 없습니다.' }
    }
    this.loadConfigs()
    const server = this.servers.find(s => s.id === serverId)
    if (!server || !server.enabled) {
      return { success: false, result: '', error: `서버가 비활성화되었거나 존재하지 않습니다. ID: ${serverId}` }
    }

    try {
      const callPayload = {
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: toolName,
          arguments: args
        },
        id: `call-${Date.now()}`
      }

      if (server.type === 'http') {
        if (!server.url) throw new Error('엔드포인트 URL이 없습니다.')
        const response = await fetch(server.url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(callPayload)
        })
        if (!response.ok) {
          throw new Error(`HTTP 에러 발생: ${response.status}`)
        }
        const data = await response.json()
        if (data.error) {
          return { success: false, result: '', error: data.error.message }
        }
        const textContent = data.result?.content?.[0]?.text || JSON.stringify(data.result) || '성공 (응답 데이터 없음)'
        return { success: true, result: textContent }

      } else if (server.type === 'stdio') {
        if (!window.electronAPI) throw new Error('Electron API 환경이 아닙니다.')
        const data = await window.electronAPI.mcpCall(server.id, callPayload)
        if (data.error) {
          return { success: false, result: '', error: data.error.message }
        }
        const textContent = data.result?.content?.[0]?.text || JSON.stringify(data.result) || '성공'
        return { success: true, result: textContent }
      }

    } catch (e: any) {
      return { success: false, result: '', error: e.message }
    }

    return { success: false, result: '', error: '알 수 없는 MCP 통신 채널 유형' }
  }

  /** Stdio 서버 프로세스 자원 일괄 정리 */
  static async cleanupAll() {
    if (!window.electronAPI) return
    this.loadConfigs()
    for (const server of this.servers) {
      if (server.type === 'stdio') {
        await window.electronAPI.mcpKill(server.id)
      }
    }
  }
}
