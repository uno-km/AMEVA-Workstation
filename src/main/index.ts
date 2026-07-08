import { app, BrowserWindow, dialog, session, ipcMain } from 'electron'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { existsSync } from 'fs'
import { readFile } from 'fs/promises'
import { MCPProcessManager } from './services/mcpProcessManager.js'
import { LLMProcessManager } from './services/llmProcessManager.js'
import { WindowDefenseManager } from './services/windowDefenseManager.js'

import { registerFileIpc } from './ipc/fileIpc.js'
import { registerMcpIpc } from './ipc/mcpIpc.js'
import { registerPythonIpc } from './ipc/pythonIpc.js'
import { registerLlmIpc } from './ipc/llmIpc.js'
import { registerTerminalIpc } from './ipc/terminalIpc.js'

// 🤖 개발용 일렉트론 보안 경고 비활성화
process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = 'true'

// ESM/CJS 유니버설 __dirname 폴리필
const localFilename = (typeof import.meta !== 'undefined' && import.meta.url) 
  ? fileURLToPath(import.meta.url) 
  : ''
const localDirname = localFilename ? dirname(localFilename) : ''
const __dirname = localDirname

let mainWindow: BrowserWindow | null = null
let fileToOpenOnStartup: string | null = null

// 1. 싱글 인스턴스 락 획득 (중복 창 열림 방지 및 파일 인수 위임)
const gotTheLock = app.requestSingleInstanceLock()

if (!gotTheLock) {
  app.quit()
} else {
  app.on('second-instance', async (_event, commandLine) => {
    const filePath = parseArgvForFile(commandLine)
    if (filePath && mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
      try {
        const content = await readFile(filePath, 'utf-8')
        mainWindow.webContents.send('file:open-argv', { content, filePath })
      } catch (err) {
        console.error('Failed to open second-instance file:', err)
      }
    }
  })
}

// OS 실행 인수에서 마크다운/텍스트 파일 경로 추출 헬퍼
function parseArgvForFile(argv: string[]): string | null {
  for (const arg of argv.slice(1)) {
    if (
      (arg.endsWith('.md') ||
        arg.endsWith('.markdown') ||
        arg.endsWith('.txt') ||
        arg.endsWith('.html') ||
        arg.endsWith('.docx') ||
        arg.endsWith('.xml') ||
        arg.endsWith('.pptx') ||
        arg.endsWith('.hwpx')) &&
      existsSync(arg)
    ) {
      return arg
    }
  }
  return null
}

// 최초 앱 실행 인수 분석
fileToOpenOnStartup = parseArgvForFile(process.argv)

function createWindow() {
  const preloadPath = join(__dirname, 'preload.js')
  if (!existsSync(preloadPath)) {
    dialog.showErrorBox(
      'Preload Script Missing',
      `프리로드 스크립트 파일을 찾을 수 없습니다!\n\n예상 경로: ${preloadPath}\n\n이로 인해 window.electronAPI가 로딩되지 않습니다.`
    )
  }

  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    show: true, // [PERF] 메모장처럼 즉시 윈도우 프레임을 노출하여 기동 속도 극대화
    backgroundColor: '#090a0f', // [PERF] 다크 테마 기본 배경색 매핑으로 시각적 통일성 부여
    webPreferences: {
      preload: preloadPath,
      nodeIntegration: false,
      contextIsolation: true,
      webviewTag: true,    // [SEC-W-004] webviewTag 활성화 — 외부 유튜브, 네이버 탭 렌더링 지원
      sandbox: true,       // [SEC-W-004] 렌더러 샌드박스 강화
    },
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#0a0a0f',
      symbolColor: '#8b5cf6',
      height: 38,
    },
  })

  // [SEC-W-022] 창 보호 및 단축키 방어 전담 모듈 적용
  WindowDefenseManager.applyDefenses(mainWindow, () => isShuttingDown)

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
    // 개발자 도구 자동 열림 비활성화 (필요 시 개발자 도구 메뉴를 이용해 열 수 있도록 주석 처리)
    // mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(join(__dirname, '../dist/index.html'))
  }
}

// 🤖 IPC 모듈 등록
registerFileIpc(() => mainWindow, createWindow)
registerMcpIpc()
registerPythonIpc()
registerLlmIpc()
registerTerminalIpc()

