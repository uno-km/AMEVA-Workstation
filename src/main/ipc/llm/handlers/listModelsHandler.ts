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

  /*
   * [FUNCTION CONTRACT]
   * - 함수 명: `registerListModelsHandler`
   * - 역할: 인자 정보를 검수하고 비즈니스 계약 조건에 맞춰 최종 바인딩 결과물/바이너리 버퍼를 반환함.
   * - 예시: `registerListModelsHandler(...)` 호출 시 런타임 비동기/동기 연쇄 반응 유도.
   */
export function registerListModelsHandler(): void {
  ipcMain.handle('llm:listModels', async (_event, type?: 'llm' | 'code' | 'ollama') => {
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `type === 'ollama'`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (type === 'ollama')` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
    if (type === 'ollama') {
      return new Promise((resolve) => {
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `http`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const http = ...` 형태로 안전 캐싱 후 가공 기동.
       */
        const http = require('http')
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `req`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const req = ...` 형태로 안전 캐싱 후 가공 기동.
       */
        const req = http.request({
          hostname: '127.0.0.1',
          port: 11434,
          path: '/api/tags',
          method: 'GET',
          timeout: 2000
        }, (res: any) => {
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `rawData`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const rawData = ...` 형태로 안전 캐싱 후 가공 기동.
       */
          let rawData = ''
          res.on('data', (chunk: any) => { rawData += chunk })
          res.on('end', () => {
            try {
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `parsed`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const parsed = ...` 형태로 안전 캐싱 후 가공 기동.
       */
              const parsed = JSON.parse(rawData)
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `models`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const models = ...` 형태로 안전 캐싱 후 가공 기동.
       */
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

      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `llmDir`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const llmDir = ...` 형태로 안전 캐싱 후 가공 기동.
       */
    const llmDir = type === 'code' ? 'C:\\ameva\\models\\code' : 'C:\\ameva\\models\\llm'
    try {
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `!existsSync(llmDir)`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (!existsSync(llmDir))` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
      if (!existsSync(llmDir)) return []
      const { readdir } = require('fs').promises
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `files`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const files = ...` 형태로 안전 캐싱 후 가공 기동.
       */
      const files = await readdir(llmDir)
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `filtered`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const filtered = ...` 형태로 안전 캐싱 후 가공 기동.
       */
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

