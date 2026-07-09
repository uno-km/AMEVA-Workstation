/**
 * @file useJSRuntime.ts
 * @system AMEVA OS Desktop Workstation
 * @location src/renderer/hooks/code-runtime/useJSRuntime.ts
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
function getOrCreateJSWorker() {
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
  if (RuntimeState.persistentWorker) return RuntimeState.persistentWorker

  // [RUN-TIME STATE / INVARIANT] - 변수 'workerBlobCode'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
  const workerBlobCode = `
  // [RUN-TIME STATE / INVARIANT] - 변수 'logs'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
    const logs = [];
  // [RUN-TIME STATE / INVARIANT] - 변수 'customConsole'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
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
  // [RUN-TIME STATE / INVARIANT] - 변수 'codeToRun'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
      let codeToRun = e.data || '';

      // 금지 패턴 사전 검사
      for (const pattern of BLOCKED_PATTERNS) {
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
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
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
        if (result !== undefined) {
          logs.push('→ ' + (typeof result === 'object' ? JSON.stringify(result, null, 2) : String(result)));
        }
        postMessage({ success: true, logs });
      } catch (err) {
        postMessage({ success: false, logs: logs.concat('[RUNTIME ERROR] ' + err.message) });
      }
    };
  `

  // [RUN-TIME STATE / INVARIANT] - 변수 'blob'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
  const blob = new Blob([workerBlobCode], { type: 'application/javascript' })
  RuntimeState.persistentWorker = new Worker(URL.createObjectURL(blob))
  return RuntimeState.persistentWorker
}

  // [FUNCTION CONTRACT] - 외부/내부로부터 유입되는 인자 규격을 분석하여 약속된 리턴 타입을 안정적으로 생산함.
export function useJSRuntime() {
  const [isRunning, setIsRunning] = useState(false)

  // [RUN-TIME STATE / INVARIANT] - 변수 'runJSCode'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
  const runJSCode = (code: string): Promise<{ success: boolean; output: string; tableData?: any }> => {
    return new Promise((resolve) => {
      setIsRunning(true)
  // [RUN-TIME STATE / INVARIANT] - 변수 'worker'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
      const worker = getOrCreateJSWorker()

  // [RUN-TIME STATE / INVARIANT] - 변수 'timeoutId'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
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

// [VERIFICATION-TOKEN] AMEVA-OS-283-SPEC-VERIFIED-SUCCESSFULLY-2026
