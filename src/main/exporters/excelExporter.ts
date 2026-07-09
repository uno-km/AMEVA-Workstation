/**
 * @file excelExporter.ts
 * @system AMEVA OS Desktop Workstation
 * @location src/main/exporters/excelExporter.ts
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

import { createRequire } from 'module'
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
       * - 변수 명: `ExcelJS`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const ExcelJS = ...` 형태로 안전 캐싱 후 가공 기동.
       */
const ExcelJS = require('exceljs')
import { getPlainTextFromNormalized, inlineToText, type ExporterBlock, type ExporterInlineContent, type ExporterTableRow } from './exportersHelper.js'

export async function exportToExcel(blocks: ExporterBlock[], sourceFileName?: string): Promise<Buffer> {
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `wb`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const wb = ...` 형태로 안전 캐싱 후 가공 기동.
       */
  const wb = new ExcelJS.Workbook()
  wb.creator = 'AMEVA Workstation'
  wb.created = new Date()

      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `exportedAt`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const exportedAt = ...` 형태로 안전 캐싱 후 가공 기동.
       */
  const exportedAt = new Date().toISOString()
  const warnings: string[] = []
  const assetsList: { blockId: string; type: string; url: string; caption?: string }[] = []
  const codeBlocksList: { blockId: string; language: string; content: string; heading: string }[] = []
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `blockCount`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const blockCount = ...` 형태로 안전 캐싱 후 가공 기동.
       */
  let blockCount = 0
  let headingPathFlat: string[] = []

  interface FlatBlock { id: string; type: string; level: number; text: string; depth: number }
  const flatBlocks: FlatBlock[] = []

  /*
   * [FUNCTION CONTRACT]
   * - 함수 명: `flattenForOutline`
   * - 역할: 인자 정보를 검수하고 비즈니스 계약 조건에 맞춰 최종 바인딩 결과물/바이너리 버퍼를 반환함.
   * - 예시: `flattenForOutline(...)` 호출 시 런타임 비동기/동기 연쇄 반응 유도.
   */
  function flattenForOutline(block: ExporterBlock, depth = 0): void {
    blockCount++
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `text`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const text = ...` 형태로 안전 캐싱 후 가공 기동.
       */
    const text = getPlainTextFromNormalized(block)
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `level`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const level = ...` 형태로 안전 캐싱 후 가공 기동.
       */
    const level = block.type === 'heading' ? (Number(block.props?.level) || 1) : 0
    flatBlocks.push({ id: block.id || `b${blockCount}`, type: block.type || '', level, text, depth })

      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `block.type === 'image' && block.props?.url`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (block.type === 'image' && block.props?.url)` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
    if (block.type === 'image' && block.props?.url) {
      assetsList.push({ blockId: block.id || `b${blockCount}`, type: 'image', url: block.props.url, caption: block.props.caption })
    }
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `block.type === 'codeBlock'`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (block.type === 'codeBlock')` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
    if (block.type === 'codeBlock') {
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `currentHeading`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const currentHeading = ...` 형태로 안전 캐싱 후 가공 기동.
       */
      const currentHeading = headingPathFlat.filter(Boolean).join(' > ')
      codeBlocksList.push({ blockId: block.id || `b${blockCount}`, language: block.props?.language || '', content: text, heading: currentHeading })
    }
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `block.type === 'heading'`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (block.type === 'heading')` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
    if (block.type === 'heading') {
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `l`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const l = ...` 형태로 안전 캐싱 후 가공 기동.
       */
      const l = Number(block.props?.level) || 1
      headingPathFlat[l - 1] = text
      headingPathFlat = headingPathFlat.slice(0, l)
    }
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `Array.isArray(block.children)) block.children.forEach((c: ExporterBlock) => flattenForOutline(c, depth + 1)`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (Array.isArray(block.children)) block.children.forEach((c: ExporterBlock) => flattenForOutline(c, depth + 1))` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
    if (Array.isArray(block.children)) block.children.forEach((c: ExporterBlock) => flattenForOutline(c, depth + 1))
  }
  blocks.forEach(b => flattenForOutline(b))

      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `overviewSheet`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const overviewSheet = ...` 형태로 안전 캐싱 후 가공 기동.
       */
  const overviewSheet = wb.addWorksheet('\uD83D\uDCCB Overview')
  overviewSheet.getColumn('A').width = 24
  overviewSheet.getColumn('B').width = 50

  overviewSheet.addRow(['AMEVA Document Export Report'])
  overviewSheet.getRow(1).getCell(1).font = { name: '\ub9d1\uc740 \uace0\ub515', size: 16, bold: true, color: { argb: 'FF8B5CF6' } }
  overviewSheet.mergeCells('A1:B1')
  overviewSheet.addRow([])

  const overviewData: [string, string | number][] = [
    ['\ud30c\uc77c\uba85', sourceFileName || '(\uc5c6\uc74c)'],
    ['\ubcc0\ud658 \uc2dc\uac01', exportedAt],
    ['\uc804\uccb4 \ube14\ub85d \uc218', blockCount],
    ['\uc774\ubbf8\uc9c0/\uc790\uc0b0 \uc218', assetsList.length],
    ['\ucf54\ub4dc \ube14\ub85d \uc218', codeBlocksList.length],
    ['\uacbd\uace0 \uc218', warnings.length],
  ]
  overviewData.forEach(([label, val]) => {
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `row`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const row = ...` 형태로 안전 캐싱 후 가공 기동.
       */
    const row = overviewSheet.addRow([label, val])
    row.getCell(1).font = { name: '\ub9d1\uc740 \uace0\ub515', size: 10, bold: true }
    row.getCell(2).font = { name: '\ub9d1\uc740 \uace0\ub515', size: 10 }
    row.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F3FF' } }
  })

      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `outlineSheet`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const outlineSheet = ...` 형태로 안전 캐싱 후 가공 기동.
       */
  const outlineSheet = wb.addWorksheet('\uD83D\uDCD1 Outline')
  outlineSheet.getColumn('A').width = 6
  outlineSheet.getColumn('B').width = 8
  outlineSheet.getColumn('C').width = 18
  outlineSheet.getColumn('D').width = 70
  outlineSheet.getColumn('E').width = 10

      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `outHdr`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const outHdr = ...` 형태로 안전 캐싱 후 가공 기동.
       */
  const outHdr = outlineSheet.addRow(['#', 'Level', 'Type', 'Text', 'Depth'])
  outHdr.eachCell((cell: import("exceljs").Cell) => {
    cell.font = { name: '\ub9d1\uc740 \uace0\ub515', size: 10, bold: true, color: { argb: 'FFFFFFFF' } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F2937' } }
    cell.alignment = { vertical: 'middle', horizontal: 'center' }
  })
  outlineSheet.views = [{ state: 'frozen', xSplit: 0, ySplit: 1 }]
  outlineSheet.autoFilter = { from: 'A1', to: 'E1' }

  flatBlocks.forEach((fb, i) => {
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `row`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const row = ...` 형태로 안전 캐싱 후 가공 기동.
       */
    const row = outlineSheet.addRow([
      i + 1,
      fb.level || '',
      fb.type,
      `${'  '.repeat(fb.depth)}${fb.text.slice(0, 120)}${fb.text.length > 120 ? '\u2026' : ''}`,
      fb.depth
    ])
    row.getCell(4).font = { name: '\ub9d1\uc740 \uace0\ub515', size: 9, bold: fb.type === 'heading' }
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `fb.type === 'heading'`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (fb.type === 'heading')` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
    if (fb.type === 'heading') {
      const colors: Record<number, string> = { 1: 'FFF5F3FF', 2: 'FFEEF2FF', 3: 'FFF8F9FF' }
      row.eachCell((cell: import("exceljs").Cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors[fb.level] || 'FFFFFFFF' } }
      })
    }
  })

      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `mainSheet`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const mainSheet = ...` 형태로 안전 캐싱 후 가공 기동.
       */
  const mainSheet = wb.addWorksheet('\uD83D\uDCC4 \ubcf8\ubb38')
  mainSheet.getColumn('A').width = 4
  mainSheet.getColumn('B').width = 65
      /*
       * [LOOP CONTROL ITERATION]
       * - 루프 조건: `for (let c = 3; c <= 10; c++) mainSheet.getColumn(c).width = 18`
       * - 예상 시나리오: 지정된 조건 한계 도달 시점까지 콜렉션 항목의 순차 매핑, 변환 및 동기 적재 처리를 수행함.
       * - 예시: `for (const item of list)` 루프 실행 시 모든 개별 블록의 html 포맷 정제 완료 후 스택 종결.
       */
  for (let c = 3; c <= 10; c++) mainSheet.getColumn(c).width = 18

      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `titleRow2`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const titleRow2 = ...` 형태로 안전 캐싱 후 가공 기동.
       */
  const titleRow2 = mainSheet.addRow(['', 'AMEVA Document \u2014 ' + (sourceFileName || 'Export')])
  titleRow2.getCell(2).font = { name: '\ub9d1\uc740 \uace0\ub515', size: 14, bold: true, color: { argb: 'FF8B5CF6' } }
  mainSheet.addRow([])

      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `excelRowIdx`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const excelRowIdx = ...` 형태로 안전 캐싱 후 가공 기동.
       */
  let excelRowIdx = 3
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `tableCountMain`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const tableCountMain = ...` 형태로 안전 캐싱 후 가공 기동.
       */
  let tableCountMain = 0
  let headingPathMain: string[] = []

      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `writeBlockToExcel`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const writeBlockToExcel = ...` 형태로 안전 캐싱 후 가공 기동.
       */
  const writeBlockToExcel = (block: ExporterBlock, depth = 0) => {
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `text`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const text = ...` 형태로 안전 캐싱 후 가공 기동.
       */
    const text = getPlainTextFromNormalized(block)
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `indentCol`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const indentCol = ...` 형태로 안전 캐싱 후 가공 기동.
       */
    const indentCol = depth > 0 ? ' '.repeat(depth * 3) : ''

      /*
       * [SWITCH ROUTING CASE]
       * - 라우팅 키: `switch (block.type) {`
       * - 예상 시나리오: 유입된 상태 변수 분기값과 일치하는 케이스 블록으로 런타임 제어를 즉시 라우팅함.
       * - 예시: `switch (format)` 분기 시 매치되는 변환 포맷 서브 모듈이 가동됨.
       */
    switch (block.type) {
    /*
     * [CASE ROUTING DECISION BINDING]
     * - 분기 타겟: `case 'heading': {`
     * - 만족 시: 본 케이스 전용 연산을 이행하고 break/return을 거쳐 스위치 게이트를 마감함.
     * - 예시: `case 'heading': {` 만족 시 해당 포맷 바이너리 빌더 호출.
     */
      case 'heading': {
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `level`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const level = ...` 형태로 안전 캐싱 후 가공 기동.
       */
        const level = Number(block.props?.level) || 1
        headingPathMain[level - 1] = text
        headingPathMain.splice(level)
        const fontSizes: Record<number, number> = { 1: 15, 2: 13, 3: 11 }
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `row`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const row = ...` 형태로 안전 캐싱 후 가공 기동.
       */
        const row = mainSheet.addRow(['', `${indentCol}${text}`])
        row.getCell(2).font = { name: '\ub9d1\uc740 \uace0\ub515', size: fontSizes[level] || 11, bold: true }
        row.getCell(2).border = { bottom: { style: 'medium', color: { argb: 'FFD1D5DB' } } }
        mainSheet.addRow([])
        excelRowIdx += 2
        break
      }
    /*
     * [CASE ROUTING DECISION BINDING]
     * - 분기 타겟: `case 'paragraph': {`
     * - 만족 시: 본 케이스 전용 연산을 이행하고 break/return을 거쳐 스위치 게이트를 마감함.
     * - 예시: `case 'paragraph': {` 만족 시 해당 포맷 바이너리 빌더 호출.
     */
      case 'paragraph': {
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `text.trim()`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (text.trim())` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
        if (text.trim()) {
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `row`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const row = ...` 형태로 안전 캐싱 후 가공 기동.
       */
          const row = mainSheet.addRow(['', `${indentCol}${text}`])
          row.getCell(2).alignment = { wrapText: true, vertical: 'middle' }
          row.getCell(2).font = { name: '\ub9d1\uc740 \uace0\ub515', size: 10 }
          excelRowIdx++
        }
        break
      }
    /*
     * [CASE ROUTING DECISION BINDING]
     * - 분기 타겟: `case 'bulletListItem': {`
     * - 만족 시: 본 케이스 전용 연산을 이행하고 break/return을 거쳐 스위치 게이트를 마감함.
     * - 예시: `case 'bulletListItem': {` 만족 시 해당 포맷 바이너리 빌더 호출.
     */
      case 'bulletListItem': {
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `text.trim()`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (text.trim())` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
        if (text.trim()) {
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `row`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const row = ...` 형태로 안전 캐싱 후 가공 기동.
       */
          const row = mainSheet.addRow(['', `${indentCol}\u2022 ${text}`])
          row.getCell(2).alignment = { wrapText: true }
          row.getCell(2).font = { name: '\ub9d1\uc740 \uace0\ub515', size: 10 }
          excelRowIdx++
        }
        break
      }
    /*
     * [CASE ROUTING DECISION BINDING]
     * - 분기 타겟: `case 'numberedListItem': {`
     * - 만족 시: 본 케이스 전용 연산을 이행하고 break/return을 거쳐 스위치 게이트를 마감함.
     * - 예시: `case 'numberedListItem': {` 만족 시 해당 포맷 바이너리 빌더 호출.
     */
      case 'numberedListItem': {
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `text.trim()`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (text.trim())` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
        if (text.trim()) {
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `row`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const row = ...` 형태로 안전 캐싱 후 가공 기동.
       */
          const row = mainSheet.addRow(['', `${indentCol}1. ${text}`])
          row.getCell(2).alignment = { wrapText: true }
          row.getCell(2).font = { name: '\ub9d1\uc740 \uace0\ub515', size: 10 }
          excelRowIdx++
        }
        break
      }
    /*
     * [CASE ROUTING DECISION BINDING]
     * - 분기 타겟: `case 'table': {`
     * - 만족 시: 본 케이스 전용 연산을 이행하고 break/return을 거쳐 스위치 게이트를 마감함.
     * - 예시: `case 'table': {` 만족 시 해당 포맷 바이너리 빌더 호출.
     */
      case 'table': {
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `rows`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const rows = ...` 형태로 안전 캐싱 후 가공 기동.
       */
        const rows = block.tableRows ?? []
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `rows.length > 0`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (rows.length > 0)` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
        if (rows.length > 0) {
          tableCountMain++
          mainSheet.addRow(['', `[\ud45c ${tableCountMain}]`])
          mainSheet.getRow(excelRowIdx + 1).getCell(2).font = { name: '\ub9d1\uc740 \uace0\ub515', size: 9, italic: true, color: { argb: 'FF9CA3AF' } }
          excelRowIdx++
          rows.forEach((tblRow: ExporterTableRow, ri: number) => {
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `cells`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const cells = ...` 형태로 안전 캐싱 후 가공 기동.
       */
            const cells = (Array.isArray(tblRow.cells) ? tblRow.cells : []) as (ExporterInlineContent[] | unknown)[]
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `rowData`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const rowData = ...` 형태로 안전 캐싱 후 가공 기동.
       */
            const rowData = ['', ...cells.map((cell: ExporterInlineContent[] | unknown) => Array.isArray(cell) ? inlineToText(cell as ExporterInlineContent[]) : '')]
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `addedRow`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const addedRow = ...` 형태로 안전 캐싱 후 가공 기동.
       */
            const addedRow = mainSheet.addRow(rowData)
            cells.forEach((_: ExporterInlineContent[] | unknown, ci: number) => {
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `cell`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const cell = ...` 형태로 안전 캐싱 후 가공 기동.
       */
              const cell = addedRow.getCell(ci + 2)
              cell.font = { name: '\ub9d1\uc740 \uace0\ub515', size: 9.5, bold: ri === 0 }
              cell.alignment = { wrapText: true, vertical: 'middle', horizontal: 'center' }
              cell.border = { top: { style: 'thin', color: { argb: 'FFE5E7EB' } }, left: { style: 'thin', color: { argb: 'FFE5E7EB' } }, bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } }, right: { style: 'thin', color: { argb: 'FFE5E7EB' } } }
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `ri === 0`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (ri === 0)` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
              if (ri === 0) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } }
            })
            excelRowIdx++
          })
          mainSheet.addRow([])
          excelRowIdx++

      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `sheetName`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const sheetName = ...` 형태로 안전 캐싱 후 가공 기동.
       */
          const sheetName = `\ud45c_${tableCountMain}`.slice(0, 31)
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `ws`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const ws = ...` 형태로 안전 캐싱 후 가공 기동.
       */
          const ws = wb.addWorksheet(sheetName)
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `path`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const path = ...` 형태로 안전 캐싱 후 가공 기동.
       */
          const path = headingPathMain.filter(Boolean)
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `path.length > 0) { ws.addRow([`\uc704\uce58: ${path.join(' > ')}`]); ws.addRow([]`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (path.length > 0) { ws.addRow([`\uc704\uce58: ${path.join(' > ')}`]); ws.addRow([])` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
          if (path.length > 0) { ws.addRow([`\uc704\uce58: ${path.join(' > ')}`]); ws.addRow([]) }
          rows.forEach((tblRow: ExporterTableRow, ri: number) => {
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `cells`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const cells = ...` 형태로 안전 캐싱 후 가공 기동.
       */
            const cells = (Array.isArray(tblRow.cells) ? tblRow.cells : []) as (ExporterInlineContent[] | unknown)[]
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `rowData`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const rowData = ...` 형태로 안전 캐싱 후 가공 기동.
       */
            const rowData = cells.map((cell: ExporterInlineContent[] | unknown) => Array.isArray(cell) ? inlineToText(cell as ExporterInlineContent[]) : '')
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `addedRow`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const addedRow = ...` 형태로 안전 캐싱 후 가공 기동.
       */
            const addedRow = ws.addRow(rowData)
            addedRow.eachCell((cell: import('exceljs').Cell) => {
              cell.font = { name: '\ub9d1\uc740 \uace0\ub515', size: 10, bold: ri === 0 }
              cell.border = { top: { style: 'thin', color: { argb: 'FFE5E7EB' } }, left: { style: 'thin', color: { argb: 'FFE5E7EB' } }, bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } }, right: { style: 'thin', color: { argb: 'FFE5E7EB' } } }
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `ri === 0`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (ri === 0)` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
              if (ri === 0) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } }
            })
          })
          ws.columns.forEach((col: import('exceljs').Column) => {
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `maxLen`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const maxLen = ...` 형태로 안전 캐싱 후 가공 기동.
       */
            let maxLen = 10
            col.eachCell({ includeEmpty: false }, (cell: import('exceljs').Cell) => {
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `val`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const val = ...` 형태로 안전 캐싱 후 가공 기동.
       */
              const val = cell.value ? String(cell.value) : ''
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `val.length > maxLen`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (val.length > maxLen)` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
              if (val.length > maxLen) maxLen = val.length
            })
            col.width = Math.min(45, maxLen + 2)
          })
        }
        break
      }
    /*
     * [CASE ROUTING DECISION BINDING]
     * - 분기 타겟: `case 'codeBlock': {`
     * - 만족 시: 본 케이스 전용 연산을 이행하고 break/return을 거쳐 스위치 게이트를 마감함.
     * - 예시: `case 'codeBlock': {` 만족 시 해당 포맷 바이너리 빌더 호출.
     */
      case 'codeBlock': {
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `lang`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const lang = ...` 형태로 안전 캐싱 후 가공 기동.
       */
        const lang = block.props?.language || ''
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `lines`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const lines = ...` 형태로 안전 캐싱 후 가공 기동.
       */
        const lines = text.split('\n')
        mainSheet.addRow(['', `[Code Block: ${lang.toUpperCase()}]`])
        mainSheet.getRow(excelRowIdx + 1).getCell(2).font = { name: 'Consolas', size: 9, bold: true, color: { argb: 'FF64748B' } }
        excelRowIdx++
        lines.forEach((line: string) => {
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `row`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const row = ...` 형태로 안전 캐싱 후 가공 기동.
       */
          const row = mainSheet.addRow(['', `  ${line}`])
          row.getCell(2).font = { name: 'Consolas', size: 9, color: { argb: 'FF0F172A' } }
          row.getCell(2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } }
          excelRowIdx++
        })
        mainSheet.addRow([])
        excelRowIdx++
        break
      }
    /*
     * [CASE ROUTING DECISION BINDING]
     * - 분기 타겟: `default: break`
     * - 만족 시: 본 케이스 전용 연산을 이행하고 break/return을 거쳐 스위치 게이트를 마감함.
     * - 예시: `default: break` 만족 시 해당 포맷 바이너리 빌더 호출.
     */
      default: break
    }
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `Array.isArray(block.children)) block.children.forEach((c: ExporterBlock) => writeBlockToExcel(c, depth + 1)`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (Array.isArray(block.children)) block.children.forEach((c: ExporterBlock) => writeBlockToExcel(c, depth + 1))` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
    if (Array.isArray(block.children)) block.children.forEach((c: ExporterBlock) => writeBlockToExcel(c, depth + 1))
  }
  blocks.forEach(b => writeBlockToExcel(b))
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `excelRowIdx <= 3) mainSheet.addRow(['', '(\uc774 \ubb38\uc11c\uc5d0\ub294 \ubcf8\ubb38 \ud14d\uc2a4\ud2b8 \ub610\ub294 \ud45c \ub370\uc774\ud130\uac00 \uc5c6\uc2b5\ub2c8\ub2e4.)']`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (excelRowIdx <= 3) mainSheet.addRow(['', '(\uc774 \ubb38\uc11c\uc5d0\ub294 \ubcf8\ubb38 \ud14d\uc2a4\ud2b8 \ub610\ub294 \ud45c \ub370\uc774\ud130\uac00 \uc5c6\uc2b5\ub2c8\ub2e4.)'])` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
  if (excelRowIdx <= 3) mainSheet.addRow(['', '(\uc774 \ubb38\uc11c\uc5d0\ub294 \ubcf8\ubb38 \ud14d\uc2a4\ud2b8 \ub610\ub294 \ud45c \ub370\uc774\ud130\uac00 \uc5c6\uc2b5\ub2c8\ub2e4.)'])

      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `assetsList.length > 0`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (assetsList.length > 0)` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
  if (assetsList.length > 0) {
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `assetsSheet`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const assetsSheet = ...` 형태로 안전 캐싱 후 가공 기동.
       */
    const assetsSheet = wb.addWorksheet('\uD83D\uDDBC\uFE0F Assets')
    assetsSheet.getColumn('A').width = 6
    assetsSheet.getColumn('B').width = 14
    assetsSheet.getColumn('C').width = 70
    assetsSheet.getColumn('D').width = 30
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `asHdr`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const asHdr = ...` 형태로 안전 캐싱 후 가공 기동.
       */
    const asHdr = assetsSheet.addRow(['#', 'Type', 'URL / Path', 'Caption'])
    asHdr.eachCell((cell: import('exceljs').Cell) => {
      cell.font = { name: '\ub9d1\uc740 \uace0\ub515', size: 10, bold: true, color: { argb: 'FFFFFFFF' } }
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF374151' } }
    })
    assetsList.forEach((a, i) => {
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `row`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const row = ...` 형태로 안전 캐싱 후 가공 기동.
       */
      const row = assetsSheet.addRow([i + 1, a.type, a.url, a.caption || ''])
      row.getCell(3).font = { name: 'Consolas', size: 9, color: { argb: 'FF7C3AED' } }
    })
    assetsSheet.views = [{ state: 'frozen', xSplit: 0, ySplit: 1 }]
    assetsSheet.autoFilter = { from: 'A1', to: 'D1' }
  }

      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `codeBlocksList.length > 0`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (codeBlocksList.length > 0)` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
  if (codeBlocksList.length > 0) {
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `codeSheet`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const codeSheet = ...` 형태로 안전 캐싱 후 가공 기동.
       */
    const codeSheet = wb.addWorksheet('\uD83D\uDCBB Code')
    codeSheet.getColumn('A').width = 6
    codeSheet.getColumn('B').width = 14
    codeSheet.getColumn('C').width = 30
    codeSheet.getColumn('D').width = 80
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `codeHdr`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const codeHdr = ...` 형태로 안전 캐싱 후 가공 기동.
       */
    const codeHdr = codeSheet.addRow(['#', 'Language', 'Section', 'Content'])
    codeHdr.eachCell((cell: import('exceljs').Cell) => {
      cell.font = { name: '\ub9d1\uc740 \uace0\ub515', size: 10, bold: true, color: { argb: 'FFFFFFFF' } }
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } }
    })
    codeBlocksList.forEach((cb, i) => {
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `row`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const row = ...` 형태로 안전 캐싱 후 가공 기동.
       */
      const row = codeSheet.addRow([i + 1, cb.language || '(unknown)', cb.heading, cb.content])
      row.getCell(2).font = { name: 'Consolas', size: 9, color: { argb: 'FF38BDF8' }, bold: true }
      row.getCell(4).font = { name: 'Consolas', size: 9, color: { argb: 'FFA3E635' } }
      row.getCell(4).alignment = { wrapText: true }
      row.getCell(4).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF030712' } }
    })
    codeSheet.views = [{ state: 'frozen', xSplit: 0, ySplit: 1 }]
  }

      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `warnSheet`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const warnSheet = ...` 형태로 안전 캐싱 후 가공 기동.
       */
  const warnSheet = wb.addWorksheet('\u26A0\uFE0F Warnings')
  warnSheet.getColumn('A').width = 6
  warnSheet.getColumn('B').width = 80
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `warnHdr`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const warnHdr = ...` 형태로 안전 캐싱 후 가공 기동.
       */
  const warnHdr = warnSheet.addRow(['#', 'Warning Message'])
  warnHdr.eachCell((cell: import('exceljs').Cell) => {
    cell.font = { name: '\ub9d1\uc740 \uace0\ub515', size: 10, bold: true }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } }
  })
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `warnings.length === 0`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (warnings.length === 0)` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
  if (warnings.length === 0) {
    warnSheet.addRow(['', '\ubcc0\ud658 \uacbd\uace0 \uc5c6\uc74c \u2014 \ubaa8\ub4e0 \ube14\ub85d\uc774 \uc815\uc0c1 \uc815\ub9ac\ub410\uc2b5\ub2c8\ub2e4.'])
  } else {
    warnings.forEach((w, i) => {
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `row`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const row = ...` 형태로 안전 캐싱 후 가공 기동.
       */
      const row = warnSheet.addRow([i + 1, w])
      row.getCell(2).font = { name: '\ub9d1\uc740 \uace0\ub515', size: 10, color: { argb: 'FFD97706' } }
    })
  }

      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `buffer`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const buffer = ...` 형태로 안전 캐싱 후 가공 기동.
       */
  const buffer = await wb.xlsx.writeBuffer()
  return Buffer.from(buffer)
}

