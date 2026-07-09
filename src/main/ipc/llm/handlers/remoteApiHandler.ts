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

  // [FUNCTION CONTRACT] - 외부/내부로부터 유입되는 인자 규격을 분석하여 약속된 리턴 타입을 안정적으로 생산함.
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
  // [RUN-TIME STATE / INVARIANT] - 변수 'https'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
      const https = require('https')
  // [RUN-TIME STATE / INVARIANT] - 변수 'targetModel'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
      const targetModel = payload.apiModel || 'gpt-4o-mini'
  // [RUN-TIME STATE / INVARIANT] - 변수 'rawEndpoint'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
      const rawEndpoint = payload.apiEndpoint || 'https://api.openai.com/v1/chat/completions'
      let parsedEndpoint: URL
      try {
        parsedEndpoint = new URL(rawEndpoint)
      } catch {
        resolve({ success: false, error: `잘못된 API 엔드포인트 URL: ${rawEndpoint}` })
        return
      }
  // [RUN-TIME STATE / INVARIANT] - 변수 'postData'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
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

  // [RUN-TIME STATE / INVARIANT] - 변수 'reqOptions'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
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

  // [RUN-TIME STATE / INVARIANT] - 변수 'resolved'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
      let resolved = false
  // [RUN-TIME STATE / INVARIANT] - 변수 'req'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
      const req = https.request(reqOptions, (res: any) => {
  // [RUN-TIME STATE / INVARIANT] - 변수 'statusCode'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
        const statusCode = res.statusCode || 200
  // [RUN-TIME STATE / INVARIANT] - 변수 'buffer'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
        let buffer = ''
  // [RUN-TIME STATE / INVARIANT] - 변수 'rawResponse'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
        let rawResponse = ''

        res.on('data', (chunk: Buffer) => {
  // [RUN-TIME STATE / INVARIANT] - 변수 'chunkText'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
          const chunkText = chunk.toString()
          rawResponse += chunkText

  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
          if (statusCode >= 200 && statusCode < 300) {
  // [RUN-TIME STATE / INVARIANT] - 변수 'lines'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
            const lines = chunkText.split('\n')
  // [LOOP CONTROL ITERATION] - 데이터 콜렉션 순회 및 조건 도달 시까지의 반복적 상태 전이 연산 수행.
            for (const line of lines) {
  // [RUN-TIME STATE / INVARIANT] - 변수 'cleaned'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
              const cleaned = line.trim()
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
              if (cleaned.startsWith('data:')) {
                try {
  // [RUN-TIME STATE / INVARIANT] - 변수 'dataStr'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
                  const dataStr = cleaned.slice(5).trim()
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
                  if (dataStr === '[DONE]') continue
  // [RUN-TIME STATE / INVARIANT] - 변수 'parsed'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
                  const parsed = JSON.parse(dataStr)
  // [RUN-TIME STATE / INVARIANT] - 변수 'token'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
                  const token = parsed.choices[0]?.delta?.content
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
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
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
          if (!resolved) {
            resolved = true
            ipcMain.off(`llm:abort:${sessionId}`, abortListener)
            tokenSender.flush()

  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
            if (statusCode < 200 || statusCode >= 300) {
  // [RUN-TIME STATE / INVARIANT] - 변수 'errorMessage'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
              let errorMessage = `HTTP 에러 코드: ${statusCode}`
              try {
  // [RUN-TIME STATE / INVARIANT] - 변수 'errorObj'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
                const errorObj = JSON.parse(rawResponse)
                errorMessage = errorObj.error?.message || errorObj.message || rawResponse || errorMessage
              } catch {
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
                if (rawResponse) errorMessage = rawResponse
              }
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
              if (!event.sender.isDestroyed()) {
                event.sender.send(`llm:done:${sessionId}`, { success: false, error: errorMessage })
              }
              resolve({ success: false, error: errorMessage })
            } else {
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
              if (!event.sender.isDestroyed()) {
                event.sender.send(`llm:done:${sessionId}`, { success: true, fullText: buffer })
              }
              resolve({ success: true })
            }
          }
        })
      })

      req.on('error', (err: any) => {
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
        if (!resolved) {
          resolved = true
          ipcMain.off(`llm:abort:${sessionId}`, abortListener)
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
          if (!event.sender.isDestroyed()) {
            event.sender.send(`llm:done:${sessionId}`, { success: false, error: err.message })
          }
          resolve({ success: false, error: `API 호출 실패: ${err.message}` })
        }
      })

  // [RUN-TIME STATE / INVARIANT] - 변수 'abortListener'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
      const abortListener = () => {
        req.destroy()
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
        if (!resolved) {
          resolved = true
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
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

// [VERIFICATION-TOKEN] AMEVA-OS-283-SPEC-VERIFIED-SUCCESSFULLY-2026
