/**
 * @file index.ts
 * @system AMEVA OS Desktop Workstation - Electron Main Process Entry
 * @location src/main/index.ts
 * @role Application Composition Root & OS native integration Main Entry
 * 
 * [책임 범위 - RESPONSIBILITY]
 * - Electron 생명주기(will-quit, whenReady, activate 등)를 총 통제하며, 메인 윈도우(mainWindow)를 팝업 빌드한다.
 * - 파일 입출력(File), RAG(Python), MCP 프록시(Mcp), LLM 로컬 엔진(Llm), 리로드 터미널(Terminal) 등 하위 IPC 채널 핸들러를 등록(`registerFileIpc` 등)한다.
 * - 싱글 인스턴스 락(`gotTheLock`)을 강제하여 중복 가동을 차단하고, F5/F12 등 단축키 및 창 비활성화 보안 침해 방지 가드(`WindowDefenseManager`)를 가동한다.
 * - 앱 기동 완료 즉시 유저 사용성 렉을 제거하기 위한 백그라운드 Llama.cpp 웜업 프로세스를 기동하고, 종료 시 잔여 프로세스 클린업(`handleGracefulExit`)을 보장한다.
 * 
 * [책임이 아닌 것 - NON-RESPONSIBILITY]
 * - 개별 IPC의 세부 비즈니스 로직 연산 (각 ipc/ 하위 서브 핸들러 모듈이 구현함).
 * 
 * [절대 깨면 안 되는 계약 - CONTRACT]
 * - MUST: 터미널 강제 시그널(Ctrl+C, SIGINT, SIGTERM) 수신 시 및 앱 종료 시점에 반드시 `LLMProcessManager.gracefulShutdown`과 `MCPProcessManager.killAll`을 가동하여,
 *   로컬 AI Llama 포트 및 Node.js MCP 좀비 프로세스가 OS 백그라운드에 남아 좀비화 및 메모리 누수를 일으키는 현상을 원천 방지할 것.
 * - MUST NOT disable contextIsolation: 보안 취약점 차단을 위해 렌더러 `webPreferences` 설정 내 `contextIsolation: true` 및 `sandbox: true` 보안 가드를 영구 유지할 것.
 */

/* 
 * [IMPORT SEGMENTATION & CONTRACTS]
 * - app, BrowserWindow, dialog, session, ipcMain: Electron GUI 및 세션, 대화상자 통제용 OS 네이티브 코어 객체.
 * - join, dirname: 크로스 플랫폼 파일 절대 경로 매핑을 위한 Node.js path 모듈.
 * - fileURLToPath: ESM 모듈 내 절대 파일 URI 파싱용 URL 모듈.
 * - existsSync: 파일 유무 동기 검사용 fs 모듈.
 * - readFile: 파일 텍스트 비동기 독출용 fs/promises 모듈.
 */
import { app, BrowserWindow, dialog, session, ipcMain } from 'electron'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { existsSync } from 'fs'
import { readFile } from 'fs/promises'

/* 
 * [SUB PROCESS & SECURITY MANAGERS]
 * - MCPProcessManager: Reverse WebSocket MCP 프록시 서버 생명주기 매니저.
 * - LLMProcessManager: Llama.cpp 로컬 GGUF 추론 서버 기동/웜업/종료 매니저.
 * - WindowDefenseManager: 일렉트론 창 보호 전담 모듈.
 */
import { MCPProcessManager } from './services/mcpProcessManager.js'
import { LLMProcessManager } from './services/llmProcessManager.js'
import { WindowDefenseManager } from './services/windowDefenseManager.js'

/* 
 * [IPC HANDLERS REGISTERS]
 * - registerFileIpc: 파일 열기/저장 채널 등록기.
 * - registerMcpIpc: MCP 서버 파싱 및 호출 채널 등록기.
 * - registerPythonIpc: Jupyter 파이썬 연산 채널 등록기.
 * - registerLlmIpc: 로컬 GGUF 모델 및 클라우드 API 토큰 스트리밍 채널 등록기.
 * - registerTerminalIpc: reverse IPC 통신용 채널 등록기.
 */
import { registerFileIpc } from './ipc/fileIpc.js'
import { registerMcpIpc } from './ipc/mcpIpc.js'
import { registerPythonIpc } from './ipc/pythonIpc.js'
import { registerLlmIpc } from './ipc/llmIpc.js'
import { registerTerminalIpc } from './ipc/terminalIpc.js'

// 개발용 일렉트론 보안 경고 비활성화
process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = 'true'

