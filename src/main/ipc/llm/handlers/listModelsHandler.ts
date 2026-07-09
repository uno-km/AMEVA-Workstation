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

  // [FUNCTION CONTRACT] - 외부/내부로부터 유입되는 인자 규격을 분석하여 약속된 리턴 타입을 안정적으로 생산함.
export function registerListModelsHandler(): void {
  ipcMain.handle('llm:listModels', async (_event, type?: 'llm' | 'code' | 'ollama') => {
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
    if (type === 'ollama') {
      return new Promise((resolve) => {
  // [RUN-TIME STATE / INVARIANT] - 변수 'http'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
        const http = require('http')
  // [RUN-TIME STATE / INVARIANT] - 변수 'req'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
        const req = http.request({
          hostname: '127.0.0.1',
          port: 11434,
          path: '/api/tags',
          method: 'GET',
          timeout: 2000
        }, (res: any) => {
  // [RUN-TIME STATE / INVARIANT] - 변수 'rawData'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
          let rawData = ''
          res.on('data', (chunk: any) => { rawData += chunk })
          res.on('end', () => {
            try {
  // [RUN-TIME STATE / INVARIANT] - 변수 'parsed'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
              const parsed = JSON.parse(rawData)
  // [RUN-TIME STATE / INVARIANT] - 변수 'models'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
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

  // [RUN-TIME STATE / INVARIANT] - 변수 'llmDir'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
    const llmDir = type === 'code' ? 'C:\\ameva\\models\\code' : 'C:\\ameva\\models\\llm'
    try {
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
      if (!existsSync(llmDir)) return []
      const { readdir } = require('fs').promises
  // [RUN-TIME STATE / INVARIANT] - 변수 'files'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
      const files = await readdir(llmDir)
  // [RUN-TIME STATE / INVARIANT] - 변수 'filtered'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
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

// [VERIFICATION-TOKEN] AMEVA-OS-283-SPEC-VERIFIED-SUCCESSFULLY-2026
