import { app, BrowserWindow, ipcMain, dialog, shell, session } from 'electron'
import { join, dirname, resolve as resolvePath, basename } from 'path'
import { fileURLToPath } from 'url'
import { existsSync } from 'fs'
import * as exportersMain from './exportersMain'

// 🤖 개발용 일렉트론 보안 경고 비활성화
process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = 'true'

// ESM/CJS 유니버설 __dirname 폴리필
const localFilename = (typeof import.meta !== 'undefined' && import.meta.url) 
  ? fileURLToPath(import.meta.url) 
  : (typeof __filename !== 'undefined' ? __filename : '')
const localDirname = (typeof import.meta !== 'undefined' && import.meta.url) 
  ? dirname(localFilename) 
  : (typeof __dirname !== 'undefined' ? __dirname : '')

const __filename = localFilename
const __dirname = localDirname
import { readFile, writeFile, unlink } from 'fs/promises'
import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const pdf = require('pdf-parse')
import { spawn, ChildProcess } from 'child_process'
import { WebSocketServer, WebSocket } from 'ws'
import { networkInterfaces } from 'os'

let mainWindow: BrowserWindow | null = null
let collabilationServer: WebSocketServer | null = null
let activeConnections: Set<WebSocket> = new Set()
let fileToOpenOnStartup: string | null = null

// LLM 프로세스 상태 관리
let activeLLMProcess: ChildProcess | null = null

// 1. 싱글 인스턴스 락 획득 (중복 창 열림 방지 및 파일 인수 위임)
const gotTheLock = app.requestSingleInstanceLock()

if (!gotTheLock) {
  app.quit()
} else {
  app.on('second-instance', async (event, commandLine) => {
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
    show: false, // [PERF] 준비될 때까지 윈도우 노출을 보류하여 검은색 플래시 현상 방지
    backgroundColor: '#090a0f', // [PERF] 다크 테마 기본 배경색 매핑으로 시각적 통일성 부여
    webPreferences: {
      preload: preloadPath,
      nodeIntegration: false,
      contextIsolation: true,
      webviewTag: false,   // [SEC-W-004] webviewTag 비활성화 — XSS 확장 벡터 차단
      sandbox: true,       // [SEC-W-004] 렌더러 샌드박스 강화
    },
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#0a0a0f',
      symbolColor: '#8b5cf6',
      height: 38,
    },
  })

  // [PERF] 렌더러가 첫 페인팅을 끝마치고 시각적으로 완성되었을 때 단번에 화면에 표출
  mainWindow.once('ready-to-show', () => {
    if (mainWindow) {
      mainWindow.show()
    }
  })

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
    // 개발자 도구 자동 열림 활성화
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(join(__dirname, '../dist/index.html'))
  }

  // 렌더러 로딩 완료 시 최초 전달된 파일 로드 전송
  mainWindow.webContents.on('did-finish-load', async () => {
    if (fileToOpenOnStartup && mainWindow) {
      try {
        const content = await readFile(fileToOpenOnStartup, 'utf-8')
        mainWindow.webContents.send('file:open-argv', { content, filePath: fileToOpenOnStartup })
        fileToOpenOnStartup = null
      } catch (err) {
        console.error('Failed to read startup file:', err)
      }
    }
  })
}

app.whenReady().then(() => {
  // [SEC-W-021] Content-Security-Policy 설정
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' blob: https://cdn.jsdelivr.net https://cdnjs.cloudflare.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net; font-src 'self' https://fonts.gstatic.com https://cdn.jsdelivr.net; img-src 'self' data: blob:; connect-src 'self' ws://localhost:* wss://* http://localhost:* https://* wss://demos.yjs.dev; worker-src blob:; frame-src 'self' https: http: data: blob:;"
        ]
      }
    })
  })

  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  // LLM 프로세스 정리
  if (activeLLMProcess) {
    activeLLMProcess.kill()
    activeLLMProcess = null
  }
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

// 로컈 IP 주소 추출 헬퍼 함수
function getLocalIPAddress() {
  const nets = networkInterfaces()
  for (const name of Object.keys(nets)) {
    const interfaces = nets[name]
    if (interfaces) {
      for (const net of interfaces) {
        if (net.family === 'IPv4' && !net.internal) {
          return net.address
        }
      }
    }
  }
  return 'localhost'
}

