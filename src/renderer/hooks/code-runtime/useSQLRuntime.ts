import { useState } from 'react'
import { RuntimeState } from './runtimeState'

export function useSQLRuntime() {
  const [isRunning, setIsRunning] = useState(false)

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

      if (!RuntimeState.sqliteDatabaseInstance) {
        const config = {
          locateFile: (file: string) => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.2/${file}`
        }
        const initSqlJs = (window as any).initSqlJs
        const SQL = await initSqlJs(config)
        RuntimeState.sqliteDatabaseInstance = new SQL.Database()
      }

      const res = RuntimeState.sqliteDatabaseInstance.exec(code)
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
    isSQLRunning: isRunning,
    runSQLCode,
  }
}
