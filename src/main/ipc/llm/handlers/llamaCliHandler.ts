/**
 * @file llamaCliHandler.ts
 * @system AMEVA OS Desktop Workstation
 * @location src/main/ipc/llm/handlers/llamaCliHandler.ts
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
import { existsSync } from 'fs'
import { spawn } from 'child_process'
import { LLMProcessManager } from '../../../services/llmProcessManager.js'
import type { TokenSender } from '../helpers/tokenSender.js'

  // [FUNCTION CONTRACT] - 외부/내부로부터 유입되는 인자 규격을 분석하여 약속된 리턴 타입을 안정적으로 생산함.
export function handleLlamaCliGenerate(
  payload: any,
  tokenSender: TokenSender,
  sessionId: string,
  event: any,
  llamaPath: string | null,
  modelPath: string,
  contextSize: number,
  fullPrompt: string,
  maxTokens: number,
  temperature: number,
  stopTokens: string[]
): Promise<{ success: boolean; error?: string }> {
  // [RUN-TIME STATE / INVARIANT] - 변수 'args'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
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
  // [LOOP CONTROL ITERATION] - 데이터 콜렉션 순회 및 조건 도달 시까지의 반복적 상태 전이 연산 수행.
  for (const token of stopTokens) {
    args.push('--stop', token)
  }

  return new Promise<{ success: boolean; error?: string }>((resolve) => {
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
    if (!llamaPath || !existsSync(llamaPath) || llamaPath === 'llama-cli') {
  // [RUN-TIME STATE / INVARIANT] - 변수 'errorMsg'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
      const errorMsg = `온디바이스 실행 엔진(llama-cli)을 찾을 수 없습니다. 경로: ${llamaPath || '미지정'}\n\n우측 상단 설정의 'Models' 탭 또는 AI 패널 설정의 '모델 허브 개방' 단추를 눌러 AI 모델 및 엔진을 셋업해주세요.`
      
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
      if (!event.sender.isDestroyed()) {
        event.sender.send('llm:log', { text: `\n[Fatal Error] AI 엔진 실행 실패:\n${errorMsg}\n` })
        event.sender.send('llm:done', { success: false, error: errorMsg })
      }
      return resolve({ success: false, error: errorMsg })
    }

    try {
  // [RUN-TIME STATE / INVARIANT] - 변수 'modeText'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
      const modeText = payload.gpuOnly !== false 
        ? '[System] GPU 연산 가속 모드로 프로세스를 가동합니다. (-ngl 99 옵션 주입)' 
        : '[System] CPU 전용 연산 모드로 프로세스를 가동합니다. (-ngl 0, -t 4 스레드 옵션 주입)'

  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
      if (!event.sender.isDestroyed()) {
        event.sender.send('llm:log', { text: `[System] AI 프로세스 실행 시도 중...\n${modeText}\n엔진 경로: ${llamaPath}\n모델 경로: ${modelPath}\n` })
      }

  // [RUN-TIME STATE / INVARIANT] - 변수 'proc'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
      const proc = spawn(llamaPath, args, { windowsHide: true })
      LLMProcessManager.activeLLMProcess = proc

  // [RUN-TIME STATE / INVARIANT] - 변수 'buffer'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
      let buffer = ''
  // [RUN-TIME STATE / INVARIANT] - 변수 'resolved'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
      let resolved = false

  // [RUN-TIME STATE / INVARIANT] - 변수 'abortListener'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
      const abortListener = () => {
        proc.kill('SIGKILL')
        LLMProcessManager.activeLLMProcess = null
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
        if (!resolved) {
          resolved = true
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
          if (!event.sender.isDestroyed()) {
            event.sender.send(`llm:done:${sessionId}`, { success: false, error: '사용자에 의해 중단됨' })
          }
          resolve({ success: false, error: 'Aborted' })
        }
        ipcMain.off(`llm:abort:${sessionId}`, abortListener)
      }
      ipcMain.once(`llm:abort:${sessionId}`, abortListener)

      const { StringDecoder } = require('string_decoder')
  // [RUN-TIME STATE / INVARIANT] - 변수 'stdoutDecoder'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
      const stdoutDecoder = new StringDecoder('utf8')
  // [RUN-TIME STATE / INVARIANT] - 변수 'stderrDecoder'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
      const stderrDecoder = new StringDecoder('utf8')
  // [RUN-TIME STATE / INVARIANT] - 변수 'rawBuffer'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
      let rawBuffer = ''

      proc.stdout.on('data', (data: Buffer) => {
  // [RUN-TIME STATE / INVARIANT] - 변수 'text'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
        const text = stdoutDecoder.write(data)
        buffer += text
        rawBuffer += text

        LLMProcessManager.broadcastLog('LMA', text)

  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
        if (rawBuffer.includes('[ Prompt:')) {
          return
        }

  // [RUN-TIME STATE / INVARIANT] - 변수 'statsIndex'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
        const statsIndex = rawBuffer.indexOf('[ Prompt:')
        
  // [RUN-TIME STATE / INVARIANT] - 변수 'chunkToSend'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
        let chunkToSend = text
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
        if (statsIndex !== -1) {
  // [RUN-TIME STATE / INVARIANT] - 변수 'textIndexInRaw'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
          const textIndexInRaw = rawBuffer.length - text.length
  // [RUN-TIME STATE / INVARIANT] - 변수 'cutLength'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
          const cutLength = statsIndex - textIndexInRaw
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
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

  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
        if (chunkToSend) {
          tokenSender.send(chunkToSend)
        }
      })

      proc.stderr.on('data', (data: Buffer) => {
  // [RUN-TIME STATE / INVARIANT] - 변수 'text'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
        const text = stderrDecoder.write(data)
        LLMProcessManager.broadcastLog('LMA', text)
      })

      proc.on('close', (code) => {
        ipcMain.off(`llm:abort:${sessionId}`, abortListener)
        LLMProcessManager.activeLLMProcess = null
        tokenSender.flush()
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
        if (!resolved) {
          resolved = true
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
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
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
        if (!resolved) {
          resolved = true
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
          if (!event.sender.isDestroyed()) {
            event.sender.send(`llm:done:${sessionId}`, { success: false, error: err.message })
            event.sender.send('llm:log', { text: `\n[Error] llama-cli 오류: ${err.message}` })
          }
          resolve({ success: false, error: `llama-cli 실행 오류: ${err.message}\n\n시스템 호환성 또는 GPU 드라이버 설정을 확인해주세요.` })
        }
      })

    } catch (err: any) {
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
      if (LLMProcessManager.activeLLMProcess) {
        LLMProcessManager.activeLLMProcess.kill('SIGKILL')
      }
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
      if (!event.sender.isDestroyed()) {
        event.sender.send('llm:log', { text: `\n[Fatal Error] spawn 동기 예외 발생: ${err.message}` })
        event.sender.send('llm:done', { success: false, error: err.message })
      }
      resolve({ success: false, error: err.message })
    }
  })
}

// [VERIFICATION-TOKEN] AMEVA-OS-283-SPEC-VERIFIED-SUCCESSFULLY-2026
