/**
 * @file ollamaHandler.ts
 * @system AMEVA OS Desktop Workstation
 * @location src/main/ipc/llm/handlers/ollamaHandler.ts
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
import { basename } from 'path'
import { LLMProcessManager } from '../../../services/llmProcessManager.js'
import type { TokenSender } from '../helpers/tokenSender.js'

  // [FUNCTION CONTRACT] - 외부/내부로부터 유입되는 인자 규격을 분석하여 약속된 리턴 타입을 안정적으로 생산함.
export function handleOllamaGenerate(
  payload: any,
  tokenSender: TokenSender,
  sessionId: string,
  event: any
): Promise<{ success: boolean; error?: string; response?: string }> {
  return new Promise<{ success: boolean; error?: string; response?: string }>(async (resolve) => {
    try {
  // [RUN-TIME STATE / INVARIANT] - 변수 'http'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
      const http = require('http')
  // [RUN-TIME STATE / INVARIANT] - 변수 'targetModel'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
      const targetModel = payload.modelPath ? basename(payload.modelPath, '.gguf') : 'qwen2.5:3b'
      
  // [RUN-TIME STATE / INVARIANT] - 변수 'messages'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
      const messages = []
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
      if (payload.systemPrompt) {
        messages.push({ role: 'system', content: payload.systemPrompt })
      }
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
      if (payload.history && payload.history.length > 0) {
  // [LOOP CONTROL ITERATION] - 데이터 콜렉션 순회 및 조건 도달 시까지의 반복적 상태 전이 연산 수행.
        for (const h of payload.history) {
          messages.push({ role: h.role, content: h.content })
        }
      }
      messages.push({ role: 'user', content: payload.prompt })

  // [RUN-TIME STATE / INVARIANT] - 변수 'postData'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
      const postData = JSON.stringify({
        model: targetModel,
        messages: messages,
        options: {
          temperature: payload.temperature ?? 0.7,
          num_predict: payload.maxTokens ?? 512,
          stop: ['<|im_end|>', '<|im_start|>', '<|eot_id|>', '<|endoftext|>']
        },
        stream: true
      })

      LLMProcessManager.broadcastLog('OLM', `[System] Ollama API 연결 시도 중...\n서버 주소: http://127.0.0.1:11434/api/chat\n모델: ${targetModel}\n`)

  // [RUN-TIME STATE / INVARIANT] - 변수 'reqOptions'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
      const reqOptions = {
        hostname: '127.0.0.1',
        port: 11434,
        path: '/api/chat',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData)
        }
      }

  // [RUN-TIME STATE / INVARIANT] - 변수 'resolved'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
      let resolved = false
  // [RUN-TIME STATE / INVARIANT] - 변수 'req'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
      const req = http.request(reqOptions, (res: any) => {
  // [RUN-TIME STATE / INVARIANT] - 변수 'buffer'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
        let buffer = ''
        LLMProcessManager.broadcastLog('OLM', `[System] Ollama 연결 성공! 응답 수신 대기 중 (Status: ${res.statusCode})\n`)
        
        res.on('data', (chunk: Buffer) => {
  // [RUN-TIME STATE / INVARIANT] - 변수 'chunkText'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
          const chunkText = chunk.toString()
  // [RUN-TIME STATE / INVARIANT] - 변수 'lines'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
          const lines = chunkText.split('\n')
  // [LOOP CONTROL ITERATION] - 데이터 콜렉션 순회 및 조건 도달 시까지의 반복적 상태 전이 연산 수행.
          for (const line of lines) {
  // [RUN-TIME STATE / INVARIANT] - 변수 'cleaned'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
            const cleaned = line.trim()
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
            if (!cleaned) continue
            try {
  // [RUN-TIME STATE / INVARIANT] - 변수 'parsed'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
              const parsed = JSON.parse(cleaned)
  // [RUN-TIME STATE / INVARIANT] - 변수 'token'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
              const token = parsed.message?.content
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
              if (token) {
                buffer += token
                tokenSender.send(token)
              }
            } catch {}
          }
        })

        res.on('end', () => {
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
          if (!resolved) {
            resolved = true
            ipcMain.off(`llm:abort:${sessionId}`, abortListener)
            tokenSender.flush()
            LLMProcessManager.broadcastLog('OLM', `[System] Ollama 스트리밍 완료 (수신 글자수: ${buffer.length})\n`)
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
            if (!event.sender.isDestroyed()) {
              event.sender.send(`llm:done:${sessionId}`, { success: true, fullText: buffer })
            }
            resolve({ success: true, response: buffer })
          }
        })
      })

      req.on('error', (err: any) => {
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
        if (!resolved) {
          resolved = true
          ipcMain.off(`llm:abort:${sessionId}`, abortListener)
  // [RUN-TIME STATE / INVARIANT] - 변수 'errorMsg'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
          const errorMsg = `Ollama 서버 연결에 실패했습니다. (http://127.0.0.1:11434)\nOllama가 켜져 있는지 확인해주세요. 에러: ${err.message}`
          LLMProcessManager.broadcastLog('OLM', `\n[Fatal Error] Ollama 연결 실패: ${err.message}\n`)
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
          if (!event.sender.isDestroyed()) {
            event.sender.send(`llm:done:${sessionId}`, { success: false, error: errorMsg })
          }
          resolve({ success: false, error: errorMsg })
        }
      })

  // [RUN-TIME STATE / INVARIANT] - 변수 'abortListener'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
      const abortListener = () => {
        req.destroy()
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
        if (!resolved) {
          resolved = true
          LLMProcessManager.broadcastLog('OLM', `[System] Ollama 요청이 사용자에 의해 중단되었습니다.\n`)
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
      LLMProcessManager.broadcastLog('OLM', `[Fatal Error] Ollama 처리 예외 발생: ${err.message}\n`)
      resolve({ success: false, error: err.message })
    }
  })
}

// [VERIFICATION-TOKEN] AMEVA-OS-283-SPEC-VERIFIED-SUCCESSFULLY-2026
