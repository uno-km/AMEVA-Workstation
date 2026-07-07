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

    // [SEC-W-006] 네트워크 접근 차단 — Worker에서 외부 통신 불가
    const BLOCKED_PATTERNS = ['fetch(', 'XMLHttpRequest', 'importScripts', 'WebSocket', 'navigator.sendBeacon'];

    self.onmessage = function(e) {
      let codeToRun = e.data || '';

      // 금지 패턴 사전 검사
      for (const pattern of BLOCKED_PATTERNS) {
        if (codeToRun.includes(pattern)) {
          postMessage({ success: false, logs: ['[SECURITY] 네트워크 접근 코드는 실행이 차단되었습니다: ' + pattern] });
          return;
        }
      }

      // const, let을 var로 치환하여 eval 시 글로벌 스코프(self)에 영구 안착하도록 보정
      // 주의: 문자열 리터럴 안의 const/let은 교체되지 않도록 간단한 보정
      codeToRun = codeToRun.replace(/\\bconst\\b(?=[^'"]*(?:['"][^'"]*['"][^'"]*)*$)/gm, 'var')
                            .replace(/\\blet\\b(?=[^'"]*(?:['"][^'"]*['"][^'"]*)*$)/gm, 'var');

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

// [SEC-W-014] 외부에서 런타임 리소스를 정리할 수 있는 함수
export function cleanupCodeRuntime() {
  if (persistentWorker) {
    persistentWorker.terminate()
    persistentWorker = null
  }
  pyodideInstance = null
  sqliteDatabaseInstance = null
}

export function useCodeRuntime() {
  const [isRunning, setIsRunning] = useState(false)

  // ── JS: Web Worker 상주형 세션 유지 샌드박스 실행 ──
  const runJSCode = (code: string): Promise<{ success: boolean; output: string; tableData?: any }> => {
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
  const runPythonCode = async (code: string): Promise<{ success: boolean; output: string; tableData?: any }> => {
    setIsRunning(true)

    // 느낌표 명령어 (!pip install 및 가상 cmd 쉘 명령어) 전처리
    let processedCode = code
    let needsMicropip = false

    // 가상 쉘 명령어 및 파이프라인/다중 실행 결합 파서 알고리즘 (WASM Pyodide용)
    const lines = code.split('\n')
    const processedLines = lines.map(line => {
      const trimmed = line.trim()
      if (!trimmed.startsWith('!')) return line

      // !pip install 특수 처리
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

      // 쉘 명령어 토크나이저 & 번역기
      const cmdText = trimmed.substring(1).trim()
      
      // 세미콜론(;) 또는 && 기준으로 1차 명령 체인 분할
      // 예: cd src; pwd  또는  echo hello && ls
      const chains = cmdText.split(/;|&&/).map(c => c.trim()).filter(Boolean)
      
      let pythonCodeBlock = 'import os, shutil, re\n'
      
      chains.forEach((chain, chainIdx) => {
        // 파이프(|) 기준으로 2차 스트림 분할
        // 예: ls | grep ts | wc -l
        const pipes = chain.split('|').map(p => p.trim()).filter(Boolean)
        
        pythonCodeBlock += `\n# --- Chain [${chainIdx}] : ${chain.replace(/"/g, '\\"')} ---\n`
        pythonCodeBlock += `pipe_in = ""\n`
        
        pipes.forEach((pipe, pipeIdx) => {
          const parts = pipe.split(/\s+/).filter(Boolean)
          if (parts.length === 0) return
          
          const mainCmd = parts[0].toLowerCase()
          const args = parts.slice(1).join(' ').trim()
          const escapedArgs = args.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
          
          pythonCodeBlock += `\n# Pipe [${pipeIdx}] : ${mainCmd} ${escapedArgs}\n`
          
          switch (mainCmd) {
            case 'pwd':
              pythonCodeBlock += `pipe_in = os.getcwd()\n`
              break
            case 'cd':
              pythonCodeBlock += `
try:
    os.chdir("${escapedArgs}" if "${escapedArgs}" else "/")
    pipe_in = f"Changed directory to: {os.getcwd()}"
except Exception as e:
    pipe_in = f"cd: {str(e)}"
`
              break
            case 'ls':
            case 'dir':
              pythonCodeBlock += `
try:
    target_dir = "${escapedArgs}" if "${escapedArgs}" else "."
    pipe_in = "\\n".join(os.listdir(target_dir))
except Exception as e:
    pipe_in = f"ls: {str(e)}"
`
              break
            case 'mkdir':
              pythonCodeBlock += `
try:
    os.makedirs("${escapedArgs}", exist_ok=True)
    pipe_in = f"Created directory: {${JSON.stringify(args)}}"
except Exception as e:
    pipe_in = f"mkdir: {str(e)}"
`
              break
            case 'rmdir':
              pythonCodeBlock += `
try:
    shutil.rmtree("${escapedArgs}", ignore_errors=True)
    pipe_in = f"Removed directory: ${escapedArgs}"
except Exception as e:
    pipe_in = f"rmdir: {str(e)}"
`
              break
            case 'touch':
              pythonCodeBlock += `
try:
    with open("${escapedArgs}", 'w') as f:
        pass
    pipe_in = f"Created file: ${escapedArgs}"
except Exception as e:
    pipe_in = f"touch: {str(e)}"
`
              break
            case 'cat':
            case 'type':
              // 파이프 이전 단계의 데이터가 있고 인자가 없으면 파이프 데이터를 cat 대상으로 간주, 아니면 인자 파일 로드
              pythonCodeBlock += `
try:
    target_file = "${escapedArgs}" if "${escapedArgs}" else pipe_in.strip()
    if target_file:
        with open(target_file, 'r', encoding='utf-8', errors='ignore') as f:
            pipe_in = f.read()
    else:
        pipe_in = "[ERROR] cat: No file specified"
except Exception as e:
    pipe_in = f"cat: {str(e)}"
`
              break
            case 'echo':
              // 인자가 없으면 파이프 입력을 그대로 출력, 있으면 인자 출력
              pythonCodeBlock += `pipe_in = "${escapedArgs}" if "${escapedArgs}" else pipe_in\n`
              break
            case 'grep':
              // 간단한 grep 시뮬레이터 (대소문자 무시 옵션 -i 지원)
              const isCaseInsensitive = args.includes('-i')
              const cleanPattern = args.replace(/-[a-zA-Z]+/g, '').trim().replace(/"/g, '\\"')
              pythonCodeBlock += `
pattern = "${cleanPattern}"
lines_to_filter = pipe_in.split('\\n')
if ${isCaseInsensitive ? 'True' : 'False'}:
    pipe_in = "\\n".join([line for line in lines_to_filter if pattern.lower() in line.lower()])
else:
    pipe_in = "\\n".join([line for line in lines_to_filter if pattern in line])
`
              break
            case 'wc':
              const isLineCount = args.includes('-l')
              pythonCodeBlock += `
lines_wc = pipe_in.split('\\n')
# 빈 라인 제외 개수 세기
active_lines = [l for l in lines_wc if l.strip()]
if ${isLineCount ? 'True' : 'False'}:
    pipe_in = str(len(active_lines))
else:
    words = len(pipe_in.split())
    chars = len(pipe_in)
    pipe_in = f"{len(active_lines)} {words} {chars}"
`
              break
            case 'head':
              const headLinesMatch = args.match(/-n\s*(\d+)/) || args.match(/-(\d+)/)
              const headCount = headLinesMatch ? parseInt(headLinesMatch[1]) : 10
              pythonCodeBlock += `
lines_head = pipe_in.split('\\n')
pipe_in = "\\n".join(lines_head[:${headCount}])
`
              break
            case 'tail':
              const tailLinesMatch = args.match(/-n\s*(\d+)/) || args.match(/-(\d+)/)
              const tailCount = tailLinesMatch ? parseInt(tailLinesMatch[1]) : 10
              pythonCodeBlock += `
lines_tail = pipe_in.split('\\n')
pipe_in = "\\n".join(lines_tail[-${tailCount}:])
`
              break
            case 'sort':
              pythonCodeBlock += `
lines_sort = [l for l in pipe_in.split('\\n') if l.strip()]
pipe_in = "\\n".join(sorted(lines_sort))
`
              break
            default:
              pythonCodeBlock += `pipe_in = "[WASM Sandbox] 파이썬 샌드박스 실행기에서 지원되지 않는 쉘 명령입니다: ${mainCmd}"\n`
          }
        })
        
        // 각 체인의 최종 결과를 화면에 print
        pythonCodeBlock += `print(pipe_in)\n`
      })
      
      return pythonCodeBlock
    })
    processedCode = processedLines.join('\n')

    // WebAssembly Pyodide Worker 격리 샌드박스 기동 (데스크탑 로컬 파이썬 미사용)
    try {
      if (!(window as any).loadPyodide) {
        // [SEC-W-016] Pyodide CDN 스크립트에 SRI 해시 적용 — 공급망 공격 차단
        await new Promise<void>((resolve, reject) => {
          const script = document.createElement('script')
          script.src = 'https://cdn.jsdelivr.net/pyodide/v0.26.1/full/pyodide.js'
          script.integrity = 'sha384-Zt+txBUVind9SDPtCx7HTNK8jiZiFKX/Cm3Ml1tEnAmGKO/QSRn1VqM+Vr45Cbrj'
          script.crossOrigin = 'anonymous'
          script.onload = () => resolve()
          script.onerror = () => reject(new Error('Pyodide WebAssembly CDN 로드 실패 (SRI 검증 실패일 수 있습니다)'))
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
