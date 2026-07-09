/**
 * @file usePythonRuntime.ts
 * @system AMEVA OS Desktop Workstation
 * @location src/renderer/hooks/code-runtime/usePythonRuntime.ts
 * @role Core module helper and integration logic
 * 
 * [소비처 - CONSUMERS / USAGE CONTEXT]
 * - 소비처 A (src/renderer/App.tsx): 최상위 Facade 구조에 통합 마운트.
 * - 소비처 B (src/renderer/contexts/AppContext.tsx): 리액트 Context 훅 목록에 바인딩되어 하위 뷰에 전파.
 * 
 * [책임 범위 - RESPONSIBILITY]
 * - 본 파일은 AMEVA 시스템 내에서 도메인 목적에 부합하는 연산 및 데이터 처리 흐름을 안전하게 캡슐화한다.
 * - 외부 라이브러리 및 하위 종속성을 조율하고 결과 규격을 일관되게 제공한다.
 * 
 * [절대 깨면 안 되는 계약 - CONTRACT]
 * - MUST: 모든 예외 발생 시 에러를 침묵시키지 말고 에러 로그를 명확하게 남길 것.
 * - MUST NOT: TypeScript any 형식을 우회 수단으로 함부로 선언하지 말 것.
 */

import { useState } from 'react'
import { RuntimeState } from './runtimeState'

export function usePythonRuntime() {
  const [isRunning, setIsRunning] = useState(false)

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
      const chains = cmdText.split(/;|&&/).map(c => c.trim()).filter(Boolean)
      
      let pythonCodeBlock = 'import os, shutil, re\n'
      
      chains.forEach((chain, chainIdx) => {
        // 파이프(|) 기준으로 2차 스트림 분할
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
              pythonCodeBlock += `pipe_in = "${escapedArgs}" if "${escapedArgs}" else pipe_in\n`
              break
            case 'grep':
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
        
        pythonCodeBlock += `print(pipe_in)\n`
      })
      
      return pythonCodeBlock
    })
    processedCode = processedLines.join('\n')

    try {
      if (!(window as any).loadPyodide) {
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

      if (!RuntimeState.pyodideInstance) {
        RuntimeState.pyodideInstance = await (window as any).loadPyodide({
          indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.26.1/full/'
        })
      }

      if (needsMicropip) {
        await RuntimeState.pyodideInstance.loadPackage("micropip")
      }

      const logs: string[] = []
      RuntimeState.pyodideInstance.setStdout({
        batched: (text: string) => logs.push(text)
      })
      RuntimeState.pyodideInstance.setStderr({
        batched: (text: string) => logs.push(`[ERROR] ${text}`)
      })

      const result = await RuntimeState.pyodideInstance.runPythonAsync(processedCode)
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

  return {
    isPythonRunning: isRunning,
    runPythonCode,
  }
}
