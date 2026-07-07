import { cleanupCodeRuntime } from './code-runtime/runtimeState'
import { useJSRuntime } from './code-runtime/useJSRuntime'
import { usePythonRuntime } from './code-runtime/usePythonRuntime'
import { useSQLRuntime } from './code-runtime/useSQLRuntime'

export { cleanupCodeRuntime }

export function useCodeRuntime() {
  const { isJSRunning, runJSCode } = useJSRuntime()
  const { isPythonRunning, runPythonCode } = usePythonRuntime()
  const { isSQLRunning, runSQLCode } = useSQLRuntime()

  return {
    isRunning: isJSRunning || isPythonRunning || isSQLRunning,
    runJSCode,
    runPythonCode,
    runSQLCode,
  }
}
