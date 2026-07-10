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
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `nets`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const nets = ...` 형태로 안전 캐싱 후 가공 기동.
       */
    const nets = networkInterfaces()
      /*
       * [LOOP CONTROL ITERATION]
       * - 루프 조건: `for (const name of Object.keys(nets)) {`
       * - 예상 시나리오: 지정된 조건 한계 도달 시점까지 콜렉션 항목의 순차 매핑, 변환 및 동기 적재 처리를 수행함.
       * - 예시: `for (const item of list)` 루프 실행 시 모든 개별 블록의 html 포맷 정제 완료 후 스택 종결.
       */
    for (const name of Object.keys(nets)) {
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `interfaces`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const interfaces = ...` 형태로 안전 캐싱 후 가공 기동.
       */
      const interfaces = nets[name]
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `interfaces`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (interfaces)` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
      if (interfaces) {
      /*
       * [LOOP CONTROL ITERATION]
       * - 루프 조건: `for (const net of interfaces) {`
       * - 예상 시나리오: 지정된 조건 한계 도달 시점까지 콜렉션 항목의 순차 매핑, 변환 및 동기 적재 처리를 수행함.
       * - 예시: `for (const item of list)` 루프 실행 시 모든 개별 블록의 html 포맷 정제 완료 후 스택 종결.
       */
        for (const net of interfaces) {
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `net.family === 'IPv4' && !net.internal`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (net.family === 'IPv4' && !net.internal)` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
          if (net.family === 'IPv4' && !net.internal) {
            return net.address
          }
        }
      }
    }
    return 'localhost'
  }

  static async startServer(port: number, onStatus: (status: any) => void) {
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `localIp`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const localIp = ...` 형태로 안전 캐싱 후 가공 기동.
       */
    const localIp = this.getLocalIPAddress()
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `this.collabilationServer`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (this.collabilationServer)` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
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
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `reqUrl`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const reqUrl = ...` 형태로 안전 캐싱 후 가공 기동.
       */
          const reqUrl = new URL(req.url || '/', `http://localhost`)
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `clientToken`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const clientToken = ...` 형태로 안전 캐싱 후 가공 기동.
       */
          const clientToken = reqUrl.searchParams.get('token')
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `!clientToken || clientToken !== this.collabSessionToken`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (!clientToken || clientToken !== this.collabSessionToken)` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
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
      /*
       * [LOOP CONTROL ITERATION]
       * - 루프 조건: `for (const client of this.activeConnections) {`
       * - 예상 시나리오: 지정된 조건 한계 도달 시점까지 콜렉션 항목의 순차 매핑, 변환 및 동기 적재 처리를 수행함.
       * - 예시: `for (const item of list)` 루프 실행 시 모든 개별 블록의 html 포맷 정제 완료 후 스택 종결.
       */
          for (const client of this.activeConnections) {
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `client !== ws && client.readyState === 1`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (client !== ws && client.readyState === 1)` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
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
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `this.collabilationServer`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (this.collabilationServer)` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
    if (this.collabilationServer) {
      /*
       * [LOOP CONTROL ITERATION]
       * - 루프 조건: `for (const ws of this.activeConnections) ws.close()`
       * - 예상 시나리오: 지정된 조건 한계 도달 시점까지 콜렉션 항목의 순차 매핑, 변환 및 동기 적재 처리를 수행함.
       * - 예시: `for (const item of list)` 루프 실행 시 모든 개별 블록의 html 포맷 정제 완료 후 스택 종결.
       */
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

