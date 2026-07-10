/**
 * @file pythonIpc.ts
 * @system AMEVA OS Desktop Workstation
 * @location src/main/ipc/pythonIpc.ts
 * @role Core module helper and integration logic
 * 
 * [소비처 - CONSUMERS / USAGE CONTEXT]
 * - 소비처 A (src/main/index.ts): 일렉트론 메인 라이프사이클(ready/will-quit) 및 윈도우 생성 시점에 결합 구동.
 * - 소비처 B (src/main/preload.ts): contextBridge 안전 통로 노출을 위한 핵심 백엔드 기능 공급자로 소비.
 * 
 * [책임 범위 - RESPONSIBILITY]
 * - 본 파일은 AMEVA 시스템 내에서 도메인 목적에 부합하는 연산 및 데이터 처리 흐름을 안전하게 캡슐화한다.
 * - 외부 라이브러리 및 하위 종속성을 조율하고 결과 규격을 일관되게 제공한다.
 * 
 * [절대 깨면 안 되는 계약 - CONTRACT]
 * - MUST: 모든 예외 발생 시 에러를 침묵시키지 말고 에러 로그를 명확하게 남길 것.
 * - MUST NOT: TypeScript any 형식을 우회 수단으로 함부로 선언하지 말 것.
 */

import { ipcMain } from 'electron'

/**
 * Python/Runtime 관련 IPC 핸들러를 등록합니다.
 * [SEC-W-001] 로컬 Python 실행 IPC 제거 — Pyodide WASM으로 일원화
 */
export function registerPythonIpc(): void {
  // runtime:runPython 채널은 보안상 비활성화됨.
  // 렌더러의 useCodeRuntime.ts > runPythonCode()가 Pyodide WASM 샌드박스를 사용합니다.
  ipcMain.handle('runtime:runPython', async () => {
    return {
      success: false,
      error: '[보안 정책] 로컬 Python 직접 실행은 비활성화되었습니다. 코드 실행은 브라우저 내장 Pyodide WASM 샌드박스를 사용합니다.'
    }
  })
}

