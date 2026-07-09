/**
 * @file mcpProcessManager.ts
 * @system AMEVA OS Desktop Workstation - MCP Integration Layer
 * @location src/main/services/mcpProcessManager.ts
 * @role Model Context Protocol (MCP) Node.js Server Child Process Lifecycle Manager
 * 
 * [설계 의도 - DESIGN INTENT / ADR / SECURITY]
 * - Llama.cpp 에이전트와 도구를 동적 결합하기 위해 외부 Node.js 기반 MCP 서버 프로세스를 자식 프로세스(`spawn`)로 실행한다.
 * - JSON-RPC 2.0 프로토콜을 통과시키기 위해 개별 라인단위 JSON 파싱(`\n` 구분 버퍼링)을 수행한다.
 * - [보안 - taskkill 계약]: 윈도우 OS의 경우 `ChildProcess.kill()`을 호출해도 자식의 자식(하위 트리 프로세스)은 죽지 않고 고아 좀비로 상주한다.
 *   이를 차단하기 위해 Win32인 경우 `taskkill /pid PID /T /F` CLI를 연동하여 트리 프로세스 전체를 완전히 소멸(killServer) 시킨다.
 * - [15초 타임아웃 가드]: 원격 MCP 호출 실패나 무한 행 상태에서 전체 시스템 데드락을 방지하고자, 15초 제한 시간 경과 시 `pendingResolvers` 큐에서 자동 만료 및 반환한다.
 * 
 * [책임 범위 - RESPONSIBILITY]
 * - 서버 프로세스의 기동(`spawnServer`), 종료(`killServer`, `killAll`), 및 JSON-RPC 주입/해석(`callServer`) 생명주기를 통제한다.
 
 * [소비처 - CONSUMERS / USAGE CONTEXT]
 * - 소비처 A (src/main/index.ts): 일렉트론 메인 라이프사이클(ready/will-quit) 및 윈도우 생성 시점에 결합 구동.
 * - 소비처 B (src/main/preload.ts): contextBridge 안전 통로 노출을 위한 핵심 백엔드 기능 공급자로 소비.
 */

/* 
 * [IMPORT SEGMENTATION & CONTRACTS]
 * - spawn: 자식 CLI 프로세스를 비동기 기동하기 위한 Node.js core api.
 * - ChildProcess: 자식 프로세스 기동 인스턴스 타입.
 * - execSync: 윈도우 프로세스 트리 강제 소멸 CLI(`taskkill`) 구동용 Node.js api.
 */
import { spawn, ChildProcess, execSync } from 'child_process'

/**
 * @class MCPProcessManager
 * @description 가동 중인 외부 MCP 서버들의 ChildProcess 인스턴스 및 stdout 버퍼, JSON-RPC 응답 대기 프라미스 큐를 보관 관리하는 클래스.
 */
export class MCPProcessManager {
  /*
   * [INVARIANT - Static Active Processes Registry Map]
   * - processes: 현재 가동 실행 중인 MCP 서버 인스턴스 맵 정보.
   *   - process: ChildProcess 본체.
   *   - stdoutBuffer: 줄바꿈 파싱용 개별 수신 스트림 누적 텍스트 버퍼.
   *   - pendingResolvers: JSON-RPC request.id에 상응하는 비동기 resolve 리턴 함수 맵.
   */
  private static processes: Map<string, {
    process: ChildProcess;
    stdoutBuffer: string;
    pendingResolvers: Map<string, (response: any) => void>;
  }> = new Map()

