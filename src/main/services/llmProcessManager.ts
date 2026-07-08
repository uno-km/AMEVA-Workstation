import { app } from 'electron'
import { join, basename } from 'path'
import { existsSync } from 'fs'
import { spawn, exec, type ChildProcess } from 'child_process'

class StreamLineFormatter {
  private buffer = '';
  private prefix: string;

  constructor(prefix: string) {
    this.prefix = prefix;
  }

  feed(chunk: string, onLine: (formattedLine: string) => void) {
    this.buffer += chunk;
    const lines = this.buffer.split('\n');
    this.buffer = lines.pop() || '';
    for (const line of lines) {
      if (!line.trim()) continue; // 빈 줄 무시
      const now = new Date();
      const hh = String(now.getHours()).padStart(2, '0');
      const mm = String(now.getMinutes()).padStart(2, '0');
      const ss = String(now.getSeconds()).padStart(2, '0');
      const ms = String(now.getMilliseconds()).padStart(3, '0');
      const timestamp = `${hh}:${mm}:${ss}.${ms}`;
      onLine(`[${this.prefix}][${timestamp}] ${line}\n`);
    }
  }
}

export class LLMProcessManager {
  static activeLLMProcess: ChildProcess | null = null
  static activeServerProcess: ChildProcess | null = null
  static activeServerModelPath: string | null = null
  static serverStartingPromise: Promise<boolean> | null = null
  // [FIX-FLICKER-001] 서버 기동 중 상태를 추적하여 헬스체크가 false를 반환하지 않도록 함
  static isStarting = false
  static llamaLogBuffer = ''
  static formatters: Record<string, StreamLineFormatter> = {}
  static serverPort = 12345

  static findLlamaCli(): string | null {
    const cliBinaryName = process.platform === 'win32' ? 'llama-server.exe' : 'llama-server'
    const isPackaged = app.isPackaged
    
    // [SEC-W-015] 패키징 경로 및 절대 경로 후보 순회
    const bundledPath = isPackaged
      ? join(process.resourcesPath, 'resources', process.platform === 'win32' ? 'win32' : 'darwin', cliBinaryName)
      : join(app.getAppPath(), 'resources', process.platform === 'win32' ? 'win32' : 'darwin', cliBinaryName)
  
    const candidates = [
      bundledPath,
      'C:\\ameva\\llama\\llama-cli.exe',
      'C:\\ameva\\llama\\llama.exe',
      'C:\\ameva\\llama\\main.exe',
      join(app.getPath('userData'), 'llama', cliBinaryName),
    ]
    for (const c of candidates) {
      if (existsSync(c)) return c
    }
    return null
  }

