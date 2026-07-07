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
    
    // 기본 로컬 WASM 게이트웨이는 플랜과 무관하게 상시 존재
    const defaultGateway: MCPServerConfig = {
      id: 'mcp-wasm-gateway',
      name: 'AMEVA OS WASM Gateway',
      type: 'http',
      url: 'http://127.0.0.1:11553/mcp',
      enabled: true
    }

    if (!isPro) {
      // 무료 플랜일 경우 외부 추가 Stdio 서버들은 로드하지 않고 기본 로컬 게이트웨이만 허용
      this.servers = [defaultGateway]
      return this.servers
    }

    try {
      const stored = localStorage.getItem('mcp-servers-config')
      if (stored) {
        this.servers = JSON.parse(stored)
        // 로드된 설정에 mcp-wasm-gateway가 누락되어 있다면 병합 보정
        if (!this.servers.find(s => s.id === 'mcp-wasm-gateway')) {
          this.servers.unshift(defaultGateway)
        }
      } else {
        this.servers = [defaultGateway]
        this.saveConfigs()
      }
    } catch (e) {
      console.error('[MCPClientManager] 설정 로드 오류:', e)
      this.servers = [defaultGateway]
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
    // 무료 회원이라도 loadConfigs()를 통해 기본 mcp-wasm-gateway 도구는 긁어오도록 허용
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
          const response = await this.safeMcpFetch(server.url, {
            jsonrpc: '2.0',
            method: 'tools/list',
            id: `list-${Date.now()}`
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
          const spawnResult = await window.electronAPI?.mcpSpawn?.(server.id, server.command, server.args || [])
          if (spawnResult.success) {
            // 2. tools/list JSON-RPC 전송
            const response = await window.electronAPI?.mcpCall?.(server.id, {
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
    // 기본 로컬 WASM 게이트웨이가 아닌 다른 stdio 서버 도구일 때만 pro 제한을 적용
    if (!isPro && serverId !== 'mcp-wasm-gateway') {
      return { success: false, result: '', error: '무료 버전에서는 외부 MCP 도구를 호출할 수 없습니다.' }
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
        const response = await this.safeMcpFetch(server.url, callPayload)
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
        const data = await window.electronAPI?.mcpCall?.(server.id, callPayload)
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
        await window.electronAPI?.mcpKill?.(server.id)
      }
    }
  }

  private static mcpToken: string | null = null

  private static async getOrFetchToken(): Promise<string | null> {
    if (this.mcpToken) return this.mcpToken
    if ((window as any).electronAPI?.mcpGetToken) {
      try {
        this.mcpToken = await (window as any).electronAPI.mcpGetToken()
      } catch (err) {
        console.error('[MCPClientManager] mcpGetToken 실패:', err)
      }
    }
    return this.mcpToken
  }

  /** localhost / 127.0.0.1 네트워크 바인딩 실패 시 상호 폴백 재시도 헬퍼 */
  private static async safeMcpFetch(url: string, body: any): Promise<Response> {
    const token = await this.getOrFetchToken()
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    }
    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body)
      })
      return res
    } catch (e) {
      // 127.0.0.1 -> localhost 폴백
      if (url.includes('127.0.0.1')) {
        const fallbackUrl = url.replace('127.0.0.1', 'localhost')
        console.warn(`[MCPClientManager] 127.0.0.1 fetch 실패. localhost 폴백 재시도... URL: ${fallbackUrl}`)
        return await fetch(fallbackUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify(body)
        })
      }
      // localhost -> 127.0.0.1 폴백
      if (url.includes('localhost')) {
        const fallbackUrl = url.replace('localhost', '127.0.0.1')
        console.warn(`[MCPClientManager] localhost fetch 실패. 127.0.0.1 폴백 재시도... URL: ${fallbackUrl}`)
        return await fetch(fallbackUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify(body)
        })
      }
      throw e
    }
  }
}
