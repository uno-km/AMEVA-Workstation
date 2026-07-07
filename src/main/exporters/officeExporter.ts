import { createRequire } from 'module'
const require = createRequire(import.meta.url)

const docx = require('docx')
const ExcelJS = require('exceljs')
const pptxgen = require('pptxgenjs')
import { getPlainTextFromNormalized, inlineToText, type ExporterBlock, type ExporterInlineContent, type ExporterTableRow } from './exportersHelper.js'

const {
  Document, Packer, Paragraph, TextRun, Table: DocxTable, TableRow, TableCell,
  BorderStyle, HeadingLevel, AlignmentType, WidthType, TableLayoutType,
  ShadingType, convertInchesToTwip
} = docx

// ══════════════════════════════════════════════════════════════
// 2. Word (DOCX) 내보내기 (백엔드 분산 변환 노드 버전)
// ══════════════════════════════════════════════════════════════
export async function exportToWord(blocks: ExporterBlock[]): Promise<Buffer> {
  const docChildren: unknown[] = []
  const headingSizes: Record<number, number> = { 1: 44, 2: 36, 3: 28 }
  const headingColors: Record<number, string> = { 1: '111827', 2: '1f2937', 3: '374151' }

  const inlineToRuns = (inline: ExporterInlineContent[]): unknown[] =>
    inline.map(c => new TextRun({
      text: c.text,
      bold: c.styles?.bold,
      italics: c.styles?.italic,
      underline: c.styles?.underline ? { type: 'single' } : undefined,
      strike: c.styles?.strike,
      font: 'Calibri',
      size: 24,
      color: c.styles?.textColor?.replace('#', '') || undefined,
    }))

  const addBlock = (block: ExporterBlock, depth = 0) => {
    const runs = inlineToRuns(block.content || [])
    const plainText = getPlainTextFromNormalized(block)

    switch (block.type) {
      case 'heading': {
        const level = Math.min(3, Math.max(1, Number(block.props?.level) || 1))
        const hLevel = level === 1 ? HeadingLevel.HEADING_1 : level === 2 ? HeadingLevel.HEADING_2 : HeadingLevel.HEADING_3
        const hRuns = (block.content || []).length > 0
          ? block.content.map((c: ExporterInlineContent) => new TextRun({ text: c.text, bold: true, font: 'Calibri', size: headingSizes[level] || 28, color: headingColors[level] || '374151' }))
          : [new TextRun({ text: plainText, bold: true, font: 'Calibri', size: headingSizes[level] || 28 })]
        docChildren.push(new Paragraph({
          children: hRuns,
          heading: hLevel,
          spacing: { before: convertInchesToTwip(0.25), after: convertInchesToTwip(0.1) },
          border: level === 1 ? { bottom: { style: BorderStyle.SINGLE, size: 4, color: 'E5E7EB', space: 4 } } : undefined,
        }))
        break
      }

      case 'paragraph':
        docChildren.push(new Paragraph({
          children: runs.length > 0 ? runs : [new TextRun({ text: '' })],
          spacing: { after: 120 },
          indent: depth > 0 ? { left: depth * 720 } : undefined,
        }))
        break

      case 'bulletListItem':
        docChildren.push(new Paragraph({ children: runs, bullet: { level: depth }, spacing: { after: 80 } }))
        break

      case 'numberedListItem':
        docChildren.push(new Paragraph({ children: runs, numbering: { reference: 'default-numbering', level: depth }, spacing: { after: 80 } }))
        break

      case 'codeBlock': {
        const lang = block.props?.language || ''
        const lines = plainText.split('\n')
        if (lang) {
          docChildren.push(new Paragraph({
            children: [new TextRun({ text: lang.toUpperCase(), font: 'Consolas', size: 16, color: '64748B', bold: true })],
            shading: { type: ShadingType.CLEAR, fill: '0F172A' },
            spacing: { before: 160, after: 0 },
          }))
        }
        lines.forEach((line, idx) => {
          docChildren.push(new Paragraph({
            children: [new TextRun({ text: line || ' ', font: 'Consolas', size: 20, color: 'A3E635' })],
            shading: { type: ShadingType.CLEAR, fill: '0F172A' },
            spacing: { after: idx === lines.length - 1 ? 160 : 0 },
          }))
        })
        break
      }

      case 'image':
        docChildren.push(new Paragraph({
          children: [new TextRun({ text: `[이미지: ${block.props?.url || ''}]`, italics: true, color: '9CA3AF', size: 20 })],
          spacing: { after: 120 },
        }))
        break

      case 'table': {
        const rows = block.tableRows ?? []
        if (rows.length > 0) {
          try {
            const docxRows = rows.map((row: ExporterTableRow, ri: number) => {
              const cells = (Array.isArray(row.cells) ? row.cells : []) as (ExporterInlineContent[] | unknown)[]
              const docxCells = cells.map((cell: ExporterInlineContent[] | unknown) => {
                const cellText = Array.isArray(cell) ? inlineToText(cell as ExporterInlineContent[]) : ''
                return new TableCell({
                  children: [new Paragraph({
                    children: [new TextRun({ text: cellText, bold: ri === 0, font: 'Calibri', size: 22, color: ri === 0 ? '374151' : '4B5563' })],
                    spacing: { after: 60 },
                  })],
                  shading: ri === 0 ? { type: ShadingType.CLEAR, fill: 'F8FAFC' } : undefined,
                  borders: {
                    top: { style: BorderStyle.SINGLE, size: 2, color: 'E5E7EB' },
                    bottom: { style: BorderStyle.SINGLE, size: ri === 0 ? 4 : 2, color: 'E5E7EB' },
                    left: { style: BorderStyle.SINGLE, size: 2, color: 'E5E7EB' },
                    right: { style: BorderStyle.SINGLE, size: 2, color: 'E5E7EB' },
                  },
                  margins: { top: 80, bottom: 80, left: 160, right: 160 },
                })
              })
              return new TableRow({ children: docxCells })
            })
            docChildren.push(new DocxTable({
              rows: docxRows,
              width: { size: 100, type: WidthType.PERCENTAGE },
              layout: TableLayoutType.FIXED,
            }))
            docChildren.push(new Paragraph({ children: [], spacing: { after: 160 } }))
          } catch (err) {
            console.error('[exportToWord] table 처리 실패:', err)
            docChildren.push(new Paragraph({ children: [new TextRun({ text: '[테이블 변환 실패]', color: 'EF4444' })], spacing: { after: 120 } }))
          }
        }
        break
      }

      case 'divider':
        docChildren.push(new Paragraph({
          children: [],
          border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: 'E5E7EB', space: 4 } },
          spacing: { before: 160, after: 160 },
        }))
        break

      default:
        if (runs.length > 0) docChildren.push(new Paragraph({ children: runs, spacing: { after: 120 } }))
    }

    if (Array.isArray(block.children)) {
      block.children.forEach((child: ExporterBlock) => addBlock(child, depth + 1))
    }
  }

  blocks.forEach(b => addBlock(b))

  if (docChildren.length === 0) {
    docChildren.push(new Paragraph({ children: [new TextRun({ text: '(내용 없음)' })] }))
  }

  const doc = new Document({
    numbering: {
      config: [{
        reference: 'default-numbering',
        levels: [{ level: 0, numFmt: 'decimal', text: '%1.', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } }],
      }],
    },
    sections: [{
      properties: { page: { margin: { top: convertInchesToTwip(1), bottom: convertInchesToTwip(1), left: convertInchesToTwip(1.2), right: convertInchesToTwip(1.2) } } },
      children: docChildren,
    }],
  })

  return await Packer.toBuffer(doc)
}

