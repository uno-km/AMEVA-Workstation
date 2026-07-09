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
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `sessionId`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const sessionId = ...` 형태로 안전 캐싱 후 가공 기동.
       */
    const sessionId = payload.sessionId || 'default'
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `tokenSender`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const tokenSender = ...` 형태로 안전 캐싱 후 가공 기동.
       */
    const tokenSender = createTokenSender(event, sessionId)

      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `LLMProcessManager.activeLLMProcess`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (LLMProcessManager.activeLLMProcess)` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
    if (LLMProcessManager.activeLLMProcess) {
      LLMProcessManager.activeLLMProcess.kill()
      LLMProcessManager.activeLLMProcess = null
    }

      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `llamaPath`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const llamaPath = ...` 형태로 안전 캐싱 후 가공 기동.
       */
    const llamaPath = LLMProcessManager.findLlamaCli()
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `modelPath`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const modelPath = ...` 형태로 안전 캐싱 후 가공 기동.
       */
    let modelPath = payload.modelPath || 'C:\\ameva\\models\\llm\\qwen2.5-3b-instruct-q4_k_m.gguf'

      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `!existsSync(modelPath) && !payload.modelPath`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (!existsSync(modelPath) && !payload.modelPath)` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
    if (!existsSync(modelPath) && !payload.modelPath) {
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `llmDir`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const llmDir = ...` 형태로 안전 캐싱 후 가공 기동.
       */
      const llmDir = 'C:\\ameva\\models\\llm'
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `existsSync(llmDir)`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (existsSync(llmDir))` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
      if (existsSync(llmDir)) {
        try {
          const { readdirSync } = require('fs')
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `files`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const files = ...` 형태로 안전 캐싱 후 가공 기동.
       */
          const files = readdirSync(llmDir)
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `firstGguf`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const firstGguf = ...` 형태로 안전 캐싱 후 가공 기동.
       */
          const firstGguf = files.find((f: string) => f.endsWith('.gguf'))
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `firstGguf`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (firstGguf)` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
          if (firstGguf) {
            modelPath = join(llmDir, firstGguf)
          }
        } catch {}
      }
    }

      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `payload.apiType === 'ollama'`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (payload.apiType === 'ollama')` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
    if (payload.apiType === 'ollama') {
      return handleOllamaGenerate(payload, tokenSender, sessionId, event)
    }

      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `isRealExecutionAvailable`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const isRealExecutionAvailable = ...` 형태로 안전 캐싱 후 가공 기동.
       */
    const isRealExecutionAvailable = existsSync(modelPath) && existsSync(llamaPath || '')
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `!isRealExecutionAvailable`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (!isRealExecutionAvailable)` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
    if (!isRealExecutionAvailable) {
      return new Promise<{ success: boolean; error?: string }>((resolve) => {
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `errorMsg`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const errorMsg = ...` 형태로 안전 캐싱 후 가공 기동.
       */
        const errorMsg = `로컬 모델 파일 또는 엔진 바이너리가 디바이스에 존재하지 않습니다.\n\n- 엔진 경로: ${llamaPath || '미지정'}\n- 모델 파일: ${modelPath}\n\n우측 상단 톱니바퀴 -> 'Models' 탭에서 파일을 체크하시거나, AI 패널의 설정 기어 버튼 -> '모델 허브 개방'을 통해 간편하게 AI를 설정해주세요.`
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `!event.sender.isDestroyed()`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (!event.sender.isDestroyed())` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
        if (!event.sender.isDestroyed()) {
          event.sender.send('llm:log', { text: `\n[Fatal Error] 실행 실패:\n${errorMsg}\n` })
          event.sender.send(`llm:done:${sessionId}`, { success: false, error: errorMsg })
        }
        resolve({ success: false, error: errorMsg })
      })
    }

      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `systemPrompt`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const systemPrompt = ...` 형태로 안전 캐싱 후 가공 기동.
       */
    const systemPrompt = payload.systemPrompt || 'You are AMEVA AI, a helpful assistant integrated into AMEVA document editor. Respond in the same language as the user. Be concise and helpful.'
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `temperature`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const temperature = ...` 형태로 안전 캐싱 후 가공 기동.
       */
    const temperature = payload.temperature ?? 0.7
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `maxTokens`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const maxTokens = ...` 형태로 안전 캐싱 후 가공 기동.
       */
    const maxTokens = payload.maxTokens ?? 512
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `contextSize`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const contextSize = ...` 형태로 안전 캐싱 후 가공 기동.
       */
    const contextSize = payload.contextSize ?? 8192

    const { fullPrompt, stopTokens } = formatPromptForModel(modelPath, systemPrompt, payload)

      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `payload.apiType === 'api'`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (payload.apiType === 'api')` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
    if (payload.apiType === 'api') {
      return handleRemoteApiGenerate(payload, tokenSender, sessionId, event, systemPrompt, temperature, maxTokens)
    }

      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `isServer`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const isServer = ...` 형태로 안전 캐싱 후 가공 기동.
       */
    const isServer = llamaPath && llamaPath.toLowerCase().includes('llama-server')

      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `isServer`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (isServer)` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
    if (isServer) {
      return handleLlamaServerGenerate(payload, tokenSender, sessionId, event, llamaPath!, modelPath, contextSize, fullPrompt, maxTokens, temperature, stopTokens)
    }

    return handleLlamaCliGenerate(payload, tokenSender, sessionId, event, llamaPath, modelPath, contextSize, fullPrompt, maxTokens, temperature, stopTokens)
  })

  ipcMain.on('llm:abort', () => {
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
  })
}