  static findWhisperCli(): string | null {
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

  static async asyncCleanupOrphanedProcesses(): Promise<void> {
    return new Promise(resolve => {
      if (process.platform === 'win32') {
        exec('taskkill /f /im llama-server.exe', () => {
          exec('taskkill /f /im llama-cli.exe', () => {
            resolve()
          })
        })
      } else {
        exec('killall -9 llama-server llama-cli', () => resolve())
      }
    })
  }

  static async gracefulShutdown(): Promise<void> {
    if (this.activeServerProcess) {
      this.logToRenderer('[System] AI 엔진 정상 종료 대기 중...\n')
      return new Promise(resolve => {
        const timer = setTimeout(() => {
          if (this.activeServerProcess) {
            try { this.activeServerProcess.kill('SIGKILL') } catch {}
          }
          this.activeServerProcess = null
          resolve()
        }, 3000)

        this.activeServerProcess!.on('exit', () => {
          clearTimeout(timer)
          this.activeServerProcess = null
          resolve()
        })

        try {
          this.activeServerProcess!.kill('SIGINT')
        } catch {
          clearTimeout(timer)
          resolve()
        }
      })
    }
  }

  static broadcastLog(prefix: string, text: string) {
    let formatter = this.formatters[prefix];
    if (!formatter) {
      formatter = new StreamLineFormatter(prefix);
      this.formatters[prefix] = formatter;
    }
    formatter.feed(text, (formattedLine) => {
      this.llamaLogBuffer += formattedLine;
      if (this.llamaLogBuffer.length > 200000) {
        this.llamaLogBuffer = this.llamaLogBuffer.slice(-200000);
      }
      
      // [FIX-DUP-001] getAllWebContents()는 DevTools 등 여러 WebContents를 반환하여
      // 로그가 창 수만큼 중복 전송되는 버그 발생. BrowserWindow의 webContents만 필터링.
      const { BrowserWindow } = require('electron');
      BrowserWindow.getAllWindows().forEach((win: any) => {
        if (!win.isDestroyed() && !win.webContents.isDestroyed()) {
          win.webContents.send('llm:log', { text: formattedLine });
        }
      });
      process.stderr.write(formattedLine);
    });
  }

  static logToRenderer(text: string) {
    let prefix = 'SYS';
    if (text.includes('[Fatal Error]') || text.includes('[Error]')) prefix = 'SYS';
    this.broadcastLog(prefix, text);
  }

  static async startLlamaServerWithFallback(
    llamaPath: string,
    modelPath: string,
    contextSize: number,
    gpuFirst: boolean
  ): Promise<boolean> {
    if (
      this.activeServerProcess &&
      this.activeServerModelPath === modelPath &&
      !this.serverStartingPromise
    ) {
      this.logToRenderer(`[System] 기존 llama-server 인스턴스 재사용 (모델: ${basename(modelPath)})\n`)
      return true
    }

    if (this.serverStartingPromise) {
      this.logToRenderer('[System] 다른 요청이 서버 기동 중입니다. 대기...\n')
      return this.serverStartingPromise
    }
    // [FIX-FLICKER-001] 기동 시작 시 isStarting = true 로 설정하여
    // 헬스체크가 offline 을 반환하지 않도록 한다.
    this.isStarting = true

    const doStart = async (ngl: number, threads: number): Promise<boolean> => {
      if (this.activeServerProcess) {
        try { this.activeServerProcess.kill('SIGKILL') } catch {}
        this.activeServerProcess = null
        this.activeServerModelPath = ''
      }
      await this.asyncCleanupOrphanedProcesses()

      const isPackaged = app.isPackaged
      const llamaDir = isPackaged
        ? join(process.resourcesPath, 'resources', process.platform === 'win32' ? 'win32' : 'darwin')
        : join(app.getAppPath(), 'resources', process.platform === 'win32' ? 'win32' : 'darwin')

      const cmdArgs = [
        '-m', modelPath,
        '-c', String(contextSize),
        '--port', String(this.serverPort),
        '-ngl', String(ngl),
        '-t', String(threads),
        '--embedding',
        '-cb'
      ]

      this.logToRenderer(`[System] 로컬 AI 엔진 기동 중 (Port: ${this.serverPort}, GPU 가속 레이어 ngl: ${ngl}, 스레드: ${threads})...\n`)

      return new Promise<boolean>((resolve) => {
        let isResolved = false
        const proc = spawn(llamaPath, cmdArgs, {
          cwd: llamaDir,
          env: {
            ...process.env,
            PATH: `${process.env.PATH};${llamaDir}`
          }
        })

        proc.stdout.on('data', (data) => {
          const text = data.toString()
          this.broadcastLog('OUT', text)
          if (text.includes('HTTP server listening') || text.includes('llama server listening')) {
            if (!isResolved) {
              isResolved = true
              this.activeServerProcess = proc
              this.activeServerModelPath = modelPath
              resolve(true)
            }
          }
        })

        proc.stderr.on('data', (data) => {
          const text = data.toString()
          this.broadcastLog('ERR', text)
          if (text.includes('HTTP server listening') || text.includes('llama server listening')) {
            if (!isResolved) {
              isResolved = true
              this.activeServerProcess = proc
              this.activeServerModelPath = modelPath
              resolve(true)
            }
          }
        })

        proc.on('error', (err) => {
          this.logToRenderer(`[System] 로컬 엔진 실행 실패: ${err.message}\n`)
          if (!isResolved) {
            isResolved = true
            resolve(false)
          }
        })

        proc.on('close', (code) => {
          this.logToRenderer(`[System] 로컬 엔진 종료됨 (Exit Code: ${code})\n`)
          if (this.activeServerProcess === proc) {
            this.activeServerProcess = null
            this.activeServerModelPath = ''
          }
          if (!isResolved) {
            isResolved = true
            resolve(false)
          }
        })

        setTimeout(() => {
          if (!isResolved) {
            isResolved = true
            this.activeServerProcess = proc
            this.activeServerModelPath = modelPath
            resolve(true)
          }
        }, 12000)
      })
    }

    this.serverStartingPromise = (async () => {
      let threads = 4
      try {
        const os = require('os')
        const cpuCount = os.cpus().length
        threads = Math.max(1, Math.min(8, Math.floor(cpuCount * 0.75)))
      } catch {}

      if (gpuFirst) {
        const success = await doStart(99, threads)
        if (success) {
          this.serverStartingPromise = null
          this.isStarting = false
          return true
        }
        this.logToRenderer('[System] GPU 가속 기동 실패. CPU 모드로 자동 폴백(Fallback) 기동합니다...\n')
      }

      const cpuSuccess = await doStart(0, threads)
      this.serverStartingPromise = null
      // [FIX-FLICKER-001] 기동 완료(성공 또는 실패) 후 isStarting 해제
      this.isStarting = false
      return cpuSuccess
    })()

    return this.serverStartingPromise
  }
}
