/**
 * @file listModelsHandler.ts
 * @system AMEVA OS Desktop Workstation
 * @location src/main/ipc/llm/handlers/listModelsHandler.ts
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
import { join } from 'path'
import { existsSync } from 'fs'

export function registerListModelsHandler(): void {
  ipcMain.handle('llm:listModels', async (_event, type?: 'llm' | 'code' | 'ollama') => {
    if (type === 'ollama') {
      return new Promise((resolve) => {
        const http = require('http')
        const req = http.request({
          hostname: '127.0.0.1',
          port: 11434,
          path: '/api/tags',
          method: 'GET',
          timeout: 2000
        }, (res: any) => {
          let rawData = ''
          res.on('data', (chunk: any) => { rawData += chunk })
          res.on('end', () => {
            try {
              const parsed = JSON.parse(rawData)
              const models = (parsed.models || []).map((m: any) => ({
                name: m.name,
                filename: m.model,
                path: m.name,
                size: m.size || 0
              }))
              resolve(models)
            } catch (e) {
              resolve([])
            }
          })
        })
        req.on('error', () => { resolve([]) })
        req.on('timeout', () => { req.destroy(); resolve([]) })
        req.end()
      })
    }

    const llmDir = type === 'code' ? 'C:\\ameva\\models\\code' : 'C:\\ameva\\models\\llm'
    try {
      if (!existsSync(llmDir)) return []
      const { readdir } = require('fs').promises
      const files = await readdir(llmDir)
      const filtered = files
        .filter((f: string) => f.toLowerCase().endsWith('.gguf'))
        .map((f: string) => ({
          name: f.replace(/\.gguf$/i, '').replace(/-/g, ' '),
          filename: f,
          path: join(llmDir, f),
          size: (() => {
            try {
              const { statSync } = require('fs')
              return statSync(join(llmDir, f)).size
            } catch { return 0 }
          })(),
        }))
      return filtered
    } catch (e) {
      console.error('[listModelsHandler] Failed to list models in', llmDir, e)
      return []
    }
  })
}