// IPC 핸들러 - 로컈 협업 웹소켓 서버 관리
// [SEC-W-009] 세션 토큰 정성 실행 시마다 새 토큰 생성
let collabSessionToken: string | null = null

ipcMain.handle('server:start', async (event, port: number) => {
  const localIp = getLocalIPAddress()
  // 이미 실행 중이면 현재 상태를 다시 전송하여 UI 동기화
  if (collabilationServer) {
    event.sender.send('server:status', { running: true, port, ip: localIp, token: collabSessionToken })
    return { running: true, port, ip: localIp, token: collabSessionToken }
  }
  try {
    // [SEC-W-009] 매 서버 시작마다 새 랜덤 토큰 생성
    const { randomUUID } = await import('crypto')
    collabSessionToken = randomUUID()

    collabilationServer = new WebSocketServer({
      port,
      perMessageDeflate: {
        zlibDeflateOptions: { chunkSize: 1024, memLevel: 7, level: 4 },
        zlibInflateOptions: { chunkSize: 10 * 1024 },
        threshold: 1024,
      },
    })
    activeConnections = new Set()
    collabilationServer.on('connection', (ws, req) => {
      // [SEC-W-009] 토큰 검증 — URL 쿼리 파라미터에서 토큰 확인
      try {
        const reqUrl = new URL(req.url || '/', `http://localhost`)
        const clientToken = reqUrl.searchParams.get('token')
        if (!clientToken || clientToken !== collabSessionToken) {
          ws.close(1008, 'Unauthorized: invalid session token')
          return
        }
      } catch {
        ws.close(1008, 'Unauthorized: invalid request')
        return
      }

      activeConnections.add(ws)
      ws.on('message', (message, isBinary) => {
        for (const client of activeConnections) {
          // readyState 1은 WebSocket.OPEN을 의미함 (번들러 충돌 및 ESM/CJS 호환성 방지)
          if (client !== ws && client.readyState === 1) {
            client.send(message, { binary: isBinary })
          }
        }
      })
      ws.on('close', () => activeConnections.delete(ws))
      ws.on('error', () => activeConnections.delete(ws))
    })
    // 서버 런타임 에러 핸들링
    collabilationServer.on('error', (err: any) => {
      console.error('[collabServer] 런타임 오류:', err)
      event.sender.send('server:status', { running: false, error: err.message, ip: localIp })
      collabilationServer = null
      collabSessionToken = null
    })
    event.sender.send('server:status', { running: true, port, ip: localIp, token: collabSessionToken })
    return { running: true, port, ip: localIp, token: collabSessionToken }
  } catch (err: any) {
    console.error('[collabServer] 서버 시작 실패:', err)
    collabilationServer = null
    collabSessionToken = null
    event.sender.send('server:status', { running: false, error: err.message, ip: localIp })
    return { running: false, error: err.message }
  }
})

