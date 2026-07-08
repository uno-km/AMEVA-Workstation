import { app, ipcMain } from 'electron'
import { join } from 'path'
import { LLMProcessManager } from '../../services/llmProcessManager.js'
import { isFreeModeRequested, getProPlanMemory, setProPlanMemory } from '../../services/planState.js'

/**
 * LLM 엔진 라이프사이클(시작/정지/재시작/헬스체크), 로그, GPU 정보 및 플랜 상태 관리 IPC 등록
 */
export function registerLlmLifecycleIpc(): void {
  ipcMain.on('llm:add-log', (_event, payload: { text: string; prefix?: string }) => {
    const prefix = payload.prefix || 'SYS';
    LLMProcessManager.broadcastLog(prefix, payload.text + (!payload.text.endsWith('\n') ? '\n' : ''));
  })

  ipcMain.handle('llm:get-logs', () => {
    return LLMProcessManager.llamaLogBuffer
  })

  // 🤖 [llm:check-health] 포트 12345 llama-server 상태 체크 핸들러
  ipcMain.handle('llm:check-health', async (_event) => {
    if (!LLMProcessManager.activeServerProcess) {
      return { status: 'offline', running: false }
    }
    return new Promise<{ status: string; running: boolean }>((resolve) => {
      const httpM = require('http')
      const hReq = httpM.request(
        { hostname: '127.0.0.1', port: LLMProcessManager.serverPort, path: '/health', method: 'GET', timeout: 5000 },
        (hRes: any) => {
          let body = ''
          hRes.on('data', (d: Buffer) => { body += d.toString() })
          hRes.on('end', () => {
            try {
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
      const llamaPath = LLMProcessManager.findLlamaCli()
      if (!llamaPath) return { success: false, error: 'llama.cpp 엔진 경로를 찾을 수 없습니다.' }
      
      let modelPath = 'C:\\ameva\\models\\llm\\qwen2.5-3b-instruct-q4_k_m.gguf'
      const fs = require('fs')
      if (!fs.existsSync(modelPath)) {
        const llmDir = 'C:\\ameva\\models\\llm'
        if (fs.existsSync(llmDir)) {
          try {
            const files = fs.readdirSync(llmDir)
            const firstGguf = files.find((f: string) => f.endsWith('.gguf'))
            if (firstGguf) modelPath = join(llmDir, firstGguf)
          } catch {}
        }
      }
      
      if (!fs.existsSync(modelPath)) return { success: false, error: '모델 파일(.gguf)을 찾을 수 없습니다.' }
      
      if (LLMProcessManager.activeServerProcess) {
        try { LLMProcessManager.activeServerProcess.kill('SIGKILL') } catch {}
        LLMProcessManager.activeServerProcess = null
      }
      LLMProcessManager.serverStartingPromise = null
      await LLMProcessManager.asyncCleanupOrphanedProcesses()
      
      LLMProcessManager.logToRenderer('[System] 수동 재구동 요청 수신. llama-server 웜업 재기동...\n')
      const ok = await LLMProcessManager.startLlamaServerWithFallback(llamaPath, modelPath, 8192, true)
      return { success: ok, error: ok ? undefined : '재기동 실패 (CPU 폴백 포함)' }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('llm:start', async (_event, modelPath: string) => {
    try {
      const llamaPath = LLMProcessManager.findLlamaCli()
      if (!llamaPath) return { success: false, error: 'llama.cpp 엔진 경로를 찾을 수 없습니다.' }
      
      const fs = require('fs')
      if (!fs.existsSync(modelPath)) {
        return { success: false, error: `모델 파일을 찾을 수 없습니다: ${modelPath}` }
      }

      if (LLMProcessManager.activeServerProcess) {
        return { success: true }
      }

      LLMProcessManager.logToRenderer(`[System] 로컬 AI 엔진 수동 기동 요청 수신 (모델: ${modelPath})\n`)
      const ok = await LLMProcessManager.startLlamaServerWithFallback(llamaPath, modelPath, 8192, true)
      return { success: ok, error: ok ? undefined : '엔진 기동 실패' }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('llm:stop', async () => {
    try {
      LLMProcessManager.logToRenderer('[System] 로컬 AI 엔진 수동 정지 요청 수신\n')
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
      const devices = info?.gpuDevice || []
      const activeDevice = devices.find((d: any) => d.active) || devices[0]
      if (activeDevice && activeDevice.deviceString) {
        return activeDevice.deviceString
      }
    } catch (e) {
    }

    if (process.platform === 'win32') {
      try {
        const { execSync } = require('child_process')
        const out = execSync('wmic path win32_VideoController get name', { encoding: 'utf8' })
        const lines = out.split(/\r?\n/).map((l: string) => l.trim()).filter((l: string) => l && l !== "Name")
        if (lines.length > 0) {
          return lines.join(', ')
        }
      } catch {}
    }
    return 'Generic Graphics Device'
  })
}
