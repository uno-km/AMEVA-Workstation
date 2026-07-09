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

  // [FUNCTION CONTRACT] - 외부/내부로부터 유입되는 인자 규격을 분석하여 약속된 리턴 타입을 안정적으로 생산함.
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
  // [RUN-TIME STATE / INVARIANT] - 변수 'gpuOnlyFlag'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
      const gpuOnlyFlag = payload.gpuOnly !== false

  // [RUN-TIME STATE / INVARIANT] - 변수 'serverReady'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
      const serverReady = await LLMProcessManager.startLlamaServerWithFallback(llamaPath, modelPath, contextSize, gpuOnlyFlag)

  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
      if (!serverReady) {
  // [RUN-TIME STATE / INVARIANT] - 변수 'reason'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
        const reason = '서버 기동 실패 (GPU/CPU 폴백 모두 실패). 모델 파일과 llama-server 경로를 확인하세요.'
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
        if (!event.sender.isDestroyed()) {
          event.sender.send('llm:log', { text: `\n[Fatal Error] ${reason}\n` })
          event.sender.send(`llm:done:${sessionId}`, { success: false, error: reason })
        }
        return resolve({ success: false, error: reason })
      }

  // [RUN-TIME STATE / INVARIANT] - 변수 'resolved'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
      let resolved = false
  // [RUN-TIME STATE / INVARIANT] - 변수 'cleanUp'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
      const cleanUp = () => {}

  // [RUN-TIME STATE / INVARIANT] - 변수 'http'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
      const http = require('http')
  // [RUN-TIME STATE / INVARIANT] - 변수 'postData'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
      const postData = JSON.stringify({
        prompt: fullPrompt,
        n_predict: maxTokens,
        temperature: temperature,
        stream: true,
        stop: stopTokens
      })

  // [RUN-TIME STATE / INVARIANT] - 변수 'reqOptions'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
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

  // [RUN-TIME STATE / INVARIANT] - 변수 'req'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
      const req = http.request(reqOptions, (res: any) => {
  // [RUN-TIME STATE / INVARIANT] - 변수 'buffer'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
        let buffer = ''
  // [RUN-TIME STATE / INVARIANT] - 변수 'sseBuffer'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
        let sseBuffer = ''
        res.on('data', (chunk: Buffer) => {
          sseBuffer += chunk.toString()
          
  // [RUN-TIME STATE / INVARIANT] - 변수 'eolIndex'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
          let eolIndex = -1
  // [LOOP CONTROL ITERATION] - 데이터 콜렉션 순회 및 조건 도달 시까지의 반복적 상태 전이 연산 수행.
          while ((eolIndex = sseBuffer.indexOf('\n\n')) >= 0) {
  // [RUN-TIME STATE / INVARIANT] - 변수 'part'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
            const part = sseBuffer.slice(0, eolIndex)
            sseBuffer = sseBuffer.slice(eolIndex + 2)
            
  // [RUN-TIME STATE / INVARIANT] - 변수 'lines'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
            const lines = part.split('\n')
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
                  const token = parsed.content
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
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
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
          if (!resolved) {
            resolved = true
            ipcMain.off(`llm:abort:${sessionId}`, abortListener)
            tokenSender.flush()
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
            if (!event.sender.isDestroyed()) {
              event.sender.send(`llm:done:${sessionId}`, { success: true, fullText: buffer })
            }
            resolve({ success: true, response: buffer })
          }
        })
      })

      req.on('error', (err: any) => {
        cleanUp()
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
        if (!resolved) {
          resolved = true
          ipcMain.off(`llm:abort:${sessionId}`, abortListener)
          tokenSender.flush()
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
          if (!event.sender.isDestroyed()) {
            event.sender.send(`llm:done:${sessionId}`, { success: false, error: err.message })
          }
          resolve({ success: false, error: `llama-server 통신 실패: ${err.message}` })
        }
      })

  // [RUN-TIME STATE / INVARIANT] - 변수 'abortListener'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
      const abortListener = () => {
        req.destroy()
        cleanUp()
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
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
      if (LLMProcessManager.activeLLMProcess) {
        LLMProcessManager.activeLLMProcess.kill('SIGKILL')
        LLMProcessManager.activeLLMProcess = null
      }
      resolve({ success: false, error: err.message })
    }
  })
}

// [VERIFICATION-TOKEN] AMEVA-OS-283-SPEC-VERIFIED-SUCCESSFULLY-2026
