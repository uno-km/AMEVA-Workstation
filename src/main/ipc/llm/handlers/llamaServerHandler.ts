/**
 * @file llamaServerHandler.ts
 * @system AMEVA OS Desktop Workstation
 * @location src/main/ipc/llm/handlers/llamaServerHandler.ts
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
import { LLMProcessManager } from '../../../services/llmProcessManager.js'
import type { TokenSender } from '../helpers/tokenSender.js'

  /*
   * [FUNCTION CONTRACT]
   * - 함수 명: `handleLlamaServerGenerate`
   * - 역할: 인자 정보를 검수하고 비즈니스 계약 조건에 맞춰 최종 바인딩 결과물/바이너리 버퍼를 반환함.
   * - 예시: `handleLlamaServerGenerate(...)` 호출 시 런타임 비동기/동기 연쇄 반응 유도.
   */
export function handleLlamaServerGenerate(
  payload: any,
  tokenSender: TokenSender,
  sessionId: string,
  event: any,
  llamaPath: string,
  modelPath: string,
  contextSize: number,
  fullPrompt: string,
  maxTokens: number,
  temperature: number,
  stopTokens: string[]
): Promise<{ success: boolean; error?: string; response?: string }> {
  return new Promise<{ success: boolean; error?: string; response?: string }>(async (resolve) => {
    try {
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `gpuOnlyFlag`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const gpuOnlyFlag = ...` 형태로 안전 캐싱 후 가공 기동.
       */
      const gpuOnlyFlag = payload.gpuOnly !== false

      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `serverReady`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const serverReady = ...` 형태로 안전 캐싱 후 가공 기동.
       */
      const serverReady = await LLMProcessManager.startLlamaServerWithFallback(llamaPath, modelPath, contextSize, gpuOnlyFlag)

      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `!serverReady`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (!serverReady)` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
      if (!serverReady) {
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `reason`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const reason = ...` 형태로 안전 캐싱 후 가공 기동.
       */
        const reason = '서버 기동 실패 (GPU/CPU 폴백 모두 실패). 모델 파일과 llama-server 경로를 확인하세요.'
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `!event.sender.isDestroyed()`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (!event.sender.isDestroyed())` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
        if (!event.sender.isDestroyed()) {
          event.sender.send('llm:log', { text: `\n[Fatal Error] ${reason}\n` })
          event.sender.send(`llm:done:${sessionId}`, { success: false, error: reason })
        }
        return resolve({ success: false, error: reason })
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
       * - 변수 명: `cleanUp`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const cleanUp = ...` 형태로 안전 캐싱 후 가공 기동.
       */
      const cleanUp = () => {}

      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `http`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const http = ...` 형태로 안전 캐싱 후 가공 기동.
       */
      const http = require('http')
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `postData`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const postData = ...` 형태로 안전 캐싱 후 가공 기동.
       */
      const postData = JSON.stringify({
        prompt: fullPrompt,
        n_predict: maxTokens,
        temperature: temperature,
        stream: true,
        stop: stopTokens
      })

      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `reqOptions`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const reqOptions = ...` 형태로 안전 캐싱 후 가공 기동.
       */
      const reqOptions = {
        hostname: '127.0.0.1',
        port: LLMProcessManager.serverPort,
        path: '/completion',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData)
        }
      }

      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `req`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const req = ...` 형태로 안전 캐싱 후 가공 기동.
       */
      const req = http.request(reqOptions, (res: any) => {
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
       * - 변수 명: `sseBuffer`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const sseBuffer = ...` 형태로 안전 캐싱 후 가공 기동.
       */
        let sseBuffer = ''
        res.on('data', (chunk: Buffer) => {
          sseBuffer += chunk.toString()
          
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `eolIndex`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const eolIndex = ...` 형태로 안전 캐싱 후 가공 기동.
       */
          let eolIndex = -1
      /*
       * [LOOP CONTROL ITERATION]
       * - 루프 조건: `while ((eolIndex = sseBuffer.indexOf('\n\n')) >= 0) {`
       * - 예상 시나리오: 지정된 조건 한계 도달 시점까지 콜렉션 항목의 순차 매핑, 변환 및 동기 적재 처리를 수행함.
       * - 예시: `for (const item of list)` 루프 실행 시 모든 개별 블록의 html 포맷 정제 완료 후 스택 종결.
       */
          while ((eolIndex = sseBuffer.indexOf('\n\n')) >= 0) {
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `part`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const part = ...` 형태로 안전 캐싱 후 가공 기동.
       */
            const part = sseBuffer.slice(0, eolIndex)
            sseBuffer = sseBuffer.slice(eolIndex + 2)
            
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `lines`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const lines = ...` 형태로 안전 캐싱 후 가공 기동.
       */
            const lines = part.split('\n')
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
                  const token = parsed.content
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `token !== undefined && token !== null`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (token !== undefined && token !== null)` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
                  if (token !== undefined && token !== null) {
                    buffer += token
                    tokenSender.send(token)
                  }
                } catch (err) {
                  console.error('SSE JSON Parse Error:', err, 'Data:', cleaned)
                }
              }
            }
          }
        })

        res.on('end', () => {
          cleanUp()
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
       * - 조건 식: `!event.sender.isDestroyed()`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (!event.sender.isDestroyed())` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
            if (!event.sender.isDestroyed()) {
              event.sender.send(`llm:done:${sessionId}`, { success: true, fullText: buffer })
            }
            resolve({ success: true, response: buffer })
          }
        })
      })

      req.on('error', (err: any) => {
        cleanUp()
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
       * - 조건 식: `!event.sender.isDestroyed()`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (!event.sender.isDestroyed())` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
          if (!event.sender.isDestroyed()) {
            event.sender.send(`llm:done:${sessionId}`, { success: false, error: err.message })
          }
          resolve({ success: false, error: `llama-server 통신 실패: ${err.message}` })
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
        cleanUp()
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
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `LLMProcessManager.activeLLMProcess`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (LLMProcessManager.activeLLMProcess)` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
      if (LLMProcessManager.activeLLMProcess) {
        LLMProcessManager.activeLLMProcess.kill('SIGKILL')
        LLMProcessManager.activeLLMProcess = null
      }
      resolve({ success: false, error: err.message })
    }
  })
}

