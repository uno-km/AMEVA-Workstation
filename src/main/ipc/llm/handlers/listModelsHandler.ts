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
      const { readdir } = await import('fs/promises')
      if (!existsSync(llmDir)) return []
      const files = await readdir(llmDir)
      const filtered = files
        .filter(f => f.endsWith('.gguf'))
        .map(f => ({
          name: f.replace('.gguf', '').replace(/-/g, ' '),
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
    } catch {
      return []
    }
  })
}
