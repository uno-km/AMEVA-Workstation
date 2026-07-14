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
 
 * [소비처 - CONSUMERS / USAGE CONTEXT]
 * - 소비처 A (src/main/index.ts): 일렉트론 메인 라이프사이클(ready/will-quit) 및 윈도우 생성 시점에 결합 구동.
 * - 소비처 B (src/main/preload.ts): contextBridge 안전 통로 노출을 위한 핵심 백엔드 기능 공급자로 소비.
 */

/* 
 * [IMPORT SEGMENTATION & CONTRACTS]
 * - app, BrowserWindow, dialog, session, ipcMain: Electron GUI 및 세션, 대화상자 통제용 OS 네이티브 코어 객체.
 * - join, dirname: 크로스 플랫폼 파일 절대 경로 매핑을 위한 Node.js path 모듈.
 * - fileURLToPath: ESM 모듈 내 절대 파일 URI 파싱용 URL 모듈.
 * - existsSync: 파일 유무 동기 검사용 fs 모듈.
 * - readFile: 파일 텍스트 비동기 독출용 fs/promises 모듈.
 */
import { app, BrowserWindow, dialog, session, ipcMain, Menu, MenuItem, protocol, net } from 'electron'
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
import { registerGoogleAuthIpc } from './ipc/googleAuthIpc.js'
import { registerLlmIpc } from './ipc/llmIpc.js'
import { registerTerminalIpc } from './ipc/terminalIpc.js'

// [FEAT-MEDIA-PROTOCOL-PRIVILEGES] media 커스텀 프로토콜에 로컬 자원 접근 및 스트리밍 특권 부여
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'media',
    privileges: {
      standard: true,
      secure: true,
      bypassCSP: true,
      allowServiceWorkers: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true
    }
  }
])

// 개발용 일렉트론 보안 경고 비활성화
process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = 'true'

// WebGPU shader-f16 및 Dawn 불안정 API 기능 활성화 크롬 플래그 주입
app.commandLine.appendSwitch('enable-dawn-features', 'allow_unsafe_apis')
// WebGPU 가속과 WebAssembly SIMD 가속 및 공유 메모리 버퍼 활성화
app.commandLine.appendSwitch('enable-features', 'SharedArrayBuffer,WebAssemblySimd,WebGPU')
// GPU 샌드박스를 해제하여 Dawn API와 shader-f16의 하드웨어 수준 직접 연산 호환성 확보
app.commandLine.appendSwitch('disable-gpu-sandbox')

/*
 * [ESM / CJS COMPATIBILITY CONSTANTS]
 * - localFilename: 현재 ESM 파일 절대 경로.
 * - localDirname: 디렉터리 경로.
 * - __dirname: CommonJS 호환용 전역 상수로 바인딩.
 */