app.whenReady().then(() => {
  // [PERF] 1. 가장 먼저 윈도우 생성 (블로킹 방지 및 즉각적인 UI 피드백 제공)
  createWindow()

  // [SEC-W-021] Content-Security-Policy 설정
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' blob: http://localhost:* http://127.0.0.1:* https://cdn.jsdelivr.net https://cdnjs.cloudflare.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net; font-src 'self' https://fonts.gstatic.com https://cdn.jsdelivr.net; img-src 'self' data: blob:; connect-src 'self' ws://localhost:* ws://127.0.0.1:* wss://* http://localhost:* http://127.0.0.1:* https://* wss://demos.yjs.dev; worker-src blob:; frame-src 'self' https: http: data: blob:;"
        ]
      }
    })
  })

  // 렌더러 로딩 완료 시 최초 전달된 파일 로드 전송
  ipcMain.handle('app:ready', async () => {
    if (fileToOpenOnStartup && mainWindow) {
      try {
        const content = await readFile(fileToOpenOnStartup, 'utf-8')
        mainWindow.webContents.send('file:open-argv', { content, filePath: fileToOpenOnStartup })
        fileToOpenOnStartup = null
      } catch (err) {
        console.error('Failed to read startup file:', err)
      }
    }
    return { success: true }
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })

  // [PERF] 2. 나머지 무거운 작업들은 윈도우 생성 완료 이후 백그라운드로 지연 실행 (1초 뒤)
  setTimeout(async () => {
    // [MEM-CLEANUP] 프로그램 기동 시점에 OS 상에 유령으로 남아있던 모든 llama 프로세스 일괄 정리
    await LLMProcessManager.asyncCleanupOrphanedProcesses()

  // 🤖 [Background Warmup] 앱 기동 시 로컬 LLM 백그라운드 비동기 기동 (웜업)
  try {
    const llamaPath = LLMProcessManager.findLlamaCli()
    let defaultModelPath = 'C:\\ameva\\models\\llm\\qwen2.5-3b-instruct-q4_k_m.gguf'
    const fs = require('fs')
    if (!fs.existsSync(defaultModelPath)) {
      const llmDir = 'C:\\ameva\\models\\llm'
      if (fs.existsSync(llmDir)) {
        try {
          const files = fs.readdirSync(llmDir)
          const firstGguf = files.find((f: string) => f.endsWith('.gguf'))
          if (firstGguf) defaultModelPath = join(llmDir, firstGguf)
        } catch {}
      }
    }
    if (llamaPath && fs.existsSync(defaultModelPath)) {
      LLMProcessManager.startLlamaServerWithFallback(llamaPath, defaultModelPath, 8192, true)
        .then(ok => console.log('Background Warmup Status:', ok))
        .catch(err => console.error('Background Warmup Failed:', err))
      }
    } catch (err) {
      console.error('Failed to trigger background warmup:', err)
    }
  }, 1000)
})

let isShuttingDown = false

const handleGracefulExit = async () => {
  if (isShuttingDown) return
  isShuttingDown = true
  await LLMProcessManager.gracefulShutdown()
  try { MCPProcessManager.killAll() } catch {}
  if (process.env.VITE_DEV_SERVER_URL) {
    try {
      const { execSync } = require('child_process')
      execSync(`taskkill /pid ${process.ppid} /T /F`, { stdio: 'ignore' })
    } catch {}
  }
  app.exit(0)
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('will-quit', (e) => {
  if (!isShuttingDown && LLMProcessManager.activeServerProcess) {
    e.preventDefault()
    handleGracefulExit()
  } else {
    try { MCPProcessManager.killAll() } catch {}
    if (process.env.VITE_DEV_SERVER_URL) {
      try {
        const { execSync } = require('child_process')
        execSync(`taskkill /pid ${process.ppid} /T /F`, { stdio: 'ignore' })
      } catch {}
    }
    app.exit(0)
  }
})

// 🦾 [CONSOLE EXIT-GUARD] 터미널에서 Ctrl+C (SIGINT) 또는 SIGTERM 시그널로 강제 종료 시, 안전하게 엔진 종료
process.on('SIGINT', async () => {
  if (isShuttingDown) return
  isShuttingDown = true
  await LLMProcessManager.gracefulShutdown()
  try { MCPProcessManager.killAll() } catch {}
  process.exit(0)
})
process.on('SIGTERM', async () => {
  if (isShuttingDown) return
  isShuttingDown = true
  await LLMProcessManager.gracefulShutdown()
  try { MCPProcessManager.killAll() } catch {}
  process.exit(0)
})
