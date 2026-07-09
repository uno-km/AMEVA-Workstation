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
      const https = require('https')
      const targetModel = payload.apiModel || 'gpt-4o-mini'
      const rawEndpoint = payload.apiEndpoint || 'https://api.openai.com/v1/chat/completions'
      let parsedEndpoint: URL
      try {
        parsedEndpoint = new URL(rawEndpoint)
      } catch {
        resolve({ success: false, error: `잘못된 API 엔드포인트 URL: ${rawEndpoint}` })
        return
      }
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

      let resolved = false
      const req = https.request(reqOptions, (res: any) => {
        const statusCode = res.statusCode || 200
        let buffer = ''
        let rawResponse = ''

        res.on('data', (chunk: Buffer) => {
          const chunkText = chunk.toString()
          rawResponse += chunkText

          if (statusCode >= 200 && statusCode < 300) {
            const lines = chunkText.split('\n')
            for (const line of lines) {
              const cleaned = line.trim()
              if (cleaned.startsWith('data:')) {
                try {
                  const dataStr = cleaned.slice(5).trim()
                  if (dataStr === '[DONE]') continue
                  const parsed = JSON.parse(dataStr)
                  const token = parsed.choices[0]?.delta?.content
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
          if (!resolved) {
            resolved = true
            ipcMain.off(`llm:abort:${sessionId}`, abortListener)
            tokenSender.flush()

            if (statusCode < 200 || statusCode >= 300) {
              let errorMessage = `HTTP 에러 코드: ${statusCode}`
              try {
                const errorObj = JSON.parse(rawResponse)
                errorMessage = errorObj.error?.message || errorObj.message || rawResponse || errorMessage
              } catch {
                if (rawResponse) errorMessage = rawResponse
              }
              if (!event.sender.isDestroyed()) {
                event.sender.send(`llm:done:${sessionId}`, { success: false, error: errorMessage })
              }
              resolve({ success: false, error: errorMessage })
            } else {
              if (!event.sender.isDestroyed()) {
                event.sender.send(`llm:done:${sessionId}`, { success: true, fullText: buffer })
              }
              resolve({ success: true })
            }
          }
        })
      })

      req.on('error', (err: any) => {
        if (!resolved) {
          resolved = true
          ipcMain.off(`llm:abort:${sessionId}`, abortListener)
          if (!event.sender.isDestroyed()) {
            event.sender.send(`llm:done:${sessionId}`, { success: false, error: err.message })
          }
          resolve({ success: false, error: `API 호출 실패: ${err.message}` })
        }
      })

      const abortListener = () => {
        req.destroy()
        if (!resolved) {
          resolved = true
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