const localFilename = (typeof import.meta !== 'undefined' && import.meta.url) 
  ? fileURLToPath(import.meta.url) 
  : ''
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `localDirname`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const localDirname = ...` 형태로 안전 캐싱 후 가공 기동.
       */
const localDirname = localFilename ? dirname(localFilename) : ''
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `__dirname`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const __dirname = ...` 형태로 안전 캐싱 후 가공 기동.
       */
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

      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `!gotTheLock`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (!gotTheLock)` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
if (!gotTheLock) {
  // 이미 가동 중인 인스턴스가 존재하면 즉시 본 세션을 소멸 종료
  app.quit()
} else {
  // 두 번째 인스턴스가 켜지려 할 때 기존 열린 창을 포커싱하고 더블클릭해 가져온 파일 내용물을 렌더러로 리다이렉트
  app.on('second-instance', async (_event, commandLine) => {
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `filePath`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const filePath = ...` 형태로 안전 캐싱 후 가공 기동.
       */
    const filePath = parseArgvForFile(commandLine)
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `filePath && mainWindow`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (filePath && mainWindow)` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
    if (filePath && mainWindow) {
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `mainWindow.isMinimized()) mainWindow.restore(`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (mainWindow.isMinimized()) mainWindow.restore()` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
      try {
        const ext = filePath.split('.').pop()?.toLowerCase() || ''
        const isBinary = ['docx', 'pdf', 'hwpx', 'xlsx', 'xls', 'adc'].includes(ext)
        const content = await readFile(filePath, isBinary ? 'base64' : 'utf-8')
        mainWindow.webContents.send('file:open-argv', { content, filePath, isBinary })
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
      /*
       * [LOOP CONTROL ITERATION]
       * - 루프 조건: `for (const arg of argv.slice(1)) {`
       * - 예상 시나리오: 지정된 조건 한계 도달 시점까지 콜렉션 항목의 순차 매핑, 변환 및 동기 적재 처리를 수행함.
       * - 예시: `for (const item of list)` 루프 실행 시 모든 개별 블록의 html 포맷 정제 완료 후 스택 종결.
       */
  for (const arg of argv.slice(1)) {
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `조건 식`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (조건 식)` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
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
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `preloadPath`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const preloadPath = ...` 형태로 안전 캐싱 후 가공 기동.
       */
  const preloadPath = join(__dirname, 'preload.js')
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `!existsSync(preloadPath)`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (!existsSync(preloadPath))` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
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

  let bypassNativeContextMenu = false;

  ipcMain.on('set-bypass-native-context-menu', (_e, value) => {
    bypassNativeContextMenu = !!value;
  });

  /*
   * [SIDE EFFECT - Global Context Menu Binding]
   * - Rationale: 일렉트론 샌드박스에서 기본 마우스 우클릭 메뉴가 원천 차단되는 사용성 오류를 극복하기 위해,
   *   마우스 우클릭 시 드래그 텍스트 유무에 따라 Copy/Cut/Paste/Select All 등의 OS 기본 편집 행동 메뉴를 동적으로 표출한다.
   *   단, React 단에서 커스텀 메뉴 영역(터미널 등)을 다룰 때 겹침 오류를 피하고자 bypassNativeContextMenu 플래그가 켜진 경우 무시한다.
   */
  mainWindow.webContents.on('context-menu', (_e, params) => {
    if (bypassNativeContextMenu) {
      return;
    }
    const menu = new Menu();

    if (params.selectionText && params.selectionText.trim() !== '') {
      menu.append(new MenuItem({ label: '복사 (Copy)', role: 'copy' }));
    }

    if (params.isEditable) {
      menu.append(new MenuItem({ label: '잘라내기 (Cut)', role: 'cut' }));
      menu.append(new MenuItem({ label: '붙여넣기 (Paste)', role: 'paste' }));
      menu.append(new MenuItem({ label: '모두 선택 (Select All)', role: 'selectAll' }));
    }

    if (menu.items.length > 0) {
      menu.popup({ window: mainWindow! });
    }
  });

  // 디버깅을 위한 개발자 도구 강제 활성화
  // mainWindow.webContents.openDevTools()

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
registerGoogleAuthIpc()

/*
 * [FIX-FINANCE-001] Finance IPC 채널: CORS 우회 Yahoo Finance 주식/지수 조회
 * - 렌더러(브라우저 샌드박스)에서 직접 Yahoo Finance API를 fetch하면
 *   CORS 정책 및 Cookie 차단으로 403/CORS 에러가 발생한다.
 * - 메인 프로세스에서 Node.js의 fetch를 이용하면 CORS 제약이 없으므로 안전하게 호출 가능하다.
 * - [소비처] preload.ts → getFinanceQuotes → FinanceDashboardView.tsx
 */
ipcMain.handle('finance:get-quotes', async (_event, symbols: string[]) => {
  /*
   * [FIX-FINANCE-001] Finance IPC 채널: CORS 우회 Yahoo Finance 주식/지수 조회
   * - 기존 Yahoo Finance v7 API (query2.finance.yahoo.com/v7/finance/quote)는
   *   인증 토큰(Crumb)이 누락될 경우 HTTP 401 Unauthorized 에러를 유발하여 주식 정보 조회에 실패한다.
   * - 해결: 401 오류를 방지하고 안정적인 데이터 공급을 보장하기 위해 토큰 요구가 없는
   *   v8 chart API (query1.finance.yahoo.com/v8/finance/chart/<symbol>)를 병렬로 조회하도록 전환한다.
   * - 각 조회 결과를 StockQuote 규격에 맞춰 어댑터 변환하여 렌더러에 공급한다.
   * - [소비처] preload.ts → getFinanceQuotes → FinanceDashboardView.tsx
   */
  try {
    const results = await Promise.allSettled(
      symbols.map(async (symbol) => {
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d`
        const res = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'application/json',
            'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8',
          },
          signal: AbortSignal.timeout(8000)
        })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = await res.json() as any
        const result = data?.chart?.result?.[0]
        if (!result) throw new Error('No chart data found for ' + symbol)
        
        const meta = result.meta
        const price = meta.regularMarketPrice
        const prevClose = meta.chartPreviousClose
        const changePercent = prevClose ? ((price - prevClose) / prevClose) * 100 : 0
        const change = price - prevClose

        return {
          symbol: symbol,
          shortName: meta.symbol || symbol,
          regularMarketPrice: price || 0,
          regularMarketChangePercent: changePercent || 0,
          regularMarketChange: change || 0,
          currency: meta.currency || 'USD'
        }
      })
    )

    const settled = results
      .filter((r): r is PromiseFulfilledResult<any> => r.status === 'fulfilled')
      .map(r => r.value)

    return { success: true, result: settled }
  } catch (err: unknown) {
    console.error('[finance:get-quotes] 조회 실패:', err)
    return { success: false, result: [], error: String(err) }
  }
})

