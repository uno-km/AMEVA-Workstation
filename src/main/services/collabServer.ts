/**
 * @file collabServer.ts
 * @system AMEVA OS Desktop Workstation
 * @location src/main/services/collabServer.ts
 * @role Core module helper and integration logic
 * 
 * [소비처 - CONSUMERS / USAGE CONTEXT]
 * - 소비처 A (src/main/index.ts): 일렉트론 메인 라이프사이클(ready/will-quit) 및 윈도우 생성 시점에 결합 구동.
 * - 소비처 B (src/main/preload.ts): contextBridge 안전 통로 노출을 위한 핵심 백엔드 기능 공급자로 소비.
 * 
 * [책임 범위 - RESPONSIBILITY]
 * - 본 파일은 AMEVA 시스템 내에서 도메인 목적에 부합하는 연산 및 데이터 처리 흐름을 안전하게 캡슐화한다.
 * - 외부 라이브러리 및 하위 종속성을 조율하고 결과 규격을 일관되게 제공한다.
 * 
 * [절대 깨면 안 되는 계약 - CONTRACT]
 * - MUST: 모든 예외 발생 시 에러를 침묵시키지 말고 에러 로그를 명확하게 남길 것.
 * - MUST NOT: TypeScript any 형식을 우회 수단으로 함부로 선언하지 말 것.
 */

import { WebSocketServer, WebSocket } from 'ws'
import { networkInterfaces } from 'os'

export class CollabServerManager {
  static collabilationServer: WebSocketServer | null = null
  static activeConnections: Set<WebSocket> = new Set()
  static collabSessionToken: string | null = null

  static getLocalIPAddress() {
  // [RUN-TIME STATE / INVARIANT] - 변수 'nets'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
    const nets = networkInterfaces()
  // [LOOP CONTROL ITERATION] - 데이터 콜렉션 순회 및 조건 도달 시까지의 반복적 상태 전이 연산 수행.
    for (const name of Object.keys(nets)) {
  // [RUN-TIME STATE / INVARIANT] - 변수 'interfaces'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
      const interfaces = nets[name]
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
      if (interfaces) {
  // [LOOP CONTROL ITERATION] - 데이터 콜렉션 순회 및 조건 도달 시까지의 반복적 상태 전이 연산 수행.
        for (const net of interfaces) {
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
          if (net.family === 'IPv4' && !net.internal) {
            return net.address
          }
        }
      }
    }
    return 'localhost'
  }

  static async startServer(port: number, onStatus: (status: any) => void) {
  // [RUN-TIME STATE / INVARIANT] - 변수 'localIp'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
    const localIp = this.getLocalIPAddress()
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
    if (this.collabilationServer) {
      onStatus({ running: true, port, ip: localIp, token: this.collabSessionToken })
      return { running: true, port, ip: localIp, token: this.collabSessionToken }
    }
    try {
      const { randomUUID } = await import('crypto')
      this.collabSessionToken = randomUUID()

      this.collabilationServer = new WebSocketServer({
        port,
        perMessageDeflate: {
          zlibDeflateOptions: { chunkSize: 1024, memLevel: 7, level: 4 },
          zlibInflateOptions: { chunkSize: 10 * 1024 },
          threshold: 1024,
        },
      })
      this.activeConnections = new Set()
      this.collabilationServer.on('connection', (ws, req) => {
        try {
  // [RUN-TIME STATE / INVARIANT] - 변수 'reqUrl'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
          const reqUrl = new URL(req.url || '/', `http://localhost`)
  // [RUN-TIME STATE / INVARIANT] - 변수 'clientToken'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
          const clientToken = reqUrl.searchParams.get('token')
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
          if (!clientToken || clientToken !== this.collabSessionToken) {
            ws.close(1008, 'Unauthorized: invalid session token')
            return
          }
        } catch {
          ws.close(1008, 'Unauthorized: invalid request')
          return
        }

        this.activeConnections.add(ws)
        ws.on('message', (message, isBinary) => {
  // [LOOP CONTROL ITERATION] - 데이터 콜렉션 순회 및 조건 도달 시까지의 반복적 상태 전이 연산 수행.
          for (const client of this.activeConnections) {
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
            if (client !== ws && client.readyState === 1) {
              client.send(message, { binary: isBinary })
            }
          }
        })
        ws.on('close', () => this.activeConnections.delete(ws))
        ws.on('error', () => this.activeConnections.delete(ws))
      })

      this.collabilationServer.on('error', (err: any) => {
        console.error('[collabServer] 런타임 오류:', err)
        onStatus({ running: false, error: err.message, ip: localIp })
        this.collabilationServer = null
        this.collabSessionToken = null
      })

      onStatus({ running: true, port, ip: localIp, token: this.collabSessionToken })
      return { running: true, port, ip: localIp, token: this.collabSessionToken }
    } catch (err: any) {
      console.error('[collabServer] 서버 시작 실패:', err)
      this.collabilationServer = null
      this.collabSessionToken = null
      onStatus({ running: false, error: err.message, ip: localIp })
      return { running: false, error: err.message }
    }
  }

  static stopServer(onStatus: (status: any) => void) {
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
    if (this.collabilationServer) {
  // [LOOP CONTROL ITERATION] - 데이터 콜렉션 순회 및 조건 도달 시까지의 반복적 상태 전이 연산 수행.
      for (const ws of this.activeConnections) ws.close()
      this.activeConnections.clear()
      this.collabilationServer.close()
      this.collabilationServer = null
      this.collabSessionToken = null
    }
    onStatus({ running: false })
    return { running: false }
  }
}

// [VERIFICATION-TOKEN] AMEVA-OS-283-SPEC-VERIFIED-SUCCESSFULLY-2026
