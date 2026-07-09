/**
 * @file llmProcessManager.ts
 * @system AMEVA OS Desktop Workstation - LLM Integration Layer
 * @location src/main/services/llmProcessManager.ts
 * @role Llama.cpp Local Inference Server Child Process Lifecycle Manager
 * 
 * [설계 의도 - DESIGN INTENT / ADR / PERFORMANCE CRITICAL]
 * - 로컬 추론 서버(`llama-server`) 실행 시 OS 콘솔 로그 스트림을 실시간 수집하되,
 *   유입 로그량이 폭발 시 렌더러 IPC 전송 과부하로 앱이 굳어지는 현상이 발생한다.
 * - 이를 가드하기 위해 **StreamLineFormatter(개행 문자 \n 기반 링버퍼 슬라이싱)**를 구축하여,
 *   로깅 텍스트 최대 누적 한계를 20만 자(`200,000`)로 설정하여 초과 유입 시 과거 로그를 강제 휘발 소거한다.
 * - [보안 - 패키징 리소스 경로 가드 / SEC-W-015]: Electron의 개발/배포 패키징 상태(`app.isPackaged`)에 맞춰 
 *   동작 운영체제별(Win32/Darwin) 내장 llama-server 바이너리 경로 및 C드라이브 후보 경로들을 안전하게 탐색(`findLlamaCli`)한다.
 * - [중복 전송 버그 가드 / FIX-DUP-001]: Electron의 `getAllWebContents()` 호출 시 개발자 도구(DevTools) 창 등
 *   실제 메인 뷰포트 외의 웹 콘텐트들에도 로그를 중복 브로드캐스트 전송하는 버그가 있었음.
 *   BrowserWindow의 유효 창들만 추려서 메인 프레임 webContents 채널에만 단일 타겟 발송하는 가드로 해결함.
 * - [헬스체크 깜빡임 방지 / FIX-FLICKER-001]: llama-server가 백그라운드 웜업 중일 때 헬스체크 핑이 offline으로 오판단되어
 *   UI 상단/하단 표시등이 꺼지는 플리커 현상을 제어하기 위해 서버 기동 플래그(`isStarting`)를 도입함.
 * 
 * [책임 범위 - RESPONSIBILITY]
 * - Llama CLI/Server 및 Whisper STT CLI 경로를 검지한다.
 * - GPU 레이어 오프로드 가속(`-ngl 99`) 기동을 시도하고, 드라이버 불일치로 실패 시 CPU 스레드 모드(`-ngl 0`)로 자동 폴백 웜업시킨다.
 * - 윈도우 F5/Ctrl+C/will-quit 발생 시 기존 유령 백그라운드 Llama 프로세스를 OS 프로세스 테이블에서 안전하게 청소(`asyncCleanupOrphanedProcesses`)한다.
 
 * [소비처 - CONSUMERS / USAGE CONTEXT]
 * - 소비처 A (src/main/index.ts): 일렉트론 메인 라이프사이클(ready/will-quit) 및 윈도우 생성 시점에 결합 구동.
 * - 소비처 B (src/main/preload.ts): contextBridge 안전 통로 노출을 위한 핵심 백엔드 기능 공급자로 소비.
 */

/* 
 * [IMPORT SEGMENTATION & CONTRACTS]
 * - app: 패키징 여부 및 데이터 폴더 위치 파악용 Electron 코어 모듈.
 * - join, basename: 파일 절대 경로 조작용 path 라이브러리.
 * - existsSync: 바이너리 유무 동기 검사용 fs 라이브러리.
 * - spawn, exec, ChildProcess: llama 백그라운드 서버 기동 및 taskkill용 child_process API.
 */
import { app } from 'electron'
import { join, basename } from 'path'
import { existsSync } from 'fs'
import { spawn, exec, type ChildProcess } from 'child_process'

/**
 * @class StreamLineFormatter
 * @description 청크 스트림을 라인 단위로 조립하고 HH:MM:SS.ms의 정제된 타임스탬프를 덧붙여 기록하는 문자열 링 포맷터.
 */
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
      if (!line.trim()) continue; // 빈 개행 줄 무시
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

/**
 * @class LLMProcessManager
 * @description Llama 추론 프로세스 및 Whisper 음성 인식 엔진을 OS 차원에서 관리하는 매니저 클래스.
 */