// 클립보드에 이미지 쓰기 IPC 핸들러
ipcMain.handle('clipboard:write-image', async (_event, dataUrl: string) => {
  try {
    const { clipboard, nativeImage } = require('electron')
    const img = nativeImage.createFromDataURL(dataUrl)
    clipboard.writeImage(img)
    return true
  } catch (err) {
    console.error('Failed to write image to clipboard:', err)
    return false
  }
})

/*
 * [FEAT-OLLAMA-001] Ollama 라이프사이클 IPC 채널 그룹
 * - ollama:check-installed: Ollama CLI 바이너리 설치 여부를 검사한다.
 * - ollama:start-server: ollama serve를 백그라운드 detached 프로세스로 기동한다.
 * - ollama:pull-model: ollama pull <model>을 실행하며 stdout 진행률을 스트리밍으로 브로드캐스팅한다.
 * - [소비처] preload.ts → SettingsTabAIEngine.tsx
 */

// (1) Ollama 설치 여부 진단 채널
ipcMain.handle('ollama:check-installed', async () => {
  try {
    const { exec } = require('child_process') as typeof import('child_process')
    // Windows: where ollama / Linux·macOS: which ollama
    const cmd = process.platform === 'win32' ? 'where ollama' : 'which ollama'
    
    /*
     * [RUN-TIME STATE / INVARIANT]
     * - 변수 명: `result`
     * - 자료형 / 예상 값: string
     * - 시나리오: 비동기 exec를 이용하여 where/which 명령어를 실행해 백그라운드 콘솔 창의 깜빡임을 방지하고 설치 경로를 확보한다.
     */
    const result = await new Promise<string>((resolve) => {
      exec(cmd, { windowsHide: true, timeout: 3000 }, (error, stdout) => {
        if (error) {
          resolve('')
        } else {
          resolve(stdout.trim())
        }
      })
    })
    
    return { installed: !!result, path: result }
  } catch {
    return { installed: false, path: '' }
  }
})

