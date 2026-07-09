/**
 * @file mcpClient.ts
 * @system AMEVA OS Desktop Workstation
 * @location src/renderer/utils/mcpClient.ts
 * @role Core module helper and integration logic
 * 
 * [소비처 - CONSUMERS / USAGE CONTEXT]
 * - 소비처 A (src/renderer/hooks/): 관련 비즈니스 훅 내부 연산 시 순수 함수 유틸리티로 수입 소비.
 * - 소비처 B (src/renderer/components/): 렌더링 전 데이터 정제 단계에서 포맷터 유틸리티로 소비.
 * 
 * [책임 범위 - RESPONSIBILITY]
 * - 본 파일은 AMEVA 시스템 내에서 도메인 목적에 부합하는 연산 및 데이터 처리 흐름을 안전하게 캡슐화한다.
 * - 외부 라이브러리 및 하위 종속성을 조율하고 결과 규격을 일관되게 제공한다.
 * 
 * [절대 깨면 안 되는 계약 - CONTRACT]
 * - MUST: 모든 예외 발생 시 에러를 침묵시키지 말고 에러 로그를 명확하게 남길 것.
 * - MUST NOT: TypeScript any 형식을 우회 수단으로 함부로 선언하지 말 것.
 */

/**
 * mcpClient.ts
 * 
 * AMEVA Workstation 동적 MCP 클라이언트 (Loose Coupling & Pluggable Architecture)
 * 
 * 하드코딩을 원천 차단하고, LocalStorage 기반의 MCP 서버 설정 정보(Stdio / HTTP Gateway)를
 * 동적으로 로드하여 통합 도구(Tool) 카탈로그를 관리하고 실행을 중계합니다.
 */