export class LLMProcessManager {
  // activeLLMProcess: 일회성 CLI 실행 시 프로세스 인스턴스.
  static activeLLMProcess: ChildProcess | null = null
  // activeServerProcess: 백그라운드 8080/12345 상주 추론 서버 프로세스 본체.
  static activeServerProcess: ChildProcess | null = null
  // activeServerModelPath: 현재 기동 적재 중인 GGUF 파일 절대 경로.
  static activeServerModelPath: string | null = null
  // serverStartingPromise: 중복 서버 시작 요청을 방지하기 위한 공유 프라미스 락.
  static serverStartingPromise: Promise<boolean> | null = null
  // [FIX-FLICKER-001] 기동 중 표시 가드 락.
  static isStarting = false
  // llamaLogBuffer: 렌더러에 전달 및 출력될 누적 텍스트 링 버퍼.
  static llamaLogBuffer = ''
  // formatters: 출력 타입(OUT, ERR, SYS)별 라인 포맷터 맵.
  static formatters: Record<string, StreamLineFormatter> = {}
  // serverPort: 기본 바인딩 포트.
  static serverPort = 12345

  /**
   * [CONTRACT - Find Llama CLI Binary Path / SEC-W-015]
   * - Rationale: 패키징 번들 경로, 사용자 임시 경로, C드라이브 고정 후보 디렉터리 순으로 순회하여 
   *   실행 가능한 llama-server 물리 파일 위치를 탐색 반환한다.
   */
  static findLlamaCli(): string | null {
    const cliBinaryName = process.platform === 'win32' ? 'llama-server.exe' : 'llama-server'
    const isPackaged = app.isPackaged
    
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

  /**
   * [CONTRACT - Find Whisper CLI Binary Path]
   * - Rationale: Whisper C++ 한국어 음성 인식을 지원하는 cli 바이너리 경로를 탐색해 반환한다.
   */
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

  /**
   * [CONTRACT - Async Cleanup Orphaned Processes]
   * - Rationale: OS 백그라운드에 가동 중이던 F5 리로드 잔여 llama 좀비 데몬들을 taskkill로 청소한다.
   */
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

  /**
   * [CONTRACT - Graceful Shutdown Inference Server]
   * - Rationale: 3초 타임아웃 락을 주어 SIGINT 인터럽트 시그널로 llama-server가 안전하게 디바이스를 닫고 소멸하도록 대기한다.
   */
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

  /**
   * [CONTRACT - Broadcast Log to WebContents / FIX-DUP-001]
   * - Rationale: log 수신 시, DevTools 창 중복 전송 버그를 차단하기 위해 BrowserWindow webContents만 순회 추출하여 라우팅한다.
   */
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
      
      const { BrowserWindow } = require('electron');
      BrowserWindow.getAllWindows().forEach((win: any) => {
        if (!win.isDestroyed() && !win.webContents.isDestroyed()) {
          win.webContents.send('llm:log', { text: formattedLine });
        }
      });
      process.stderr.write(formattedLine);
    });
  }

  // 시스템 에러 문구 발생 시 SYS 프리픽스 로깅
  static logToRenderer(text: string) {
    let prefix = 'SYS';
    if (text.includes('[Fatal Error]') || text.includes('[Error]')) prefix = 'SYS';
    this.broadcastLog(prefix, text);
  }

  /**
   * [CONTRACT - Start Llama Server with GPU Fallback / Rationale]
   * - Rationale: GPU 가속 모드(ngl 99)로 자식 프로세스를 띄워 stdout 리스너가 "listening" 시그널을 검지할 때까지 대기(최대 12초)한다.
   *   만약 GPU 기동 실패 시 CPU 전용 스레드 모드(ngl 0)로 자동 낙(Fallback) 구성 기동을 시작한다.
   */
  static async startLlamaServerWithFallback(
    llamaPath: string,
    modelPath: string,
    contextSize: number,
    gpuFirst: boolean
  ): Promise<boolean> {
    // 이미 같은 모델 파일로 실행 중이라면 바이패스
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
    // [FIX-FLICKER-001] 웜업 개시 플래그 세팅
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

        // stdout 리스너 감청
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

        // stderr 리스너 감청
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

        // listening 문자열 매칭에 실패하더라도 12초 이상 대기 시 강제 정상 판정 완료
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

    // 웜업 구동 프로프레시브
    this.serverStartingPromise = (async () => {
      let threads = 4
      try {
        const os = require('os')
        const cpuCount = os.cpus().length
        // 코어 수의 75% 수준 스레드 최적 할당
        threads = Math.max(1, Math.min(8, Math.floor(cpuCount * 0.75)))
      } catch {}

      // GPU 우선 시작 시도
      if (gpuFirst) {
        const success = await doStart(99, threads)
        if (success) {
          this.serverStartingPromise = null
          this.isStarting = false
          return true
        }
        this.logToRenderer('[System] GPU 가속 기동 실패. CPU 모드로 자동 폴백(Fallback) 기동합니다...\n')
      }

      // CPU 모드 Fallback
      const cpuSuccess = await doStart(0, threads)
      this.serverStartingPromise = null
      
      // [FIX-FLICKER-001] 기동 완료 처리 해제
      this.isStarting = false
      return cpuSuccess
    })()

    return this.serverStartingPromise
  }
}
