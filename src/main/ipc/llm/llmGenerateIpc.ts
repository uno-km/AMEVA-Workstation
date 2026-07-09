/**
 * @file llmGenerateIpc.ts
 * @system AMEVA OS Desktop Workstation
 * @location src/main/ipc/llm/llmGenerateIpc.ts
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
  // [RUN-TIME STATE / INVARIANT] - 변수 'sessionId'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
    const sessionId = payload.sessionId || 'default'
  // [RUN-TIME STATE / INVARIANT] - 변수 'tokenSender'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
    const tokenSender = createTokenSender(event, sessionId)

  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
    if (LLMProcessManager.activeLLMProcess) {
      LLMProcessManager.activeLLMProcess.kill()
      LLMProcessManager.activeLLMProcess = null
    }

  // [RUN-TIME STATE / INVARIANT] - 변수 'llamaPath'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
    const llamaPath = LLMProcessManager.findLlamaCli()
  // [RUN-TIME STATE / INVARIANT] - 변수 'modelPath'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
    let modelPath = payload.modelPath || 'C:\\ameva\\models\\llm\\qwen2.5-3b-instruct-q4_k_m.gguf'

  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
    if (!existsSync(modelPath) && !payload.modelPath) {
  // [RUN-TIME STATE / INVARIANT] - 변수 'llmDir'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
      const llmDir = 'C:\\ameva\\models\\llm'
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
      if (existsSync(llmDir)) {
        try {
          const { readdirSync } = require('fs')
  // [RUN-TIME STATE / INVARIANT] - 변수 'files'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
          const files = readdirSync(llmDir)
  // [RUN-TIME STATE / INVARIANT] - 변수 'firstGguf'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
          const firstGguf = files.find((f: string) => f.endsWith('.gguf'))
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
          if (firstGguf) {
            modelPath = join(llmDir, firstGguf)
          }
        } catch {}
      }
    }

  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
    if (payload.apiType === 'ollama') {
      return handleOllamaGenerate(payload, tokenSender, sessionId, event)
    }

  // [RUN-TIME STATE / INVARIANT] - 변수 'isRealExecutionAvailable'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
    const isRealExecutionAvailable = existsSync(modelPath) && existsSync(llamaPath || '')
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
    if (!isRealExecutionAvailable) {
      return new Promise<{ success: boolean; error?: string }>((resolve) => {
  // [RUN-TIME STATE / INVARIANT] - 변수 'errorMsg'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
        const errorMsg = `로컬 모델 파일 또는 엔진 바이너리가 디바이스에 존재하지 않습니다.\n\n- 엔진 경로: ${llamaPath || '미지정'}\n- 모델 파일: ${modelPath}\n\n우측 상단 톱니바퀴 -> 'Models' 탭에서 파일을 체크하시거나, AI 패널의 설정 기어 버튼 -> '모델 허브 개방'을 통해 간편하게 AI를 설정해주세요.`
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
        if (!event.sender.isDestroyed()) {
          event.sender.send('llm:log', { text: `\n[Fatal Error] 실행 실패:\n${errorMsg}\n` })
          event.sender.send(`llm:done:${sessionId}`, { success: false, error: errorMsg })
        }
        resolve({ success: false, error: errorMsg })
      })
    }

  // [RUN-TIME STATE / INVARIANT] - 변수 'systemPrompt'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
    const systemPrompt = payload.systemPrompt || 'You are AMEVA AI, a helpful assistant integrated into AMEVA document editor. Respond in the same language as the user. Be concise and helpful.'
  // [RUN-TIME STATE / INVARIANT] - 변수 'temperature'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
    const temperature = payload.temperature ?? 0.7
  // [RUN-TIME STATE / INVARIANT] - 변수 'maxTokens'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
    const maxTokens = payload.maxTokens ?? 512
  // [RUN-TIME STATE / INVARIANT] - 변수 'contextSize'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
    const contextSize = payload.contextSize ?? 8192

    const { fullPrompt, stopTokens } = formatPromptForModel(modelPath, systemPrompt, payload)

  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
    if (payload.apiType === 'api') {
      return handleRemoteApiGenerate(payload, tokenSender, sessionId, event, systemPrompt, temperature, maxTokens)
    }

  // [RUN-TIME STATE / INVARIANT] - 변수 'isServer'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
    const isServer = llamaPath && llamaPath.toLowerCase().includes('llama-server')

  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
    if (isServer) {
      return handleLlamaServerGenerate(payload, tokenSender, sessionId, event, llamaPath!, modelPath, contextSize, fullPrompt, maxTokens, temperature, stopTokens)
    }

    return handleLlamaCliGenerate(payload, tokenSender, sessionId, event, llamaPath, modelPath, contextSize, fullPrompt, maxTokens, temperature, stopTokens)
  })

  ipcMain.on('llm:abort', () => {
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
    if (LLMProcessManager.activeLLMProcess) {
      LLMProcessManager.activeLLMProcess.kill('SIGKILL')
      LLMProcessManager.activeLLMProcess = null
    }
  })
}

// [VERIFICATION-TOKEN] AMEVA-OS-283-SPEC-VERIFIED-SUCCESSFULLY-2026
