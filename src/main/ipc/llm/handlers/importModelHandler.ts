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

  /*
   * [FUNCTION CONTRACT]
   * - 함수 명: `registerImportModelHandler`
   * - 역할: 인자 정보를 검수하고 비즈니스 계약 조건에 맞춰 최종 바인딩 결과물/바이너리 버퍼를 반환함.
   * - 예시: `registerImportModelHandler(...)` 호출 시 런타임 비동기/동기 연쇄 반응 유도.
   */
export function registerImportModelHandler(): void {
  ipcMain.handle('llm:importModel', async (_event, sourcePath: string, type?: 'llm' | 'code') => {
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `llmDir`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const llmDir = ...` 형태로 안전 캐싱 후 가공 기동.
       */
    const llmDir = type === 'code' ? 'C:\\ameva\\models\\code' : 'C:\\ameva\\models\\llm'
    try {
      const { copyFile, mkdir } = await import('fs/promises')
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `!sourcePath || !existsSync(sourcePath)`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (!sourcePath || !existsSync(sourcePath))` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
      if (!sourcePath || !existsSync(sourcePath)) {
        return { success: false, error: '선택한 파일이 존재하지 않습니다.' }
      }
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `filename`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const filename = ...` 형태로 안전 캐싱 후 가공 기동.
       */
      const filename = basename(sourcePath)
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `!filename.endsWith('.gguf')`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (!filename.endsWith('.gguf'))` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
      if (!filename.endsWith('.gguf')) {
        return { success: false, error: '보안 정책: .gguf 파일만 추가할 수 있습니다.' }
      }
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `!existsSync(llmDir)`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (!existsSync(llmDir))` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
      if (!existsSync(llmDir)) {
        await mkdir(llmDir, { recursive: true })
      }
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `targetPath`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const targetPath = ...` 형태로 안전 캐싱 후 가공 기동.
       */
      const targetPath = join(llmDir, filename)
      await copyFile(sourcePath, targetPath)
      return { success: true, path: targetPath }
    } catch (err: any) {
      return { success: false, error: `파일 복사 실패: ${err.message}` }
    }
  })
}