// (2) Ollama 서버 백그라운드 기동 채널 (detached spawn — 완료를 기다리지 않음)
ipcMain.handle('ollama:start-server', async () => {
  try {
    const { spawn } = require('child_process') as typeof import('child_process')
    // [BUG-FIX] Windows에서 CMD 검은 창이 직접 팝업되는 현상을 방지하기 위해 shell: false 및 windowsHide: true 지정
    // stdio를 ignore하지 않고 pipe로 가두어, 실시간 출력 로그를 AMEVA 웹 CLI/콘솔 화면(OLM 프리픽스)에 전달
    const child = spawn('ollama', ['serve'], {
      detached: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: false,
      windowsHide: true,
    })

    child.stdout?.on('data', (chunk: Buffer) => {
      const text = chunk.toString('utf-8')
      LLMProcessManager.broadcastLog('OLM', text)
    })

    child.stderr?.on('data', (chunk: Buffer) => {
      const text = chunk.toString('utf-8')
      LLMProcessManager.broadcastLog('OLM', text)
    })

    child.unref()
    // 2초 대기 후 헬스체크를 수행하여 실제 기동 성공 여부를 확인한다.
    await new Promise<void>(resolve => setTimeout(resolve, 2000))
    try {
      const res = await fetch('http://localhost:11434/api/tags', { signal: AbortSignal.timeout(3000) })
      return { success: res.ok }
    } catch {
      // 아직 준비 중일 수 있으므로 에러가 아닌 진행 중 상태로 반환한다.
      return { success: true, pending: true }
    }
  } catch (err: unknown) {
    console.error('[ollama:start-server] 기동 실패:', err)
    return { success: false, error: String(err) }
  }
})

// (3) Ollama 모델 다운로드(pull) 채널 — stdout 진행률 파싱 후 IPC 스트리밍
ipcMain.handle('ollama:pull-model', async (event, modelName: string) => {
  try {
    const { spawn } = require('child_process') as typeof import('child_process')
    return await new Promise<{ success: boolean; error?: string }>((resolve) => {
      const child = spawn('ollama', ['pull', modelName], {
        shell: process.platform === 'win32',
        stdio: ['ignore', 'pipe', 'pipe'],
        // - Rationale: 모델 다운로드 백그라운드 프로세스 기동 시 Windows CMD 창 팝업 방지.
        windowsHide: true,
      })
      let lastProgress = 0

      child.stdout?.on('data', (chunk: Buffer) => {
        const text = chunk.toString('utf-8')
        // 진행률 파싱: "pulling manifest... X% ..." 형식을 감지한다.
        const match = text.match(/(\d+)%/)
        if (match) {
          const pct = parseInt(match[1], 10)
          if (pct !== lastProgress) {
            lastProgress = pct
            // mainWindow로 실시간 진행률 브로드캐스팅
            const win = BrowserWindow.fromWebContents(event.sender)
            win?.webContents.send('ollama:pull-progress', { modelName, percent: pct, text: text.trim() })
          }
        }
      })

      child.stderr?.on('data', (chunk: Buffer) => {
        const text = chunk.toString('utf-8')
        const win = BrowserWindow.fromWebContents(event.sender)
        win?.webContents.send('ollama:pull-progress', { modelName, percent: lastProgress, text: text.trim() })
      })

      child.on('close', (code) => {
        if (code === 0) {
          resolve({ success: true })
        } else {
          resolve({ success: false, error: `ollama pull exited with code ${code}` })
        }
      })

      child.on('error', (err) => {
        resolve({ success: false, error: err.message })
      })
    })
  } catch (err: unknown) {
    console.error('[ollama:pull-model] 실패:', err)
    return { success: false, error: String(err) }
  }
})

// (4) Ollama 포트 11434 헬스 체크 대행 채널 (렌더러측 콘솔 ERR_CONNECTION_REFUSED 도배 회피용)
ipcMain.handle('ollama:check-health', async () => {
  try {
    const res = await fetch('http://127.0.0.1:11434/api/tags', { signal: AbortSignal.timeout(1500) })
    return { success: res.ok }
  } catch {
    return { success: false }
  }
})

