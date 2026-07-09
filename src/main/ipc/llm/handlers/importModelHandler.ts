/**
 * @file importModelHandler.ts
 * @system AMEVA OS Desktop Workstation
 * @location src/main/ipc/llm/handlers/importModelHandler.ts
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
import { join, basename } from 'path'
import { existsSync } from 'fs'

export function registerImportModelHandler(): void {
  ipcMain.handle('llm:importModel', async (_event, sourcePath: string, type?: 'llm' | 'code') => {
    const llmDir = type === 'code' ? 'C:\\ameva\\models\\code' : 'C:\\ameva\\models\\llm'
    try {
      const { copyFile, mkdir } = await import('fs/promises')
      if (!sourcePath || !existsSync(sourcePath)) {
        return { success: false, error: '선택한 파일이 존재하지 않습니다.' }
      }
      const filename = basename(sourcePath)
      if (!filename.endsWith('.gguf')) {
        return { success: false, error: '보안 정책: .gguf 파일만 추가할 수 있습니다.' }
      }
      if (!existsSync(llmDir)) {
        await mkdir(llmDir, { recursive: true })
      }
      const targetPath = join(llmDir, filename)
      await copyFile(sourcePath, targetPath)
      return { success: true, path: targetPath }
    } catch (err: any) {
      return { success: false, error: `파일 복사 실패: ${err.message}` }
    }
  })
}