  /**
   * [CONTRACT - Spawn MCP Server Process]
   * - Rationale: serverId 기준으로 이미 가동 중인 중복 인스턴스가 있다면 taskkill 킬 선행 후 새 프로세스를 띄운다.
   * - stdout.on('data') 감청 시 개행 기호(`\n`) 기준으로 버퍼를 분할 슬라이싱하고 JSON-RPC id 매핑을 해석해 resolve 콜백을 기동한다.
   */
  static spawnServer(serverId: string, command: string, args: string[]): Promise<{ success: boolean; error?: string }> {
    return new Promise((resolve) => {
      // 기존에 띄운 동일 서버 식별 선 킬
      this.killServer(serverId)

      console.log(`[MCP-Manager] Spawning MCP server "${serverId}" with command: ${command} ${args.join(' ')}`)

      try {
        // 프로세스 생성 (stdin/stdout 파이프 바인딩, stderr는 메인 프로세스로 위임)
        const proc = spawn(command, args, { stdio: ['pipe', 'pipe', 'inherit'] })
        
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `state`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const state = ...` 형태로 안전 캐싱 후 가공 기동.
       */
        const state = {
          process: proc,
          stdoutBuffer: '',
          pendingResolvers: new Map<string, (response: any) => void>()
        }
        this.processes.set(serverId, state)

        // stdout 스트림 감청 버퍼링 파서
        proc.stdout.on('data', (chunk: Buffer) => {
          state.stdoutBuffer += chunk.toString()
          let newlineIndex: number
          
          // 개행 기호 단위로 계속 슬라이싱
          while ((newlineIndex = state.stdoutBuffer.indexOf('\n')) !== -1) {
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `rawLine`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const rawLine = ...` 형태로 안전 캐싱 후 가공 기동.
       */
            const rawLine = state.stdoutBuffer.slice(0, newlineIndex).trim()
            state.stdoutBuffer = state.stdoutBuffer.slice(newlineIndex + 1)
            
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `!rawLine`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (!rawLine)` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
            if (!rawLine) continue
            try {
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `parsed`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const parsed = ...` 형태로 안전 캐싱 후 가공 기동.
       */
              const parsed = JSON.parse(rawLine)
              // JSON-RPC id가 존재 시 대기 중인 프라미스 매핑 resolve 처리 후 맵 제거
              if (parsed.id !== undefined) {
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `resolver`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const resolver = ...` 형태로 안전 캐싱 후 가공 기동.
       */
                const resolver = state.pendingResolvers.get(String(parsed.id))
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `resolver`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (resolver)` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
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

        // 프로세스 안착 통보 시 resolve
        proc.on('spawn', () => {
          resolve({ success: true })
        })
      } catch (err: any) {
        resolve({ success: false, error: err.message })
      }
    })
  }

  /**
   * [CONTRACT - Invoke JSON-RPC Request to Server]
   * - Rationale: RPC 규격 객체에 \n 개행 문자를 덧붙여 stdin 채널에 기입하고, 
   *   15초 타이머 락 가드를 등록한 후 비동기 응답 대기열 프라미스를 반환한다.
   */
  static callServer(serverId: string, request: any): Promise<any> {
    return new Promise((resolve) => {
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `state`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const state = ...` 형태로 안전 캐싱 후 가공 기동.
       */
      const state = this.processes.get(serverId)
      // 쓰기 파이프가 차단되었거나 비활성 시 에러 반환
      if (!state || !state.process.stdin || !state.process.stdin.writable) {
        resolve({
          jsonrpc: '2.0',
          id: request.id,
          error: { code: -32000, message: `MCP Server "${serverId}"가 정상 실행 중이 아니거나 쓰기가 차단되었습니다.` }
        })
        return
      }

      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `reqId`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const reqId = ...` 형태로 안전 캐싱 후 가공 기동.
       */
      const reqId = String(request.id)
      state.pendingResolvers.set(reqId, resolve)

      // 15초 제한 시간 경과 시 만료 가드
      const timeout = setTimeout(() => {
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `state.pendingResolvers.has(reqId)`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (state.pendingResolvers.has(reqId))` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
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
        // 개행 구분 JSON-RPC 스트림 발송
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

  /**
   * [CONTRACT - Safe Kill Server Process]
   * - Rationale: 윈도우 OS의 하위 트리 좀비 상주를 막기 위해 taskkill로 자식의 자식까지 강제 소멸시킨다.
   */
  static killServer(serverId: string) {
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `state`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const state = ...` 형태로 안전 캐싱 후 가공 기동.
       */
    const state = this.processes.get(serverId)
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `state`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (state)` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
    if (state) {
      try {
        // 윈도우 플랫폼 트리 킬 계약 준수
        if (process.platform === 'win32' && state.process.pid) {
          execSync(`taskkill /pid ${state.process.pid} /T /F`, { stdio: 'ignore', timeout: 1000 })
        } else {
          state.process.kill()
        }
      } catch {}
      this.processes.delete(serverId)
    }
  }

  /**
   * [CONTRACT - Purge All MCP Servers]
   * - Rationale: 종료will-quit 시그널 수신 시 등록된 모든 서버를 전수 강제 킬(killServer)한다.
   */
  static killAll() {
    console.log('[MCP-Manager] 모든 MCP 서버 프로세스 종료 중...')
      /*
       * [LOOP CONTROL ITERATION]
       * - 루프 조건: `for (const serverId of this.processes.keys()) {`
       * - 예상 시나리오: 지정된 조건 한계 도달 시점까지 콜렉션 항목의 순차 매핑, 변환 및 동기 적재 처리를 수행함.
       * - 예시: `for (const item of list)` 루프 실행 시 모든 개별 블록의 html 포맷 정제 완료 후 스택 종결.
       */
    for (const serverId of this.processes.keys()) {
      this.killServer(serverId)
    }
  }
}

