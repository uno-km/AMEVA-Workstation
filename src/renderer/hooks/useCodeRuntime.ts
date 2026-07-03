import { useState } from 'react'

let pyodideInstance: any = null
let persistentWorker: Worker | null = null
let sqliteDatabaseInstance: any = null

function getOrCreateJSWorker() {
  if (persistentWorker) return persistentWorker

  const workerBlobCode = `
    const logs = [];
    const customConsole = {
      log: function(...args) {
        logs.push(args.map(a => typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a)).join(' '));
      },
      error: function(...args) {
        logs.push('[ERROR] ' + args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' '));
      },
      warn: function(...args) {
        logs.push('[WARN] ' + args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' '));
      },
      info: function(...args) {
        logs.push('[INFO] ' + args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' '));
      },
      table: function(data) {
        logs.push(typeof data === 'object' ? JSON.stringify(data, null, 2) : String(data));
      }
    };
    
    self.console = customConsole;

    self.onmessage = function(e) {
      let codeToRun = e.data || '';
      // const, let을 var로 치환하여 eval 시 글로벌 스코프(self)에 영구 안착하도록 보정
      codeToRun = codeToRun.replace(/\bconst\b/g, 'var').replace(/\blet\b/g, 'var');

      logs.length = 0; // 누적 로그 비우기
      try {
        // eval을 사용하여 워커 전역 네임스페이스 상에서 코드를 순차 누적 실행 (변수 상태 완벽 세션 보존)
        const result = self.eval(codeToRun);
        if (result !== undefined) {
          logs.push('→ ' + (typeof result === 'object' ? JSON.stringify(result, null, 2) : String(result)));
        }
        postMessage({ success: true, logs });
      } catch (err) {
        postMessage({ success: false, logs: logs.concat('[RUNTIME ERROR] ' + err.message) });
      }
    };
  `

  const blob = new Blob([workerBlobCode], { type: 'application/javascript' })
  persistentWorker = new Worker(URL.createObjectURL(blob))
  return persistentWorker
}

