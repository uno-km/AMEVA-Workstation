import { app, BrowserWindow, ipcMain, dialog, shell, session, net, safeStorage } from 'electron'
import { join, dirname, resolve as resolvePath, basename } from 'path'
import { fileURLToPath } from 'url'
import { existsSync, writeFileSync, readFileSync } from 'fs'
import * as exportersMain from './exportersMain.js'
import { MCPProcessManager } from './services/mcpProcessManager.js'
import { CollabServerManager } from './services/collabServer.js'
import { LLMProcessManager } from './services/llmProcessManager.js'

// 🤖 개발용 일렉트론 보안 경고 비활성화
process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = 'true'

// ESM/CJS 유니버설 __dirname 폴리필
const localFilename = (typeof import.meta !== 'undefined' && import.meta.url) 
  ? fileURLToPath(import.meta.url) 
  : ''
const localDirname = localFilename ? dirname(localFilename) : ''

const __dirname = localDirname
import { readFile, writeFile, unlink } from 'fs/promises'
import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const pdfModule = require('pdf-parse')
const pdf = typeof pdfModule === 'function' ? pdfModule : (pdfModule.default || pdfModule)
import { spawn, ChildProcess } from 'child_process'


let mainWindow: BrowserWindow | null = null

let fileToOpenOnStartup: string | null = null

// LLM 프로세스 상태 관리 (Moved to LLMProcessManager)

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

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
    // 개발자 도구 자동 열림 비활성화 (필요 시 개발자 도구 메뉴를 이용해 열 수 있도록 주석 처리)
    // mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(join(__dirname, '../dist/index.html'))
  }
}

app.whenReady().then(() => {
  // [MEM-CLEANUP] 프로그램 기동 시점에 OS 상에 유령으로 남아있던 모든 llama 프로세스 일괄 정리
  LLMProcessManager.forceCleanupLocalLLMProcesses()

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
  // 렌더러가 완전 기동 완료된 후 직접 준비완료 시그널을 보냈을 때 대기 중이던 시작 파일을 전송 (경쟁 상태 100% 해소)
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

  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })

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
})

