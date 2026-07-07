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
