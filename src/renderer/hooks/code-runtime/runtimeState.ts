export const RuntimeState = {
  pyodideInstance: null as any,
  persistentWorker: null as Worker | null,
  sqliteDatabaseInstance: null as any,
}

// [SEC-W-014] 외부에서 런타임 리소스를 정리할 수 있는 함수
export function cleanupCodeRuntime() {
  if (RuntimeState.persistentWorker) {
    RuntimeState.persistentWorker.terminate()
    RuntimeState.persistentWorker = null
  }
  RuntimeState.pyodideInstance = null
  RuntimeState.sqliteDatabaseInstance = null
}
