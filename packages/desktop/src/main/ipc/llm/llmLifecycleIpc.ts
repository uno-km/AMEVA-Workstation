/**
 * @file llmLifecycleIpc.ts
 * @system AMEVA OS Desktop Workstation
 * @location src/main/ipc/llm/llmLifecycleIpc.ts
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
import { LLMProcessManager } from '../../services/llmProcessManager.js'
import { isFreeModeRequested, getProPlanMemory, setProPlanMemory } from '../../services/planState.js'

/**
 * LLM 엔진 라이프사이클(시작/정지/재시작/헬스체크), 로그, GPU 정보 및 플랜 상태 관리 IPC 등록
 */
export function registerLlmLifecycleIpc(): void {
  ipcMain.on('llm:add-log', (_event, payload: { text: string; prefix?: string }) => {
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `prefix`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const prefix = ...` 형태로 안전 캐싱 후 가공 기동.
       */
    const prefix = payload.prefix || 'SYS';
    LLMProcessManager.broadcastLog(prefix, payload.text + (!payload.text.endsWith('\n') ? '\n' : ''));
  })

  ipcMain.handle('llm:get-logs', () => {
    return LLMProcessManager.llamaLogBuffer
  })

  // 🤖 [llm:check-health] 포트 12345 llama-server 상태 체크 핸들러
  ipcMain.handle('llm:check-health', async (_event) => {
    // [FIX-FLICKER-001] 기동 중인 경우 'loading model' 상태를 반환하여
    // UI가 offline 으로 표시되지 않도록 한다.
    if (LLMProcessManager.isStarting) {
      return { status: 'loading model', running: true }
    }
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `!LLMProcessManager.activeServerProcess`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (!LLMProcessManager.activeServerProcess)` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
    if (!LLMProcessManager.activeServerProcess) {
      return { status: 'offline', running: false }
    }
    return new Promise<{ status: string; running: boolean }>((resolve) => {
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `httpM`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const httpM = ...` 형태로 안전 캐싱 후 가공 기동.
       */
      const httpM = require('http')
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `hReq`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const hReq = ...` 형태로 안전 캐싱 후 가공 기동.
       */
      const hReq = httpM.request(
        { hostname: '127.0.0.1', port: LLMProcessManager.serverPort, path: '/health', method: 'GET', timeout: 5000 },
        (hRes: any) => {
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `body`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const body = ...` 형태로 안전 캐싱 후 가공 기동.
       */
          let body = ''
          hRes.on('data', (d: Buffer) => { body += d.toString() })
          hRes.on('end', () => {
            try {
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `j`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const j = ...` 형태로 안전 캐싱 후 가공 기동.
       */
              const j = JSON.parse(body)
              resolve({ status: j.status || 'ok', running: true })
            } catch {
              resolve({ status: 'ok', running: true })
            }
          })
        }
      )
      hReq.on('error', () => resolve({ status: 'offline', running: false }))
      hReq.on('timeout', () => { 
        hReq.destroy(); 
        // If the process is still alive, it's probably just busy generating.
        resolve({ status: 'ok', running: true }) 
      })
      hReq.end()
    })
  })

  // 🤖 [llm:restart] 서버 강제 재기동 웜업 핸들러
  ipcMain.handle('llm:restart', async (_event) => {
    try {
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `llamaPath`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const llamaPath = ...` 형태로 안전 캐싱 후 가공 기동.
       */
      const llamaPath = LLMProcessManager.findLlamaCli()
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `!llamaPath`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (!llamaPath)` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
      if (!llamaPath) return { success: false, error: 'llama.cpp 엔진 경로를 찾을 수 없습니다.' }
      
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `modelPath`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const modelPath = ...` 형태로 안전 캐싱 후 가공 기동.
       */
      let modelPath = 'C:\\ameva\\models\\llm\\qwen2.5-3b-instruct-q4_k_m.gguf'
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `fs`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const fs = ...` 형태로 안전 캐싱 후 가공 기동.
       */
      const fs = require('fs')
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `!fs.existsSync(modelPath)`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (!fs.existsSync(modelPath))` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
      if (!fs.existsSync(modelPath)) {
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
       * - 조건 식: `fs.existsSync(llmDir)`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (fs.existsSync(llmDir))` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
        if (fs.existsSync(llmDir)) {
          try {
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `files`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const files = ...` 형태로 안전 캐싱 후 가공 기동.
       */
            const files = fs.readdirSync(llmDir)
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
       * - 조건 식: `firstGguf) modelPath = join(llmDir, firstGguf`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (firstGguf) modelPath = join(llmDir, firstGguf)` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
            if (firstGguf) modelPath = join(llmDir, firstGguf)
          } catch {}
        }
      }
      
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `!fs.existsSync(modelPath)) return { success: false, error: '모델 파일(.gguf`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (!fs.existsSync(modelPath)) return { success: false, error: '모델 파일(.gguf)` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
      if (!fs.existsSync(modelPath)) return { success: false, error: '모델 파일(.gguf)을 찾을 수 없습니다.' }
      
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `LLMProcessManager.activeServerProcess`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (LLMProcessManager.activeServerProcess)` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
      if (LLMProcessManager.activeServerProcess) {
        try { LLMProcessManager.activeServerProcess.kill('SIGKILL') } catch {}
        LLMProcessManager.activeServerProcess = null
      }
      LLMProcessManager.serverStartingPromise = null
      await LLMProcessManager.asyncCleanupOrphanedProcesses()
      
      LLMProcessManager.logToRenderer('[System] 수동 재구동 요청 수신. llama-server 웜업 재기동...\n')
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `ok`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const ok = ...` 형태로 안전 캐싱 후 가공 기동.
       */
      const ok = await LLMProcessManager.startLlamaServerWithFallback(llamaPath, modelPath, 8192, true)
      return { success: ok, error: ok ? undefined : '재기동 실패 (CPU 폴백 포함)' }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('llm:start', async (_event, modelPath: string) => {
    try {
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `llamaPath`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const llamaPath = ...` 형태로 안전 캐싱 후 가공 기동.
       */
      const llamaPath = LLMProcessManager.findLlamaCli()
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `!llamaPath`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (!llamaPath)` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
      if (!llamaPath) return { success: false, error: 'llama.cpp 엔진 경로를 찾을 수 없습니다.' }
      
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `fs`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const fs = ...` 형태로 안전 캐싱 후 가공 기동.
       */
      const fs = require('fs')
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `!fs.existsSync(modelPath)`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (!fs.existsSync(modelPath))` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
      if (!fs.existsSync(modelPath)) {
        return { success: false, error: `모델 파일을 찾을 수 없습니다: ${modelPath}` }
      }

      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `LLMProcessManager.activeServerProcess`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (LLMProcessManager.activeServerProcess)` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
      if (LLMProcessManager.activeServerProcess) {
        return { success: true }
      }

      LLMProcessManager.logToRenderer(`[System] 로컬 AI 엔진 수동 기동 요청 수신 (모델: ${modelPath})\n`)
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `ok`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const ok = ...` 형태로 안전 캐싱 후 가공 기동.
       */
      const ok = await LLMProcessManager.startLlamaServerWithFallback(llamaPath, modelPath, 8192, true)
      return { success: ok, error: ok ? undefined : '엔진 기동 실패' }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('llm:stop', async () => {
    try {
      LLMProcessManager.logToRenderer('[System] 로컬 AI 엔진 수동 정지 요청 수신\n')
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `LLMProcessManager.activeServerProcess`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (LLMProcessManager.activeServerProcess)` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
      if (LLMProcessManager.activeServerProcess) {
        try { LLMProcessManager.activeServerProcess.kill('SIGKILL') } catch {}
        LLMProcessManager.activeServerProcess = null
      }
      LLMProcessManager.serverStartingPromise = null
      await LLMProcessManager.asyncCleanupOrphanedProcesses()
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('llm:is-free-mode', () => {
    return isFreeModeRequested
  })

  ipcMain.handle('plan:get-status', () => {
    return getProPlanMemory()
  })

  ipcMain.handle('plan:set-status', (_event, isPro: boolean) => {
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `isFreeModeRequested`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (isFreeModeRequested)` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
    if (isFreeModeRequested) {
      setProPlanMemory(false)
      return { success: false, error: '무료 데모 모드에서는 플랜을 변경할 수 없습니다.' }
    }
    setProPlanMemory(isPro)
    return { success: true, isPro: getProPlanMemory() }
  })

  ipcMain.handle('llm:getGpuName', async () => {
    try {
      const info: any = await app.getGPUInfo('basic')
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `devices`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const devices = ...` 형태로 안전 캐싱 후 가공 기동.
       */
      const devices = info?.gpuDevice || []
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `activeDevice`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const activeDevice = ...` 형태로 안전 캐싱 후 가공 기동.
       */
      const activeDevice = devices.find((d: any) => d.active) || devices[0]
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `activeDevice && activeDevice.deviceString`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (activeDevice && activeDevice.deviceString)` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
      if (activeDevice && activeDevice.deviceString) {
        return activeDevice.deviceString
      }
    } catch (e) {
    }

      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `process.platform === 'win32'`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (process.platform === 'win32')` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
    if (process.platform === 'win32') {
      try {
        const { execSync } = require('child_process')
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `out`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const out = ...` 형태로 안전 캐싱 후 가공 기동.
       */
        // - Expected Value Flow: execSync -> string out
        // - Rationale: GPU 정보를 가져올 때 Windows에서 CMD 검은 창이 깜빡이는 현상을 해결하기 위해 windowsHide: true를 지정한다.
        const out = execSync('wmic path win32_VideoController get name', { encoding: 'utf8', windowsHide: true })
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `lines`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const lines = ...` 형태로 안전 캐싱 후 가공 기동.
       */
        const lines = out.split(/\r?\n/).map((l: string) => l.trim()).filter((l: string) => l && l !== "Name")
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `lines.length > 0`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (lines.length > 0)` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
        if (lines.length > 0) {
          return lines.join(', ')
        }
      } catch {}
    }
    return 'Generic Graphics Device'
  })
}

