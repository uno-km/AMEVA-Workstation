import { useState } from 'react'
import { RuntimeState } from './runtimeState'

function getOrCreateJSWorker() {
  if (RuntimeState.persistentWorker) return RuntimeState.persistentWorker

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
  RuntimeState.persistentWorker = new Worker(URL.createObjectURL(blob))
  return RuntimeState.persistentWorker
}

export function useJSRuntime() {
  const [isRunning, setIsRunning] = useState(false)

  const runJSCode = (code: string): Promise<{ success: boolean; output: string; tableData?: any }> => {
    return new Promise((resolve) => {
      setIsRunning(true)
      const worker = getOrCreateJSWorker()

      const timeoutId = setTimeout(() => {
        worker.terminate()
        RuntimeState.persistentWorker = null
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

  return {
    isJSRunning: isRunning,
    runJSCode,
  }
}
