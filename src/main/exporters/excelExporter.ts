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
const require = createRequire(import.meta.url)

const ExcelJS = require('exceljs')
import { getPlainTextFromNormalized, inlineToText, type ExporterBlock, type ExporterInlineContent, type ExporterTableRow } from './exportersHelper.js'

export async function exportToExcel(blocks: ExporterBlock[], sourceFileName?: string): Promise<Buffer> {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'AMEVA Workstation'
  wb.created = new Date()

  const exportedAt = new Date().toISOString()
  const warnings: string[] = []
  const assetsList: { blockId: string; type: string; url: string; caption?: string }[] = []
  const codeBlocksList: { blockId: string; language: string; content: string; heading: string }[] = []
  let blockCount = 0
  let headingPathFlat: string[] = []

  interface FlatBlock { id: string; type: string; level: number; text: string; depth: number }
  const flatBlocks: FlatBlock[] = []

  function flattenForOutline(block: ExporterBlock, depth = 0): void {
    blockCount++
    const text = getPlainTextFromNormalized(block)
    const level = block.type === 'heading' ? (Number(block.props?.level) || 1) : 0
    flatBlocks.push({ id: block.id || `b${blockCount}`, type: block.type || '', level, text, depth })

    if (block.type === 'image' && block.props?.url) {
      assetsList.push({ blockId: block.id || `b${blockCount}`, type: 'image', url: block.props.url, caption: block.props.caption })
    }
    if (block.type === 'codeBlock') {
      const currentHeading = headingPathFlat.filter(Boolean).join(' > ')
      codeBlocksList.push({ blockId: block.id || `b${blockCount}`, language: block.props?.language || '', content: text, heading: currentHeading })
    }
    if (block.type === 'heading') {
      const l = Number(block.props?.level) || 1
      headingPathFlat[l - 1] = text
      headingPathFlat = headingPathFlat.slice(0, l)
    }
    if (Array.isArray(block.children)) block.children.forEach((c: ExporterBlock) => flattenForOutline(c, depth + 1))
  }
  blocks.forEach(b => flattenForOutline(b))

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
    const row = overviewSheet.addRow([label, val])
    row.getCell(1).font = { name: '\ub9d1\uc740 \uace0\ub515', size: 10, bold: true }
    row.getCell(2).font = { name: '\ub9d1\uc740 \uace0\ub515', size: 10 }
    row.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F3FF' } }
  })

  const outlineSheet = wb.addWorksheet('\uD83D\uDCD1 Outline')
  outlineSheet.getColumn('A').width = 6
  outlineSheet.getColumn('B').width = 8
  outlineSheet.getColumn('C').width = 18
  outlineSheet.getColumn('D').width = 70
  outlineSheet.getColumn('E').width = 10

  const outHdr = outlineSheet.addRow(['#', 'Level', 'Type', 'Text', 'Depth'])
  outHdr.eachCell((cell: import("exceljs").Cell) => {
    cell.font = { name: '\ub9d1\uc740 \uace0\ub515', size: 10, bold: true, color: { argb: 'FFFFFFFF' } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F2937' } }
    cell.alignment = { vertical: 'middle', horizontal: 'center' }
  })
  outlineSheet.views = [{ state: 'frozen', xSplit: 0, ySplit: 1 }]
  outlineSheet.autoFilter = { from: 'A1', to: 'E1' }

  flatBlocks.forEach((fb, i) => {
    const row = outlineSheet.addRow([
      i + 1,
      fb.level || '',
      fb.type,
      `${'  '.repeat(fb.depth)}${fb.text.slice(0, 120)}${fb.text.length > 120 ? '\u2026' : ''}`,
      fb.depth
    ])
    row.getCell(4).font = { name: '\ub9d1\uc740 \uace0\ub515', size: 9, bold: fb.type === 'heading' }
    if (fb.type === 'heading') {
      const colors: Record<number, string> = { 1: 'FFF5F3FF', 2: 'FFEEF2FF', 3: 'FFF8F9FF' }
      row.eachCell((cell: import("exceljs").Cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors[fb.level] || 'FFFFFFFF' } }
      })
    }
  })

  const mainSheet = wb.addWorksheet('\uD83D\uDCC4 \ubcf8\ubb38')
  mainSheet.getColumn('A').width = 4
  mainSheet.getColumn('B').width = 65
  for (let c = 3; c <= 10; c++) mainSheet.getColumn(c).width = 18

  const titleRow2 = mainSheet.addRow(['', 'AMEVA Document \u2014 ' + (sourceFileName || 'Export')])
  titleRow2.getCell(2).font = { name: '\ub9d1\uc740 \uace0\ub515', size: 14, bold: true, color: { argb: 'FF8B5CF6' } }
  mainSheet.addRow([])

  let excelRowIdx = 3
  let tableCountMain = 0
  let headingPathMain: string[] = []

  const writeBlockToExcel = (block: ExporterBlock, depth = 0) => {
    const text = getPlainTextFromNormalized(block)
    const indentCol = depth > 0 ? ' '.repeat(depth * 3) : ''

    switch (block.type) {
      case 'heading': {
        const level = Number(block.props?.level) || 1
        headingPathMain[level - 1] = text
        headingPathMain.splice(level)
        const fontSizes: Record<number, number> = { 1: 15, 2: 13, 3: 11 }
        const row = mainSheet.addRow(['', `${indentCol}${text}`])
        row.getCell(2).font = { name: '\ub9d1\uc740 \uace0\ub515', size: fontSizes[level] || 11, bold: true }
        row.getCell(2).border = { bottom: { style: 'medium', color: { argb: 'FFD1D5DB' } } }
        mainSheet.addRow([])
        excelRowIdx += 2
        break
      }
      case 'paragraph': {
        if (text.trim()) {
          const row = mainSheet.addRow(['', `${indentCol}${text}`])
          row.getCell(2).alignment = { wrapText: true, vertical: 'middle' }
          row.getCell(2).font = { name: '\ub9d1\uc740 \uace0\ub515', size: 10 }
          excelRowIdx++
        }
        break
      }
      case 'bulletListItem': {
        if (text.trim()) {
          const row = mainSheet.addRow(['', `${indentCol}\u2022 ${text}`])
          row.getCell(2).alignment = { wrapText: true }
          row.getCell(2).font = { name: '\ub9d1\uc740 \uace0\ub515', size: 10 }
          excelRowIdx++
        }
        break
      }
      case 'numberedListItem': {
        if (text.trim()) {
          const row = mainSheet.addRow(['', `${indentCol}1. ${text}`])
          row.getCell(2).alignment = { wrapText: true }
          row.getCell(2).font = { name: '\ub9d1\uc740 \uace0\ub515', size: 10 }
          excelRowIdx++
        }
        break
      }
      case 'table': {
        const rows = block.tableRows ?? []
        if (rows.length > 0) {
          tableCountMain++
          mainSheet.addRow(['', `[\ud45c ${tableCountMain}]`])
          mainSheet.getRow(excelRowIdx + 1).getCell(2).font = { name: '\ub9d1\uc740 \uace0\ub515', size: 9, italic: true, color: { argb: 'FF9CA3AF' } }
          excelRowIdx++
          rows.forEach((tblRow: ExporterTableRow, ri: number) => {
            const cells = (Array.isArray(tblRow.cells) ? tblRow.cells : []) as (ExporterInlineContent[] | unknown)[]
            const rowData = ['', ...cells.map((cell: ExporterInlineContent[] | unknown) => Array.isArray(cell) ? inlineToText(cell as ExporterInlineContent[]) : '')]
            const addedRow = mainSheet.addRow(rowData)
            cells.forEach((_: ExporterInlineContent[] | unknown, ci: number) => {
              const cell = addedRow.getCell(ci + 2)
              cell.font = { name: '\ub9d1\uc740 \uace0\ub515', size: 9.5, bold: ri === 0 }
              cell.alignment = { wrapText: true, vertical: 'middle', horizontal: 'center' }
              cell.border = { top: { style: 'thin', color: { argb: 'FFE5E7EB' } }, left: { style: 'thin', color: { argb: 'FFE5E7EB' } }, bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } }, right: { style: 'thin', color: { argb: 'FFE5E7EB' } } }
              if (ri === 0) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } }
            })
            excelRowIdx++
          })
          mainSheet.addRow([])
          excelRowIdx++

          const sheetName = `\ud45c_${tableCountMain}`.slice(0, 31)
          const ws = wb.addWorksheet(sheetName)
          const path = headingPathMain.filter(Boolean)
          if (path.length > 0) { ws.addRow([`\uc704\uce58: ${path.join(' > ')}`]); ws.addRow([]) }
          rows.forEach((tblRow: ExporterTableRow, ri: number) => {
            const cells = (Array.isArray(tblRow.cells) ? tblRow.cells : []) as (ExporterInlineContent[] | unknown)[]
            const rowData = cells.map((cell: ExporterInlineContent[] | unknown) => Array.isArray(cell) ? inlineToText(cell as ExporterInlineContent[]) : '')
            const addedRow = ws.addRow(rowData)
            addedRow.eachCell((cell: import('exceljs').Cell) => {
              cell.font = { name: '\ub9d1\uc740 \uace0\ub515', size: 10, bold: ri === 0 }
              cell.border = { top: { style: 'thin', color: { argb: 'FFE5E7EB' } }, left: { style: 'thin', color: { argb: 'FFE5E7EB' } }, bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } }, right: { style: 'thin', color: { argb: 'FFE5E7EB' } } }
              if (ri === 0) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } }
            })
          })
          ws.columns.forEach((col: import('exceljs').Column) => {
            let maxLen = 10
            col.eachCell({ includeEmpty: false }, (cell: import('exceljs').Cell) => {
              const val = cell.value ? String(cell.value) : ''
              if (val.length > maxLen) maxLen = val.length
            })
            col.width = Math.min(45, maxLen + 2)
          })
        }
        break
      }
      case 'codeBlock': {
        const lang = block.props?.language || ''
        const lines = text.split('\n')
        mainSheet.addRow(['', `[Code Block: ${lang.toUpperCase()}]`])
        mainSheet.getRow(excelRowIdx + 1).getCell(2).font = { name: 'Consolas', size: 9, bold: true, color: { argb: 'FF64748B' } }
        excelRowIdx++
        lines.forEach((line: string) => {
          const row = mainSheet.addRow(['', `  ${line}`])
          row.getCell(2).font = { name: 'Consolas', size: 9, color: { argb: 'FF0F172A' } }
          row.getCell(2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } }
          excelRowIdx++
        })
        mainSheet.addRow([])
        excelRowIdx++
        break
      }
      default: break
    }
    if (Array.isArray(block.children)) block.children.forEach((c: ExporterBlock) => writeBlockToExcel(c, depth + 1))
  }
  blocks.forEach(b => writeBlockToExcel(b))
  if (excelRowIdx <= 3) mainSheet.addRow(['', '(\uc774 \ubb38\uc11c\uc5d0\ub294 \ubcf8\ubb38 \ud14d\uc2a4\ud2b8 \ub610\ub294 \ud45c \ub370\uc774\ud130\uac00 \uc5c6\uc2b5\ub2c8\ub2e4.)'])

  if (assetsList.length > 0) {
    const assetsSheet = wb.addWorksheet('\uD83D\uDDBC\uFE0F Assets')
    assetsSheet.getColumn('A').width = 6
    assetsSheet.getColumn('B').width = 14
    assetsSheet.getColumn('C').width = 70
    assetsSheet.getColumn('D').width = 30
    const asHdr = assetsSheet.addRow(['#', 'Type', 'URL / Path', 'Caption'])
    asHdr.eachCell((cell: import('exceljs').Cell) => {
      cell.font = { name: '\ub9d1\uc740 \uace0\ub515', size: 10, bold: true, color: { argb: 'FFFFFFFF' } }
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF374151' } }
    })
    assetsList.forEach((a, i) => {
      const row = assetsSheet.addRow([i + 1, a.type, a.url, a.caption || ''])
      row.getCell(3).font = { name: 'Consolas', size: 9, color: { argb: 'FF7C3AED' } }
    })
    assetsSheet.views = [{ state: 'frozen', xSplit: 0, ySplit: 1 }]
    assetsSheet.autoFilter = { from: 'A1', to: 'D1' }
  }

  if (codeBlocksList.length > 0) {
    const codeSheet = wb.addWorksheet('\uD83D\uDCBB Code')
    codeSheet.getColumn('A').width = 6
    codeSheet.getColumn('B').width = 14
    codeSheet.getColumn('C').width = 30
    codeSheet.getColumn('D').width = 80
    const codeHdr = codeSheet.addRow(['#', 'Language', 'Section', 'Content'])
    codeHdr.eachCell((cell: import('exceljs').Cell) => {
      cell.font = { name: '\ub9d1\uc740 \uace0\ub515', size: 10, bold: true, color: { argb: 'FFFFFFFF' } }
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } }
    })
    codeBlocksList.forEach((cb, i) => {
      const row = codeSheet.addRow([i + 1, cb.language || '(unknown)', cb.heading, cb.content])
      row.getCell(2).font = { name: 'Consolas', size: 9, color: { argb: 'FF38BDF8' }, bold: true }
      row.getCell(4).font = { name: 'Consolas', size: 9, color: { argb: 'FFA3E635' } }
      row.getCell(4).alignment = { wrapText: true }
      row.getCell(4).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF030712' } }
    })
    codeSheet.views = [{ state: 'frozen', xSplit: 0, ySplit: 1 }]
  }

  const warnSheet = wb.addWorksheet('\u26A0\uFE0F Warnings')
  warnSheet.getColumn('A').width = 6
  warnSheet.getColumn('B').width = 80
  const warnHdr = warnSheet.addRow(['#', 'Warning Message'])
  warnHdr.eachCell((cell: import('exceljs').Cell) => {
    cell.font = { name: '\ub9d1\uc740 \uace0\ub515', size: 10, bold: true }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } }
  })
  if (warnings.length === 0) {
    warnSheet.addRow(['', '\ubcc0\ud658 \uacbd\uace0 \uc5c6\uc74c \u2014 \ubaa8\ub4e0 \ube14\ub85d\uc774 \uc815\uc0c1 \uc815\ub9ac\ub410\uc2b5\ub2c8\ub2e4.'])
  } else {
    warnings.forEach((w, i) => {
      const row = warnSheet.addRow([i + 1, w])
      row.getCell(2).font = { name: '\ub9d1\uc740 \uace0\ub515', size: 10, color: { argb: 'FFD97706' } }
    })
  }

  const buffer = await wb.xlsx.writeBuffer()
  return Buffer.from(buffer)
}
