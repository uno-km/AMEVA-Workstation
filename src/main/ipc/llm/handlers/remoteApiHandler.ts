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
