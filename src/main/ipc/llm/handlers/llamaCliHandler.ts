import { ipcMain } from 'electron'
import { existsSync } from 'fs'
import { spawn } from 'child_process'
import { LLMProcessManager } from '../../../services/llmProcessManager.js'
import type { TokenSender } from '../helpers/tokenSender.js'

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
        LLMProcessManager.activeLLMProcess.kill('SIGKILL')
      }
      if (!event.sender.isDestroyed()) {
        event.sender.send('llm:log', { text: `\n[Fatal Error] spawn 동기 예외 발생: ${err.message}` })
        event.sender.send('llm:done', { success: false, error: err.message })
      }
      resolve({ success: false, error: err.message })
    }
  })
}
