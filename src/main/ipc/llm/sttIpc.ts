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