// ══════════════════════════════════════════════════════════════
// 3. Excel (XLSX) 내보내기 — 구조화 멀티시트 버전
// ══════════════════════════════════════════════════════════════
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

// ══════════════════════════════════════════════════════════════
// 4. PPTX 내보내기 (백엔드 분산 변환 노드 버전)
// ══════════════════════════════════════════════════════════════
export async function exportToPPTX(blocks: ExporterBlock[]): Promise<Buffer> {
  const pptx = new pptxgen()
  pptx.layout = 'LAYOUT_16x9'
  pptx.author = 'AMEVA'

  interface SlideContent {
    type: 'bullet' | 'image' | 'table' | 'code'
    text?: string
    url?: string
    tableRows?: ExporterTableRow[]
  }

  interface SlideData {
    title: string
    contents: SlideContent[]
  }

  const slides: SlideData[] = []
  let currentSlide: SlideData = { title: 'Presentation', contents: [] }

  const processBlock = (block: ExporterBlock) => {
    const text = getPlainTextFromNormalized(block)

    if (block.type === 'heading') {
      const level = Number(block.props?.level) || 1
      if (level === 1) {
        if (currentSlide.contents.length > 0 || currentSlide.title !== 'Presentation') {
          slides.push(currentSlide)
        }
        currentSlide = { title: text, contents: [] }
      } else {
        currentSlide.contents.push({ type: 'bullet', text: `[${level}단계] ${text}` })
      }
    } else if (['bulletListItem', 'numberedListItem', 'paragraph'].includes(block.type)) {
      if (text.trim()) {
        currentSlide.contents.push({ type: 'bullet', text: (block.type === 'numberedListItem' ? '1. ' : '') + text })
      }
    } else if (block.type === 'codeBlock') {
      currentSlide.contents.push({ type: 'code', text })
    } else if (block.type === 'image' && block.props?.url) {
      currentSlide.contents.push({ type: 'image', url: block.props.url })
    } else if (block.type === 'table') {
      const rows = block.tableRows ?? []
      if (rows.length > 0) {
        currentSlide.contents.push({ type: 'table', tableRows: rows })
      }
    }

    if (Array.isArray(block.children)) {
      block.children.forEach(processBlock)
    }
  }

  blocks.forEach(processBlock)
  if (currentSlide.contents.length > 0 || currentSlide.title !== 'Presentation') {
    slides.push(currentSlide)
  }

  if (slides.length === 0) {
    slides.push({ title: 'AMEVA Document Summary', contents: [{ type: 'bullet', text: '문서 내용이 비어 있습니다.' }] })
  }

  const coverSlide = pptx.addSlide()
  coverSlide.background = { fill: '0B0F19' }
  coverSlide.addShape(pptx.shapes.RECTANGLE, { x: 0.8, y: 3.4, w: 11.7, h: 0.04, fill: { type: 'solid', color: '8B5CF6' }, line: { color: 'transparent' } })
  coverSlide.addText('AMEVA WORKSTATION PRESENTATION', { x: 0.8, y: 2.8, w: 11.7, h: 0.4, fontSize: 13, bold: true, color: '8B5CF6', fontFace: 'Calibri', charSpacing: 6 })
  coverSlide.addText(slides[0]?.title || 'Document Report', { x: 0.8, y: 3.8, w: 11.7, h: 1.8, fontSize: 44, bold: true, color: 'FFFFFF', fontFace: 'Calibri' })
  coverSlide.addText(new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' }) + ' · Generated by AMEVA', { x: 0.8, y: 6.2, w: 8, h: 0.4, fontSize: 11, color: '6B7280', fontFace: 'Calibri' })

  slides.forEach((slideData, idx) => {
    const MAX_BULLETS_PER_PAGE = 6
    const bulletItems = slideData.contents.filter(c => c.type === 'bullet')
    const images = slideData.contents.filter(c => c.type === 'image')
    const tables = slideData.contents.filter(c => c.type === 'table')
    const codes = slideData.contents.filter(c => c.type === 'code')

    if (codes.length > 0 && bulletItems.length === 0 && tables.length === 0) {
      codes.forEach((codeItem, cIdx) => {
        const slide = pptx.addSlide()
        slide.background = { fill: '0F172A' }
        slide.addText(`${slideData.title} - Source Code ${codes.length > 1 ? `(${cIdx + 1})` : ''}`, { x: 0.6, y: 0.4, w: 12.0, h: 0.8, fontSize: 26, bold: true, color: '8B5CF6', fontFace: 'Calibri' })
        slide.addText(codeItem.text || '', {
          x: 0.6, y: 1.4, w: 12.0, h: 5.2,
          fontSize: 12,
          color: '38BDF8',
          fontFace: 'Courier New',
          fill: { color: '030712' },
          line: { color: '334155', width: 1.5 },
          valign: 'top',
          margin: [15, 15, 15, 15]
        })
      })
      return
    }

    if (tables.length > 0) {
      tables.forEach((tableItem, tIdx) => {
        const slide = pptx.addSlide()
        slide.background = { fill: '0A0A14' }
        slide.addText(`${slideData.title} - Table ${tables.length > 1 ? `(${tIdx + 1})` : ''}`, { x: 0.6, y: 0.4, w: 12.0, h: 0.8, fontSize: 26, bold: true, color: 'FFFFFF', fontFace: 'Calibri' })
        
        if (bulletItems.length > 0) {
          const leadText = bulletItems.slice(0, 2).map(b => b.text).join('\n')
          slide.addText(leadText, { x: 0.6, y: 1.2, w: 12.0, h: 0.8, fontSize: 13, color: '9CA3AF', fontFace: 'Calibri' })
        }

        const rawRows = tableItem.tableRows || []
        const formattedTableData = rawRows.map((rowObj: ExporterTableRow, ri: number) => {
          const cells = (Array.isArray(rowObj.cells) ? rowObj.cells : []) as (ExporterInlineContent[] | unknown)[]
          return cells.map((cell: ExporterInlineContent[] | unknown) => {
            const txt = Array.isArray(cell) ? inlineToText(cell as ExporterInlineContent[]) : ''
            return {
              text: txt,
              options: {
                fill: ri === 0 ? '1F2937' : '111827',
                color: ri === 0 ? '8B5CF6' : 'D1D5DB',
                bold: ri === 0,
                align: 'center',
                fontFace: 'Calibri',
                fontSize: 11,
                border: { pt: 1, color: '374151' }
              }
            }
          })
        })

        if (formattedTableData.length > 0) {
          slide.addTable(formattedTableData, {
            x: 0.6,
            y: bulletItems.length > 0 ? 2.1 : 1.4,
            w: 12.0,
            h: bulletItems.length > 0 ? 4.5 : 5.2
          })
        }
      })
      return
    }

    const totalPages = Math.max(1, Math.ceil(bulletItems.length / MAX_BULLETS_PER_PAGE))
    
    for (let pageIdx = 0; pageIdx < totalPages; pageIdx++) {
      const slide = pptx.addSlide()
      slide.background = { fill: '0A0A14' }
      slide.addShape(pptx.shapes.RECTANGLE, { x: 0, y: 0, w: 0.05, h: 7.5, fill: { type: 'solid', color: idx % 2 === 0 ? '8B5CF6' : '06B6D4' }, line: { color: 'transparent' } })

      const pageSuffix = totalPages > 1 ? ` (${pageIdx + 1}/${totalPages})` : ''
      slide.addText(slideData.title + pageSuffix, { x: 0.6, y: 0.4, w: 12.0, h: 0.8, fontSize: 28, bold: true, color: 'FFFFFF', fontFace: 'Calibri' })
      slide.addShape(pptx.shapes.RECTANGLE, { x: 0.6, y: 1.25, w: 12.0, h: 0.01, fill: { type: 'solid', color: '374151' }, line: { color: 'transparent' } })

      const startIdx = pageIdx * MAX_BULLETS_PER_PAGE
      const endIdx = startIdx + MAX_BULLETS_PER_PAGE
      const pageBullets = bulletItems.slice(startIdx, endIdx)

      const hasImage = images.length > 0 && pageIdx === 0
      const textWidth = hasImage ? 7.0 : 12.0
      
      if (pageBullets.length > 0) {
        const textRuns = pageBullets.map(b => ({
          text: `\n${b.text}`,
          options: { fontSize: 16, color: 'D1D5DB', fontFace: 'Calibri', paraSpaceAfter: 12 }
        }))
        slide.addText(textRuns, { x: 0.6, y: 1.5, w: textWidth, h: 5.0, valign: 'top' })
      }

      if (hasImage && images[0].url) {
        try {
          slide.addImage({
            path: images[0].url,
            x: 7.9,
            y: 1.5,
            w: 4.8,
            h: 4.8,
            sizing: { type: 'contain', w: 4.8, h: 4.8 }
          })
        } catch (imgErr) {
          console.warn('[exportToPPTX] 이미지 삽입 실패:', imgErr)
        }
      }

      slide.addText(`${pageIdx + 1} / ${totalPages}`, { x: 11.5, y: 7.0, w: 1.2, h: 0.3, fontSize: 9, color: '4B5563', fontFace: 'Calibri', align: 'right' })
    }
  })

  const buffer = await pptx.write('arraybuffer')
  return Buffer.from(buffer)
}
