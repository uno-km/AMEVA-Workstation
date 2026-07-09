/**
 * @file remoteApiHandler.ts
 * @system AMEVA OS Desktop Workstation
 * @location src/main/ipc/llm/handlers/remoteApiHandler.ts
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

import { ipcMain } from 'electron'
import type { TokenSender } from '../helpers/tokenSender.js'

  /*
   * [FUNCTION CONTRACT]
   * - 함수 명: `handleRemoteApiGenerate`
   * - 역할: 인자 정보를 검수하고 비즈니스 계약 조건에 맞춰 최종 바인딩 결과물/바이너리 버퍼를 반환함.
   * - 예시: `handleRemoteApiGenerate(...)` 호출 시 런타임 비동기/동기 연쇄 반응 유도.
   */
export function handleRemoteApiGenerate(
  payload: any,
  tokenSender: TokenSender,
  sessionId: string,
  event: any,
  systemPrompt: string,
  temperature: number,
  maxTokens: number
): Promise<{ success: boolean; error?: string }> {
  return new Promise<{ success: boolean; error?: string }>(async (resolve) => {
    try {
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `https`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const https = ...` 형태로 안전 캐싱 후 가공 기동.
       */
      const https = require('https')
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `targetModel`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const targetModel = ...` 형태로 안전 캐싱 후 가공 기동.
       */
      const targetModel = payload.apiModel || 'gpt-4o-mini'
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `rawEndpoint`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const rawEndpoint = ...` 형태로 안전 캐싱 후 가공 기동.
       */
      const rawEndpoint = payload.apiEndpoint || 'https://api.openai.com/v1/chat/completions'
      let parsedEndpoint: URL
      try {
        parsedEndpoint = new URL(rawEndpoint)
      } catch {
        resolve({ success: false, error: `잘못된 API 엔드포인트 URL: ${rawEndpoint}` })
        return
      }
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `postData`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const postData = ...` 형태로 안전 캐싱 후 가공 기동.
       */
      const postData = JSON.stringify({
        model: targetModel,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: payload.prompt }
        ],
        temperature: temperature,
        max_tokens: maxTokens,
        stream: true
      })

      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `reqOptions`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const reqOptions = ...` 형태로 안전 캐싱 후 가공 기동.
       */
      const reqOptions = {
        hostname: parsedEndpoint.hostname,
        port: parseInt(parsedEndpoint.port) || 443,
        path: parsedEndpoint.pathname + (parsedEndpoint.search || ''),
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${payload.apiKey || ''}`
        }
      }

      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `resolved`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const resolved = ...` 형태로 안전 캐싱 후 가공 기동.
       */
      let resolved = false
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `req`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const req = ...` 형태로 안전 캐싱 후 가공 기동.
       */
      const req = https.request(reqOptions, (res: any) => {
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `statusCode`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const statusCode = ...` 형태로 안전 캐싱 후 가공 기동.
       */
        const statusCode = res.statusCode || 200
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `buffer`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const buffer = ...` 형태로 안전 캐싱 후 가공 기동.
       */
        let buffer = ''
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `rawResponse`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const rawResponse = ...` 형태로 안전 캐싱 후 가공 기동.
       */
        let rawResponse = ''

        res.on('data', (chunk: Buffer) => {
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `chunkText`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const chunkText = ...` 형태로 안전 캐싱 후 가공 기동.
       */
          const chunkText = chunk.toString()
          rawResponse += chunkText

      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `statusCode >= 200 && statusCode < 300`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (statusCode >= 200 && statusCode < 300)` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
          if (statusCode >= 200 && statusCode < 300) {
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `lines`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const lines = ...` 형태로 안전 캐싱 후 가공 기동.
       */
            const lines = chunkText.split('\n')
      /*
       * [LOOP CONTROL ITERATION]
       * - 루프 조건: `for (const line of lines) {`
       * - 예상 시나리오: 지정된 조건 한계 도달 시점까지 콜렉션 항목의 순차 매핑, 변환 및 동기 적재 처리를 수행함.
       * - 예시: `for (const item of list)` 루프 실행 시 모든 개별 블록의 html 포맷 정제 완료 후 스택 종결.
       */
            for (const line of lines) {
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `cleaned`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const cleaned = ...` 형태로 안전 캐싱 후 가공 기동.
       */
              const cleaned = line.trim()
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `cleaned.startsWith('data:')`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (cleaned.startsWith('data:'))` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
              if (cleaned.startsWith('data:')) {
                try {
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `dataStr`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const dataStr = ...` 형태로 안전 캐싱 후 가공 기동.
       */
                  const dataStr = cleaned.slice(5).trim()
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `dataStr === '[DONE]'`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (dataStr === '[DONE]')` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
                  if (dataStr === '[DONE]') continue
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `parsed`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const parsed = ...` 형태로 안전 캐싱 후 가공 기동.
       */
                  const parsed = JSON.parse(dataStr)
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `token`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const token = ...` 형태로 안전 캐싱 후 가공 기동.
       */
                  const token = parsed.choices[0]?.delta?.content
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `token`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (token)` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
                  if (token) {
                    buffer += token
                    tokenSender.send(token)
                  }
                } catch {}
              }
            }
          }
        })

        res.on('end', () => {
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `!resolved`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (!resolved)` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
          if (!resolved) {
            resolved = true
            ipcMain.off(`llm:abort:${sessionId}`, abortListener)
            tokenSender.flush()

      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `statusCode < 200 || statusCode >= 300`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (statusCode < 200 || statusCode >= 300)` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
            if (statusCode < 200 || statusCode >= 300) {
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `errorMessage`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const errorMessage = ...` 형태로 안전 캐싱 후 가공 기동.
       */
              let errorMessage = `HTTP 에러 코드: ${statusCode}`
              try {
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `errorObj`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const errorObj = ...` 형태로 안전 캐싱 후 가공 기동.
       */
                const errorObj = JSON.parse(rawResponse)
                errorMessage = errorObj.error?.message || errorObj.message || rawResponse || errorMessage
              } catch {
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `rawResponse`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (rawResponse)` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
                if (rawResponse) errorMessage = rawResponse
              }
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `!event.sender.isDestroyed()`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (!event.sender.isDestroyed())` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
              if (!event.sender.isDestroyed()) {
                event.sender.send(`llm:done:${sessionId}`, { success: false, error: errorMessage })
              }
              resolve({ success: false, error: errorMessage })
            } else {
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `!event.sender.isDestroyed()`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (!event.sender.isDestroyed())` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
              if (!event.sender.isDestroyed()) {
                event.sender.send(`llm:done:${sessionId}`, { success: true, fullText: buffer })
              }
              resolve({ success: true })
            }
          }
        })
      })

      req.on('error', (err: any) => {
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `!resolved`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (!resolved)` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
        if (!resolved) {
          resolved = true
          ipcMain.off(`llm:abort:${sessionId}`, abortListener)
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `!event.sender.isDestroyed()`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (!event.sender.isDestroyed())` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
          if (!event.sender.isDestroyed()) {
            event.sender.send(`llm:done:${sessionId}`, { success: false, error: err.message })
          }
          resolve({ success: false, error: `API 호출 실패: ${err.message}` })
        }
      })

      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `abortListener`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const abortListener = ...` 형태로 안전 캐싱 후 가공 기동.
       */
      const abortListener = () => {
        req.destroy()
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `!resolved`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (!resolved)` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
        if (!resolved) {
          resolved = true
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `!event.sender.isDestroyed()`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (!event.sender.isDestroyed())` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
          if (!event.sender.isDestroyed()) {
            event.sender.send(`llm:done:${sessionId}`, { success: false, error: '사용자에 의해 중단됨' })
          }
          resolve({ success: false, error: 'Aborted' })
        }
      }
      ipcMain.once(`llm:abort:${sessionId}`, abortListener)

      req.write(postData)
      req.end()

    } catch (err: any) {
      resolve({ success: false, error: err.message })
    }
  })
}

