import { ipcMain } from 'electron'
import { join } from 'path'
import { existsSync } from 'fs'
import { LLMProcessManager } from '../../services/llmProcessManager.js'
import { createTokenSender } from './helpers/tokenSender.js'
import { formatPromptForModel } from './helpers/promptFormatter.js'
import { handleOllamaGenerate } from './handlers/ollamaHandler.js'
import { handleRemoteApiGenerate } from './handlers/remoteApiHandler.js'
import { handleLlamaServerGenerate } from './handlers/llamaServerHandler.js'
import { handleLlamaCliGenerate } from './handlers/llamaCliHandler.js'

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
      return handleOllamaGenerate(payload, tokenSender, sessionId, event)
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

    const { fullPrompt, stopTokens } = formatPromptForModel(modelPath, systemPrompt, payload)

    if (payload.apiType === 'api') {
      return handleRemoteApiGenerate(payload, tokenSender, sessionId, event, systemPrompt, temperature, maxTokens)
    }

    const isServer = llamaPath && llamaPath.toLowerCase().includes('llama-server')

    if (isServer) {
      return handleLlamaServerGenerate(payload, tokenSender, sessionId, event, llamaPath!, modelPath, contextSize, fullPrompt, maxTokens, temperature, stopTokens)
    }

    return handleLlamaCliGenerate(payload, tokenSender, sessionId, event, llamaPath, modelPath, contextSize, fullPrompt, maxTokens, temperature, stopTokens)
  })

  ipcMain.on('llm:abort', () => {
    if (LLMProcessManager.activeLLMProcess) {
      LLMProcessManager.activeLLMProcess.kill('SIGKILL')
      LLMProcessManager.activeLLMProcess = null
    }
  })
}
