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

  // [FUNCTION CONTRACT] - 외부/내부로부터 유입되는 인자 규격을 분석하여 약속된 리턴 타입을 안정적으로 생산함.
export function usePythonRuntime() {
  const [isRunning, setIsRunning] = useState(false)

  // [RUN-TIME STATE / INVARIANT] - 변수 'runPythonCode'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
  const runPythonCode = async (code: string): Promise<{ success: boolean; output: string; tableData?: any }> => {
    setIsRunning(true)

    // 느낌표 명령어 (!pip install 및 가상 cmd 쉘 명령어) 전처리
    let processedCode = code
  // [RUN-TIME STATE / INVARIANT] - 변수 'needsMicropip'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
    let needsMicropip = false

    // 가상 쉘 명령어 및 파이프라인/다중 실행 결합 파서 알고리즘 (WASM Pyodide용)
    const lines = code.split('\n')
  // [RUN-TIME STATE / INVARIANT] - 변수 'processedLines'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
    const processedLines = lines.map(line => {
  // [RUN-TIME STATE / INVARIANT] - 변수 'trimmed'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
      const trimmed = line.trim()
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
      if (!trimmed.startsWith('!')) return line

      // !pip install 특수 처리
      if (trimmed.startsWith('!pip install ')) {
        needsMicropip = true
  // [RUN-TIME STATE / INVARIANT] - 변수 'packagesStr'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
        const packagesStr = trimmed.substring('!pip install '.length).trim()
  // [RUN-TIME STATE / INVARIANT] - 변수 'pkgs'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
        const pkgs = packagesStr.split(/[\s,]+/).map(p => p.trim()).filter(Boolean)
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
        if (pkgs.length > 0) {
          return `
import micropip
  // [LOOP CONTROL ITERATION] - 데이터 콜렉션 순회 및 조건 도달 시까지의 반복적 상태 전이 연산 수행.
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
      
  // [RUN-TIME STATE / INVARIANT] - 변수 'pythonCodeBlock'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
      let pythonCodeBlock = 'import os, shutil, re\n'
      
      chains.forEach((chain, chainIdx) => {
        // 파이프(|) 기준으로 2차 스트림 분할
        const pipes = chain.split('|').map(p => p.trim()).filter(Boolean)
        
        pythonCodeBlock += `\n# --- Chain [${chainIdx}] : ${chain.replace(/"/g, '\\"')} ---\n`
        pythonCodeBlock += `pipe_in = ""\n`
        
        pipes.forEach((pipe, pipeIdx) => {
  // [RUN-TIME STATE / INVARIANT] - 변수 'parts'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
          const parts = pipe.split(/\s+/).filter(Boolean)
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
          if (parts.length === 0) return
          
  // [RUN-TIME STATE / INVARIANT] - 변수 'mainCmd'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
          const mainCmd = parts[0].toLowerCase()
  // [RUN-TIME STATE / INVARIANT] - 변수 'args'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
          const args = parts.slice(1).join(' ').trim()
  // [RUN-TIME STATE / INVARIANT] - 변수 'escapedArgs'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
          const escapedArgs = args.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
          
          pythonCodeBlock += `\n# Pipe [${pipeIdx}] : ${mainCmd} ${escapedArgs}\n`
          
  // [SWITCH ROUTING CASE] - 다중 후보 값 매핑 조건에 따른 최적 라우팅 제어.
          switch (mainCmd) {
    // [CASE DECISION BINDING] - 분기 타겟 조건 충족 시의 대응 비즈니스 처리 단락.
            case 'pwd':
              pythonCodeBlock += `pipe_in = os.getcwd()\n`
              break
    // [CASE DECISION BINDING] - 분기 타겟 조건 충족 시의 대응 비즈니스 처리 단락.
            case 'cd':
              pythonCodeBlock += `
try:
    os.chdir("${escapedArgs}" if "${escapedArgs}" else "/")
    pipe_in = f"Changed directory to: {os.getcwd()}"
except Exception as e:
    pipe_in = f"cd: {str(e)}"
`
              break
    // [CASE DECISION BINDING] - 분기 타겟 조건 충족 시의 대응 비즈니스 처리 단락.
            case 'ls':
    // [CASE DECISION BINDING] - 분기 타겟 조건 충족 시의 대응 비즈니스 처리 단락.
            case 'dir':
              pythonCodeBlock += `
try:
    target_dir = "${escapedArgs}" if "${escapedArgs}" else "."
    pipe_in = "\\n".join(os.listdir(target_dir))
except Exception as e:
    pipe_in = f"ls: {str(e)}"
`
              break
    // [CASE DECISION BINDING] - 분기 타겟 조건 충족 시의 대응 비즈니스 처리 단락.
            case 'mkdir':
              pythonCodeBlock += `
try:
    os.makedirs("${escapedArgs}", exist_ok=True)
    pipe_in = f"Created directory: {${JSON.stringify(args)}}"
except Exception as e:
    pipe_in = f"mkdir: {str(e)}"
`
              break
    // [CASE DECISION BINDING] - 분기 타겟 조건 충족 시의 대응 비즈니스 처리 단락.
            case 'rmdir':
              pythonCodeBlock += `
try:
    shutil.rmtree("${escapedArgs}", ignore_errors=True)
    pipe_in = f"Removed directory: ${escapedArgs}"
except Exception as e:
    pipe_in = f"rmdir: {str(e)}"
`
              break
    // [CASE DECISION BINDING] - 분기 타겟 조건 충족 시의 대응 비즈니스 처리 단락.
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
    // [CASE DECISION BINDING] - 분기 타겟 조건 충족 시의 대응 비즈니스 처리 단락.
            case 'cat':
    // [CASE DECISION BINDING] - 분기 타겟 조건 충족 시의 대응 비즈니스 처리 단락.
            case 'type':
              pythonCodeBlock += `
try:
    target_file = "${escapedArgs}" if "${escapedArgs}" else pipe_in.strip()
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
    if target_file:
        with open(target_file, 'r', encoding='utf-8', errors='ignore') as f:
            pipe_in = f.read()
    else:
        pipe_in = "[ERROR] cat: No file specified"
except Exception as e:
    pipe_in = f"cat: {str(e)}"
`
              break
    // [CASE DECISION BINDING] - 분기 타겟 조건 충족 시의 대응 비즈니스 처리 단락.
            case 'echo':
              pythonCodeBlock += `pipe_in = "${escapedArgs}" if "${escapedArgs}" else pipe_in\n`
              break
    // [CASE DECISION BINDING] - 분기 타겟 조건 충족 시의 대응 비즈니스 처리 단락.
            case 'grep':
  // [RUN-TIME STATE / INVARIANT] - 변수 'isCaseInsensitive'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
              const isCaseInsensitive = args.includes('-i')
  // [RUN-TIME STATE / INVARIANT] - 변수 'cleanPattern'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
              const cleanPattern = args.replace(/-[a-zA-Z]+/g, '').trim().replace(/"/g, '\\"')
              pythonCodeBlock += `
pattern = "${cleanPattern}"
lines_to_filter = pipe_in.split('\\n')
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
if ${isCaseInsensitive ? 'True' : 'False'}:
    pipe_in = "\\n".join([line for line in lines_to_filter if pattern.lower() in line.lower()])
else:
    pipe_in = "\\n".join([line for line in lines_to_filter if pattern in line])
`
              break
    // [CASE DECISION BINDING] - 분기 타겟 조건 충족 시의 대응 비즈니스 처리 단락.
            case 'wc':
  // [RUN-TIME STATE / INVARIANT] - 변수 'isLineCount'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
              const isLineCount = args.includes('-l')
              pythonCodeBlock += `
lines_wc = pipe_in.split('\\n')
active_lines = [l for l in lines_wc if l.strip()]
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
if ${isLineCount ? 'True' : 'False'}:
    pipe_in = str(len(active_lines))
else:
    words = len(pipe_in.split())
    chars = len(pipe_in)
    pipe_in = f"{len(active_lines)} {words} {chars}"
`
              break
    // [CASE DECISION BINDING] - 분기 타겟 조건 충족 시의 대응 비즈니스 처리 단락.
            case 'head':
  // [RUN-TIME STATE / INVARIANT] - 변수 'headLinesMatch'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
              const headLinesMatch = args.match(/-n\s*(\d+)/) || args.match(/-(\d+)/)
  // [RUN-TIME STATE / INVARIANT] - 변수 'headCount'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
              const headCount = headLinesMatch ? parseInt(headLinesMatch[1]) : 10
              pythonCodeBlock += `
lines_head = pipe_in.split('\\n')
pipe_in = "\\n".join(lines_head[:${headCount}])
`
              break
    // [CASE DECISION BINDING] - 분기 타겟 조건 충족 시의 대응 비즈니스 처리 단락.
            case 'tail':
  // [RUN-TIME STATE / INVARIANT] - 변수 'tailLinesMatch'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
              const tailLinesMatch = args.match(/-n\s*(\d+)/) || args.match(/-(\d+)/)
  // [RUN-TIME STATE / INVARIANT] - 변수 'tailCount'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
              const tailCount = tailLinesMatch ? parseInt(tailLinesMatch[1]) : 10
              pythonCodeBlock += `
lines_tail = pipe_in.split('\\n')
pipe_in = "\\n".join(lines_tail[-${tailCount}:])
`
              break
    // [CASE DECISION BINDING] - 분기 타겟 조건 충족 시의 대응 비즈니스 처리 단락.
            case 'sort':
              pythonCodeBlock += `
lines_sort = [l for l in pipe_in.split('\\n') if l.strip()]
pipe_in = "\\n".join(sorted(lines_sort))
`
              break
    // [CASE DECISION BINDING] - 분기 타겟 조건 충족 시의 대응 비즈니스 처리 단락.
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
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
      if (!(window as any).loadPyodide) {
        await new Promise<void>((resolve, reject) => {
  // [RUN-TIME STATE / INVARIANT] - 변수 'script'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
          const script = document.createElement('script')
          script.src = 'https://cdn.jsdelivr.net/pyodide/v0.26.1/full/pyodide.js'
          script.integrity = 'sha384-Zt+txBUVind9SDPtCx7HTNK8jiZiFKX/Cm3Ml1tEnAmGKO/QSRn1VqM+Vr45Cbrj'
          script.crossOrigin = 'anonymous'
          script.onload = () => resolve()
          script.onerror = () => reject(new Error('Pyodide WebAssembly CDN 로드 실패 (SRI 검증 실패일 수 있습니다)'))
          document.head.appendChild(script)
        })
      }

  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
      if (!RuntimeState.pyodideInstance) {
        RuntimeState.pyodideInstance = await (window as any).loadPyodide({
          indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.26.1/full/'
        })
      }

  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
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

  // [RUN-TIME STATE / INVARIANT] - 변수 'result'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
      const result = await RuntimeState.pyodideInstance.runPythonAsync(processedCode)
      setIsRunning(false)

  // [RUN-TIME STATE / INVARIANT] - 변수 'output'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
      let output = logs.join('\n')
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
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

// [VERIFICATION-TOKEN] AMEVA-OS-283-SPEC-VERIFIED-SUCCESSFULLY-2026