// 🦙 Ollama 백그라운드 서버가 설치되어 있고 꺼져 있는 경우, 시작 시 자동 기동하는 백데몬 헬퍼
async function autoStartOllamaIfInstalled() {
  try {
    /*
     * [RUN-TIME STATE / INVARIANT]
     * - 변수 명: `isAlreadyRunning`
     * - 자료형 / 예상 값: boolean (초기값 false)
     * - 시나리오: 127.0.0.1 및 localhost 엔드포인트 두 곳 모두 헬스체크 핑을 전송하여 어느 하나라도 정상 수신되면 true가 됨.
     */
    let isAlreadyRunning = false
    const endpoints = ['http://127.0.0.1:11434/api/tags', 'http://localhost:11434/api/tags']
    for (const endpoint of endpoints) {
      try {
        const checkRes = await fetch(endpoint, { signal: AbortSignal.timeout(2000) })
        /*
         * [ALGORITHM BRANCH / DECISION]
         * - 조건 식: `checkRes && checkRes.ok`
         * - 만족 시: Ollama 백그라운드 서버가 가용한 엔드포인트를 통해 이미 구동 중임을 확인한 경우
         * - 불만족 시: 네트워크 연결 거부 등으로 에러가 발생하면 다음 엔드포인트 검사를 진행함
         */
        if (checkRes && checkRes.ok) {
          isAlreadyRunning = true
          break
        }
      } catch {
        // 개별 엔드포인트 접속 실패 시 예외를 조용히 버리고 다음 루프로 전환
      }
    }

    /*
     * [ALGORITHM BRANCH / DECISION]
     * - 조건 식: `isAlreadyRunning`
     * - 만족 시: 이미 백그라운드에서 동작 중이므로 신규 서브 프로세스 spawn을 바이패스(중단)함
     * - 불만족 시: Ollama 포트가 완전히 닫혀있어 자동 기동 프로세스로 통과함
     */
    if (isAlreadyRunning) {
      console.log('[OllamaAutoStart] Ollama 데몬이 이미 백그라운드에서 동작 중입니다.')
      return
    }

    // 2. Ollama CLI의 설치 유무 판단 및 실제 실행파일 경로 조회
    const { execSync, spawn } = require('child_process') as typeof import('child_process')
    const cmd = process.platform === 'win32' ? 'where ollama' : 'which ollama'
    
    const ollamaPath = await new Promise<string>((resolve) => {
      try {
        // - Expected Value Flow: cmd -> execSync -> string result
        // - Rationale: 백데몬 시작 검사 시 Windows CMD 창 깜빡임 차단.
        const result = execSync(cmd, { encoding: 'utf-8', timeout: 3000, windowsHide: true })
        const lines = result.trim().split('\n')
        if (lines.length > 0 && lines[0].trim()) {
          resolve(lines[0].trim())
        } else {
          resolve('')
        }
      } catch {
        resolve('')
      }
    })

    if (!ollamaPath) {
      console.log('[OllamaAutoStart] Ollama가 시스템에 설치되어 있지 않습니다. 자동 기동 생략.')
      return
    }

    // 3. 백그라운드로 독립 spawn serve 기동 (shell: false 옵션을 통해 CMD 검은 도스창 완전 차단)
    console.log(`[OllamaAutoStart] Ollama 백데몬 서버 자동 기동을 개시합니다... (Path: ${ollamaPath})`)
    const child = spawn(ollamaPath, ['serve'], {
      detached: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: false,
      windowsHide: true,
    })

    child.stdout?.on('data', (chunk: Buffer) => {
      const text = chunk.toString('utf-8')
      LLMProcessManager.broadcastLog('OLM', text)
    })

    child.stderr?.on('data', (chunk: Buffer) => {
      const text = chunk.toString('utf-8')
      LLMProcessManager.broadcastLog('OLM', text)
    })

    child.unref()
  } catch (err) {
    console.error('[OllamaAutoStart] 자동 시작 도중 오류 발생:', err)
  }
}

// [LINTER GUARD]
// Rationale: Ollama 자동 기동은 렌더러 단 제어 연동으로 인해 호출부가 주석 처리되었으나,
// 코드 무결성 보존 및 TypeScript 'never read' 경고 제거를 위해 아래와 같이 무해한 참조 바인딩을 이식한다.
void [autoStartOllamaIfInstalled]

