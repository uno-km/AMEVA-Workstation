import { ipcMain } from 'electron'

/**
 * @file restIpc.ts
 * @system AMEVA OS Desktop Workstation
 * @location packages/desktop/src/main/ipc/restIpc.ts
 * @role Proxy HTTP requests via Main Process to bypass browser CORS limitations.
 * 
 * [소비처 - CONSUMERS / USAGE CONTEXT]
 * - 소비처 A (packages/core/src/renderer/services/ipc/adapters/appAdapter.ts): 렌더러 IPC 어댑터 레이어
 * - 소비처 B (packages/core/src/renderer/components/RestClientPlugin.tsx): REST 클라이언트 플러그인 뷰
 */

/*
 * [FUNCTION CONTRACT]
 * - 함수 명: `registerRestIpc`
 * - 역할: HTTP API를 직접 찌르는 `http:request` IPC 채널 핸들러를 Electron 메인 프로세스에 등록한다.
 *         렌더러(크롬 브라우저 샌드박스)의 CORS 제약을 원천 우회하기 위해 Node.js의 fetch를 활용한다.
 */
export function registerRestIpc(): void {
  ipcMain.handle('http:request', async (_event, payload: {
    url: string
    method: string
    headers?: Record<string, string>
    body?: string
  }) => {
    try {
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `options`
       * - 자료형 / 예상 값: RequestInit
       * - 시나리오: HTTP 요청 메소드를 대문자로 표준화하고 헤더 레코드를 주입하여 fetch 요청 옵션을 설정한다.
       */
      const options: RequestInit = {
        method: payload.method.toUpperCase(),
        headers: payload.headers || {},
      }

      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: GET 또는 HEAD 메소드가 아닌 경우에만 요청 바디(Body) 데이터를 실어 보낸다.
       */
      if (!['GET', 'HEAD'].includes(options.method!)) {
        options.body = payload.body
      }

      console.log(`[restIpc] Proxying ${options.method} request to: ${payload.url}`)
      const response = await fetch(payload.url, options)
      
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `responseHeaders`
       * - 자료형 / 예상 값: Record<string, string>
       * - 시나리오: 응답 헤더 객체를 순회하여 렌더러로 보낼 수 있는 플랫 딕셔너리로 변환 적재한다.
       */
      const responseHeaders: Record<string, string> = {}
      response.headers.forEach((value, key) => {
        responseHeaders[key] = value
      })

      const status = response.status
      const statusText = response.statusText
      const bodyText = await response.text()

      return {
        success: true,
        status,
        statusText,
        headers: responseHeaders,
        body: bodyText
      }
    } catch (e: any) {
      /*
       * [CONTRACT] 예외 발생 시 침묵하지 않고 디버깅 및 에러 추적을 위한 로그를 남긴다.
       */
      console.error('[restIpc] Request failed:', e)
      return {
        success: false,
        error: e.message || String(e)
      }
    }
  })
}