export function useCodeRuntime() {
  const [isRunning, setIsRunning] = useState(false)

  // ── JS: Web Worker 상주형 세션 유지 샌드박스 실행 ──
  const runJSCode = (code: string): Promise<{ success: boolean; output: string }> => {
    return new Promise((resolve) => {
      setIsRunning(true)
      const worker = getOrCreateJSWorker()

      const timeoutId = setTimeout(() => {
        // 무한루프 발생 시 세션 재생성을 위해 기존 워커 강제 기동 중지 및 널 세팅
        worker.terminate()
        persistentWorker = null
        setIsRunning(false)
        resolve({ success: false, output: '[TIMEOUT] 실행 시간이 5초를 초과하여 강제 종료되었습니다. 상태 세션이 초기화되었습니다.' })
      }, 5000)

      worker.onmessage = (e) => {
        clearTimeout(timeoutId)
        setIsRunning(false)
        const { success, logs } = e.data
        resolve({ success, output: (logs as string[]).join('\n') })
      }

      worker.onerror = (err) => {
        clearTimeout(timeoutId)
        setIsRunning(false)
        resolve({ success: false, output: `[RUNTIME ERROR] ${err.message}` })
      }

      worker.postMessage(code)
    })
  }

  // ── Python: 브라우저 WebAssembly(Pyodide WASM) 격리형 샌드박스 실행 ──
  const runPythonCode = async (code: string): Promise<{ success: boolean; output: string }> => {
    setIsRunning(true)

    // 느낌표 명령어 (!pip install 및 가상 cmd 쉘 명령어) 전처리
    let processedCode = code
    let needsMicropip = false

    const lines = code.split('\n')
    const processedLines = lines.map(line => {
      const trimmed = line.trim()
      if (!trimmed.startsWith('!')) return line

      // 1. pip 패키지 인스톨 명령어 처리
      if (trimmed.startsWith('!pip install ')) {
        needsMicropip = true
        const packagesStr = trimmed.substring('!pip install '.length).trim()
        const pkgs = packagesStr.split(/[\s,]+/).map(p => p.trim()).filter(Boolean)
        if (pkgs.length > 0) {
          return `
import micropip
for pkg in ${JSON.stringify(pkgs)}:
    print(f"Collecting {pkg}...")
    try:
        await micropip.install(pkg)
        print(f"Successfully installed {pkg}")
    except Exception as e:
        print(f"[ERROR] Failed to install {pkg}: {str(e)}")
`
        }
        return ''
      }

      // 2. 가상 cmd 쉘 명령어 시뮬레이터 처리 (WASM 격리 샌드박스용)
      const cmdLine = trimmed.substring(1).trim()
      const parts = cmdLine.split(' ')
      const mainCmd = parts[0]
      const args = parts.slice(1).join(' ').trim()

      switch (mainCmd) {
        case 'pwd':
          return `import os\nprint(os.getcwd())`
        case 'cd':
          return `import os\nos.chdir(${JSON.stringify(args || '/')})\nprint(f"Changed directory to: {os.getcwd()}")`
        case 'ls':
        case 'dir':
          return `import os\nfor f in os.listdir(${JSON.stringify(args || '.') || "'.'" }):\n    print(f)`
        case 'mkdir':
          return `import os\nos.makedirs(${JSON.stringify(args)}, exist_ok=True)\nprint(f"Created directory: {${JSON.stringify(args)}}")`
        case 'rmdir':
          return `import os, shutil\nshutil.rmtree(${JSON.stringify(args)}, ignore_errors=True)\nprint(f"Removed directory: {${JSON.stringify(args)}}")`
        case 'touch':
          return `with open(${JSON.stringify(args)}, 'w') as f:\n    pass\nprint(f"Created file: {${JSON.stringify(args)}}")`
        case 'cat':
        case 'type':
          return `print(open(${JSON.stringify(args)}, 'r', encoding='utf-8', errors='ignore').read())`
        case 'echo':
          return `print(${JSON.stringify(args)})`
        default:
          return `print(${JSON.stringify(`[AMEVA Shell] 가상 샌드박스 브라우저 환경에서는 로컬 PC 커맨드 '${cmdLine}'를 실행할 수 없으므로 가상 쉘 시뮬레이터로 대체 작동합니다. (지원 명령어: pwd, cd, ls, dir, mkdir, touch, cat, echo, pip)`)})`
      }
    })
    processedCode = processedLines.join('\n')

    // WebAssembly Pyodide Worker 격리 샌드박스 기동 (데스크탑 로컬 파이썬 미사용)
    try {
      if (!(window as any).loadPyodide) {
        // Pyodide WebAssembly CDN 라이브러리 동적 로드
        await new Promise<void>((resolve, reject) => {
          const script = document.createElement('script')
          script.src = 'https://cdn.jsdelivr.net/pyodide/v0.26.1/full/pyodide.js'
          script.onload = () => resolve()
          script.onerror = () => reject(new Error('Pyodide WebAssembly CDN 로드 실패'))
          document.head.appendChild(script)
        })
      }

      if (!pyodideInstance) {
        pyodideInstance = await (window as any).loadPyodide({
          indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.26.1/full/'
        })
      }

      // micropip 모듈 로드
      if (needsMicropip) {
        await pyodideInstance.loadPackage("micropip")
      }

      const logs: string[] = []
      pyodideInstance.setStdout({
        batched: (text: string) => logs.push(text)
      })
      pyodideInstance.setStderr({
        batched: (text: string) => logs.push(`[ERROR] ${text}`)
      })

      const result = await pyodideInstance.runPythonAsync(processedCode)
      setIsRunning(false)

      let output = logs.join('\n')
      if (result !== undefined && result !== null) {
        output += `\n→ ${String(result)}`
      }
      return { success: true, output: output || '실행 완료 (WASM)' }

    } catch (err: any) {
      setIsRunning(false)
      return { success: false, output: `[WASM RUNTIME ERROR]\n${err.message}` }
    }
  }

  // ── SQL: SQLite WASM 가상 메모리 데이터베이스 실행 ──
  const runSQLCode = async (code: string): Promise<{ success: boolean; output: string; isTable?: boolean; tableData?: any }> => {
    setIsRunning(true)
    try {
      if (!(window as any).SQL) {
        await new Promise<void>((resolve, reject) => {
          const script = document.createElement('script')
          script.src = 'https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.2/sql-wasm.js'
          script.onload = () => resolve()
          script.onerror = () => reject(new Error('sql.js WASM CDN 로드 실패'))
          document.head.appendChild(script)
        })
      }

      if (!sqliteDatabaseInstance) {
        const config = {
          locateFile: (file: string) => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.2/${file}`
        }
        const initSqlJs = (window as any).initSqlJs
        const SQL = await initSqlJs(config)
        sqliteDatabaseInstance = new SQL.Database()
      }

      const res = sqliteDatabaseInstance.exec(code)
      setIsRunning(false)

      if (res.length === 0) {
        return { success: true, output: 'Query executed successfully (No results returned).' }
      }

      const lastQueryResult = res[res.length - 1]
      return {
        success: true,
        output: '',
        isTable: true,
        tableData: {
          columns: lastQueryResult.columns,
          values: lastQueryResult.values
        }
      }
    } catch (err: any) {
      setIsRunning(false)
      return { success: false, output: `[SQL WASM ERROR]\n${err.message}` }
    }
  }

  return {
    isRunning,
    runJSCode,
    runPythonCode,
    runSQLCode,
  }
}