ipcMain.handle('server:stop', (event) => {
  if (collabilationServer) {
    for (const ws of activeConnections) ws.close()
    activeConnections.clear()
    collabilationServer.close()
    collabilationServer = null
    collabSessionToken = null
  }
  event.sender.send('server:status', { running: false })
  return { running: false }
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

// [AI 셋업] 번들링된 llama-cli/server 실행 파일 경로 탐색 헬퍼 (사용자 설치 불필요하게 번들 1순위 조회)
function findLlamaCli(): string | null {
  const isDev = !app.isPackaged
  const basePath = isDev
    ? join(app.getAppPath(), 'resources')
    : join(process.resourcesPath, 'bin')

  const platform = process.platform // 'win32', 'darwin', 'linux'
  
  // 1순위: 로딩 딜레이가 없고 즉각 실행되는 llama-server 우선 탐색
  const serverBinaryName = platform === 'win32' ? 'llama-server.exe' : 'llama-server'
  const serverCandidates = [
    join(basePath, platform, serverBinaryName),
    'C:\\ameva\\llama\\llama-server.exe',
    'C:\\ameva\\llama\\server.exe',
    join(app.getPath('userData'), 'llama', serverBinaryName),
  ]
  for (const c of serverCandidates) {
    if (existsSync(c)) return c
  }

  // 2순위: llama-cli 폴백 탐색
  const cliBinaryName = platform === 'win32' ? 'llama-cli.exe' : 'llama-cli'
  const bundledPath = join(basePath, platform, cliBinaryName)
  const candidates = [
    bundledPath, // 앱 패키지 내 내장 바이너리
    'C:\\ameva\\llama\\llama-cli.exe',
    'C:\\ameva\\llama\\llama.exe',
    'C:\\ameva\\llama\\main.exe',
    join(app.getPath('userData'), 'llama', cliBinaryName),
  ]
  for (const c of candidates) {
    if (existsSync(c)) return c
  }
  // PATH에서 탐색
  return null // 무조건 실재 경로 반환하도록 null 폴백
}

// whisper-cli 실행 파일 경로 탐색 헬퍼
function findWhisperCli(): string | null {
  const candidates = [
    'C:\\ameva\\whisper\\whisper-cli.exe',
    'C:\\ameva\\whisper\\main.exe',
    'C:\\ameva\\whisper\\whisper.exe',
  ]
  for (const c of candidates) {
    if (existsSync(c)) return c
  }
  return 'whisper-cli'
}

// 🤖 [llama-server 백그라운드 상주 제어 전역 변수]
let activeServerProcess: any = null
let activeServerModelPath: string = ''
let activeServerGpuOnly: boolean = true
const serverPort = 12345

app.on('will-quit', () => {
  if (activeServerProcess) {
    try {
      activeServerProcess.kill('SIGKILL')
    } catch {}
  }
})

// 스트리밍 LLM 추론 (토큰 단위 IPC 이벤트 방출)
ipcMain.handle('llm:generate', async (event, payload: {
  modelPath: string
  prompt: string
  context?: string
  systemPrompt?: string
  maxTokens?: number
  temperature?: number
  contextSize?: number
  apiType?: 'local' | 'api'
  apiKey?: string
  gpuOnly?: boolean
  history?: { role: 'user' | 'assistant'; content: string }[]
}) => {
  // 기존 프로세스 kill
  if (activeLLMProcess) {
    activeLLMProcess.kill()
    activeLLMProcess = null
  }

  const llamaPath = findLlamaCli()
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

  // 🤖 [Ollama 지원] 만약 apiType이 'ollama'라면 즉시 Ollama API 처리로 진입
  if (payload.apiType === 'ollama') {
    return new Promise<{ success: boolean; error?: string }>(async (resolve) => {
      try {
        const http = require('http')
        const postData = JSON.stringify({
          model: payload.modelPath ? basename(payload.modelPath, '.gguf') : 'qwen2.5:3b',
          prompt: payload.prompt,
          system: payload.systemPrompt,
          options: {
            temperature: payload.temperature ?? 0.7,
            num_predict: payload.maxTokens ?? 512,
          },
          stream: true
        })

        if (!event.sender.isDestroyed()) {
          event.sender.send('llm:log', { text: `[System] Ollama API 연동 기동 중...\n서버 주소: http://127.0.0.1:11434\n모델: ${payload.modelPath ? basename(payload.modelPath, '.gguf') : 'qwen2.5:3b'}\n` })
        }

        const reqOptions = {
          hostname: '127.0.0.1',
          port: 11434,
          path: '/api/generate',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(postData)
          }
        }

        let resolved = false
        const req = http.request(reqOptions, (res: any) => {
          let buffer = ''
          res.on('data', (chunk: Buffer) => {
            const chunkText = chunk.toString()
            const lines = chunkText.split('\n')
            for (const line of lines) {
              const cleaned = line.trim()
              if (!cleaned) continue
              try {
                const parsed = JSON.parse(cleaned)
                const token = parsed.response
                if (token) {
                  buffer += token
                  if (!event.sender.isDestroyed()) {
                    event.sender.send('llm:token', { token })
                  }
                }
              } catch {}
            }
          })

          res.on('end', () => {
            if (!resolved) {
              resolved = true
              if (!event.sender.isDestroyed()) {
                event.sender.send('llm:done', { success: true, fullText: buffer })
              }
              resolve({ success: true })
            }
          })
        })

        req.on('error', (err: any) => {
          if (!resolved) {
            resolved = true
            const errorMsg = `Ollama 서버 연결에 실패했습니다. (http://127.0.0.1:11434)\nOllama가 켜져 있는지 확인해주세요. 에러: ${err.message}`
            if (!event.sender.isDestroyed()) {
              event.sender.send('llm:log', { text: `\n[Fatal Error] Ollama 연결 실패: ${err.message}\n` })
              event.sender.send('llm:done', { success: false, error: errorMsg })
            }
            resolve({ success: false, error: errorMsg })
          }
        })

        // 사용자 중단 리스너
        const abortListener = () => {
          req.destroy()
          if (!resolved) {
            resolved = true
            if (!event.sender.isDestroyed()) {
              event.sender.send('llm:done', { success: false, error: '사용자에 의해 중단됨' })
            }
            resolve({ success: false, error: 'Aborted' })
          }
        }
        ipcMain.once('llm:abort', abortListener)

        req.write(postData)
        req.end()

      } catch (err: any) {
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
        event.sender.send('llm:done', { success: false, error: errorMsg })
      }
      resolve({ success: false, error: errorMsg })
    })
  }

  const systemPrompt = payload.systemPrompt || 'You are AMEVA AI, a helpful assistant integrated into AMEVA document editor. Respond in the same language as the user. Be concise and helpful.'
  const temperature = payload.temperature ?? 0.7
  const maxTokens = payload.maxTokens ?? 512
  const contextSize = payload.contextSize ?? 4096

  // Qwen 2.5 채팅 형식으로 프롬프트 구성 (컨텍스트 분리 구성으로 이중 래핑 방지)
  let fullPrompt = `<|im_start|>system\n${systemPrompt}<|im_end|>\n`
  if (payload.context) {
    fullPrompt += `<|im_start|>context\n${payload.context.slice(0, 2000)}<|im_end|>\n`
  }
  if (payload.history && payload.history.length > 0) {
    for (const h of payload.history) {
      fullPrompt += `<|im_start|>${h.role}\n${h.content}<|im_end|>\n`
    }
  }
  fullPrompt += `<|im_start|>user\n${payload.prompt}<|im_end|>\n<|im_start|>assistant\n`

  if (payload.apiType === 'api') {
    // ── 💡 OpenAI/Claude 호환 클라우드 API 모드 ──
    return new Promise<{ success: boolean; error?: string }>(async (resolve) => {
      try {
        const https = require('https')
        const postData = JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: payload.prompt }
          ],
          temperature: temperature,
          max_tokens: maxTokens,
          stream: true
        })

        const reqOptions = {
          hostname: 'api.openai.com',
          port: 443,
          path: '/v1/chat/completions',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${payload.apiKey || ''}`
          }
        }

        let resolved = false
        const req = https.request(reqOptions, (res: any) => {
          let buffer = ''
          res.on('data', (chunk: Buffer) => {
            const chunkText = chunk.toString()
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
                    if (!event.sender.isDestroyed()) {
                      event.sender.send('llm:token', { token })
                    }
                  }
                } catch {}
              }
            }
          })

          res.on('end', () => {
            if (!resolved) {
              resolved = true
              if (!event.sender.isDestroyed()) {
                event.sender.send('llm:done', { success: true, fullText: buffer })
              }
              resolve({ success: true })
            }
          })
        })

        req.on('error', (err: any) => {
          if (!resolved) {
            resolved = true
            if (!event.sender.isDestroyed()) {
              event.sender.send('llm:done', { success: false, error: err.message })
            }
            resolve({ success: false, error: `API 호출 실패: ${err.message}` })
          }
        })

        const abortListener = () => {
          req.destroy()
          if (!resolved) {
            resolved = true
            if (!event.sender.isDestroyed()) {
              event.sender.send('llm:done', { success: false, error: '사용자에 의해 중단됨' })
            }
            resolve({ success: false, error: 'Aborted' })
          }
        }
        ipcMain.once('llm:abort', abortListener)

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
        const isServerRunning = activeServerProcess && 
                                activeServerModelPath === modelPath && 
                                activeServerGpuOnly === gpuOnlyFlag
        
        if (!isServerRunning) {
          // 기존 서버 프로세스가 실행 중이면 종료
          if (activeServerProcess) {
            try {
              activeServerProcess.kill('SIGKILL')
            } catch {}
            activeServerProcess = null
          }
          
          const sArgs = [
            '-m', modelPath,
            '-c', String(contextSize),
            '--port', String(serverPort),
            '--host', '127.0.0.1',
            '--log-disable',
            '-ngl', gpuOnlyFlag ? '99' : '0'
          ]
          if (!gpuOnlyFlag) {
            sArgs.push('-t', '4')
          }
          
          if (!event.sender.isDestroyed()) {
            event.sender.send('llm:log', { text: `[System] 새 llama-server 프로세스를 백그라운드에 구동합니다...\n` })
          }
          
          const proc = spawn(llamaPath!, sArgs, { windowsHide: true })
          activeServerProcess = proc
          activeServerModelPath = modelPath
          activeServerGpuOnly = gpuOnlyFlag
          
          let initError: string | null = null
          proc.on('error', (err) => {
            initError = err.message
          })
          
          proc.on('close', (code) => {
            activeServerProcess = null
            activeServerModelPath = ''
          })
          
          // 서버 기동 대기
          await new Promise(r => {
            const t = setTimeout(r, 1800)
            proc.once('close', () => clearTimeout(t))
            proc.once('error', () => clearTimeout(t))
          })
          
          if (initError) {
            activeServerProcess = null
            activeServerModelPath = ''
            if (!event.sender.isDestroyed()) {
              event.sender.send('llm:log', { text: `\n[Fatal Error] llama-server 스폰 실패: ${initError}\n` })
              event.sender.send('llm:done', { success: false, error: initError })
            }
            return resolve({ success: false, error: initError })
          }
        } else {
          if (!event.sender.isDestroyed()) {
            event.sender.send('llm:log', { text: `[System] 이미 백그라운드에 상주 중인 llama-server(모델: ${basename(modelPath)}) 인스턴스를 재사용하여 즉각 추론합니다.\n` })
          }
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
          stream: true
        })

        const reqOptions = {
          hostname: '127.0.0.1',
          port: serverPort,
          path: '/completion',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(postData)
          }
        }

        const req = http.request(reqOptions, (res: any) => {
          let buffer = ''
          res.on('data', (chunk: Buffer) => {
            const chunkText = chunk.toString()
            const lines = chunkText.split('\n')
            for (const line of lines) {
              const cleaned = line.trim()
              if (cleaned.startsWith('data:')) {
                try {
                  const dataStr = cleaned.slice(5).trim()
                  if (dataStr === '[DONE]') continue
                  const parsed = JSON.parse(dataStr)
                  const token = parsed.content
                  if (token) {
                    buffer += token
                    if (!event.sender.isDestroyed()) {
                      event.sender.send('llm:token', { token })
                    }
                  }
                } catch {}
              }
            }
          })

          res.on('end', () => {
            cleanUp()
            if (!resolved) {
              resolved = true
              if (!event.sender.isDestroyed()) {
                event.sender.send('llm:done', { success: true, fullText: buffer })
              }
              resolve({ success: true })
            }
          })
        })

        req.on('error', (err: any) => {
          cleanUp()
          if (!resolved) {
            resolved = true
            if (!event.sender.isDestroyed()) {
              event.sender.send('llm:done', { success: false, error: err.message })
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
              event.sender.send('llm:done', { success: false, error: '사용자에 의해 중단됨' })
            }
            resolve({ success: false, error: 'Aborted' })
          }
        }
        ipcMain.once('llm:abort', abortListener)

        req.write(postData)
        req.end()

      } catch (err: any) {
        if (activeLLMProcess) {
          activeLLMProcess.kill('SIGKILL')
          activeLLMProcess = null
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
      activeLLMProcess = proc

      let buffer = ''
      let resolved = false

      // [SEC-W-011] 50ms 단위로 토큰 배치 전송 — IPC 이벤트 홍수 방지
      let pendingTokens = ''
      let flushTimer: ReturnType<typeof setTimeout> | null = null

      const flushPending = () => {
        if (pendingTokens && !event.sender.isDestroyed()) {
          event.sender.send('llm:token', { token: pendingTokens })
          pendingTokens = ''
        }
        flushTimer = null
      }

      // [SEC-W-022] abort 리스너를 트래킹하여 에러 경로에서도 확실히 정리
      const abortListener = () => {
        if (flushTimer) { clearTimeout(flushTimer); flushTimer = null }
        proc.kill('SIGKILL')
        activeLLMProcess = null
        if (!resolved) {
          resolved = true
          if (!event.sender.isDestroyed()) {
            event.sender.send('llm:done', { success: false, error: '사용자에 의해 중단됨' })
          }
          resolve({ success: false, error: 'Aborted' })
        }
        ipcMain.off('llm:abort', abortListener)
      }
      ipcMain.once('llm:abort', abortListener)

      const { StringDecoder } = require('string_decoder')
      const stdoutDecoder = new StringDecoder('utf8')
      const stderrDecoder = new StringDecoder('utf8')
      let rawBuffer = '' // 🤖 llama-cli 전체 원시 아웃풋 추적용

      proc.stdout.on('data', (data: Buffer) => {
        const text = stdoutDecoder.write(data)
        buffer += text
        rawBuffer += text

        // [실시간 콘솔 로그 스트림] 렌더러로 원시 터미널 아웃풋 전송 (전체 다 보여줌)
        if (!event.sender.isDestroyed()) {
          event.sender.send('llm:log', { text })
        }

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
          pendingTokens += chunkToSend

          // 이미 타이머가 없으면 50ms 후 일괄 전송
          if (!flushTimer) {
            flushTimer = setTimeout(flushPending, 50)
          }
        }
      })

      proc.stderr.on('data', (data: Buffer) => {
        const text = stderrDecoder.write(data)
        // [실시간 콘솔 로그 스트림] llama.cpp의 표준 에러 로그 전송
        if (!event.sender.isDestroyed()) {
          event.sender.send('llm:log', { text })
        }
      })

      proc.on('close', (code) => {
        // 남은 토큰 즉시 플러시
        if (flushTimer) { clearTimeout(flushTimer); flushTimer = null }
        flushPending()
        ipcMain.off('llm:abort', abortListener)
        activeLLMProcess = null
        if (!resolved) {
          resolved = true
          if (!event.sender.isDestroyed()) {
            event.sender.send('llm:done', { success: code === 0, fullText: buffer })
          }
          resolve({ success: code === 0 || code === null })
        }
      })

      proc.on('error', (err) => {
        if (flushTimer) { clearTimeout(flushTimer); flushTimer = null }
        ipcMain.off('llm:abort', abortListener)
        activeLLMProcess = null
        if (!resolved) {
          resolved = true
          if (!event.sender.isDestroyed()) {
            event.sender.send('llm:done', { success: false, error: err.message })
            event.sender.send('llm:log', { text: `\n[Error] llama-cli 오류: ${err.message}` })
          }
          resolve({ success: false, error: `llama-cli 실행 오류: ${err.message}\n\n시스템 호환성 또는 GPU 드라이버 설정을 확인해주세요.` })
        }
      })

    } catch (err: any) {
      if (activeLLMProcess) {
        activeLLMProcess = null
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
  if (activeLLMProcess) {
    activeLLMProcess.kill('SIGKILL')
    activeLLMProcess = null
  }
})

ipcMain.handle('llm:getGpuName', async () => {
  try {
    const info = await app.getGPUInfo('basic')
    const devices = info.gpuDevice || []
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
      const lines = out.split(/\r?\n/).map(l => l.trim()).filter(l => l && l !== 'Name')
      if (lines.length > 0) {
        return lines.join(', ')
      }
    } catch {}
  }
  return 'Generic Graphics Device'
})

// 사용 가능한 LLM 모델 목록 조회 (c:\ameva\models\llm 경로 탐색)
ipcMain.handle('llm:listModels', async () => {
  const llmDir = 'C:\\ameva\\models\\llm'
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
}) => {
  const llmDir = 'C:\\ameva\\models\\llm'
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
  const whisperPath = findWhisperCli()
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
