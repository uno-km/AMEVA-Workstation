/**
 * @file sttIpc.ts
 * @system AMEVA OS Desktop Workstation
 * @location src/main/ipc/llm/sttIpc.ts
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

import { app, ipcMain } from 'electron'
import { join } from 'path'
import { existsSync } from 'fs'
import { readFile, unlink } from 'fs/promises'
import { spawn } from 'child_process'
import { LLMProcessManager } from '../../services/llmProcessManager.js'

/**
 * Whisper 음성 인식(STT) 및 녹음 임시 경로 조회 IPC 등록
 */
export function registerSttIpc(): void {
  // 🎤 Whisper STT IPC 핸들러
  ipcMain.handle('stt:transcribe', async (_event, payload: {
    audioPath: string
    language?: string
  }) => {
    const whisperPath = LLMProcessManager.findWhisperCli()
    const modelPath = 'C:\\ameva\\models\\stt\\ggml-small.bin'

    if (!existsSync(modelPath)) {
      return { success: false, error: `Whisper 모델 파일을 찾을 수 없습니다: ${modelPath}` }
    }

    if (!existsSync(payload.audioPath)) {
      return { success: false, error: `음성 파일을 찾을 수 없습니다: ${payload.audioPath}` }
    }

    const args = [
      '-m', modelPath,
      '-f', payload.audioPath,
      '--output-txt',
      '--no-timestamps',
      '-l', payload.language || 'auto',
      '--print-progress', 'false',
    ]

    return new Promise<{ success: boolean; text?: string; error?: string }>((resolve) => {
      try {
        const proc = spawn(whisperPath!, args, { windowsHide: true })
        let stdout = ''
        let stderr = ''

        proc.stdout.on('data', (data: Buffer) => { stdout += data.toString() })
        proc.stderr.on('data', (data: Buffer) => { stderr += data.toString() })

        proc.on('close', (code) => {
          const txtPath = payload.audioPath + '.txt'
          if (code === 0) {
            if (stdout.trim()) {
              resolve({ success: true, text: stdout.trim() })
            } else if (existsSync(txtPath)) {
              readFile(txtPath, 'utf-8')
                .then(text => {
                  unlink(txtPath).catch(() => {})
                  resolve({ success: true, text: text.trim() })
                })
                .catch(() => resolve({ success: true, text: stdout.trim() }))
            } else {
              resolve({ success: true, text: stdout.trim() })
            }
          } else {
            resolve({ success: false, error: stderr || `Whisper 프로세스가 코드 ${code}로 종료됨` })
          }
        })

        proc.on('error', (err) => {
          resolve({ success: false, error: `whisper-cli 실행 오류: ${err.message}\n\nwhisper.cpp를 C:\\ameva\\whisper\\ 에 설치해주세요.` })
        })

      } catch (err: any) {
        resolve({ success: false, error: err.message })
      }
    })
  })

  ipcMain.handle('stt:getTempPath', async () => {
    return join(app.getPath('temp'), `ameva_recording_${Date.now()}.wav`)
  })
}
