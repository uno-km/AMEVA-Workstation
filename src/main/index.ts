import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { existsSync } from 'fs'

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
    webPreferences: {
      preload: preloadPath,
      nodeIntegration: false,
      contextIsolation: true,
      webviewTag: true,
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
    // 개발자 도구 자동 열림 비활성화 (필요 시 Ctrl+Shift+I로 수동으로 열 수 있습니다.)
    // mainWindow.webContents.openDevTools()
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
  const printWindow = new BrowserWindow({
    show: false,
    webPreferences: { nodeIntegration: false },
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

// 로컬 IP 주소 추출 헬퍼 함수
function getLocalIPAddress() {
  const nets = networkInterfaces()
  for (const name of Object.keys(nets)) {
    const interfaces = nets[name]
    if (interfaces) {
      for (const net of interfaces) {
        // Skip over non-IPv4 and internal (i.e. 127.0.0.1) addresses
        if (net.family === 'IPv4' && !net.internal) {
          return net.address
        }
      }
    }
  }
  return 'localhost'
}

// IPC 핸들러 - 로컬 협업 웹소켓 서버 관리
ipcMain.handle('server:start', async (event, port: number) => {
  const localIp = getLocalIPAddress()
  // 이미 실행 중이면 현재 상태를 다시 전송하여 UI 동기화
  if (collabilationServer) {
    event.sender.send('server:status', { running: true, port, ip: localIp })
    return { running: true, port, ip: localIp }
  }
  try {
    collabilationServer = new WebSocketServer({
      port,
      perMessageDeflate: {
        zlibDeflateOptions: { chunkSize: 1024, memLevel: 7, level: 4 },
        zlibInflateOptions: { chunkSize: 10 * 1024 },
        threshold: 1024,
      },
    })
    activeConnections = new Set()
    collabilationServer.on('connection', (ws) => {
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
    })
    event.sender.send('server:status', { running: true, port, ip: localIp })
    return { running: true, port, ip: localIp }
  } catch (err: any) {
    console.error('[collabServer] 서버 시작 실패:', err)
    collabilationServer = null
    // 실패 시에도 status 이벤트 전송
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
  }
  event.sender.send('server:status', { running: false })
  return { running: false }
})


// IPC 핸들러 - 로컬 파이썬 실행
ipcMain.handle('runtime:runPython', async (_event, code: string) => {
  return new Promise((resolve) => {
    const tempFile = join(app.getPath('temp'), `ameva_code_${Date.now()}.py`)
    writeFile(tempFile, code, 'utf-8').then(() => {
      const pyProcess = spawn('python', [tempFile])
      let stdout = ''
      let stderr = ''
      const timeout = setTimeout(() => {
        pyProcess.kill('SIGKILL')
        resolve({ success: false, error: 'Execution Timeout: 코드가 5초 제한 시간을 초과하여 강제 종료되었습니다.' })
      }, 5000)
      pyProcess.stdout.on('data', (data) => { stdout += data.toString() })
      pyProcess.stderr.on('data', (data) => { stderr += data.toString() })
      pyProcess.on('close', (code) => {
        clearTimeout(timeout)
        unlink(tempFile).catch(() => {})
        if (code === 0) {
          resolve({ success: true, output: stdout })
        } else {
          resolve({ success: false, error: stderr || `Process exited with code ${code}` })
        }
      })
      pyProcess.on('error', (err) => {
        clearTimeout(timeout)
        resolve({ success: false, error: `Python 실행 오류: ${err.message}. Python이 설치되어 있고 PATH에 등록되어 있는지 확인하십시오.` })
      })
    }).catch(err => {
      resolve({ success: false, error: `임시 스크립트 작성 실패: ${err.message}` })
    })
  })
})

// ─────────────────────────────────────────────────────────────────
// 🤖 로컬 LLM IPC 핸들러 (llama-cli / llama.cpp 래퍼)
// ─────────────────────────────────────────────────────────────────

// llama-cli 실행 파일 경로 탐색 헬퍼
function findLlamaCli(): string | null {
  const candidates = [
    'C:\\Users\\ATSAdmin\\.docker\\bin\\inference\\llama-server.exe',
    'C:\\ameva\\llama\\llama-cli.exe',
    'C:\\ameva\\llama\\llama.exe',
    'C:\\ameva\\llama\\main.exe',
    join(app.getPath('userData'), 'llama', 'llama-cli.exe'),
  ]
  for (const c of candidates) {
    if (existsSync(c)) return c
  }
  // PATH에서 탐색
  return 'llama-cli'
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

// 스트리밍 LLM 추론 (토큰 단위 IPC 이벤트 방출)
ipcMain.handle('llm:generate', async (event, payload: {
  modelPath: string
  prompt: string
  systemPrompt?: string
  maxTokens?: number
  temperature?: number
  contextSize?: number
  apiType?: 'local' | 'api'
  apiKey?: string
  gpuOnly?: boolean
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

  // 모델 파일 또는 실행 바이너리 존재 확인 (절대경로와 PATH 등록 명령어 동시 지원)
  let isRealExecutionAvailable = existsSync(modelPath)
  if (isRealExecutionAvailable) {
    if (llamaPath && (llamaPath.includes('\\') || llamaPath.includes('/'))) {
      isRealExecutionAvailable = existsSync(llamaPath)
    } else if (llamaPath) {
      try {
        const { execSync } = require('child_process')
        execSync(process.platform === 'win32' ? `where ${llamaPath}` : `which ${llamaPath}`, { stdio: 'ignore' })
        isRealExecutionAvailable = true
      } catch {
        isRealExecutionAvailable = false
      }
    } else {
      isRealExecutionAvailable = false
    }
  }

  if (!isRealExecutionAvailable) {
    // ── 💡 모델/실행 파일 없을 때: 시뮬레이션 스트리밍 모드 작동 ──
    return new Promise<{ success: boolean; error?: string }>((resolve) => {
      let isAborted = false
      const abortListener = () => { isAborted = true }
      ipcMain.once('llm:abort', abortListener)

      const simulatorResponse = `[시뮬레이션 모드] ${payload.prompt}에 대한 AMEVA AI 응답입니다.
실제 AI 응답을 보려면 C:\\ameva\\models\\llm\\ 에 Qwen 모델 (.gguf)을 넣고 C:\\ameva\\llama\\ 에 llama-cli.exe를 설치해주세요.

이 문서는 AI 협업 어시스턴트에 의해 분석되었습니다. 마크다운 에디터와 코드 실행 기능, Y.js 실시간 협업은 현재 로컬에서 완전히 활성화되어 작동 중입니다.`

      const tokens = simulatorResponse.split(/(\s+)/)
      let idx = 0

      const sendNextToken = () => {
        if (isAborted) {
          ipcMain.off('llm:abort', abortListener)
          if (!event.sender.isDestroyed()) {
            event.sender.send('llm:done', { success: false, error: '사용자에 의해 중단됨' })
          }
          resolve({ success: false, error: 'Aborted' })
          return
        }

        if (idx < tokens.length) {
          const token = tokens[idx]
          if (!event.sender.isDestroyed()) {
            event.sender.send('llm:token', { token })
          }
          idx++
          // 40ms~100ms 랜덤 딜레이로 실제 타이핑 스트리밍 구현
          setTimeout(sendNextToken, 40 + Math.random() * 60)
        } else {
          ipcMain.off('llm:abort', abortListener)
          if (!event.sender.isDestroyed()) {
            event.sender.send('llm:done', { success: true, fullText: simulatorResponse })
          }
          resolve({ success: true })
        }
      }

      // 시뮬레이터 시작
      setTimeout(sendNextToken, 200)
    })
  }

  const systemPrompt = payload.systemPrompt || 'You are AMEVA AI, a helpful assistant integrated into AMEVA document editor. Respond in the same language as the user. Be concise and helpful.'
  const temperature = payload.temperature ?? 0.7
  const maxTokens = payload.maxTokens ?? 512
  const contextSize = payload.contextSize ?? 4096

  // Qwen 2.5 채팅 형식으로 프롬프트 구성
  const fullPrompt = `<|im_start|>system\n${systemPrompt}<|im_end|>\n<|im_start|>user\n${payload.prompt}<|im_end|>\n<|im_start|>assistant\n`

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
    const serverPort = 12345
    return new Promise<{ success: boolean; error?: string }>(async (resolve) => {
      try {
        const sArgs = [
          '-m', modelPath,
          '-c', String(contextSize),
          '--port', String(serverPort),
          '--host', '127.0.0.1',
          '--log-disable',
          '-ngl', payload.gpuOnly !== false ? '99' : '0' // GPU Only 분기 처리
        ]

        if (payload.gpuOnly === false) {
          sArgs.push('-t', '4') // CPU 모드 시 스레드 분산 지정
        }
        
        const proc = spawn(llamaPath!, sArgs, { windowsHide: true })
        activeLLMProcess = proc

        let resolved = false
        const cleanUp = () => {
          if (activeLLMProcess) {
            activeLLMProcess.kill('SIGKILL')
            activeLLMProcess = null
          }
        }

        // 서버 기동에 필요한 대기
        await new Promise(r => setTimeout(r, 1800))

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
    '-e',
    '--log-disable',
  ]

  return new Promise<{ success: boolean; error?: string }>((resolve) => {
    try {
      const proc = spawn(llamaPath!, args, { windowsHide: true })
      activeLLMProcess = proc

      let buffer = ''
      let resolved = false

      proc.stdout.on('data', (data: Buffer) => {
        const text = data.toString()
        buffer += text

        // 스트리밍 토큰 전송 (렌더러로)
        if (!event.sender.isDestroyed()) {
          event.sender.send('llm:token', { token: text })
        }
      })

      proc.stderr.on('data', (_data: Buffer) => {
        // llama.cpp 는 stderr에 진행 로그를 출력하므로 무시
      })

      proc.on('close', (code) => {
        activeLLMProcess = null
        if (!resolved) {
          resolved = true
          // 종료 신호 전송
          if (!event.sender.isDestroyed()) {
            event.sender.send('llm:done', { success: code === 0, fullText: buffer })
          }
          resolve({ success: code === 0 || code === null })
        }
      })

      proc.on('error', (err) => {
        activeLLMProcess = null
        if (!resolved) {
          resolved = true
          if (!event.sender.isDestroyed()) {
            event.sender.send('llm:done', { success: false, error: err.message })
          }
          resolve({ success: false, error: `llama-cli 실행 오류: ${err.message}\n\nllama.cpp를 C:\\ameva\\llama\\ 에 설치하거나 PATH에 llama-cli를 등록해주세요.` })
        }
      })

    } catch (err: any) {
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

// 사용 가능한 LLM 모델 목록 조회
ipcMain.handle('llm:listModels', async () => {
  const llmDir = 'C:\\ameva\\models\\llm'
  const defaultList = [
    {
      name: 'Qwen 2.5 3B (Simulator)',
      filename: 'qwen2.5-3b-instruct-q4_k_m.gguf',
      path: join(llmDir, 'qwen2.5-3b-instruct-q4_k_m.gguf'),
      size: 2100000000
    }
  ]

  try {
    const { readdir } = await import('fs/promises')
    if (!existsSync(llmDir)) return defaultList
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
    return filtered.length > 0 ? filtered : defaultList
  } catch {
    return defaultList
  }
})

let activeDownloadRequest: any = null

ipcMain.handle('llm:downloadModel', async (event, payload: {
  url: string
  filename: string
}) => {
  const llmDir = 'C:\\ameva\\models\\llm'
  const { mkdir } = await import('fs/promises')
  const { createWriteStream } = require('fs')
  const https = require('https')
  const http = require('http')

  try {
    if (!existsSync(llmDir)) {
      await mkdir(llmDir, { recursive: true })
    }

    const targetPath = join(llmDir, payload.filename)
    const fileStream = createWriteStream(targetPath)

    return new Promise<{ success: boolean; error?: string }>((resolve) => {
      const client = payload.url.startsWith('https') ? https : http

      let downloadedBytes = 0
      let totalBytes = 0
      let startTime = Date.now()
      let lastTime = Date.now()
      let lastBytes = 0

      const requestUrl = (targetUrl: string) => {
        const req = client.get(targetUrl, (res: any) => {
          // 리다이렉트 (301, 302, 307 등) 핸들링
          if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
            requestUrl(res.headers.location)
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
              const speed = chunkBytes / chunkTime / (1024 * 1024) // MB/s

              const progress = totalBytes > 0 ? (downloadedBytes / totalBytes) * 100 : 0
              const bytesRemaining = totalBytes - downloadedBytes
              const speedBytesPerSec = chunkBytes / chunkTime
              const timeRemaining = speedBytesPerSec > 0 ? bytesRemaining / speedBytesPerSec : 9999

              if (!event.sender.isDestroyed()) {
                event.sender.send('llm:download-progress', {
                  filename: payload.filename,
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
                filename: payload.filename,
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

      requestUrl(payload.url)
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

ipcMain.on('action:openExternal', (_event, url: string) => {
  // file:// URL이면 showItemInFolder로 파일 탐색기에서 열기
  if (url.startsWith('file:///')) {
    const filePath = decodeURIComponent(url.replace('file:///', '').replace(/\//g, '\\'))
    shell.showItemInFolder(filePath)
  } else {
    shell.openExternal(url)
  }
})

// 내보낸 파일을 파일 탐색기에서 선택/표시
ipcMain.on('export:showInFolder', (_event, filePath: string) => {
  shell.showItemInFolder(filePath)
})

ipcMain.on('window:close', (event) => {
  const win = getActiveWindow(event)
  if (win) win.close()
})