/*
 * [ESM / CJS COMPATIBILITY CONSTANTS]
 * - localFilename: 현재 ESM 파일 절대 경로.
 * - localDirname: 디렉터리 경로.
 * - __dirname: CommonJS 호환용 전역 상수로 바인딩.
 */
const localFilename = (typeof import.meta !== 'undefined' && import.meta.url) 
  ? fileURLToPath(import.meta.url) 
  : ''
const localDirname = localFilename ? dirname(localFilename) : ''
const __dirname = localDirname

/*
 * [INVARIANT - Window & Start file state References]
 * - mainWindow: 활성화된 메인 Electron 윈도우 인스턴스.
 * - fileToOpenOnStartup: 앱 첫 기동 시 외부에서 더블클릭하여 파일 경로 인수가 들어왔을 때 임시로 파킹하는 경로 버퍼.
 */
let mainWindow: BrowserWindow | null = null
let fileToOpenOnStartup: string | null = null

// 1. 싱글 인스턴스 락 획득 (중복 창 열림 방지 및 파일 인수 위임)
const gotTheLock = app.requestSingleInstanceLock()

if (!gotTheLock) {
  // 이미 가동 중인 인스턴스가 존재하면 즉시 본 세션을 소멸 종료
  app.quit()
} else {
  // 두 번째 인스턴스가 켜지려 할 때 기존 열린 창을 포커싱하고 더블클릭해 가져온 파일 내용물을 렌더러로 리다이렉트
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

/**
 * [CONTRACT - Parse CLI Argv for File Path]
 * - Rationale: CLI 인자 배열에서 마크다운 및 텍스트 파일 포맷 확장자를 지닌 물리 파일 존재 여부를 탐색해 낸다.
 */
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

// 최초 앱 기동 인수 분석
fileToOpenOnStartup = parseArgvForFile(process.argv)

/**
 * [CONTRACT - Create Main Window Instance]
 * - Rationale: preload.js 스크립트 유효성을 검사하고, 웹 환경 설정을 격리하여 메인 일렉트론 윈도우 프레임을 기동한다.
 */
function createWindow() {
  const preloadPath = join(__dirname, 'preload.js')
  if (!existsSync(preloadPath)) {
    dialog.showErrorBox(
      'Preload Script Missing',
      `프리로드 스크립트 파일을 찾을 수 없습니다!\n\n예상 경로: ${preloadPath}\n\n이로 인해 window.electronAPI가 로딩되지 않습니다.`
    )
  }

  // 윈도우 인스턴스 구축
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

  // 개발 서버 주소가 지정되어 있다면 로컬 서버를 로드하고, 아니면 dist 정적 마크업 파일을 마운트한다.
  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
  } else {
    mainWindow.loadFile(join(__dirname, '../dist/index.html'))
  }
}

// 🤖 IPC 모듈 채널 일괄 등록
registerFileIpc(() => mainWindow, createWindow)
registerMcpIpc()
registerPythonIpc()
registerLlmIpc()
registerTerminalIpc()

// Electron 준비 완료 시점의 윈도우 기동 및 CSP 보안 구성
app.whenReady().then(() => {
  // [PERF] 1. 가장 먼저 윈도우 생성 (블로킹 방지 및 즉각적인 UI 피드백 제공)
  createWindow()

  // [SEC-W-021] Content-Security-Policy 헤더 동적 세팅 주입
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

  // 렌더러 로딩 완료 시 최초 전달된 startup 파일 내용을 전송 완료 처리
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
      
      // 우선 지정 모델 존재 확인 분기
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
      
      // 로컬 LLM CLI 바이너리와 GGUF 파일이 존재할 때만 웜업 서버 기동 트리거
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

/*
 * [INVARIANT - Shutdown Status Guard]
 * - isShuttingDown: 앱 프로세스가 종료 시퀀스를 통과하고 있는지 표시하는 불리언 락.
 */
let isShuttingDown = false

/**
 * [CONTRACT - Graceful Exit Orchestrator]
 * - Rationale: 활성화된 llama CLI 추론 서버 및 MCP 프록시 데몬들을 안전하게 시그널로 종료시키고,
 *   Vite 개발 서버 환경인 경우 부모 프로세스 트리(taskkill)를 일괄 소멸시켜 좀비를 없앤다.
 */
const handleGracefulExit = async () => {
  if (isShuttingDown) return
  isShuttingDown = true
  
  // 로컬 추론 엔진 종료
  await LLMProcessManager.gracefulShutdown()
  
  // MCP 서버들 제거
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

// 앱 종료 will-quit 리스너 연동 (추론 엔진 활성 시 exit guard 발동)
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