// Electron 준비 완료 시점의 윈도우 기동 및 CSP 보안 구성
app.whenReady().then(() => {
  // [FEAT-MEDIA-PROTOCOL] 로컬 비디오/이미지 렌더링을 위한 커스텀 media:// 프로토콜 핸들러 등록
  protocol.handle('media', (request) => {
    // [BUG-FIX] Windows 크롬 커널 프로토콜 매핑 시 호스트 뒤 콜론(:) 유실 버그 대응 복원
    let rawPath = request.url.replace(/^media:\/\/+/i, '')
    rawPath = decodeURIComponent(rawPath)
    
    // 비디오 태그 요청 시 붙을 수 있는 쿼리(?...) 및 해시(#...) 스트링 제거
    rawPath = rawPath.split('?')[0].split('#')[0]
    
    // Windows 환경에서 C/Users/... 같이 콜론(:)이 누락된 경로 복원
    if (process.platform === 'win32') {
      if (/^[a-zA-Z]\//.test(rawPath)) {
        rawPath = rawPath[0] + ':' + rawPath.substring(1)
      } else if (/^[a-zA-Z]\\/.test(rawPath)) {
        rawPath = rawPath[0] + ':/' + rawPath.substring(2)
      }
    }
    
    const { pathToFileURL } = require('url') as typeof import('url')
    const fileUrl = pathToFileURL(rawPath).toString()
    
    console.log(`[MediaProtocol] request: ${request.url} -> raw: ${rawPath} -> file: ${fileUrl}`)
    
    return net.fetch(fileUrl)
  })

  // [PERF] 1. 가장 먼저 윈도우 생성 (블로킹 방지 및 즉각적인 UI 피드백 제공)
  createWindow()

  // [FEAT-OLLAMA-AUTO] 올라마가 감지되면 백그라운드 백데몬 기동 연쇄 (LMA 등 타 엔진 사용 시 불필요한 자동 기동 방지를 위해 호출 주석 처리)
  // autoStartOllamaIfInstalled()

  // [FIX-USER-AGENT-001] 유튜브 등 외부 임베드 웹 브라우저 호환성 및 재생 제한 우회 설정
  /*
   * [RUN-TIME STATE / INVARIANT]
   * - 변수 명: `userAgent`
   * - 자료형 / 예상 값: string
   * - 시나리오: Electron 기본 User-Agent를 사용하면 유튜브 스크립트가 브라우저를 Incognito(인코그니토) 모드나 비호환 기기로 인식하여 재생을 정지시킵니다. 이를 일반 Chrome 120.0.0.0 버전 사양으로 강제 지정하여 차단을 무력화합니다.
   */
  session.defaultSession.setUserAgent(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  )

  // [FIX-YOUTUBE-REFERER-001] 유튜브 임베드 재생 차단 우회를 위한 Referer 스푸핑
  /*
   * [RUN-TIME STATE / INVARIANT]
   * - 변수 명: `Referer`
   * - 자료형 / 예상 값: string (HTTP 요청 헤더 매핑 값)
   * - 시나리오: 특정 유튜브 영상은 외부 사이트 임베드를 차단합니다. 임베드 iframe 프레임 자체의 호출에 대해서만 신뢰할 수 있는 대형 블로그 서비스 도메인(https://tistory.com/)으로 Referer를 위장하여 도메인 검증을 통과시킵니다.
   * - 주의: Origin 헤더를 임의 변조하거나 *.googlevideo.com 등 CDN 주소까지 헤더를 오염시키면 CORS 정책 불일치로 403 Forbidden 차단이 발생하므로, 오직 /embed/* 요청의 Referer 헤더만 가공합니다.
   */
  session.defaultSession.webRequest.onBeforeSendHeaders(
    { urls: ['https://*.youtube.com/embed/*', 'https://*.youtube-nocookie.com/embed/*'] },
    (details, callback) => {
      details.requestHeaders['Referer'] = 'https://tistory.com/'
      // Origin 헤더는 건드리지 않고 표준 정책을 유지하여 CORS 403 에러 예방
      callback({ requestHeaders: details.requestHeaders })
    }
  )

  // [SEC-W-021] Content-Security-Policy 헤더 동적 세팅 주입
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    const responseHeaders = { ...details.responseHeaders }
    
    // 1. 대소문자 가리지 않고 모든 요청의 x-frame-options 제거
    for (const key of Object.keys(responseHeaders)) {
      if (key.toLowerCase() === 'x-frame-options') {
        delete responseHeaders[key]
      }
    }

    // 2. content-security-policy 내 frame-ancestors 규칙을 정규식으로 우회
    for (const key of Object.keys(responseHeaders)) {
      if (key.toLowerCase() === 'content-security-policy' || key.toLowerCase() === 'content-security-policy-report-only') {
        const val = responseHeaders[key]
        if (Array.isArray(val)) {
          responseHeaders[key] = val.map(policy => 
            policy.replace(/frame-ancestors\s+[^;]+(;?)/gi, '')
          )
        } else if (typeof val === 'string') {
          responseHeaders[key] = [(val as string).replace(/frame-ancestors\s+[^;]+(;?)/gi, '')]
        }
      }
    }

    // [FIX-CSP-BYPASS-003] openstreetmap.org로부터 날아오는 응답 헤더 중 외부 프레임 임베딩을 차단하는 헤더들을 가로채어 제거
    if (details.url.includes('openstreetmap.org')) {
      delete responseHeaders['content-security-policy']
      delete responseHeaders['content-security-policy-report-only']
      delete responseHeaders['x-frame-options']
      for (const key of Object.keys(responseHeaders)) {
        if (['content-security-policy', 'content-security-policy-report-only', 'x-frame-options'].includes(key.toLowerCase())) {
          delete responseHeaders[key]
        }
      }
    } else {
      // 일반 요청인 경우에만 기본 CSP 덮어씀 (단, iframe 내부 서브 리소스가 아니라 최상단 AMEVA 앱 페이지인 경우에만 주입)
      const isAppFrame = details.url.startsWith('http://localhost') || 
                         details.url.startsWith('http://127.0.0.1') || 
                         details.url.startsWith('file:///');
      if (details.resourceType === 'mainFrame' && isAppFrame) {
        /*
         * [RUN-TIME STATE / INVARIANT]
         * - 변수 명: `Content-Security-Policy`
         * - 자료형 / 예상 값: string[] (CSP 헤더 값 목록)
         * - 시나리오: 애플리케이션의 보안 통제를 위해 CSP 헤더 값을 주입하며, 외부 썸네일 이미지 로드가 차단되는 문제를 막기 위해 img-src 지시어에 https: 프로토콜을 명시적으로 허용함.
         */
        responseHeaders['Content-Security-Policy'] = [
          "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' blob: http://localhost:* http://127.0.0.1:* https://cdn.jsdelivr.net https://cdnjs.cloudflare.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net; font-src 'self' https://fonts.gstatic.com https://cdn.jsdelivr.net; img-src 'self' data: blob: https:; connect-src 'self' ws://localhost:* ws://127.0.0.1:* wss://* http://localhost:* http://127.0.0.1:* https://* wss://demos.yjs.dev; worker-src blob:; frame-src 'self' https: http: data: blob:;"
        ]
      }
    }
    
    callback({ responseHeaders })
  })

  // 렌더러 로딩 완료 시 최초 전달된 startup 파일 내용을 전송 완료 처리
  ipcMain.handle('app:ready', async () => {
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `fileToOpenOnStartup && mainWindow`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (fileToOpenOnStartup && mainWindow)` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
    if (fileToOpenOnStartup && mainWindow) {
      try {
        const ext = fileToOpenOnStartup.split('.').pop()?.toLowerCase() || ''
        const isBinary = ['docx', 'pdf', 'hwpx', 'xlsx', 'xls', 'adc'].includes(ext)
        const content = await readFile(fileToOpenOnStartup, isBinary ? 'base64' : 'utf-8')
        mainWindow.webContents.send('file:open-argv', { content, filePath: fileToOpenOnStartup, isBinary })
        fileToOpenOnStartup = null
      } catch (err) {
        console.error('Failed to read startup file:', err)
      }
    }
    return { success: true }
  })

  app.on('activate', () => {
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `BrowserWindow.getAllWindows().length === 0) createWindow(`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (BrowserWindow.getAllWindows().length === 0) createWindow()` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })

  // [PERF] 2. 나머지 무거운 작업들은 윈도우 생성 완료 이후 백그라운드로 지연 실행 (1초 뒤)
  setTimeout(async () => {
    // [MEM-CLEANUP] 프로그램 기동 시점에 OS 상에 유령으로 남아있던 모든 llama 프로세스 일괄 정리
    await LLMProcessManager.asyncCleanupOrphanedProcesses()

    // 🤖 [Background Warmup] 앱 기동 시 로컬 LLM 백그라운드 비동기 기동 (웜업)
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
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `defaultModelPath`
       * - 자료형 / 예상 값: `string`
       * - 시나리오: 3단계 상수 규칙(`LLMProcessManager.DEFAULT_MODEL_PATH`)을 따라 기본 7B 모델 절대 경로 획득
       */
      const defaultModelPath = LLMProcessManager.DEFAULT_MODEL_PATH
      const fs = require('fs')
      
      // 로컬 LLM CLI 바이너리와 GGUF 파일이 존재할 때만 웜업 서버 기동 트리거
      if (llamaPath && fs.existsSync(defaultModelPath)) {
        LLMProcessManager.startLlamaServerWithFallback(llamaPath, defaultModelPath, 16384, true)
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
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `isShuttingDown`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (isShuttingDown)` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
  if (isShuttingDown) return
  isShuttingDown = true
  
  // 로컬 추론 엔진 종료
  await LLMProcessManager.gracefulShutdown()
  
  // MCP 서버들 제거
  try { MCPProcessManager.killAll() } catch {}
  
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `process.env.VITE_DEV_SERVER_URL`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (process.env.VITE_DEV_SERVER_URL)` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
  if (process.env.VITE_DEV_SERVER_URL) {
    try {
      const { execSync } = require('child_process')
      // - Rationale: 앱 종료 taskkill 연동 시 Windows CMD 창 깜빡임 방지.
      execSync(`taskkill /pid ${process.ppid} /T /F`, { stdio: 'ignore', windowsHide: true })
    } catch {}
  }
  app.exit(0)
}

app.on('window-all-closed', () => {
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `process.platform !== 'darwin'`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (process.platform !== 'darwin')` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// 앱 종료 will-quit 리스너 연동 (추론 엔진 활성 시 exit guard 발동)
app.on('will-quit', (e) => {
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `!isShuttingDown && LLMProcessManager.activeServerProcess`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (!isShuttingDown && LLMProcessManager.activeServerProcess)` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
  if (!isShuttingDown && LLMProcessManager.activeServerProcess) {
    e.preventDefault()
    handleGracefulExit()
  } else {
    try { MCPProcessManager.killAll() } catch {}
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `process.env.VITE_DEV_SERVER_URL`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (process.env.VITE_DEV_SERVER_URL)` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
    if (process.env.VITE_DEV_SERVER_URL) {
      try {
        const { execSync } = require('child_process')
        // - Rationale: 앱 종료 taskkill 연동 시 Windows CMD 창 깜빡임 방지.
        execSync(`taskkill /pid ${process.ppid} /T /F`, { stdio: 'ignore', windowsHide: true })
      } catch {}
    }
    app.exit(0)
  }
})

// 🦾 [CONSOLE EXIT-GUARD] 터미널에서 Ctrl+C (SIGINT) 또는 SIGTERM 시그널로 강제 종료 시, 안전하게 엔진 종료
process.on('SIGINT', async () => {
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `isShuttingDown`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (isShuttingDown)` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
  if (isShuttingDown) return
  isShuttingDown = true
  await LLMProcessManager.gracefulShutdown()
  try { MCPProcessManager.killAll() } catch {}
  process.exit(0)
})

process.on('SIGTERM', async () => {
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `isShuttingDown`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (isShuttingDown)` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
  if (isShuttingDown) return
  isShuttingDown = true
  await LLMProcessManager.gracefulShutdown()
  try { MCPProcessManager.killAll() } catch {}
  process.exit(0)
})