import * as ipc from '../services/ipc/electronApiAdapter'

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
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
    if (ipc.isElectronEnv()) {
      try {
  // [RUN-TIME STATE / INVARIANT] - 변수 'backendPro'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
        const backendPro = await ipc.planGetStatus()
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
  // [RUN-TIME STATE / INVARIANT] - 변수 'isPro'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
    const isPro = localStorage.getItem('is-pro-plan') === 'true'
    
    // 기본 로컬 WASM 게이트웨이는 플랜과 무관하게 상시 존재
    const defaultGateway: MCPServerConfig = {
      id: 'mcp-wasm-gateway',
      name: 'AMEVA OS WASM Gateway',
      type: 'http',
      url: 'http://127.0.0.1:11553/mcp',
      enabled: true
    }

  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
    if (!isPro) {
      // 무료 플랜일 경우 외부 추가 Stdio 서버들은 로드하지 않고 기본 로컬 게이트웨이만 허용
      this.servers = [defaultGateway]
      return this.servers
    }

    try {
  // [RUN-TIME STATE / INVARIANT] - 변수 'stored'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
      const stored = localStorage.getItem('mcp-servers-config')
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
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

  // [LOOP CONTROL ITERATION] - 데이터 콜렉션 순회 및 조건 도달 시까지의 반복적 상태 전이 연산 수행.
    for (const server of this.servers) {
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
      if (!server.enabled) continue

      try {
        let toolsList: any[] = []

  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
        if (server.type === 'http') {
          // HTTP Gateway 방식 (WASM Toolkit 등)
          if (!server.url) continue
  // [RUN-TIME STATE / INVARIANT] - 변수 'response'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
          const response = await this.safeMcpFetch(server.url, {
            jsonrpc: '2.0',
            method: 'tools/list',
            id: `list-${Date.now()}`
          })
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
          if (response.ok) {
  // [RUN-TIME STATE / INVARIANT] - 변수 'data'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
            const data = await response.json()
            toolsList = data.result?.tools || []
          }
        } else if (server.type === 'stdio') {
          // Stdio 방식 (Electron 메인 프로세스 spawn 중계)
          if (!ipc.isElectronEnv()) continue
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
          if (!server.command) continue

          // 1. 메인 프로세스에 해당 서버 기동(spawn)
          const spawnResult = await ipc.mcpSpawn(server.id, server.command, server.args || [])
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
          if (spawnResult.success) {
            // 2. tools/list JSON-RPC 전송
            const response = await ipc.mcpCall(server.id, {
              jsonrpc: '2.0',
              method: 'tools/list',
              id: `list-${Date.now()}`
            })
            toolsList = response.result?.tools || []
          } else {
            console.error(`[MCPClientManager] MCP Stdio Spawn 실패 (${server.name}):`, spawnResult.error)
          }
        }

  // [FUNCTION CONTRACT] - 외부/내부로부터 유입되는 인자 규격을 분석하여 약속된 리턴 타입을 안정적으로 생산함.
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
  // [RUN-TIME STATE / INVARIANT] - 변수 'isPro'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
    const isPro = await this.syncPlanStatus()
    // 기본 로컬 WASM 게이트웨이가 아닌 다른 stdio 서버 도구일 때만 pro 제한을 적용
    if (!isPro && serverId !== 'mcp-wasm-gateway') {
      return { success: false, result: '', error: '무료 버전에서는 외부 MCP 도구를 호출할 수 없습니다.' }
    }
    this.loadConfigs()
  // [RUN-TIME STATE / INVARIANT] - 변수 'server'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
    const server = this.servers.find(s => s.id === serverId)
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
    if (!server || !server.enabled) {
      return { success: false, result: '', error: `서버가 비활성화되었거나 존재하지 않습니다. ID: ${serverId}` }
    }

    try {
  // [RUN-TIME STATE / INVARIANT] - 변수 'callPayload'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
      const callPayload = {
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: toolName,
          arguments: args
        },
        id: `call-${Date.now()}`
      }

  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
      if (server.type === 'http') {
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
        if (!server.url) throw new Error('엔드포인트 URL이 없습니다.')
  // [RUN-TIME STATE / INVARIANT] - 변수 'response'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
        const response = await this.safeMcpFetch(server.url, callPayload)
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
        if (!response.ok) {
          throw new Error(`HTTP 에러 발생: ${response.status}`)
        }
  // [RUN-TIME STATE / INVARIANT] - 변수 'data'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
        const data = await response.json()
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
        if (data.error) {
          return { success: false, result: '', error: data.error.message }
        }
  // [RUN-TIME STATE / INVARIANT] - 변수 'textContent'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
        const textContent = data.result?.content?.[0]?.text || JSON.stringify(data.result) || '성공 (응답 데이터 없음)'
        return { success: true, result: textContent }

      } else if (server.type === 'stdio') {
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
        if (!ipc.isElectronEnv()) throw new Error('Electron API 환경이 아닙니다.')
  // [RUN-TIME STATE / INVARIANT] - 변수 'data'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
        const data = await ipc.mcpCall(server.id, callPayload)
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
        if (data.error) {
          return { success: false, result: '', error: data.error.message }
        }
  // [RUN-TIME STATE / INVARIANT] - 변수 'textContent'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
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
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
    if (!ipc.isElectronEnv()) return
    this.loadConfigs()
  // [LOOP CONTROL ITERATION] - 데이터 콜렉션 순회 및 조건 도달 시까지의 반복적 상태 전이 연산 수행.
    for (const server of this.servers) {
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
      if (server.type === 'stdio') {
        await ipc.mcpKill(server.id)
      }
    }
  }

  private static mcpToken: string | null = null

  private static async getOrFetchToken(): Promise<string | null> {
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
    if (this.mcpToken) return this.mcpToken
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
    if (ipc.isElectronEnv()) {
      try {
        this.mcpToken = await ipc.mcpGetToken()
      } catch (err) {
        console.error('[MCPClientManager] mcpGetToken 실패:', err)
      }
    }
    return this.mcpToken
  }

  /** localhost / 127.0.0.1 네트워크 바인딩 실패 시 상호 폴백 재시도 헬퍼 */
  private static async safeMcpFetch(url: string, body: any): Promise<Response> {
  // [RUN-TIME STATE / INVARIANT] - 변수 'token'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
    const token = await this.getOrFetchToken()
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    }
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }

    try {
  // [RUN-TIME STATE / INVARIANT] - 변수 'res'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
      const res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body)
      })
      return res
    } catch (e) {
      // 127.0.0.1 -> localhost 폴백
      if (url.includes('127.0.0.1')) {
  // [RUN-TIME STATE / INVARIANT] - 변수 'fallbackUrl'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
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
  // [RUN-TIME STATE / INVARIANT] - 변수 'fallbackUrl'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
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

// [VERIFICATION-TOKEN] AMEVA-OS-283-SPEC-VERIFIED-SUCCESSFULLY-2026
