/**
 * @file fileIpc.ts
 * @system AMEVA OS Desktop Workstation
 * @location src/main/ipc/fileIpc.ts
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

import { app, BrowserWindow, ipcMain, dialog, shell, net, safeStorage } from 'electron'
import { join, resolve as resolvePath, dirname, isAbsolute } from 'path'
import { existsSync, writeFileSync, readFileSync } from 'fs'
import { readFile, writeFile, mkdir } from 'fs/promises'
import { exec } from 'child_process'
import { promisify } from 'util'

const execPromise = promisify(exec)
import { createRequire } from 'module'
import * as exportersMain from '../exportersMain.js'
import { CollabServerManager } from '../services/collabServer.js'
import { getProPlanMemory } from '../services/planState.js'
import { fetchHtmlMetadata } from '../services/htmlScraper.js'
import { WindowDefenseManager } from '../services/windowDefenseManager.js'
import { renderMermaidToBuffer } from '../services/mermaidCompiler.js'

      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `require`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const require = ...` 형태로 안전 캐싱 후 가공 기동.
       */
const require = createRequire(import.meta.url)
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `pdfModule`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const pdfModule = ...` 형태로 안전 캐싱 후 가공 기동.
       */
const pdfModule = require('pdf-parse')
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `pdf`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const pdf = ...` 형태로 안전 캐싱 후 가공 기동.
       */
