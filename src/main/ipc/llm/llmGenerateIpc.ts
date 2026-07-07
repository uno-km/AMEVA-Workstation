import { ipcMain } from 'electron'
import { join, basename } from 'path'
import { existsSync } from 'fs'
import { spawn } from 'child_process'
import { LLMProcessManager } from '../../services/llmProcessManager.js'

// 🤖 [FIX-IPC-003] 토큰 스트리밍 스로틀 전송 헬퍼
function createTokenSender(event: any, sessionId: string) {
  let pendingTokens: string[] = []
  let throttleTimeout: NodeJS.Timeout | null = null

  const flush = () => {
    if (pendingTokens.length > 0) {
      if (!event.sender.isDestroyed()) {
        event.sender.send(`llm:token:${sessionId}`, { token: pendingTokens.join('') })
      }
      pendingTokens = []
    }
    throttleTimeout = null
  }

  return {
    send: (token: string) => {
      pendingTokens.push(token)
      if (!throttleTimeout) {
        throttleTimeout = setTimeout(flush, 30) // 30ms 스로틀 통일
      }
    },
    flush: () => {
      if (throttleTimeout) {
        clearTimeout(throttleTimeout)
      }
      flush()
    }
  }
}

/**
 * LLM 추론 생성(generate) 및 스트리밍 중단(abort) 관련 IPC 등록
 */
