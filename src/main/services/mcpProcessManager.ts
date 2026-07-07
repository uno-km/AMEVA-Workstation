import { spawn, ChildProcess } from 'child_process'

export class MCPProcessManager {
  private static processes: Map<string, {
    process: ChildProcess;
    stdoutBuffer: string;
    pendingResolvers: Map<string, (response: any) => void>;
  }> = new Map()

  static spawnServer(serverId: string, command: string, args: string[]): Promise<{ success: boolean; error?: string }> {
    return new Promise((resolve) => {
      // 기존에 띄웠던 동일 서버가 있으면 킬
      this.killServer(serverId)

      console.log(`[MCP-Manager] Spawning MCP server "${serverId}" with command: ${command} ${args.join(' ')}`)

      try {
        const proc = spawn(command, args, { stdio: ['pipe', 'pipe', 'inherit'] })
        const state = {
          process: proc,
          stdoutBuffer: '',
          pendingResolvers: new Map<string, (response: any) => void>()
        }
        this.processes.set(serverId, state)

        proc.stdout.on('data', (chunk: Buffer) => {
          state.stdoutBuffer += chunk.toString()
          let newlineIndex: number
          while ((newlineIndex = state.stdoutBuffer.indexOf('\n')) !== -1) {
            const rawLine = state.stdoutBuffer.slice(0, newlineIndex).trim()
            state.stdoutBuffer = state.stdoutBuffer.slice(newlineIndex + 1)
            
            if (!rawLine) continue
            try {
              const parsed = JSON.parse(rawLine)
              if (parsed.id !== undefined) {
                const resolver = state.pendingResolvers.get(String(parsed.id))
                if (resolver) {
                  resolver(parsed)
                  state.pendingResolvers.delete(String(parsed.id))
                }
              }
            } catch (err) {
              console.warn(`[MCP-Manager][${serverId}] JSON 라인 파싱 실패:`, rawLine)
            }
          }
        })

        proc.on('error', (err) => {
          console.error(`[MCP-Manager][${serverId}] 프로세스 실행 에러:`, err)
          this.processes.delete(serverId)
          resolve({ success: false, error: err.message })
        })

        proc.on('close', (code) => {
          console.log(`[MCP-Manager][${serverId}] 프로세스 종료 코드: ${code}`)
          this.processes.delete(serverId)
        })

        // Node ChildProcess가 생성되면 resolve
        proc.on('spawn', () => {
          resolve({ success: true })
        })
      } catch (err: any) {
        resolve({ success: false, error: err.message })
      }
    })
  }

  static callServer(serverId: string, request: any): Promise<any> {
    return new Promise((resolve) => {
      const state = this.processes.get(serverId)
      if (!state || !state.process.stdin || !state.process.stdin.writable) {
        resolve({
          jsonrpc: '2.0',
          id: request.id,
          error: { code: -32000, message: `MCP Server "${serverId}"가 정상 실행 중이 아니거나 쓰기가 차단되었습니다.` }
        })
        return
      }

      const reqId = String(request.id)
      state.pendingResolvers.set(reqId, resolve)

      // 15초 제한 시간
      const timeout = setTimeout(() => {
        if (state.pendingResolvers.has(reqId)) {
          state.pendingResolvers.delete(reqId)
          resolve({
            jsonrpc: '2.0',
            id: request.id,
            error: { code: -32000, message: `MCP 요청 제한시간(15초) 초과` }
          })
        }
      }, 15000)

      try {
        state.process.stdin.write(JSON.stringify(request) + '\n')
      } catch (err: any) {
        clearTimeout(timeout)
        state.pendingResolvers.delete(reqId)
        resolve({
          jsonrpc: '2.0',
          id: request.id,
          error: { code: -32000, message: `stdin 쓰기 실패: ${err.message}` }
        })
      }
    })
  }

  static killServer(serverId: string) {
    const state = this.processes.get(serverId)
    if (state) {
      try {
        state.process.kill()
      } catch {}
      this.processes.delete(serverId)
    }
  }

  static killAll() {
    console.log('[MCP-Manager] 모든 MCP 서버 프로세스 종료 중...')
    for (const serverId of this.processes.keys()) {
      this.killServer(serverId)
    }
  }
}