app.on('window-all-closed', () => {
  // LLM 프로세스 정리
  if (LLMProcessManager.LLMProcessManager.activeLLMProcess) {
    LLMProcessManager.LLMProcessManager.activeLLMProcess.kill()
    LLMProcessManager.LLMProcessManager.activeLLMProcess = null
  }
  // [FIX-W-001] window-all-closed에서도 백그라운드 서버 프로세스(좀비 방지) 종료
  if (LLMProcessManager.activeServerProcess) {
    try { LLMProcessManager.activeServerProcess.kill('SIGKILL') } catch {}
    LLMProcessManager.activeServerProcess = null
  }
  // MCP 자식 프로세스들 일괄 격리 종료
  try { MCPProcessManager.killAll() } catch {}

  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// 현재 이벤트를 호출한 활성 윈도우 인스턴스 가져오기 (멀티 윈도우 대응)
function getActiveWindow(event: any): BrowserWindow | null {
  return BrowserWindow.fromWebContents(event.sender) || mainWindow
}

// IPC 핸들러 - 파일 관리
ipcMain.handle('dialog:openFile', async (event) => {
  const result = await dialog.showOpenDialog(getActiveWindow(event)!, {
    properties: ['openFile'],
    filters: [
      { name: 'All Supported Documents', extensions: ['md', 'markdown', 'txt', 'docx', 'pdf', 'hwpx', 'xlsx', 'xls', 'ipynb', 'adc'] },
      { name: 'Markdown Document', extensions: ['md', 'markdown'] },
      { name: 'Plain Text', extensions: ['txt'] },
      { name: 'Word Document', extensions: ['docx'] },
      { name: 'PDF Document', extensions: ['pdf'] },
      { name: 'HWPX Document', extensions: ['hwpx'] },
      { name: 'Excel Sheet', extensions: ['xlsx', 'xls'] },
      { name: 'Jupyter Notebook', extensions: ['ipynb'] },
    ],
  })
  if (result.canceled || result.filePaths.length === 0) return null
  const filePath = result.filePaths[0]
  const ext = filePath.split('.').pop()?.toLowerCase() || ''
  
  const isBinary = ['docx', 'pdf', 'hwpx', 'xlsx', 'xls'].includes(ext)
  let content: string
  
  if (ext === 'pdf') {
    try {
      const buffer = await readFile(filePath)
      const data = await pdf(buffer)
      content = data.text || ''
    } catch (err: any) {
      content = `Error parsing PDF: ${err.message}`
    }
  } else if (isBinary) {
    const buffer = await readFile(filePath)
    content = buffer.toString('base64')
  } else {
    content = await readFile(filePath, 'utf-8')
  }
  
  return { content, filePath, isBinary }
})

ipcMain.handle('dialog:showMessageBox', async (event, options) => {
  return await dialog.showMessageBox(getActiveWindow(event)!, options)
})

ipcMain.handle('dialog:selectLocalFile', async (event, filters?: any[]) => {
  const result = await dialog.showOpenDialog(getActiveWindow(event)!, {
    properties: ['openFile'],
    filters: filters || [{ name: 'All Files', extensions: ['*'] }],
  })
  if (result.canceled || result.filePaths.length === 0) return null
  const filePath = result.filePaths[0]
  const buffer = await readFile(filePath)
  const base64 = buffer.toString('base64')
  return { filePath, base64 }
})

ipcMain.handle('dialog:saveFile', async (event, content: string, filePath?: string) => {
  let targetPath = filePath
  if (!targetPath) {
    const result = await dialog.showSaveDialog(getActiveWindow(event)!, {
      title: 'Save Document',
      filters: [
        { name: 'All Supported Documents', extensions: ['md', 'markdown', 'txt', 'docx', 'pdf', 'hwpx', 'xlsx', 'ipynb', 'adc'] },
        { name: 'Markdown Document', extensions: ['md'] },
        { name: 'Plain Text', extensions: ['txt'] },
        { name: 'Word Document', extensions: ['docx'] },
        { name: 'PDF Document', extensions: ['pdf'] },
        { name: 'HWPX Document', extensions: ['hwpx'] },
        { name: 'Excel Sheet', extensions: ['xlsx'] },
        { name: 'Jupyter Notebook', extensions: ['ipynb'] },
      ],
    })
    if (result.canceled || !result.filePath) return null
    targetPath = result.filePath
  }
  
  const ext = targetPath.split('.').pop()?.toLowerCase() || ''
  const isBinarySave = ['docx', 'pdf', 'hwpx', 'xlsx', 'xls'].includes(ext)
  
  if (isBinarySave) {
    await writeFile(targetPath, Buffer.from(content, 'base64'))
  } else {
    await writeFile(targetPath, content, 'utf-8')
  }
  
  return targetPath
})

ipcMain.handle('dialog:saveExportedFile', async (event, data: string, isBase64: boolean, defaultName: string, filters: any[]) => {
  const result = await dialog.showSaveDialog(getActiveWindow(event)!, {
    title: 'Export File',
    defaultPath: defaultName,
    filters: filters,
  })
  if (result.canceled || !result.filePath) return null
  if (isBase64) {
    await writeFile(result.filePath, Buffer.from(data, 'base64'))
  } else {
    await writeFile(result.filePath, data, 'utf-8')
  }
  return result.filePath
})

// IPC 핸들러 - PDF 변환 (Chrome Headless)
ipcMain.handle('action:printToPDF', async (_event, htmlContent: string) => {
  // [SEC-W-012] sandbox: true + javascript: false 로 임의 HTML 렌더링 격리
  const printWindow = new BrowserWindow({
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      javascript: false,  // PDF 출력 전용 — JS 실행 불필요
    },
  })
  await printWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`)
  await new Promise((resolve) => setTimeout(resolve, 800))
  const pdfData = await printWindow.webContents.printToPDF({
    margins: { top: 1, bottom: 1, left: 1, right: 1 },
    pageSize: 'A4',
    printBackground: true,
  })
  printWindow.close()
  const saveResult = await dialog.showSaveDialog(mainWindow!, {
    title: 'Save PDF File',
    defaultPath: 'document.pdf',
    filters: [{ name: 'PDF Document', extensions: ['pdf'] }],
  })
  if (saveResult.canceled || !saveResult.filePath) return null
  await writeFile(saveResult.filePath, pdfData)
  return saveResult.filePath
})

// IPC 핸들러 - 웹 실시간 검색 (CORS 우회 통로)
ipcMain.handle('action:webSearch', async (_event, query: string) => {
  if (!isProPlanMemory) {
    return { success: false, error: '무료 요금제에서는 실시간 웹 검색 기능을 사용할 수 없습니다. Pro 요금제로 업그레이드하세요.' }
  }
  try {
    const res = await net.fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    })
    if (!res.ok) {
      throw new Error(`DuckDuckGo 응답 오류: ${res.status}`)
    }
    const html = await res.text()
    const matches = html.match(/<a class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g) || []
    const snippets = matches
      .slice(0, 3)
      .map(m => m.replace(/<[^>]*>/g, '').trim())
      .join('\n\n')

    return { success: true, result: snippets }
  } catch (e: any) {
    return { success: false, error: e.message }
  }
})

// 로컈 IP 주소 추출 헬퍼 함수
ipcMain.handle('server:start', async (event, port: number) => {
  return await CollabServerManager.startServer(port, (status) => {
    event.sender.send('server:status', status)
  })
})

ipcMain.handle('server:stop', (event) => {
  return CollabServerManager.stopServer((status) => {
    event.sender.send('server:status', status)
  })
})


// [SEC-W-001] 로컬 Python 실행 IPC 제거 — Pyodide WASM으로 일원화
// runtime:runPython 채널은 보안상 제거됨.
// 렌더러의 useCodeRuntime.ts > runPythonCode()가 Pyodide WASM 샌드박스를 사용합니다.
ipcMain.handle('runtime:runPython', async () => {
  return {
    success: false,
    error: '[보안 정책] 로컬 Python 직접 실행은 비활성화되었습니다. 코드 실행은 브라우저 내장 Pyodide WASM 샌드박스를 사용합니다.'
  }
})

// ─────────────────────────────────────────────────────────────────
// 🤖 로컬 LLM IPC 핸들러 (llama-cli / llama.cpp 래퍼)
// ─────────────────────────────────────────────────────────────────



app.on('will-quit', () => {
  if (LLMProcessManager.activeServerProcess) {
    try {
      LLMProcessManager.activeServerProcess.kill('SIGKILL')
    } catch {}
  }
  // 유령 프로세스 확실히 정리
  LLMProcessManager.forceCleanupLocalLLMProcesses()
  // 앱 완전히 꺼지기 직전 모든 MCP 서버 종료 보장
  try { MCPProcessManager.killAll() } catch {}
})

// ─── 렌더러 터미널 로그 브로드캐스트 헬퍼 ───


ipcMain.on('llm:add-log', (_event, payload: { text: string; prefix?: string }) => {
  const prefix = payload.prefix || 'SYS';
  LLMProcessManager.broadcastLog(prefix, payload.text + (!payload.text.endsWith('\n') ? '\n' : ''));
})

ipcMain.handle('llm:get-logs', () => {
  return LLMProcessManager.llamaLogBuffer
})



// 🤖 [FIX-IPC-003] 토큰 스트리밍 스로틀 전송 헬퍼
function createTokenSender(event: any, sessionId: string) {
  let pendingTokens: string[] = []
  let throttleTimeout: NodeJS.Timeout | null = null

  const flush = () => {
    if (pendingTokens.length > 0) {
      if (!event.sender.isDestroyed()) {
        event.sender.send(`llm:token:${sessionId}`, { token: pendingTokens.join('') })
      }
      pendingTokens = []
    }
    throttleTimeout = null
  }

  return {
    send: (token: string) => {
      pendingTokens.push(token)
      if (!throttleTimeout) {
        throttleTimeout = setTimeout(flush, 30) // 30ms 스로틀 통일
      }
    },
    flush: () => {
      if (throttleTimeout) {
        clearTimeout(throttleTimeout)
      }
      flush()
    }
  }
}

// [BM-FREE-MODE] 시작 아규먼트 또는 npm config를 통한 --free 존재 여부 확인
const isFreeModeRequested = 
  process.argv.includes('--free') || 
  process.argv.some(arg => arg.includes('free')) ||
  process.env.FREE_MODE === 'true' ||
  process.env.npm_config_free === 'true' // npm run dev --free 감지

// 메인 프로세스 측의 실제 플랜 상태 (데모 모드 시 항상 false 강제)
let isProPlanMemory = !isFreeModeRequested

// 🤖 [llm:check-health] 포트 12345 llama-server 상태 체크 핸들러
ipcMain.handle('llm:check-health', async (_event) => {
  // 프로세스가 아예 없으면 즉시 offline
  if (!LLMProcessManager.activeServerProcess) {
    return { status: 'offline', running: false }
  }
  return new Promise<{ status: string; running: boolean }>((resolve) => {
    const httpM = require('http')
    const hReq = httpM.request(
      { hostname: '127.0.0.1', port: LLMProcessManager.serverPort, path: '/health', method: 'GET', timeout: 1200 },
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
    hReq.on('timeout', () => { hReq.destroy(); resolve({ status: 'offline', running: false }) })
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
    LLMProcessManager.serverStartingPromise = null // [FIX] 기존 기동 락 강제 초기화
    LLMProcessManager.forceCleanupLocalLLMProcesses()
    
    LLMProcessManager.logToRenderer('[System] 수동 재구동 요청 수신. llama-server 웜업 재기동...\n')
    const ok = await LLMProcessManager.startLlamaServerWithFallback(llamaPath, modelPath, 8192, true)
    return { success: ok, error: ok ? undefined : '재기동 실패 (CPU 폴백 포함)' }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
})

ipcMain.handle('llm:is-free-mode', () => {
  return isFreeModeRequested
})

ipcMain.handle('plan:get-status', () => {
  if (isFreeModeRequested) return false
  return isProPlanMemory
})

ipcMain.handle('plan:set-status', (_event, isPro: boolean) => {
  if (isFreeModeRequested) {
    isProPlanMemory = false
    return { success: false, error: '무료 데모 모드에서는 플랜을 변경할 수 없습니다.' }
  }
  isProPlanMemory = isPro
  return { success: true, isPro: isProPlanMemory }
})

// 스트리밍 LLM 추론 (토큰 단위 IPC 이벤트 방출)
ipcMain.handle('llm:generate', async (event, payload: {
  sessionId: string       // [FIX-IPC-001] 세션 격리 ID 추가
  modelPath: string
  prompt: string
  context?: string
  systemPrompt?: string
  maxTokens?: number
  temperature?: number
  contextSize?: number
  apiType?: 'local' | 'api' | 'ollama' | 'wasm'
  apiKey?: string
  apiEndpoint?: string   // [FIX-W-003] 클라우드 API 엔드포인트 동적화
  apiModel?: string      // [FIX-W-003] 클라우드 API 모델명 동적화
  gpuOnly?: boolean
  history?: { role: 'user' | 'assistant'; content: string }[]
}) => {
  const sessionId = payload.sessionId || 'default'
  const tokenSender = createTokenSender(event, sessionId)

  // 기존 프로세스 kill
  if (LLMProcessManager.activeLLMProcess) {
    LLMProcessManager.activeLLMProcess.kill()
    LLMProcessManager.activeLLMProcess = null
  }

  const llamaPath = LLMProcessManager.findLlamaCli()
  let modelPath = payload.modelPath || 'C:\\ameva\\models\\llm\\qwen2.5-3b-instruct-q4_k_m.gguf'

  // 만약 기본 3B 모델 파일이 없는데, 해당 폴더 내 다른 .gguf 파일이 존재한다면 동적 감지하여 대체
  if (!existsSync(modelPath) && !payload.modelPath) {
    const llmDir = 'C:\\ameva\\models\\llm'
    if (existsSync(llmDir)) {
      try {
        const { readdirSync } = require('fs')
        const files = readdirSync(llmDir)
        const firstGguf = files.find((f: string) => f.endsWith('.gguf'))
        if (firstGguf) {
          modelPath = join(llmDir, firstGguf)
        }
      } catch {}
    }
  }

  // 🤖 [Ollama 지원] 만약 apiType이 'ollama'라면 즉시 Ollama API 처리로 진입 (멀티턴 히스토리 지원하도록 api/chat으로 변경)
  if (payload.apiType === 'ollama') {
    return new Promise<{ success: boolean; error?: string }>(async (resolve) => {
      try {
        const http = require('http')
        const targetModel = payload.modelPath ? basename(payload.modelPath, '.gguf') : 'qwen2.5:3b'
        
        // [FIX-OLLAMA-001] 멀티턴 대화 히스토리를 반영하기 위해 messages 포맷팅 빌드
        const messages = []
        if (payload.systemPrompt) {
          messages.push({ role: 'system', content: payload.systemPrompt })
        }
        if (payload.history && payload.history.length > 0) {
          for (const h of payload.history) {
            messages.push({ role: h.role, content: h.content })
          }
        }
        messages.push({ role: 'user', content: payload.prompt })

        const postData = JSON.stringify({
          model: targetModel,
          messages: messages,
          options: {
            temperature: payload.temperature ?? 0.7,
            num_predict: payload.maxTokens ?? 512,
            stop: ['<|im_end|>', '<|im_start|>', '<|eot_id|>', '<|endoftext|>']
          },
          stream: true
        })

        LLMProcessManager.broadcastLog('OLM', `[System] Ollama API 연결 시도 중...\n서버 주소: http://127.0.0.1:11434/api/chat\n모델: ${targetModel}\n`)

        const reqOptions = {
          hostname: '127.0.0.1',
          port: 11434,
          path: '/api/chat',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(postData)
          }
        }

        let resolved = false
        const req = http.request(reqOptions, (res: any) => {
          let buffer = ''
          LLMProcessManager.broadcastLog('OLM', `[System] Ollama 연결 성공! 응답 수신 대기 중 (Status: ${res.statusCode})\n`)
          
          res.on('data', (chunk: Buffer) => {
            const chunkText = chunk.toString()
            const lines = chunkText.split('\n')
            for (const line of lines) {
              const cleaned = line.trim()
              if (!cleaned) continue
              try {
                const parsed = JSON.parse(cleaned)
                // Ollama /api/chat에서는 parsed.message.content에 토큰이 들어옵니다.
                const token = parsed.message?.content
                if (token) {
                  buffer += token
                  tokenSender.send(token)
                }
              } catch {}
            }
          })

          res.on('end', () => {
            if (!resolved) {
              resolved = true
              ipcMain.off(`llm:abort:${sessionId}`, abortListener)
              tokenSender.flush()
              LLMProcessManager.broadcastLog('OLM', `[System] Ollama 스트리밍 완료 (수신 글자수: ${buffer.length})\n`)
              if (!event.sender.isDestroyed()) {
                event.sender.send(`llm:done:${sessionId}`, { success: true, fullText: buffer })
              }
              resolve({ success: true, response: buffer } as any)
            }
          })
        })

        req.on('error', (err: any) => {
          if (!resolved) {
            resolved = true
            ipcMain.off(`llm:abort:${sessionId}`, abortListener)
            const errorMsg = `Ollama 서버 연결에 실패했습니다. (http://127.0.0.1:11434)\nOllama가 켜져 있는지 확인해주세요. 에러: ${err.message}`
            LLMProcessManager.broadcastLog('OLM', `\n[Fatal Error] Ollama 연결 실패: ${err.message}\n`)
            if (!event.sender.isDestroyed()) {
              event.sender.send(`llm:done:${sessionId}`, { success: false, error: errorMsg })
            }
            resolve({ success: false, error: errorMsg })
          }
        })

        // 사용자 중단 리스너 (세션 ID 매핑 격리)
        const abortListener = () => {
          req.destroy()
          if (!resolved) {
            resolved = true
            LLMProcessManager.broadcastLog('OLM', `[System] Ollama 요청이 사용자에 의해 중단되었습니다.\n`)
            if (!event.sender.isDestroyed()) {
              event.sender.send(`llm:done:${sessionId}`, { success: false, error: '사용자에 의해 중단됨' })
            }
            resolve({ success: false, error: 'Aborted' })
          }
        }
        ipcMain.once(`llm:abort:${sessionId}`, abortListener)

        req.write(postData)
        req.end()

      } catch (err: any) {
        LLMProcessManager.broadcastLog('OLM', `[Fatal Error] Ollama 처리 예외 발생: ${err.message}\n`)
        resolve({ success: false, error: err.message })
      }
    })
  }

  // 🤖 그 외 로컬 llama-cli 모드 시, 파일 감지가 불가능하면 시뮬레이터로 우회하지 않고 바로 에러 송출
  const isRealExecutionAvailable = existsSync(modelPath) && existsSync(llamaPath || '')
  if (!isRealExecutionAvailable) {
    return new Promise<{ success: boolean; error?: string }>((resolve) => {
      const errorMsg = `로컬 모델 파일 또는 엔진 바이너리가 디바이스에 존재하지 않습니다.\n\n- 엔진 경로: ${llamaPath || '미지정'}\n- 모델 파일: ${modelPath}\n\n우측 상단 톱니바퀴 -> 'Models' 탭에서 파일을 체크하시거나, AI 패널의 설정 기어 버튼 -> '모델 허브 개방'을 통해 간편하게 AI를 설정해주세요.`
      if (!event.sender.isDestroyed()) {
        event.sender.send('llm:log', { text: `\n[Fatal Error] 실행 실패:\n${errorMsg}\n` })
        event.sender.send(`llm:done:${sessionId}`, { success: false, error: errorMsg })
      }
      resolve({ success: false, error: errorMsg })
    })
  }

  const systemPrompt = payload.systemPrompt || 'You are AMEVA AI, a helpful assistant integrated into AMEVA document editor. Respond in the same language as the user. Be concise and helpful.'
  const temperature = payload.temperature ?? 0.7
  const maxTokens = payload.maxTokens ?? 512
  const contextSize = payload.contextSize ?? 8192

  // 모델 브랜드(Qwen, Llama, Gemma, Generic) 자동 판별
  const modelNameLower = basename(modelPath).toLowerCase()
  let modelType: 'qwen' | 'llama' | 'gemma' | 'generic' = 'generic'
  if (modelNameLower.includes('qwen')) {
    modelType = 'qwen'
  } else if (modelNameLower.includes('llama')) {
    modelType = 'llama'
  } else if (modelNameLower.includes('gemma')) {
    modelType = 'gemma'
  }

  let fullPrompt = ''
  let stopTokens: string[] = []

  if (modelType === 'llama') {
    // Llama 3/3.1/3.2 chat template format
    fullPrompt = `<|begin_of_text|><|start_header_id|>system<|end_header_id|>\n\n${systemPrompt}<|eot_id|>`
    if (payload.context) {
      fullPrompt += `<|start_header_id|>context<|end_header_id|>\n\n${payload.context.slice(0, 2000)}<|eot_id|>`
    }
    if (payload.history && payload.history.length > 0) {
      for (const h of payload.history) {
        fullPrompt += `<|start_header_id|>${h.role === 'assistant' ? 'assistant' : 'user'}<|end_header_id|>\n\n${h.content}<|eot_id|>`
      }
    }
    fullPrompt += `<|start_header_id|>user<|end_header_id|>\n\n${payload.prompt}<|eot_id|><|start_header_id|>assistant<|end_header_id|>\n\n`
    stopTokens = ['<|eot_id|>', '<|start_header_id|>', '<|end_of_text|>']
  } else if (modelType === 'gemma') {
    // Gemma 2 instruction format
    fullPrompt = `<start_of_turn>user\n${systemPrompt}\n\n`
    if (payload.context) {
      fullPrompt += `[Context]\n${payload.context.slice(0, 2000)}\n\n`
    }
    if (payload.history && payload.history.length > 0) {
      let currentTurn: 'user' | 'model' = 'user'
      for (const h of payload.history) {
        const role = h.role === 'assistant' ? 'model' : 'user'
        if (role !== currentTurn) {
          fullPrompt += `<end_of_turn>\n<start_of_turn>${role}\n`
          currentTurn = role
        }
        fullPrompt += `${h.content}\n`
      }
      if (currentTurn !== 'user') {
        fullPrompt += `<end_of_turn>\n<start_of_turn>user\n`
      }
    }
    fullPrompt += `${payload.prompt}<end_of_turn>\n<start_of_turn>model\n`
    stopTokens = ['<end_of_turn>', '<eos>', '<start_of_turn>']
  } else {
    // Qwen / ChatML / Generic
    fullPrompt = `<|im_start|>system\n${systemPrompt}<|im_end|>\n`
    if (payload.context) {
      fullPrompt += `<|im_start|>context\n${payload.context.slice(0, 2000)}<|im_end|>\n`
    }
    if (payload.history && payload.history.length > 0) {
      for (const h of payload.history) {
        fullPrompt += `<|im_start|>${h.role}\n${h.content}<|im_end|>\n`
      }
    }
    fullPrompt += `<|im_start|>user\n${payload.prompt}<|im_end|>\n<|im_start|>assistant\n`
    stopTokens = ['<|im_end|>', '<|im_start|>', '<|endoftext|>']
  }

  if (payload.apiType === 'api') {
    // ── 💡 OpenAI 호환 클라우드 API 모드 (엔드포인트/모델 동적화) ──
    // [FIX-W-003] 하드코딩된 api.openai.com 및 gpt-4o-mini를 동적 페이로드로 교체
    return new Promise<{ success: boolean; error?: string }>(async (resolve) => {
      try {
        const https = require('https')
        const targetModel = payload.apiModel || 'gpt-4o-mini'
        const rawEndpoint = payload.apiEndpoint || 'https://api.openai.com/v1/chat/completions'
        let parsedEndpoint: URL
        try {
          parsedEndpoint = new URL(rawEndpoint)
        } catch {
          resolve({ success: false, error: `잘못된 API 엔드포인트 URL: ${rawEndpoint}` })
          return
        }
        const postData = JSON.stringify({
          model: targetModel,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: payload.prompt }
          ],
          temperature: temperature,
          max_tokens: maxTokens,
          stream: true
        })

        const reqOptions = {
          hostname: parsedEndpoint.hostname,
          port: parseInt(parsedEndpoint.port) || 443,
          path: parsedEndpoint.pathname + (parsedEndpoint.search || ''),
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${payload.apiKey || ''}`
          }
        }

        let resolved = false
        const req = https.request(reqOptions, (res: any) => {
          const statusCode = res.statusCode || 200
          let buffer = ''
          let rawResponse = ''

          res.on('data', (chunk: Buffer) => {
            const chunkText = chunk.toString()
            rawResponse += chunkText

            if (statusCode >= 200 && statusCode < 300) {
              const lines = chunkText.split('\n')
              for (const line of lines) {
                const cleaned = line.trim()
                if (cleaned.startsWith('data:')) {
                  try {
                    const dataStr = cleaned.slice(5).trim()
                    if (dataStr === '[DONE]') continue
                    const parsed = JSON.parse(dataStr)
                    const token = parsed.choices[0]?.delta?.content
                    if (token) {
                      buffer += token
                      tokenSender.send(token)
                    }
                  } catch {}
                }
              }
            }
          })

          res.on('end', () => {
            if (!resolved) {
              resolved = true
              ipcMain.off(`llm:abort:${sessionId}`, abortListener)
              tokenSender.flush()

              if (statusCode < 200 || statusCode >= 300) {
                let errorMessage = `HTTP 에러 코드: ${statusCode}`
                try {
                  const errorObj = JSON.parse(rawResponse)
                  errorMessage = errorObj.error?.message || errorObj.message || rawResponse || errorMessage
                } catch {
                  if (rawResponse) errorMessage = rawResponse
                }
                if (!event.sender.isDestroyed()) {
                  event.sender.send(`llm:done:${sessionId}`, { success: false, error: errorMessage })
                }
                resolve({ success: false, error: errorMessage })
              } else {
                if (!event.sender.isDestroyed()) {
                  event.sender.send(`llm:done:${sessionId}`, { success: true, fullText: buffer })
                }
                resolve({ success: true })
              }
            }
          })
        })

        req.on('error', (err: any) => {
          if (!resolved) {
            resolved = true
            ipcMain.off(`llm:abort:${sessionId}`, abortListener)
            if (!event.sender.isDestroyed()) {
              event.sender.send(`llm:done:${sessionId}`, { success: false, error: err.message })
            }
            resolve({ success: false, error: `API 호출 실패: ${err.message}` })
          }
        })

        const abortListener = () => {
          req.destroy()
          if (!resolved) {
            resolved = true
            if (!event.sender.isDestroyed()) {
              event.sender.send(`llm:done:${sessionId}`, { success: false, error: '사용자에 의해 중단됨' })
            }
            resolve({ success: false, error: 'Aborted' })
          }
        }
        ipcMain.once(`llm:abort:${sessionId}`, abortListener)

        req.write(postData)
        req.end()

      } catch (err: any) {
        resolve({ success: false, error: err.message })
      }
    })
  }

  const isServer = llamaPath && llamaPath.toLowerCase().includes('llama-server')

  if (isServer) {
    // ── 💡 llama-server API 백그라운드 가상 래퍼 모드 구동 ──
    return new Promise<{ success: boolean; error?: string }>(async (resolve) => {
      try {
        const gpuOnlyFlag = payload.gpuOnly !== false

        // GPU→CPU 자동 폴백 기동 (경쟁 조건 방지 포함)
        const serverReady = await LLMProcessManager.startLlamaServerWithFallback(llamaPath!, modelPath, contextSize, gpuOnlyFlag)

        if (!serverReady) {
          const reason = '서버 기동 실패 (GPU/CPU 폴백 모두 실패). 모델 파일과 llama-server 경로를 확인하세요.'
          if (!event.sender.isDestroyed()) {
            event.sender.send('llm:log', { text: `\n[Fatal Error] ${reason}\n` })
            event.sender.send(`llm:done:${sessionId}`, { success: false, error: reason })
          }
          return resolve({ success: false, error: reason })
        }

        let resolved = false
        const cleanUp = () => {
          // 백그라운드 서버 모드이므로 개별 완료 단계에서 프로세스를 죽이지 않습니다.
        }

        const http = require('http')
        const postData = JSON.stringify({
          prompt: fullPrompt,
          n_predict: maxTokens,
          temperature: temperature,
          stream: true,
          stop: stopTokens
        })

        const reqOptions = {
          hostname: '127.0.0.1',
          port: LLMProcessManager.serverPort,
          path: '/completion',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(postData)
          }
        }

        const req = http.request(reqOptions, (res: any) => {
          let buffer = ''
          let sseBuffer = ''
          res.on('data', (chunk: Buffer) => {
            sseBuffer += chunk.toString()
            
            // SSE 형식은 빈 줄(\n\n)로 이벤트를 구분하므로 완전한 이벤트만 파싱
            let eolIndex = -1
            while ((eolIndex = sseBuffer.indexOf('\n\n')) >= 0) {
              const part = sseBuffer.slice(0, eolIndex)
              sseBuffer = sseBuffer.slice(eolIndex + 2) // 남은 버퍼 보존
              
              const lines = part.split('\n')
              for (const line of lines) {
                const cleaned = line.trim()
                if (cleaned.startsWith('data:')) {
                  try {
                    const dataStr = cleaned.slice(5).trim()
                    if (dataStr === '[DONE]') continue
                    const parsed = JSON.parse(dataStr)
                    const token = parsed.content
                    if (token !== undefined && token !== null) {
                      buffer += token
                      tokenSender.send(token)
                    }
                  } catch (err) {
                    console.error('SSE JSON Parse Error:', err, 'Data:', cleaned)
                  }
                }
              }
            }
          })

          res.on('end', () => {
            cleanUp()
            if (!resolved) {
              resolved = true
              ipcMain.off(`llm:abort:${sessionId}`, abortListener)
              tokenSender.flush()
              if (!event.sender.isDestroyed()) {
                event.sender.send(`llm:done:${sessionId}`, { success: true, fullText: buffer })
              }
              resolve({ success: true, response: buffer } as any)
            }
          })
        })

        req.on('error', (err: any) => {
          cleanUp()
          if (!resolved) {
            resolved = true
            ipcMain.off(`llm:abort:${sessionId}`, abortListener)
            tokenSender.flush()
            if (!event.sender.isDestroyed()) {
              event.sender.send(`llm:done:${sessionId}`, { success: false, error: err.message })
            }
            resolve({ success: false, error: `llama-server 통신 실패: ${err.message}` })
          }
        })

        // 사용자 중단 리스너 바인딩
        const abortListener = () => {
          req.destroy()
          cleanUp()
          if (!resolved) {
            resolved = true
            if (!event.sender.isDestroyed()) {
              event.sender.send(`llm:done:${sessionId}`, { success: false, error: '사용자에 의해 중단됨' })
            }
            resolve({ success: false, error: 'Aborted' })
          }
        }
        ipcMain.once(`llm:abort:${sessionId}`, abortListener)

        req.write(postData)
        req.end()

      } catch (err: any) {
        if (LLMProcessManager.activeLLMProcess) {
          LLMProcessManager.activeLLMProcess.kill('SIGKILL')
          LLMProcessManager.activeLLMProcess = null
        }
        resolve({ success: false, error: err.message })
      }
    })
  }

  const args = [
    '-m', modelPath,
    '-p', fullPrompt,
    '-n', String(maxTokens),
    '--temp', String(temperature),
    '-c', String(contextSize),
    '--no-display-prompt',
    '--no-conversation',
    '--simple-io',
    '-ngl', payload.gpuOnly !== false ? '99' : '0', // GPU 가속 인자 전달
    '-t', '4', // 스레드 4개 사용 지정
  ]
  for (const token of stopTokens) {
    args.push('--stop', token)
  }

  return new Promise<{ success: boolean; error?: string }>((resolve) => {
    // 🤖 [AI 셋업] 스폰 직전 물리 파일 유효성 최종 검사
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

      // 콘솔 출력을 얻기 위해 windowsHide 설정 후 스폰
      const proc = spawn(llamaPath, args, { windowsHide: true })
      LLMProcessManager.activeLLMProcess = proc

      let buffer = ''
      let resolved = false

      // [SEC-W-022] abort 리스너를 트래킹하여 에러 경로에서도 확실히 정리
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
      let rawBuffer = '' // 🤖 llama-cli 전체 원시 아웃풋 추적용

      proc.stdout.on('data', (data: Buffer) => {
        const text = stdoutDecoder.write(data)
        buffer += text
        rawBuffer += text

        // [실시간 콘솔 로그 스트림] 렌더러로 원시 터미널 아웃풋 전송 (전체 다 보여줌)
        LLMProcessManager.broadcastLog('LMA', text)

        // 만약 이미 성능 지표가 감지되었다면 더 이상 채팅방 토큰을 보내지 않음
        if (rawBuffer.includes('[ Prompt:')) {
          return
        }

        // 이번 청크에서 성능 지표 시작 부분이 있는지 검사
        const statsIndex = rawBuffer.indexOf('[ Prompt:')
        
        let chunkToSend = text
        if (statsIndex !== -1) {
          // 성능 지표가 시작되는 부분 전까지만 잘라서 보냄
          const textIndexInRaw = rawBuffer.length - text.length
          const cutLength = statsIndex - textIndexInRaw
          if (cutLength > 0) {
            chunkToSend = text.substring(0, cutLength)
          } else {
            chunkToSend = ''
          }
        }

        // ChatML 특수 태그 및 프롬프트 대기 기호 제거
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
        // [실시간 콘솔 로그 스트림] llama.cpp의 표준 에러 로그 전송
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
        LLMProcessManager.activeLLMProcess = null
      }
      if (!event.sender.isDestroyed()) {
        event.sender.send('llm:log', { text: `\n[Fatal Error] spawn 동기 예외 발생: ${err.message}` })
        event.sender.send('llm:done', { success: false, error: err.message })
      }
      resolve({ success: false, error: err.message })
    }
  })
})

// LLM 생성 중단
ipcMain.on('llm:abort', () => {
  if (LLMProcessManager.activeLLMProcess) {
    LLMProcessManager.activeLLMProcess.kill('SIGKILL')
    LLMProcessManager.activeLLMProcess = null
  }
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
    // getGPUInfo가 실패하거나 빈 값일 경우 대체 수단 가동
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

// 사용 가능한 LLM 및 코딩 모델 목록 조회 (c:\ameva\models\llm 혹은 code 경로 탐색)
ipcMain.handle('llm:listModels', async (_event, type?: 'llm' | 'code' | 'ollama') => {
  if (type === 'ollama') {
    return new Promise((resolve) => {
      const http = require('http')
      const req = http.request({
        hostname: '127.0.0.1',
        port: 11434,
        path: '/api/tags',
        method: 'GET',
        timeout: 2000
      }, (res: any) => {
        let rawData = ''
        res.on('data', (chunk: any) => { rawData += chunk })
        res.on('end', () => {
          try {
            const parsed = JSON.parse(rawData)
            const models = (parsed.models || []).map((m: any) => ({
              name: m.name,
              filename: m.model,
              path: m.name, // Ollama는 모델 이름을 그대로 path로 씁니다.
              size: m.size || 0
            }))
            resolve(models)
          } catch (e) {
            resolve([])
          }
        })
      })
      req.on('error', () => { resolve([]) })
      req.on('timeout', () => { req.destroy(); resolve([]) })
      req.end()
    })
  }

  const llmDir = type === 'code' ? 'C:\\ameva\\models\\code' : 'C:\\ameva\\models\\llm'
  try {
    const { readdir } = await import('fs/promises')
    if (!existsSync(llmDir)) return []
    const files = await readdir(llmDir)
    const filtered = files
      .filter(f => f.endsWith('.gguf'))
      .map(f => ({
        name: f.replace('.gguf', '').replace(/-/g, ' '),
        filename: f,
        path: join(llmDir, f),
        size: (() => {
          try {
            const { statSync } = require('fs')
            return statSync(join(llmDir, f)).size
          } catch { return 0 }
        })(),
      }))
    return filtered
  } catch {
    return []
  }
})

// 외부에서 다운로드한 모델 파일 복사 가져오기
ipcMain.handle('llm:importModel', async (_event, sourcePath: string, type?: 'llm' | 'code') => {
  const llmDir = type === 'code' ? 'C:\\ameva\\models\\code' : 'C:\\ameva\\models\\llm'
  try {
    const { copyFile, mkdir } = await import('fs/promises')
    if (!sourcePath || !existsSync(sourcePath)) {
      return { success: false, error: '선택한 파일이 존재하지 않습니다.' }
    }
    const filename = basename(sourcePath)
    if (!filename.endsWith('.gguf')) {
      return { success: false, error: '보안 정책: .gguf 파일만 추가할 수 있습니다.' }
    }
    if (!existsSync(llmDir)) {
      await mkdir(llmDir, { recursive: true })
    }
    const targetPath = join(llmDir, filename)
    await copyFile(sourcePath, targetPath)
    return { success: true, path: targetPath }
  } catch (err: any) {
    return { success: false, error: `파일 복사 실패: ${err.message}` }
  }
})

let activeDownloadRequest: any = null

// [SEC-W-003] 허용 다운로드 호스트 화이트리스트
const ALLOWED_DOWNLOAD_HOSTS = [
  'huggingface.co',
  'cdn-lfs.huggingface.co',
  'cdn-lfs-us-1.huggingface.co',
  'cdn.ollama.ai',
  'ollama.ai',
  'github.com',
  'objects.githubusercontent.com',
]
const MAX_REDIRECT_DEPTH = 5

ipcMain.handle('llm:downloadModel', async (event, payload: {
  url: string
  filename: string
  type?: 'llm' | 'code'
}) => {
  const llmDir = payload.type === 'code' ? 'C:\\ameva\\models\\code' : 'C:\\ameva\\models\\llm'
  const { mkdir } = await import('fs/promises')
  const { createWriteStream } = require('fs')
  const https = require('https')

  try {
    // [SEC-W-003] 파일명 Path Traversal 검증
    const safeName = basename(payload.filename)
    if (!safeName.endsWith('.gguf') && !safeName.endsWith('.bin')) {
      return { success: false, error: '보안 정책: .gguf / .bin 파일만 다운로드 가능합니다.' }
    }
    const targetPath = join(llmDir, safeName)
    const resolvedTarget = resolvePath(targetPath)
    const resolvedDir = resolvePath(llmDir)
    if (!resolvedTarget.startsWith(resolvedDir)) {
      return { success: false, error: '보안 정책: 경로 탈출이 감지되었습니다.' }
    }

    // [SEC-W-003] URL 검증 — HTTPS + 허용 호스트만
    let parsedUrl: URL
    try {
      parsedUrl = new URL(payload.url)
    } catch {
      return { success: false, error: '유효하지 않은 URL입니다.' }
    }
    if (parsedUrl.protocol !== 'https:') {
      return { success: false, error: '보안 정책: HTTPS URL만 허용됩니다.' }
    }
    if (!ALLOWED_DOWNLOAD_HOSTS.includes(parsedUrl.hostname)) {
      return { success: false, error: `보안 정책: 허용되지 않은 다운로드 호스트입니다. (${parsedUrl.hostname})` }
    }

    if (!existsSync(llmDir)) {
      await mkdir(llmDir, { recursive: true })
    }

    const fileStream = createWriteStream(resolvedTarget)

    return new Promise<{ success: boolean; error?: string }>((resolve) => {
      let downloadedBytes = 0
      let totalBytes = 0
      let lastTime = Date.now()
      let lastBytes = 0

      // [SEC-W-007] 리다이렉트 깊이 제한
      const requestUrl = (targetUrl: string, depth = 0) => {
        if (depth > MAX_REDIRECT_DEPTH) {
          fileStream.destroy()
          activeDownloadRequest = null
          resolve({ success: false, error: '너무 많은 리다이렉트가 발생했습니다.' })
          return
        }
        // 리다이렉트 시에도 허용 호스트 재검증
        let redirectParsed: URL
        try { redirectParsed = new URL(targetUrl) } catch {
          fileStream.destroy()
          resolve({ success: false, error: '리다이렉트 URL이 유효하지 않습니다.' })
          return
        }
        if (redirectParsed.protocol !== 'https:') {
          fileStream.destroy()
          resolve({ success: false, error: '리다이렉트가 HTTPS가 아닙니다.' })
          return
        }

        const req = https.get(targetUrl, (res: any) => {
          if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
            requestUrl(res.headers.location, depth + 1)
            return
          }
          if (res.statusCode !== 200) {
            fileStream.close()
            const errText = `다운로드 실패: 서버 응답 코드 오류: ${res.statusCode} (URL: ${targetUrl})`
            console.error(errText)
            if (!event.sender.isDestroyed()) {
              event.sender.send('llm:log', { text: `\n[Error] ${errText}\n` })
            }
            resolve({ success: false, error: `서버 응답 코드 오류: ${res.statusCode}` })
            return
          }

          totalBytes = parseInt(res.headers['content-length'] || '0', 10)

          res.on('data', (chunk: Buffer) => {
            downloadedBytes += chunk.length
            fileStream.write(chunk)

            const now = Date.now()
            if (now - lastTime > 500) {
              const chunkTime = (now - lastTime) / 1000
              const chunkBytes = downloadedBytes - lastBytes
              const speed = chunkBytes / chunkTime / (1024 * 1024)
              const progress = totalBytes > 0 ? (downloadedBytes / totalBytes) * 100 : 0
              const bytesRemaining = totalBytes - downloadedBytes
              const speedBytesPerSec = chunkBytes / chunkTime
              const timeRemaining = speedBytesPerSec > 0 ? bytesRemaining / speedBytesPerSec : 9999

              if (!event.sender.isDestroyed()) {
                event.sender.send('llm:download-progress', {
                  filename: safeName,
                  progress: Math.min(100, Number(progress.toFixed(1))),
                  speed: Number(speed.toFixed(1)),
                  downloadedBytes,
                  totalBytes,
                  timeRemaining: Math.max(0, Math.round(timeRemaining))
                })
              }
              lastTime = now
              lastBytes = downloadedBytes
            }
          })

          res.on('end', () => {
            fileStream.end()
            activeDownloadRequest = null
            if (!event.sender.isDestroyed()) {
              event.sender.send('llm:download-progress', {
                filename: safeName,
                progress: 100,
                speed: 0,
                downloadedBytes: totalBytes,
                totalBytes,
                timeRemaining: 0
              })
            }
            resolve({ success: true })
          })
        })

        activeDownloadRequest = req
        req.on('error', (err: any) => {
          fileStream.close()
          activeDownloadRequest = null
          const errText = `다운로드 통신 오류: ${err.message} (URL: ${payload.url})`
          console.error(errText)
          if (!event.sender.isDestroyed()) {
            event.sender.send('llm:log', { text: `\n[Error] ${errText}\n` })
          }
          resolve({ success: false, error: err.message })
        })
      }

      requestUrl(payload.url, 0)
    })

  } catch (err: any) {
    activeDownloadRequest = null
    return { success: false, error: err.message }
  }
})

// 다운로드 취소
ipcMain.on('llm:cancelDownload', () => {
  if (activeDownloadRequest) {
    activeDownloadRequest.destroy()
    activeDownloadRequest = null
  }
})

// ─────────────────────────────────────────────────────────────────
// 🎤 Whisper STT IPC 핸들러
// ─────────────────────────────────────────────────────────────────

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
        // whisper-cli는 .txt 파일로 출력할 수도 있음
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

// 녹음 파일 임시 저장 경로 반환
ipcMain.handle('stt:getTempPath', async () => {
  return join(app.getPath('temp'), `ameva_recording_${Date.now()}.wav`)
})

// ─────────────────────────────────────────────────────────────────
// 기타 IPC 핸들러
// ─────────────────────────────────────────────────────────────────

// 줌 레벨 조정
ipcMain.on('window:setZoom', (event, level: number) => {
  const win = getActiveWindow(event)
  if (win) win.webContents.setZoomLevel(level)
})

ipcMain.handle('window:getZoom', async (event) => {
  const win = getActiveWindow(event)
  if (win) return win.webContents.getZoomLevel()
  return 0
})

ipcMain.on('window:setZoomFactor', (event, factor: number) => {
  const win = getActiveWindow(event)
  if (win) win.webContents.setZoomFactor(factor)
})

ipcMain.handle('window:getZoomFactor', async (event) => {
  const win = getActiveWindow(event)
  if (win) return win.webContents.getZoomFactor()
  return 1.0
})

ipcMain.on('window:new-window', () => {
  createWindow()
})

// [SEC-W-005] openExternal 프로토콜 화이트리스트 — 임의 프로토콜 핸들러 실행 차단
const ALLOWED_EXTERNAL_PROTOCOLS = ['http:', 'https:', 'mailto:']

ipcMain.on('action:openExternal', (_event, url: string) => {
  // file:// URL이면 showItemInFolder로 파일 탐색기에서 열기
  if (url.startsWith('file:///')) {
    try {
      // [SEC-W-015] URL 디코딩 후 경로 정규화 (경로 탈출 방지)
      const decoded = decodeURIComponent(url.slice('file:///'.length))
      const normalized = resolvePath(decoded.replace(/\//g, '\\'))
      shell.showItemInFolder(normalized)
    } catch {
      console.warn('[Security] Invalid file:// URL for showItemInFolder')
    }
    return
  }

  try {
    const parsed = new URL(url)
    if (!ALLOWED_EXTERNAL_PROTOCOLS.includes(parsed.protocol)) {
      console.warn(`[Security] Blocked openExternal with disallowed protocol: ${parsed.protocol}`)
      return
    }
    shell.openExternal(url)
  } catch {
    console.warn(`[Security] Invalid URL for openExternal: ${url}`)
  }
})

// 내보낸 파일을 파일 탐색기에서 선택/표시
ipcMain.on('export:showInFolder', (_event, filePath: string) => {
  shell.showItemInFolder(filePath)
})

// [SEC-W-019] 분산 문서 변환 및 로컬 직접 물리 라이팅 엔진
// exportersMain이 상단에서 ESM으로 static import되어 번들링됨

ipcMain.handle('export:convert', async (event, payload: {
  blocks: any[]
  format: string
  defaultName: string
}) => {
  const win = getActiveWindow(event)
  if (!win) return { success: false, error: '활성화된 윈도우가 없습니다.' }

  const extensionsMap: Record<string, string[]> = {
    html: ['html', 'htm'],
    docx: ['docx'],
    xlsx: ['xlsx'],
    pptx: ['pptx'],
    hwpx: ['hwpx'],
    xml: ['xml']
  }

  const filters = [
    {
      name: `${payload.format.toUpperCase()} Document`,
      extensions: extensionsMap[payload.format] || [payload.format]
    }
  ]

  // 1단계: OS 시스템 보안 저장 다이얼로그 팝업 위임
  const { canceled, filePath } = await dialog.showSaveDialog(win, {
    title: `${payload.format.toUpperCase()} 파일 저장 위치 선택`,
    defaultPath: payload.defaultName,
    filters
  })

  if (canceled || !filePath) {
    return { success: false, error: '저장이 취소되었습니다.' }
  }

  try {
    let outputBuffer: Buffer | string

    // 2단계: 백엔드 노드 분산 연산 전담 수행
    switch (payload.format) {
      case 'html':
        outputBuffer = exportersMain.blocksToHTML(payload.blocks)
        await writeFile(filePath, outputBuffer, 'utf-8')
        break
      case 'docx':
        outputBuffer = await exportersMain.exportToWord(payload.blocks)
        await writeFile(filePath, outputBuffer)
        break
      case 'xlsx':
        outputBuffer = await exportersMain.exportToExcel(payload.blocks)
        await writeFile(filePath, outputBuffer)
        break
      case 'pptx':
        outputBuffer = await exportersMain.exportToPPTX(payload.blocks)
        await writeFile(filePath, outputBuffer)
        break
      case 'hwpx':
        outputBuffer = await exportersMain.exportToHWPX(payload.blocks)
        await writeFile(filePath, outputBuffer)
        break
      case 'xml':
        outputBuffer = exportersMain.exportToXML(payload.blocks)
        await writeFile(filePath, outputBuffer, 'utf-8')
        break
      default:
        throw new Error(`지원하지 않는 변환 포맷입니다: ${payload.format}`)
    }

    return { success: true, savedPath: filePath }
  } catch (err: any) {
    console.error(`[export:convert] Failed:`, err)
    return { success: false, error: err.message }
  }
})

ipcMain.on('window:close', (event) => {
  const win = getActiveWindow(event)
  if (win) win.close()
})

// 🤖 동적 Stdio MCP 자식 프로세스 관리 시스템


// 🤖 MCP IPC 핸들러 등록
ipcMain.handle('mcp:spawn', async (_event, serverId: string, command: string, args: string[]) => {
  if (!isProPlanMemory) {
    return { success: false, error: '무료 요금제에서는 MCP 서버를 기동할 수 없습니다. Pro 요금제로 업그레이드하세요.' }
  }
  return await MCPProcessManager.spawnServer(serverId, command, args)
})

ipcMain.handle('mcp:call', async (_event, serverId: string, request: any) => {
  if (!isProPlanMemory) {
    return { success: false, error: '무료 요금제에서는 MCP 도구를 호출할 수 없습니다. Pro 요금제로 업그레이드하세요.' }
  }
  return await MCPProcessManager.callServer(serverId, request)
})

ipcMain.handle('mcp:kill', async (_event, serverId: string) => {
  MCPProcessManager.killServer(serverId)
  return { success: true }
})

// 🔐 OS Keychain (safeStorage) 자격 증명 관리 IPC 핸들러 등록
const credentialsPath = join(app.getPath('userData'), 'credentials.json')

ipcMain.handle('keychain:set', async (_event, key: string, value: string) => {
  try {
    if (!safeStorage.isEncryptionAvailable()) {
      return { success: false, error: 'OS 암호화 스토리지를 사용할 수 없는 환경입니다.' }
    }
    let data: Record<string, string> = {}
    if (existsSync(credentialsPath)) {
      try {
        data = JSON.parse(readFileSync(credentialsPath, 'utf8'))
      } catch {
        data = {}
      }
    }
    const encrypted = safeStorage.encryptString(value)
    data[key] = encrypted.toString('base64')
    writeFileSync(credentialsPath, JSON.stringify(data), 'utf8')
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
})

ipcMain.handle('keychain:get', async (_event, key: string) => {
  try {
    if (!existsSync(credentialsPath)) return null
    if (!safeStorage.isEncryptionAvailable()) return null
    const data = JSON.parse(readFileSync(credentialsPath, 'utf8'))
    const encryptedBase64 = data[key]
    if (!encryptedBase64) return null
    const buffer = Buffer.from(encryptedBase64, 'base64')
    const decrypted = safeStorage.decryptString(buffer)
    return decrypted
  } catch {
    return null
  }
})

ipcMain.handle('keychain:delete', async (_event, key: string) => {
  try {
    if (!existsSync(credentialsPath)) return { success: true }
    let data: Record<string, string> = {}
    try {
      data = JSON.parse(readFileSync(credentialsPath, 'utf8'))
    } catch {
      data = {}
    }
    delete data[key]
    writeFileSync(credentialsPath, JSON.stringify(data), 'utf8')
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
})

// [FEAT] 외부 URL 메타데이터 백그라운드 크롤링 채널 (CORS 우회 및 메모리 절약)
ipcMain.handle('action:fetchUrlMetadata', async (_event, targetUrl: string) => {
  return new Promise<{ title?: string; description?: string; image?: string; url: string }>((resolve) => {
    const http = require('http')
    const https = require('https')
    const { URL } = require('url')
    let isResolved = false

    const fetchHtml = (urlStr: string, redirectsRemaining = 5) => {
      if (redirectsRemaining < 0) {
        resolve({ title: '', description: '너무 많은 리다이렉트가 발생했습니다.', image: '', url: targetUrl })
        return
      }

      let parsedUrl: URL
      try {
        parsedUrl = new URL(urlStr)
      } catch (err) {
        resolve({ title: '', description: '유효하지 않은 URL 형식입니다.', image: '', url: targetUrl })
        return
      }

      const client = parsedUrl.protocol === 'https:' ? https : http
      const options = {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
        },
        timeout: 5000
      }

      const req = client.get(urlStr, options, (res: any) => {
        // 3xx 리다이렉션 처리
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          const redirectTarget = new URL(res.headers.location, urlStr).toString()
          res.resume() // 메모리 해제
          fetchHtml(redirectTarget, redirectsRemaining - 1)
          return
        }

        if (res.statusCode !== 200) {
          res.resume()
          resolve({ title: '', description: `서버 코드: ${res.statusCode}`, image: '', url: targetUrl })
          return
        }

        let html = ''
        let totalBytes = 0
        const MAX_HTML_BYTES = 1024 * 1024; // 최대 1MB 제한 (메모리 절약)
        let isResolved = false

        const finalizeResolve = (htmlContent: string) => {
          if (isResolved) return
          isResolved = true

          const getMetaTag = (property: string) => {
            const regexes = [
              new RegExp(`<meta[^>]*property=["']og:${property}["'][^>]*content=["']([^"']*)["']`, 'i'),
              new RegExp(`<meta[^>]*content=["']([^"']*)["'][^>]*property=["']og:${property}["']`, 'i'),
              new RegExp(`<meta[^>]*name=["']og:${property}["'][^>]*content=["']([^"']*)["']`, 'i'),
              new RegExp(`<meta[^>]*content=["']([^"']*)["'][^>]*name=["']og:${property}["']`, 'i')
            ]
            for (const r of regexes) {
              const match = htmlContent.match(r)
              if (match && match[1]) {
                return match[1]
                  .replace(/&amp;/g, '&')
                  .replace(/&lt;/g, '<')
                  .replace(/&gt;/g, '>')
                  .replace(/&quot;/g, '"')
                  .replace(/&#39;/g, "'")
                  .trim()
              }
            }
            return ''
          }

          let title = getMetaTag('title')
          if (!title) {
            const titleMatch = htmlContent.match(/<title[^>]*>([^<]*)<\/title>/i)
            if (titleMatch && titleMatch[1]) {
              title = titleMatch[1].trim()
            }
          }

          let description = getMetaTag('description')
          if (!description) {
            const descMatch = htmlContent.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["']/i)
            if (descMatch && descMatch[1]) {
              description = descMatch[1].trim()
            }
          }

          const image = getMetaTag('image')

          resolve({
            title: title || parsedUrl.hostname,
            description: description || '설명이 존재하지 않는 웹 페이지입니다.',
            image: image || '',
            url: urlStr
          })
        }

        res.on('data', (chunk: Buffer) => {
          totalBytes += chunk.length
          if (totalBytes > MAX_HTML_BYTES) {
            html += chunk.toString('utf8', 0, MAX_HTML_BYTES - (totalBytes - chunk.length))
            req.destroy() // 용량 초과 시 소켓 파괴
            finalizeResolve(html) // 즉시 resolve
          } else {
            html += chunk.toString('utf8')
          }
        })

        res.on('end', () => {
          finalizeResolve(html)
        })
      })

      req.on('error', (err: any) => {
        if (isResolved) return
        isResolved = true
        resolve({ title: '', description: `연결 실패: ${err.message}`, image: '', url: targetUrl })
      })

      req.on('timeout', () => {
        req.destroy()
        if (isResolved) return
        isResolved = true
        resolve({ title: '', description: '연결 시간 초과', image: '', url: targetUrl })
      })
    }

    fetchHtml(targetUrl)
  })
})

ipcMain.handle('mcp:getToken', async () => {
  try {
    const fs = require('fs')
    if (process.env.AMEVA_TOKEN) {
      return process.env.AMEVA_TOKEN.trim()
    }
    const tokenPath = 'c:\\ameva\\AMEVA-MCP-Wasm-Toolkit\\.token'
    if (fs.existsSync(tokenPath)) {
      return fs.readFileSync(tokenPath, 'utf8').trim()
    }
  } catch (err) {
    console.error('mcp:getToken 실패:', err)
  }
  return null
})

// 🦾 [CONSOLE EXIT-GUARD] 터미널에서 Ctrl+C (SIGINT) 또는 SIGTERM 시그널로 강제 종료 시, 백그라운드 자식 프로세스를 즉각 동기적으로 정리
process.on('SIGINT', () => {
  LLMProcessManager.forceCleanupLocalLLMProcesses()
  process.exit(0)
})
process.on('SIGTERM', () => {
  LLMProcessManager.forceCleanupLocalLLMProcesses()
  process.exit(0)
})