export function registerLlmGenerateIpc(): void {
  // 스트리밍 LLM 추론
  ipcMain.handle('llm:generate', async (event, payload: {
    sessionId: string
    modelPath: string
    prompt: string
    context?: string
    systemPrompt?: string
    maxTokens?: number
    temperature?: number
    contextSize?: number
    apiType?: 'local' | 'api' | 'ollama' | 'wasm'
    apiKey?: string
    apiEndpoint?: string
    apiModel?: string
    gpuOnly?: boolean
    history?: { role: 'user' | 'assistant'; content: string }[]
  }) => {
    const sessionId = payload.sessionId || 'default'
    const tokenSender = createTokenSender(event, sessionId)

    if (LLMProcessManager.activeLLMProcess) {
      LLMProcessManager.activeLLMProcess.kill()
      LLMProcessManager.activeLLMProcess = null
    }

    const llamaPath = LLMProcessManager.findLlamaCli()
    let modelPath = payload.modelPath || 'C:\\ameva\\models\\llm\\qwen2.5-3b-instruct-q4_k_m.gguf'

    if (!existsSync(modelPath) && !payload.modelPath) {
      const llmDir = 'C:\\ameva\\models\\llm'
      if (existsSync(llmDir)) {
        try {
          const { readdirSync } = require('fs')
          const files = readdirSync(llmDir)
          const firstGguf = files.find((f: string) => f.endsWith('.gguf'))
          if (firstGguf) {
            modelPath = join(llmDir, firstGguf)
          }
        } catch {}
      }
    }

    if (payload.apiType === 'ollama') {
      return new Promise<{ success: boolean; error?: string }>(async (resolve) => {
        try {
          const http = require('http')
          const targetModel = payload.modelPath ? basename(payload.modelPath, '.gguf') : 'qwen2.5:3b'
          
          const messages = []
          if (payload.systemPrompt) {
            messages.push({ role: 'system', content: payload.systemPrompt })
          }
          if (payload.history && payload.history.length > 0) {
            for (const h of payload.history) {
              messages.push({ role: h.role, content: h.content })
            }
          }
          messages.push({ role: 'user', content: payload.prompt })

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

          let resolved = false
          const req = http.request(reqOptions, (res: any) => {
            let buffer = ''
            LLMProcessManager.broadcastLog('OLM', `[System] Ollama 연결 성공! 응답 수신 대기 중 (Status: ${res.statusCode})\n`)
            
            res.on('data', (chunk: Buffer) => {
              const chunkText = chunk.toString()
              const lines = chunkText.split('\n')
              for (const line of lines) {
                const cleaned = line.trim()
                if (!cleaned) continue
                try {
                  const parsed = JSON.parse(cleaned)
                  const token = parsed.message?.content
                  if (token) {
                    buffer += token
                    tokenSender.send(token)
                  }
                } catch {}
              }
            })

            res.on('end', () => {
              if (!resolved) {
                resolved = true
                ipcMain.off(`llm:abort:${sessionId}`, abortListener)
                tokenSender.flush()
                LLMProcessManager.broadcastLog('OLM', `[System] Ollama 스트리밍 완료 (수신 글자수: ${buffer.length})\n`)
                if (!event.sender.isDestroyed()) {
                  event.sender.send(`llm:done:${sessionId}`, { success: true, fullText: buffer })
                }
                resolve({ success: true, response: buffer } as any)
              }
            })
          })

          req.on('error', (err: any) => {
            if (!resolved) {
              resolved = true
              ipcMain.off(`llm:abort:${sessionId}`, abortListener)
              const errorMsg = `Ollama 서버 연결에 실패했습니다. (http://127.0.0.1:11434)\nOllama가 켜져 있는지 확인해주세요. 에러: ${err.message}`
              LLMProcessManager.broadcastLog('OLM', `\n[Fatal Error] Ollama 연결 실패: ${err.message}\n`)
              if (!event.sender.isDestroyed()) {
                event.sender.send(`llm:done:${sessionId}`, { success: false, error: errorMsg })
              }
              resolve({ success: false, error: errorMsg })
            }
          })

          const abortListener = () => {
            req.destroy()
            if (!resolved) {
              resolved = true
              LLMProcessManager.broadcastLog('OLM', `[System] Ollama 요청이 사용자에 의해 중단되었습니다.\n`)
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

    const isRealExecutionAvailable = existsSync(modelPath) && existsSync(llamaPath || '')
    if (!isRealExecutionAvailable) {
      return new Promise<{ success: boolean; error?: string }>((resolve) => {
        const errorMsg = `로컬 모델 파일 또는 엔진 바이너리가 디바이스에 존재하지 않습니다.\n\n- 엔진 경로: ${llamaPath || '미지정'}\n- 모델 파일: ${modelPath}\n\n우측 상단 톱니바퀴 -> 'Models' 탭에서 파일을 체크하시거나, AI 패널의 설정 기어 버튼 -> '모델 허브 개방'을 통해 간편하게 AI를 설정해주세요.`
        if (!event.sender.isDestroyed()) {
          event.sender.send('llm:log', { text: `\n[Fatal Error] 실행 실패:\n${errorMsg}\n` })
          event.sender.send(`llm:done:${sessionId}`, { success: false, error: errorMsg })
        }
        resolve({ success: false, error: errorMsg })
      })
    }

    const systemPrompt = payload.systemPrompt || 'You are AMEVA AI, a helpful assistant integrated into AMEVA document editor. Respond in the same language as the user. Be concise and helpful.'
    const temperature = payload.temperature ?? 0.7
    const maxTokens = payload.maxTokens ?? 512
    const contextSize = payload.contextSize ?? 8192

    const modelNameLower = basename(modelPath).toLowerCase()
    let modelType: 'qwen' | 'llama' | 'gemma' | 'generic' = 'generic'
    if (modelNameLower.includes('qwen')) {
      modelType = 'qwen'
    } else if (modelNameLower.includes('llama')) {
      modelType = 'llama'
    } else if (modelNameLower.includes('gemma')) {
      modelType = 'gemma'
    }

    let fullPrompt = ''
    let stopTokens: string[] = []

    if (modelType === 'llama') {
      fullPrompt = `<|begin_of_text|><|start_header_id|>system<|end_header_id|>\n\n${systemPrompt}<|eot_id|>`
      if (payload.context) {
        fullPrompt += `<|start_header_id|>context<|end_header_id|>\n\n${payload.context.slice(0, 2000)}<|eot_id|>`
      }
      if (payload.history && payload.history.length > 0) {
        for (const h of payload.history) {
          fullPrompt += `<|start_header_id|>${h.role === 'assistant' ? 'assistant' : 'user'}<|end_header_id|>\n\n${h.content}<|eot_id|>`
        }
      }
      fullPrompt += `<|start_header_id|>user<|end_header_id|>\n\n${payload.prompt}<|eot_id|><|start_header_id|>assistant<|end_header_id|>\n\n`
      stopTokens = ['<|eot_id|>', '<|start_header_id|>', '<|end_of_text|>']
    } else if (modelType === 'gemma') {
      fullPrompt = `<start_of_turn>user\n${systemPrompt}\n\n`
      if (payload.context) {
        fullPrompt += `[Context]\n${payload.context.slice(0, 2000)}\n\n`
      }
      if (payload.history && payload.history.length > 0) {
        let currentTurn: 'user' | 'model' = 'user'
        for (const h of payload.history) {
          const role = h.role === 'assistant' ? 'model' : 'user'
          if (role !== currentTurn) {
            fullPrompt += `<end_of_turn>\n<start_of_turn>${role}\n`
            currentTurn = role
          }
          fullPrompt += `${h.content}\n`
        }
        if (currentTurn !== 'user') {
          fullPrompt += `<end_of_turn>\n<start_of_turn>user\n`
        }
      }
      fullPrompt += `${payload.prompt}<end_of_turn>\n<start_of_turn>model\n`
      stopTokens = ['<end_of_turn>', '<eos>', '<start_of_turn>']
    } else {
      fullPrompt = `<|im_start|>system\n${systemPrompt}<|im_end|>\n`
      if (payload.context) {
        fullPrompt += `<|im_start|>context\n${payload.context.slice(0, 2000)}<|im_end|>\n`
      }
      if (payload.history && payload.history.length > 0) {
        for (const h of payload.history) {
          fullPrompt += `<|im_start|>${h.role}\n${h.content}<|im_end|>\n`
        }
      }
      fullPrompt += `<|im_start|>user\n${payload.prompt}<|im_end|>\n<|im_start|>assistant\n`
      stopTokens = ['<|im_end|>', '<|im_start|>', '<|endoftext|>']
    }

    if (payload.apiType === 'api') {
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

    const isServer = llamaPath && llamaPath.toLowerCase().includes('llama-server')

    if (isServer) {
      return new Promise<{ success: boolean; error?: string }>(async (resolve) => {
        try {
          const gpuOnlyFlag = payload.gpuOnly !== false

          const serverReady = await LLMProcessManager.startLlamaServerWithFallback(llamaPath!, modelPath, contextSize, gpuOnlyFlag)

          if (!serverReady) {
            const reason = '서버 기동 실패 (GPU/CPU 폴백 모두 실패). 모델 파일과 llama-server 경로를 확인하세요.'
            if (!event.sender.isDestroyed()) {
              event.sender.send('llm:log', { text: `\n[Fatal Error] ${reason}\n` })
              event.sender.send(`llm:done:${sessionId}`, { success: false, error: reason })
            }
            return resolve({ success: false, error: reason })
          }

          let resolved = false
          const cleanUp = () => {}

          const http = require('http')
          const postData = JSON.stringify({
            prompt: fullPrompt,
            n_predict: maxTokens,
            temperature: temperature,
            stream: true,
            stop: stopTokens
          })

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

          const req = http.request(reqOptions, (res: any) => {
            let buffer = ''
            let sseBuffer = ''
            res.on('data', (chunk: Buffer) => {
              sseBuffer += chunk.toString()
              
              let eolIndex = -1
              while ((eolIndex = sseBuffer.indexOf('\n\n')) >= 0) {
                const part = sseBuffer.slice(0, eolIndex)
                sseBuffer = sseBuffer.slice(eolIndex + 2)
                
                const lines = part.split('\n')
                for (const line of lines) {
                  const cleaned = line.trim()
                  if (cleaned.startsWith('data:')) {
                    try {
                      const dataStr = cleaned.slice(5).trim()
                      if (dataStr === '[DONE]') continue
                      const parsed = JSON.parse(dataStr)
                      const token = parsed.content
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
              if (!resolved) {
                resolved = true
                ipcMain.off(`llm:abort:${sessionId}`, abortListener)
                tokenSender.flush()
                if (!event.sender.isDestroyed()) {
                  event.sender.send(`llm:done:${sessionId}`, { success: true, fullText: buffer })
                }
                resolve({ success: true, response: buffer } as any)
              }
            })
          })

          req.on('error', (err: any) => {
            cleanUp()
            if (!resolved) {
              resolved = true
              ipcMain.off(`llm:abort:${sessionId}`, abortListener)
              tokenSender.flush()
              if (!event.sender.isDestroyed()) {
                event.sender.send(`llm:done:${sessionId}`, { success: false, error: err.message })
              }
              resolve({ success: false, error: `llama-server 통신 실패: ${err.message}` })
            }
          })

          const abortListener = () => {
            req.destroy()
            cleanUp()
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
          if (LLMProcessManager.activeLLMProcess) {
            LLMProcessManager.activeLLMProcess.kill('SIGKILL')
            LLMProcessManager.activeLLMProcess = null
          }
          resolve({ success: false, error: err.message })
        }
      })
    }

    const args = [
      '-m', modelPath,
      '-p', fullPrompt,
      '-n', String(maxTokens),
      '--temp', String(temperature),
      '-c', String(contextSize),
      '--no-display-prompt',
      '--no-conversation',
      '--simple-io',
      '-ngl', payload.gpuOnly !== false ? '99' : '0',
      '-t', '4',
    ]
    for (const token of stopTokens) {
      args.push('--stop', token)
    }

    return new Promise<{ success: boolean; error?: string }>((resolve) => {
      if (!llamaPath || !existsSync(llamaPath) || llamaPath === 'llama-cli') {
        const errorMsg = `온디바이스 실행 엔진(llama-cli)을 찾을 수 없습니다. 경로: ${llamaPath || '미지정'}\n\n우측 상단 설정의 'Models' 탭 또는 AI 패널 설정의 '모델 허브 개방' 단추를 눌러 AI 모델 및 엔진을 셋업해주세요.`
        
        if (!event.sender.isDestroyed()) {
          event.sender.send('llm:log', { text: `\n[Fatal Error] AI 엔진 실행 실패:\n${errorMsg}\n` })
          event.sender.send('llm:done', { success: false, error: errorMsg })
        }
        return resolve({ success: false, error: errorMsg })
      }

      try {
        const modeText = payload.gpuOnly !== false 
          ? '[System] GPU 연산 가속 모드로 프로세스를 가동합니다. (-ngl 99 옵션 주입)' 
          : '[System] CPU 전용 연산 모드로 프로세스를 가동합니다. (-ngl 0, -t 4 스레드 옵션 주입)'

        if (!event.sender.isDestroyed()) {
          event.sender.send('llm:log', { text: `[System] AI 프로세스 실행 시도 중...\n${modeText}\n엔진 경로: ${llamaPath}\n모델 경로: ${modelPath}\n` })
        }

        const proc = spawn(llamaPath, args, { windowsHide: true })
        LLMProcessManager.activeLLMProcess = proc

        let buffer = ''
        let resolved = false

        const abortListener = () => {
          proc.kill('SIGKILL')
          LLMProcessManager.activeLLMProcess = null
          if (!resolved) {
            resolved = true
            if (!event.sender.isDestroyed()) {
              event.sender.send(`llm:done:${sessionId}`, { success: false, error: '사용자에 의해 중단됨' })
            }
            resolve({ success: false, error: 'Aborted' })
          }
          ipcMain.off(`llm:abort:${sessionId}`, abortListener)
        }
        ipcMain.once(`llm:abort:${sessionId}`, abortListener)

        const { StringDecoder } = require('string_decoder')
        const stdoutDecoder = new StringDecoder('utf8')
        const stderrDecoder = new StringDecoder('utf8')
        let rawBuffer = ''

        proc.stdout.on('data', (data: Buffer) => {
          const text = stdoutDecoder.write(data)
          buffer += text
          rawBuffer += text

          LLMProcessManager.broadcastLog('LMA', text)

          if (rawBuffer.includes('[ Prompt:')) {
            return
          }

          const statsIndex = rawBuffer.indexOf('[ Prompt:')
          
          let chunkToSend = text
          if (statsIndex !== -1) {
            const textIndexInRaw = rawBuffer.length - text.length
            const cutLength = statsIndex - textIndexInRaw
            if (cutLength > 0) {
              chunkToSend = text.substring(0, cutLength)
            } else {
              chunkToSend = ''
            }
          }

          chunkToSend = chunkToSend
            .replace(/<\|im_start|>\w*\n?/gi, '')
            .replace(/<\|im_end|>\n?/gi, '')
            .replace(/<\|endoftext\|>/gi, '')
            .replace(/(^|\n)>\s*$/, '$1')

          if (chunkToSend) {
            tokenSender.send(chunkToSend)
          }
        })

        proc.stderr.on('data', (data: Buffer) => {
          const text = stderrDecoder.write(data)
          LLMProcessManager.broadcastLog('LMA', text)
        })

        proc.on('close', (code) => {
          ipcMain.off(`llm:abort:${sessionId}`, abortListener)
          LLMProcessManager.activeLLMProcess = null
          tokenSender.flush()
          if (!resolved) {
            resolved = true
            if (!event.sender.isDestroyed()) {
              event.sender.send(`llm:done:${sessionId}`, { success: code === 0, fullText: buffer })
            }
            resolve({ success: code === 0 || code === null })
          }
        })

        proc.on('error', (err) => {
          ipcMain.off(`llm:abort:${sessionId}`, abortListener)
          LLMProcessManager.activeLLMProcess = null
          tokenSender.flush()
          if (!resolved) {
            resolved = true
            if (!event.sender.isDestroyed()) {
              event.sender.send(`llm:done:${sessionId}`, { success: false, error: err.message })
              event.sender.send('llm:log', { text: `\n[Error] llama-cli 오류: ${err.message}` })
            }
            resolve({ success: false, error: `llama-cli 실행 오류: ${err.message}\n\n시스템 호환성 또는 GPU 드라이버 설정을 확인해주세요.` })
          }
        })

      } catch (err: any) {
        if (LLMProcessManager.activeLLMProcess) {
          LLMProcessManager.activeLLMProcess = null
        }
        if (!event.sender.isDestroyed()) {
          event.sender.send('llm:log', { text: `\n[Fatal Error] spawn 동기 예외 발생: ${err.message}` })
          event.sender.send('llm:done', { success: false, error: err.message })
        }
        resolve({ success: false, error: err.message })
      }
    })
  })

  ipcMain.on('llm:abort', () => {
    if (LLMProcessManager.activeLLMProcess) {
      LLMProcessManager.activeLLMProcess.kill('SIGKILL')
      LLMProcessManager.activeLLMProcess = null
    }
  })
}
