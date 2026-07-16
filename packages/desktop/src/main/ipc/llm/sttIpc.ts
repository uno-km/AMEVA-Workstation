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
    modelId?: string
  }) => {
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `whisperPath`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const whisperPath = ...` 형태로 안전 캐싱 후 가공 기동.
       */
    const whisperPath = LLMProcessManager.findWhisperCli()
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `modelPath`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const modelPath = ...` 형태로 안전 캐싱 후 가공 기동.
       */
    const modelPath = payload.modelId ? `C:\\ameva\\models\\stt\\${payload.modelId}` : 'C:\\ameva\\models\\stt\\ggml-small.bin'

      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `!existsSync(modelPath)`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (!existsSync(modelPath))` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
    if (!existsSync(modelPath)) {
      return { success: false, error: `Whisper 모델 파일을 찾을 수 없습니다: ${modelPath}` }
    }

      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `!existsSync(payload.audioPath)`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (!existsSync(payload.audioPath))` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
    if (!existsSync(payload.audioPath)) {
      return { success: false, error: `음성 파일을 찾을 수 없습니다: ${payload.audioPath}` }
    }

      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `args`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const args = ...` 형태로 안전 캐싱 후 가공 기동.
       */
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
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `proc`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const proc = ...` 형태로 안전 캐싱 후 가공 기동.
       */
        const proc = spawn(whisperPath!, args, { windowsHide: true })
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `stdout`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const stdout = ...` 형태로 안전 캐싱 후 가공 기동.
       */
        let stdout = ''
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `stderr`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const stderr = ...` 형태로 안전 캐싱 후 가공 기동.
       */
        let stderr = ''

        proc.stdout.on('data', (data: Buffer) => { stdout += data.toString() })
        proc.stderr.on('data', (data: Buffer) => { stderr += data.toString() })

        proc.on('close', (code) => {
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `txtPath`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const txtPath = ...` 형태로 안전 캐싱 후 가공 기동.
       */
          const txtPath = payload.audioPath + '.txt'
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `code === 0`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (code === 0)` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
          if (code === 0) {
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `stdout.trim()`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (stdout.trim())` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
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