const pdf = typeof pdfModule === 'function' ? pdfModule : (pdfModule.default || pdfModule)

      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `credentialsPath`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const credentialsPath = ...` 형태로 안전 캐싱 후 가공 기동.
       */
const credentialsPath = join(app.getPath('userData'), 'credentials.json')

// [SEC-W-005] openExternal 프로토콜 화이트리스트 — 임의 프로토콜 핸들러 실행 차단
const ALLOWED_EXTERNAL_PROTOCOLS = ['http:', 'https:', 'mailto:']

  /*
   * [FUNCTION CONTRACT]
   * - 함수 명: `getActiveWindow`
   * - 역할: 인자 정보를 검수하고 비즈니스 계약 조건에 맞춰 최종 바인딩 결과물/바이너리 버퍼를 반환함.
   * - 예시: `getActiveWindow(...)` 호출 시 런타임 비동기/동기 연쇄 반응 유도.
   */
function getActiveWindow(event: any, getMainWindow: () => BrowserWindow | null): BrowserWindow | null {
  return BrowserWindow.fromWebContents(event.sender) || getMainWindow()
}

/**
 * 파일, 다이얼로그, 윈도우, 내보내기, 협업 서버, 키체인, URL 메타데이터 관련 IPC 핸들러 등록
 */
export function registerFileIpc(
  getMainWindow: () => BrowserWindow | null,
  createWindow: () => void
): void {
  // IPC 핸들러 - 파일 관리
  ipcMain.handle('dialog:openFile', async (event) => {
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `result`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const result = ...` 형태로 안전 캐싱 후 가공 기동.
       */
    const result = await dialog.showOpenDialog(getActiveWindow(event, getMainWindow)!, {
      properties: ['openFile'],
      filters: [
        { name: 'All Supported Documents', extensions: ['md', 'markdown', 'txt', 'docx', 'pdf', 'hwpx', 'xlsx', 'xls', 'ipynb', 'adc'] },
        { name: 'Markdown Document', extensions: ['md', 'markdown'] },
        { name: 'Plain Text', extensions: ['txt'] },
        { name: 'Word Document', extensions: ['docx'] },
        { name: 'PDF Document', extensions: ['pdf'] },
        { name: 'HWPX Document', extensions: ['hwpx'] },
        { name: 'Excel Sheet', extensions: ['xlsx', 'xls'] },
        { name: 'Jupyter Notebook', extensions: ['ipynb'] },
      ],
    })
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `result.canceled || result.filePaths.length === 0`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (result.canceled || result.filePaths.length === 0)` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
    if (result.canceled || result.filePaths.length === 0) return null
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `filePath`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const filePath = ...` 형태로 안전 캐싱 후 가공 기동.
       */
    const filePath = result.filePaths[0]
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `ext`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const ext = ...` 형태로 안전 캐싱 후 가공 기동.
       */
    const ext = filePath.split('.').pop()?.toLowerCase() || ''
    
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `isBinary`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const isBinary = ...` 형태로 안전 캐싱 후 가공 기동.
       */
    const isBinary = ['docx', 'pdf', 'hwpx', 'xlsx', 'xls', 'adc'].includes(ext)
    let content: string
    
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `ext === 'pdf'`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (ext === 'pdf')` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
    if (ext === 'pdf') {
      try {
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `buffer`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const buffer = ...` 형태로 안전 캐싱 후 가공 기동.
       */
        const buffer = await readFile(filePath)
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `data`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const data = ...` 형태로 안전 캐싱 후 가공 기동.
       */
        const data = await pdf(buffer)
        content = data.text || ''
      } catch (err: any) {
        content = `Error parsing PDF: ${err.message}`
      }
    } else if (isBinary) {
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `buffer`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const buffer = ...` 형태로 안전 캐싱 후 가공 기동.
       */
      const buffer = await readFile(filePath)
      content = buffer.toString('base64')
    } else {
      content = await readFile(filePath, 'utf-8')
    }
    
    return { content, filePath, isBinary }
  })

  // 지정 경로 파일 직접 읽기 지원 API (모노레포 플랫폼 통합용)
  ipcMain.handle('file:readFromPath', async (_event, targetPath: string) => {
    try {
      const ext = targetPath.split('.').pop()?.toLowerCase() || ''
      const isBinary = ['docx', 'pdf', 'hwpx', 'xlsx', 'xls', 'adc'].includes(ext)
      let content: string
      if (ext === 'adc' || isBinary) {
        const buffer = await readFile(targetPath)
        content = buffer.toString('base64')
      } else {
        content = await readFile(targetPath, 'utf-8')
      }
      return { content, success: true, isBinary }
    } catch (err: any) {
      console.error('[file:readFromPath] 직접 읽기 실패:', err)
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('dialog:showMessageBox', async (event, options) => {
    return await dialog.showMessageBox(getActiveWindow(event, getMainWindow)!, options)
  })

  ipcMain.handle('dialog:selectLocalFile', async (event, filters?: any[]) => {
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `result`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const result = ...` 형태로 안전 캐싱 후 가공 기동.
       */
    const result = await dialog.showOpenDialog(getActiveWindow(event, getMainWindow)!, {
      properties: ['openFile'],
      filters: filters || [{ name: 'All Files', extensions: ['*'] }],
    })
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `result.canceled || result.filePaths.length === 0`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (result.canceled || result.filePaths.length === 0)` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
    if (result.canceled || result.filePaths.length === 0) return null
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `filePath`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const filePath = ...` 형태로 안전 캐싱 후 가공 기동.
       */
    const filePath = result.filePaths[0]
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `buffer`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const buffer = ...` 형태로 안전 캐싱 후 가공 기동.
       */
    const buffer = await readFile(filePath)
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `base64`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const base64 = ...` 형태로 안전 캐싱 후 가공 기동.
       */
    const base64 = buffer.toString('base64')
    return { filePath, base64 }
  })

  ipcMain.handle('dialog:saveFile', async (event, content: string, filePath?: string, isSaveAs?: boolean) => {
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `targetPath`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const targetPath = ...` 형태로 안전 캐싱 후 가공 기동.
       */
    let targetPath = filePath
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `!targetPath || isSaveAs`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (!targetPath || isSaveAs)` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
    if (!targetPath || isSaveAs) {
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `result`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const result = ...` 형태로 안전 캐싱 후 가공 기동.
       */
      const result = await dialog.showSaveDialog(getActiveWindow(event, getMainWindow)!, {
        title: 'Save Document',
        defaultPath: filePath,
        filters: [
          { name: 'All Supported Documents', extensions: ['md', 'markdown', 'txt', 'docx', 'pdf', 'hwpx', 'xlsx', 'ipynb', 'adc'] },
          { name: 'Markdown Document', extensions: ['md'] },
          { name: 'Plain Text', extensions: ['txt'] },
          { name: 'Word Document', extensions: ['docx'] },
          { name: 'PDF Document', extensions: ['pdf'] },
          { name: 'HWPX Document', extensions: ['hwpx'] },
          { name: 'Excel Sheet', extensions: ['xlsx'] },
          { name: 'Jupyter Notebook', extensions: ['ipynb'] },
        ],
      })
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `result.canceled || !result.filePath`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (result.canceled || !result.filePath)` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
      if (result.canceled || !result.filePath) return { success: false }
      targetPath = result.filePath
    }
    
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `ext`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const ext = ...` 형태로 안전 캐싱 후 가공 기동.
       */
    const ext = targetPath.split('.').pop()?.toLowerCase() || ''
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `isBinarySave`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const isBinarySave = ...` 형태로 안전 캐싱 후 가공 기동.
       */
    const isBinarySave = ['docx', 'pdf', 'hwpx', 'xlsx', 'xls', 'adc'].includes(ext)
    
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `isBinarySave`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (isBinarySave)` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
    if (isBinarySave) {
      await writeFile(targetPath, Buffer.from(content, 'base64'))
    } else {
      await writeFile(targetPath, content, 'utf-8')
    }
    
    return { success: true, filePath: targetPath }
  })

  ipcMain.handle('dialog:saveExportedFile', async (event, data: string, isBase64: boolean, defaultName: string, filters: any[]) => {
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `result`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const result = ...` 형태로 안전 캐싱 후 가공 기동.
       */
    const result = await dialog.showSaveDialog(getActiveWindow(event, getMainWindow)!, {
      title: 'Export File',
      defaultPath: defaultName,
      filters: filters,
    })
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `result.canceled || !result.filePath`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (result.canceled || !result.filePath)` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
    if (result.canceled || !result.filePath) return null
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `isBase64`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (isBase64)` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
    if (isBase64) {
      await writeFile(result.filePath, Buffer.from(data, 'base64'))
    } else {
      await writeFile(result.filePath, data, 'utf-8')
    }
    return result.filePath
  })

  // IPC 핸들러 - PDF 변환 (Chrome Headless)
  ipcMain.handle('action:printToPDF', async (_event, htmlContent: string) => {
    // [SEC-W-012] sandbox: true + javascript: false 로 임의 HTML 렌더링 격리
    const printWindow = new BrowserWindow({
      show: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
        javascript: false,  // PDF 출력 전용 — JS 실행 불필요
      },
    })
    await printWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`)
    await new Promise((resolve) => setTimeout(resolve, 800))
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `pdfData`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const pdfData = ...` 형태로 안전 캐싱 후 가공 기동.
       */
    const pdfData = await printWindow.webContents.printToPDF({
      margins: { top: 1, bottom: 1, left: 1, right: 1 },
      pageSize: 'A4',
      printBackground: true,
    })
    printWindow.close()
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `saveResult`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const saveResult = ...` 형태로 안전 캐싱 후 가공 기동.
       */
    const saveResult = await dialog.showSaveDialog(getMainWindow()!, {
      title: 'Save PDF File',
      defaultPath: 'document.pdf',
      filters: [{ name: 'PDF Document', extensions: ['pdf'] }],
    })
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `saveResult.canceled || !saveResult.filePath`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (saveResult.canceled || !saveResult.filePath)` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
    if (saveResult.canceled || !saveResult.filePath) return null
    await writeFile(saveResult.filePath, pdfData)
    return saveResult.filePath
  })

  // IPC 핸들러 - 웹 실시간 검색 (CORS 우회 통로)
  ipcMain.handle('action:webSearch', async (_event, query: string) => {
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `!getProPlanMemory()`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (!getProPlanMemory())` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
    if (!getProPlanMemory()) {
      return { success: false, error: '무료 요금제에서는 실시간 웹 검색 기능을 사용할 수 없습니다. Pro 요금제로 업그레이드하세요.' }
    }
    try {
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `res`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const res = ...` 형태로 안전 캐싱 후 가공 기동.
       */
      const res = await net.fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      })
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `!res.ok`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (!res.ok)` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
      if (!res.ok) {
        throw new Error(`DuckDuckGo 응답 오류: ${res.status}`)
      }
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `html`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const html = ...` 형태로 안전 캐싱 후 가공 기동.
       */
      const html = await res.text()
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `matches`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const matches = ...` 형태로 안전 캐싱 후 가공 기동.
       */
      const matches = html.match(/<a class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g) || []
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `snippets`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const snippets = ...` 형태로 안전 캐싱 후 가공 기동.
       */
      const snippets = matches
        .slice(0, 3)
        .map(m => m.replace(/<[^>]*>/g, '').trim())
        .join('\n\n')

      return { success: true, result: snippets }
    } catch (e: any) {
      return { success: false, error: e.message }
    }
  })

  ipcMain.handle('server:start', async (event, port: number) => {
    return await CollabServerManager.startServer(port, (status) => {
      event.sender.send('server:status', status)
    })
  })

  ipcMain.handle('server:stop', (event) => {
    return CollabServerManager.stopServer((status) => {
      event.sender.send('server:status', status)
    })
  })

  // 줌 레벨 조정
  ipcMain.on('window:setZoom', (event, level: number) => {
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `win`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const win = ...` 형태로 안전 캐싱 후 가공 기동.
       */
    const win = getActiveWindow(event, getMainWindow)
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `win) win.webContents.setZoomLevel(level`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (win) win.webContents.setZoomLevel(level)` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
    if (win) win.webContents.setZoomLevel(level)
  })

  ipcMain.handle('window:getZoom', async (event) => {
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `win`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const win = ...` 형태로 안전 캐싱 후 가공 기동.
       */
    const win = getActiveWindow(event, getMainWindow)
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `win) return win.webContents.getZoomLevel(`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (win) return win.webContents.getZoomLevel()` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
    if (win) return win.webContents.getZoomLevel()
    return 0
  })

  ipcMain.on('window:setZoomFactor', (event, factor: number) => {
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `win`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const win = ...` 형태로 안전 캐싱 후 가공 기동.
       */
    const win = getActiveWindow(event, getMainWindow)
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `win) win.webContents.setZoomFactor(factor`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (win) win.webContents.setZoomFactor(factor)` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
    if (win) win.webContents.setZoomFactor(factor)
  })

  ipcMain.handle('window:getZoomFactor', async (event) => {
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `win`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const win = ...` 형태로 안전 캐싱 후 가공 기동.
       */
    const win = getActiveWindow(event, getMainWindow)
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `win) return win.webContents.getZoomFactor(`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (win) return win.webContents.getZoomFactor()` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
    if (win) return win.webContents.getZoomFactor()
    return 1.0
  })

  ipcMain.on('window:new-window', () => {
    createWindow()
  })

  ipcMain.on('action:openExternal', (_event, url: string) => {
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `url.startsWith('file:///')`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (url.startsWith('file:///'))` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
    if (url.startsWith('file:///')) {
      try {
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `decoded`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const decoded = ...` 형태로 안전 캐싱 후 가공 기동.
       */
        const decoded = decodeURIComponent(url.slice('file:///'.length))
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `normalized`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const normalized = ...` 형태로 안전 캐싱 후 가공 기동.
       */
        const normalized = resolvePath(decoded.replace(/\//g, '\\'))
        shell.showItemInFolder(normalized)
      } catch {
        console.warn('[Security] Invalid file:// URL for showItemInFolder')
      }
      return
    }

    try {
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `parsed`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const parsed = ...` 형태로 안전 캐싱 후 가공 기동.
       */
      const parsed = new URL(url)
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `!ALLOWED_EXTERNAL_PROTOCOLS.includes(parsed.protocol)`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (!ALLOWED_EXTERNAL_PROTOCOLS.includes(parsed.protocol))` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
      if (!ALLOWED_EXTERNAL_PROTOCOLS.includes(parsed.protocol)) {
        console.warn(`[Security] Blocked openExternal with disallowed protocol: ${parsed.protocol}`)
        return
      }
      shell.openExternal(url)
    } catch {
      console.warn(`[Security] Invalid URL for openExternal: ${url}`)
    }
  })

  ipcMain.on('export:showInFolder', (_event, filePath: string) => {
    shell.showItemInFolder(filePath)
  })

  ipcMain.handle('export:convert', async (event, payload: {
    blocks: any[]
    format: string
    defaultName: string
  }) => {
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `win`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const win = ...` 형태로 안전 캐싱 후 가공 기동.
       */
    const win = getActiveWindow(event, getMainWindow)
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `!win`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (!win)` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
    if (!win) return { success: false, error: '활성화된 윈도우가 없습니다.' }

    const extensionsMap: Record<string, string[]> = {
      html: ['html', 'htm'],
      docx: ['docx'],
      xlsx: ['xlsx'],
      pptx: ['pptx'],
      hwpx: ['hwpx'],
      xml: ['xml']
    }

      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `filters`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const filters = ...` 형태로 안전 캐싱 후 가공 기동.
       */
    const filters = [
      {
        name: `${payload.format.toUpperCase()} Document`,
        extensions: extensionsMap[payload.format] || [payload.format]
      }
    ]

    const { canceled, filePath } = await dialog.showSaveDialog(win, {
      title: `${payload.format.toUpperCase()} 파일 저장 위치 선택`,
      defaultPath: payload.defaultName,
      filters
    })

      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `canceled || !filePath`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (canceled || !filePath)` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
    if (canceled || !filePath) {
      return { success: false, error: '저장이 취소되었습니다.' }
    }

    try {
      let outputBuffer: Buffer | string

      // 특수 블록 내보내기 전처리 로직 (Mermaid 렌더링 및 ameva-* 가상 블록 복원)
      const preprocessBlocksForExport = async (blocks: any[]) => {
        for (const block of blocks) {
          if (block.type === 'codeBlock') {
            const lang = block.props?.language;
            if (lang === 'mermaid') {
              try {
                let code = ''
                if (Array.isArray(block.content)) {
                  code = block.content.map((c: any) => c.text || '').join('')
                } else if (typeof block.content === 'string') {
                  code = block.content
                }
                if (code.trim()) {
                  const buffer = await renderMermaidToBuffer(code.trim())
                  block.type = 'image'
                  block.props = {
                    url: `data:image/png;base64,${buffer.toString('base64')}`,
                    caption: 'Mermaid Diagram'
                  }
                  block.content = [] 
                }
              } catch (err) {
                console.error('[export:convert] Failed to render mermaid', err)
              }
            } else if (lang === 'ameva-map') {
              if (payload.format === 'html') {
                // htmlExporter에서 가상 코드블록을 자체 파싱하므로 유지
              } else if (payload.format === 'xml') {
                block.type = 'map';
                try { block.props = JSON.parse(Array.isArray(block.content) ? block.content.map((c: any) => c.text || '').join('') : block.content); } catch(e) {}
                block.content = [];
              } else {
                try {
                  const data = JSON.parse(Array.isArray(block.content) ? block.content.map((c: any) => c.text || '').join('') : block.content);
                  block.type = 'paragraph';
                  block.props = {};
                  block.content = [{ type: 'text', text: `[📍 지도: ${data.locationName || '위치 지정됨'} (위도: ${data.lat}, 경도: ${data.lng})]` }];
                } catch(e) {}
              }
            } else if (lang === 'ameva-youtube') {
              if (payload.format === 'html') {
                // 유지
              } else if (payload.format === 'xml') {
                block.type = 'youtube';
                try { block.props = JSON.parse(Array.isArray(block.content) ? block.content.map((c: any) => c.text || '').join('') : block.content); } catch(e) {}
                block.content = [];
              } else {
                try {
                  const data = JSON.parse(Array.isArray(block.content) ? block.content.map((c: any) => c.text || '').join('') : block.content);
                  block.type = 'paragraph';
                  block.props = {};
                  block.content = [{ type: 'text', text: `[📺 YouTube 영상: ${data.title} - ${data.url}]` }];
                } catch(e) {}
              }
            } else if (lang === 'ameva-link') {
              if (payload.format === 'html') {
                // 유지
              } else if (payload.format === 'xml') {
                block.type = 'linkPreview';
                try { block.props = JSON.parse(Array.isArray(block.content) ? block.content.map((c: any) => c.text || '').join('') : block.content); } catch(e) {}
                block.content = [];
              } else {
                try {
                  const data = JSON.parse(Array.isArray(block.content) ? block.content.map((c: any) => c.text || '').join('') : block.content);
                  block.type = 'paragraph';
                  block.props = {};
                  block.content = [{ type: 'text', text: `[🔗 링크: ${data.title} - ${data.url}]` }];
                } catch(e) {}
              }
            } else if (lang === 'ameva-presentation') {
              if (payload.format === 'html') {
                // 유지
              } else if (payload.format === 'xml') {
                block.type = 'presentation';
                try { block.props = JSON.parse(Array.isArray(block.content) ? block.content.map((c: any) => c.text || '').join('') : block.content); } catch(e) {}
                block.content = [];
              } else {
                block.type = 'paragraph';
                block.props = {};
                block.content = [{ type: 'text', text: `[📊 프레젠테이션 자료 첨부됨]` }];
              }
            }
          }
          if (block.children && Array.isArray(block.children)) {
            await preprocessBlocksForExport(block.children)
          }
        }
      }
      
      await preprocessBlocksForExport(payload.blocks)

      /*
       * [SWITCH ROUTING CASE]
       * - 라우팅 키: `switch (payload.format) {`
       * - 예상 시나리오: 유입된 상태 변수 분기값과 일치하는 케이스 블록으로 런타임 제어를 즉시 라우팅함.
       * - 예시: `switch (format)` 분기 시 매치되는 변환 포맷 서브 모듈이 가동됨.
       */
      switch (payload.format) {
    /*
     * [CASE ROUTING DECISION BINDING]
     * - 분기 타겟: `case 'html':`
     * - 만족 시: 본 케이스 전용 연산을 이행하고 break/return을 거쳐 스위치 게이트를 마감함.
     * - 예시: `case 'html':` 만족 시 해당 포맷 바이너리 빌더 호출.
     */
        case 'html':
          outputBuffer = exportersMain.blocksToHTML(payload.blocks)
          await writeFile(filePath, outputBuffer, 'utf-8')
          break
    /*
     * [CASE ROUTING DECISION BINDING]
     * - 분기 타겟: `case 'docx':`
     * - 만족 시: 본 케이스 전용 연산을 이행하고 break/return을 거쳐 스위치 게이트를 마감함.
     * - 예시: `case 'docx':` 만족 시 해당 포맷 바이너리 빌더 호출.
     */
        case 'docx':
          outputBuffer = await exportersMain.exportToWord(payload.blocks)
          await writeFile(filePath, outputBuffer)
          break
    /*
     * [CASE ROUTING DECISION BINDING]
     * - 분기 타겟: `case 'xlsx':`
     * - 만족 시: 본 케이스 전용 연산을 이행하고 break/return을 거쳐 스위치 게이트를 마감함.
     * - 예시: `case 'xlsx':` 만족 시 해당 포맷 바이너리 빌더 호출.
     */
        case 'xlsx':
          outputBuffer = await exportersMain.exportToExcel(payload.blocks)
          await writeFile(filePath, outputBuffer)
          break
    /*
     * [CASE ROUTING DECISION BINDING]
     * - 분기 타겟: `case 'pptx':`
     * - 만족 시: 본 케이스 전용 연산을 이행하고 break/return을 거쳐 스위치 게이트를 마감함.
     * - 예시: `case 'pptx':` 만족 시 해당 포맷 바이너리 빌더 호출.
     */
        case 'pptx':
          outputBuffer = await exportersMain.exportToPPTX(payload.blocks)
          await writeFile(filePath, outputBuffer)
          break
    /*
     * [CASE ROUTING DECISION BINDING]
     * - 분기 타겟: `case 'hwpx':`
     * - 만족 시: 본 케이스 전용 연산을 이행하고 break/return을 거쳐 스위치 게이트를 마감함.
     * - 예시: `case 'hwpx':` 만족 시 해당 포맷 바이너리 빌더 호출.
     */
        case 'hwpx':
          outputBuffer = await exportersMain.exportToHWPX(payload.blocks)
          await writeFile(filePath, outputBuffer)
          break
    /*
     * [CASE ROUTING DECISION BINDING]
     * - 분기 타겟: `case 'xml':`
     * - 만족 시: 본 케이스 전용 연산을 이행하고 break/return을 거쳐 스위치 게이트를 마감함.
     * - 예시: `case 'xml':` 만족 시 해당 포맷 바이너리 빌더 호출.
     */
        case 'xml':
          outputBuffer = exportersMain.exportToXML(payload.blocks)
          await writeFile(filePath, outputBuffer, 'utf-8')
          break
    /*
     * [CASE ROUTING DECISION BINDING]
     * - 분기 타겟: `default:`
     * - 만족 시: 본 케이스 전용 연산을 이행하고 break/return을 거쳐 스위치 게이트를 마감함.
     * - 예시: `default:` 만족 시 해당 포맷 바이너리 빌더 호출.
     */
        default:
          throw new Error(`지원하지 않는 변환 포맷입니다: ${payload.format}`)
      }

      return { success: true, savedPath: filePath }
    } catch (err: any) {
      console.error(`[export:convert] Failed:`, err)
      return { success: false, error: err.message }
    }
  })

  ipcMain.on('window:close', (event) => {
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `win`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const win = ...` 형태로 안전 캐싱 후 가공 기동.
       */
    const win = getActiveWindow(event, getMainWindow)
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `win) win.close(`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (win) win.close()` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
    if (win) win.close()
  })

  ipcMain.on('window:force-close', (event) => {
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `win`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const win = ...` 형태로 안전 캐싱 후 가공 기동.
       */
    const win = getActiveWindow(event, getMainWindow)
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `win`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (win)` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
    if (win) {
      WindowDefenseManager.forceQuit(win)
    }
  })

  ipcMain.handle('keychain:set', async (_event, key: string, value: string) => {
    try {
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `!safeStorage.isEncryptionAvailable()`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (!safeStorage.isEncryptionAvailable())` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
      if (!safeStorage.isEncryptionAvailable()) {
        return { success: false, error: 'OS 암호화 스토리지를 사용할 수 없는 환경입니다.' }
      }
      let data: Record<string, string> = {}
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `existsSync(credentialsPath)`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (existsSync(credentialsPath))` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
      if (existsSync(credentialsPath)) {
        try {
          data = JSON.parse(readFileSync(credentialsPath, 'utf8'))
        } catch {
          data = {}
        }
      }
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `encrypted`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const encrypted = ...` 형태로 안전 캐싱 후 가공 기동.
       */
      const encrypted = safeStorage.encryptString(value)
      data[key] = encrypted.toString('base64')
      writeFileSync(credentialsPath, JSON.stringify(data), 'utf8')
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('keychain:get', async (_event, key: string) => {
    try {
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `!existsSync(credentialsPath)`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (!existsSync(credentialsPath))` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
      if (!existsSync(credentialsPath)) return null
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `!safeStorage.isEncryptionAvailable()`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (!safeStorage.isEncryptionAvailable())` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
      if (!safeStorage.isEncryptionAvailable()) return null
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `data`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const data = ...` 형태로 안전 캐싱 후 가공 기동.
       */
      const data = JSON.parse(readFileSync(credentialsPath, 'utf8'))
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `encryptedBase64`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const encryptedBase64 = ...` 형태로 안전 캐싱 후 가공 기동.
       */
      const encryptedBase64 = data[key]
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `!encryptedBase64`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (!encryptedBase64)` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
      if (!encryptedBase64) return null
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `buffer`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const buffer = ...` 형태로 안전 캐싱 후 가공 기동.
       */
      const buffer = Buffer.from(encryptedBase64, 'base64')
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `decrypted`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const decrypted = ...` 형태로 안전 캐싱 후 가공 기동.
       */
      const decrypted = safeStorage.decryptString(buffer)
      return decrypted
    } catch {
      return null
    }
  })

  ipcMain.handle('keychain:delete', async (_event, key: string) => {
    try {
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `!existsSync(credentialsPath)`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (!existsSync(credentialsPath))` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
      if (!existsSync(credentialsPath)) return { success: true }
      let data: Record<string, string> = {}
      try {
        data = JSON.parse(readFileSync(credentialsPath, 'utf8'))
      } catch {
        data = {}
      }
      delete data[key]
      writeFileSync(credentialsPath, JSON.stringify(data), 'utf8')
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('action:fetchUrlMetadata', async (_event, targetUrl: string) => {
    return fetchHtmlMetadata(targetUrl)
  })

  // [FEAT-PPTX-COMPILER] PPTX 파일을 백엔드 파이썬 서비스를 이용해 슬라이드 PNG 시퀀스로 변환하는 IPC 핸들러
  ipcMain.handle('pptx:process', async (_event, pptxPath: string) => {
    try {
      const tempId = Math.random().toString(36).substring(2, 10)
      const outputDir = join(app.getPath('userData'), 'temp', 'pptx_slides', tempId)
      
      // 개발 환경 및 패키징 환경 모두를 고려한 python 스크립트 경로 획득
      let scriptPath = join(app.getAppPath(), 'dist', 'main', 'services', 'pptxCompiler.py')
      if (!existsSync(scriptPath)) {
        scriptPath = join(app.getAppPath(), 'packages', 'desktop', 'src', 'main', 'services', 'pptxCompiler.py')
      }
      if (!existsSync(scriptPath)) {
        scriptPath = join(app.getAppPath(), 'src', 'main', 'services', 'pptxCompiler.py')
      }

      const cmd = `py "${scriptPath}" "${pptxPath}" "${outputDir}"`
      console.log(`[pptx:process] 실행 명령: ${cmd}`)

      const { stdout, stderr } = await execPromise(cmd, { encoding: 'utf-8' })
      if (stderr) {
        console.warn(`[pptx:process] stderr 경고: ${stderr}`)
      }

      const result = JSON.parse(stdout.trim())
      return { success: true, ...result }
    } catch (err: any) {
      console.error('[pptx:process] 오류 발생:', err)
      return { success: false, error: err.message }
    }
  })

  // [FEAT-BINARY-IO] 대용량 미디어를 .adc로 묶거나 복원할 때 바이너리 데이터를 안전하게 교환하기 위한 읽기 API
  ipcMain.handle('file:readBinary', async (_event, targetPath: string) => {
    try {
      const buffer = await readFile(targetPath)
      const base64 = buffer.toString('base64')
      return { success: true, content: base64 }
    } catch (err: any) {
      console.error('[file:readBinary] 직접 읽기 실패:', err)
      return { success: false, error: err.message }
    }
  })

  // [FEAT-BINARY-IO] 대용량 미디어를 .adc로 묶거나 복원할 때 바이너리 데이터를 안전하게 교환하기 위한 쓰기 API
  ipcMain.handle('file:writeBinary', async (_event, targetPath: string, base64Content: string) => {
    try {
      let finalPath = targetPath
      if (!isAbsolute(targetPath)) {
        finalPath = join(app.getPath('userData'), 'temp', targetPath)
      }
      const dir = dirname(finalPath)
      if (!existsSync(dir)) {
        await mkdir(dir, { recursive: true })
      }
      const buffer = Buffer.from(base64Content, 'base64')
      await writeFile(finalPath, buffer)
      return { success: true, path: finalPath.replace(/\\/g, '/') }
    } catch (err: any) {
      console.error('[file:writeBinary] 직접 쓰기 실패:', err)
      return { success: false, error: err.message }
    }
  })
}

