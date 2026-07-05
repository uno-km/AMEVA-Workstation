import { createRequire } from 'module'
const require = createRequire(import.meta.url)

const docx = require('docx')
const ExcelJS = require('exceljs')
const pptxgen = require('pptxgenjs')
const JSZip = require('jszip')

const {
  Document, Packer, Paragraph, TextRun, Table: DocxTable, TableRow, TableCell,
  BorderStyle, HeadingLevel, AlignmentType, WidthType, TableLayoutType,
  ShadingType, convertInchesToTwip
} = docx

// ─────────────────────────────────────────────────────────────
// 공통 헬퍼
// ─────────────────────────────────────────────────────────────
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function getPlainTextFromNormalized(block: any): string {
  if (!block.content) return ''
  return block.content.map((c: any) => c.text || '').join('')
}

function inlineToText(inline: any[]): string {
  return inline.map(c => c.text || '').join('')
}

function inlineToHTML(inline: any[]): string {
  return inline.map(c => {
    if (!c || !c.text) return ''
    let txt = escapeHtml(c.text)
    if (c.styles?.bold) txt = `<strong>${txt}</strong>`
    if (c.styles?.italic) txt = `<em>${txt}</em>`
    if (c.styles?.underline) txt = `<u>${txt}</u>`
    if (c.styles?.strike) txt = `<del>${txt}</del>`
    if (c.styles?.textColor) txt = `<span style="color:${c.styles.textColor}">${txt}</span>`
    if (c.type === 'link') txt = `<a href="${c.text}" style="color:#8b5cf6">${txt}</a>`
    return txt
  }).join('')
}

// ══════════════════════════════════════════════════════════════
// 1. HTML 내보내기 (백엔드 분산 변환 노드 버전)
// ══════════════════════════════════════════════════════════════
export function blocksToHTML(blocks: any[]): string {
  const css = `
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Fira+Code:wght@400;500&display=swap');
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Inter', -apple-system, sans-serif; background: #fff; color: #1f2937; line-height: 1.7; font-size: 15px; }
    .doc-container { max-width: 780px; margin: 0 auto; padding: 48px 56px; }
    h1 { font-size: 2.2rem; font-weight: 800; color: #111827; margin: 2rem 0 1rem; border-bottom: 2px solid #e5e7eb; padding-bottom: 0.5rem; }
    h2 { font-size: 1.6rem; font-weight: 700; color: #1f2937; margin: 1.8rem 0 0.8rem; }
    h3 { font-size: 1.2rem; font-weight: 600; color: #374151; margin: 1.4rem 0 0.6rem; }
    p { margin-bottom: 1rem; color: #374151; }
    ul, ol { padding-left: 1.6rem; margin-bottom: 1rem; }
    li { margin-bottom: 0.4rem; }
    pre { background: #0f172a; border-radius: 10px; padding: 20px 24px; overflow-x: auto; margin: 1.2rem 0; border: 1px solid #1e293b; }
    code { font-family: 'Fira Code', 'Consolas', monospace; font-size: 13px; background: #f1f5f9; padding: 2px 6px; border-radius: 4px; color: #7c3aed; }
    pre code { background: transparent; padding: 0; color: #a3e635; font-size: 13px; white-space: pre; line-height: 1.65; }
    .lang-badge { font-family: 'Fira Code', monospace; font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.08em; display: block; margin-bottom: 10px; }
    table { border-collapse: collapse; width: 100%; margin: 1.2rem 0; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; }
    th { background: #f8fafc; font-weight: 700; padding: 11px 16px; text-align: left; font-size: 13px; border-bottom: 2px solid #e5e7eb; }
    td { padding: 10px 16px; font-size: 14px; border-bottom: 1px solid #f1f5f9; }
    tr:last-child td { border-bottom: none; }
    blockquote { border-left: 4px solid #8b5cf6; padding: 12px 20px; background: #faf5ff; border-radius: 0 8px 8px 0; margin: 1rem 0; }
    img { max-width: 100%; border-radius: 8px; margin: 1rem 0; }
    hr { border: none; border-top: 1px solid #e5e7eb; margin: 2rem 0; }
    @media print { body { font-size: 12pt; } .doc-container { padding: 0; } }
  `

  let body = ''
  let listType: 'ul' | 'ol' | null = null

  const closeList = () => {
    if (listType) { body += `</${listType}>\n`; listType = null }
  }

  const renderBlock = (block: any, depth = 0): string => {
    const indent = depth > 0 ? ` style="margin-left:${depth * 20}px"` : ''
    const contentHtml = inlineToHTML(block.content || [])

    switch (block.type) {
      case 'heading': {
        const lvl = Math.min(6, Math.max(1, Number(block.props?.level) || 1))
        return `<h${lvl}>${contentHtml}</h${lvl}>\n`
      }
      case 'paragraph':
        return `<p>${contentHtml || '&nbsp;'}</p>\n`
      case 'bulletListItem':
        return `<li${indent}>${contentHtml}${
          block.children?.length ? `<ul>${block.children.map((c: any) => renderBlock(c, depth + 1)).join('')}</ul>` : ''
        }</li>\n`
      case 'numberedListItem':
        return `<li${indent}>${contentHtml}${
          block.children?.length ? `<ol>${block.children.map((c: any) => renderBlock(c, depth + 1)).join('')}</ol>` : ''
        }</li>\n`
      case 'codeBlock': {
        const lang = block.props?.language || ''
        const code = escapeHtml(getPlainTextFromNormalized(block))
        return `<pre><span class="lang-badge">${escapeHtml(lang)}</span><code class="language-${lang}">${code}</code></pre>\n`
      }
      case 'checkListItem': {
        const checked = block.props?.checked ? 'checked' : ''
        return `<li style="list-style:none;display:flex;gap:8px"><input type="checkbox" ${checked} disabled /><span>${contentHtml}</span></li>\n`
      }
      case 'image': {
        const url = block.props?.url || ''
        const caption = block.props?.caption || ''
        return `<figure style="text-align:center;margin:1.2rem 0"><img src="${url}" alt="${escapeHtml(caption)}" />${caption ? `<figcaption style="font-size:12px;color:#9ca3af;margin-top:6px">${escapeHtml(caption)}</figcaption>` : ''}</figure>\n`
      }
      case 'table': {
        const rows = block.tableRows ?? []
        if (rows.length === 0) return ''
        let html = '<table>\n<tbody>\n'
        rows.forEach((row: any, ri: number) => {
          html += '<tr>\n'
          const cells = Array.isArray(row.cells) ? row.cells : []
          cells.forEach((cell: any) => {
            const cellText = Array.isArray(cell) ? inlineToText(cell) : ''
            const tag = ri === 0 ? 'th' : 'td'
            html += `<${tag}>${escapeHtml(cellText)}</${tag}>\n`
          })
          html += '</tr>\n'
        })
        html += '</tbody>\n</table>\n'
        return html
      }
      case 'quote':
        return `<blockquote>${contentHtml}</blockquote>\n`
      case 'divider':
        return '<hr />\n'
      default:
        return contentHtml ? `<p>${contentHtml}</p>\n` : ''
    }
  }

  blocks.forEach((block) => {
    if (block.type === 'bulletListItem') {
      if (listType !== 'ul') { closeList(); body += '<ul>\n'; listType = 'ul' }
      body += renderBlock(block)
    } else if (block.type === 'numberedListItem') {
      if (listType !== 'ol') { closeList(); body += '<ol>\n'; listType = 'ol' }
      body += renderBlock(block)
    } else {
      closeList()
      body += renderBlock(block)
    }
  })
  closeList()

  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>AMEVA Document</title>
  <style>${css}</style>
</head>
<body>
<div class="doc-container">
${body}
</div>
</body>
</html>`
}

// ══════════════════════════════════════════════════════════════
// 2. Word (DOCX) 내보내기 (백엔드 분산 변환 노드 버전)
// ══════════════════════════════════════════════════════════════
export async function exportToWord(blocks: any[]): Promise<Buffer> {
  const docChildren: any[] = []
  const headingSizes: Record<number, number> = { 1: 44, 2: 36, 3: 28 }
  const headingColors: Record<number, string> = { 1: '111827', 2: '1f2937', 3: '374151' }

  const inlineToRuns = (inline: any[]): any[] =>
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

  const addBlock = (block: any, depth = 0) => {
    const runs = inlineToRuns(block.content || [])
    const plainText = getPlainTextFromNormalized(block)

    switch (block.type) {
      case 'heading': {
        const level = Math.min(3, Math.max(1, Number(block.props?.level) || 1))
        const hLevel = level === 1 ? HeadingLevel.HEADING_1 : level === 2 ? HeadingLevel.HEADING_2 : HeadingLevel.HEADING_3
        const hRuns = (block.content || []).length > 0
          ? block.content.map((c: any) => new TextRun({ text: c.text, bold: true, font: 'Calibri', size: headingSizes[level] || 28, color: headingColors[level] || '374151' }))
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
            const docxRows = rows.map((row: any, ri: number) => {
              const cells = Array.isArray(row.cells) ? row.cells : []
              const docxCells = cells.map((cell: any) => {
                const cellText = Array.isArray(cell) ? inlineToText(cell) : ''
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
      block.children.forEach((child: any) => addBlock(child, depth + 1))
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
// 3. Excel (XLSX) 내보내기 (백엔드 분산 변환 노드 버전)
// ══════════════════════════════════════════════════════════════
export async function exportToExcel(blocks: any[]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'AMEVA Workstation'
  wb.created = new Date()

  const mainSheet = wb.addWorksheet('문서 본문')
  mainSheet.getColumn('A').width = 4
  mainSheet.getColumn('B').width = 65
  for (let c = 3; c <= 10; c++) {
    mainSheet.getColumn(c).width = 18
  }

  const titleRow = mainSheet.addRow(['', 'AMEVA Document structured Report'])
  titleRow.getCell(2).font = { name: '맑은 고딕', size: 16, bold: true, color: { argb: 'FF8B5CF6' } }
  mainSheet.addRow([])

  let excelRowIdx = 3
  let tableCount = 0
  const headingPath: string[] = []

  const writeBlockToExcel = (block: any, depth = 0) => {
    const text = getPlainTextFromNormalized(block)
    const indentCol = depth > 0 ? ' '.repeat(depth * 3) : ''

    switch (block.type) {
      case 'heading': {
        const level = Number(block.props?.level) || 1
        headingPath[level - 1] = text
        headingPath.splice(level)

        const fontSizes: Record<number, number> = { 1: 15, 2: 13, 3: 11 }
        const row = mainSheet.addRow(['', `${indentCol}${text}`])
        row.getCell(2).font = { name: '맑은 고딕', size: fontSizes[level] || 11, bold: true }
        row.getCell(2).border = { bottom: { style: 'medium', color: { argb: 'FFD1D5DB' } } }
        mainSheet.addRow([])
        excelRowIdx += 2
        break
      }
      case 'paragraph': {
        if (text.trim()) {
          const row = mainSheet.addRow(['', `${indentCol}${text}`])
          row.getCell(2).alignment = { wrapText: true, vertical: 'middle' }
          row.getCell(2).font = { name: '맑은 고딕', size: 10 }
          excelRowIdx++
        }
        break
      }
      case 'bulletListItem': {
        if (text.trim()) {
          const row = mainSheet.addRow(['', `${indentCol}• ${text}`])
          row.getCell(2).alignment = { wrapText: true }
          row.getCell(2).font = { name: '맑은 고딕', size: 10 }
          excelRowIdx++
        }
        break
      }
      case 'numberedListItem': {
        if (text.trim()) {
          const row = mainSheet.addRow(['', `${indentCol}1. ${text}`])
          row.getCell(2).alignment = { wrapText: true }
          row.getCell(2).font = { name: '맑은 고딕', size: 10 }
          excelRowIdx++
        }
        break
      }
      case 'table': {
        const rows = block.tableRows ?? []
        if (rows.length > 0) {
          tableCount++
          mainSheet.addRow(['', `[표 ${tableCount}]`])
          mainSheet.getRow(excelRowIdx + 1).getCell(2).font = { name: '맑은 고딕', size: 9, italic: true, color: { argb: 'FF9CA3AF' } }
          excelRowIdx++

          rows.forEach((tblRow: any, ri: number) => {
            const cells = Array.isArray(tblRow.cells) ? tblRow.cells : []
            const rowData = ['', ...cells.map(cell => Array.isArray(cell) ? inlineToText(cell) : '')]
            const addedRow = mainSheet.addRow(rowData)
            
            cells.forEach((_, ci) => {
              const cell = addedRow.getCell(ci + 2)
              cell.font = { name: '맑은 고딕', size: 9.5, bold: ri === 0 }
              cell.alignment = { wrapText: true, vertical: 'middle', horizontal: 'center' }
              cell.border = {
                top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
                left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
                bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
                right: { style: 'thin', color: { argb: 'FFE5E7EB' } }
              }
              if (ri === 0) {
                cell.fill = {
                  type: 'pattern',
                  pattern: 'solid',
                  fgColor: { argb: 'FFF1F5F9' }
                }
              }
            })
            excelRowIdx++
          })
          mainSheet.addRow([])
          excelRowIdx++

          const sheetName = `표_${tableCount}`.slice(0, 31)
          const ws = wb.addWorksheet(sheetName)
          const path = headingPath.filter(Boolean)
          if (path.length > 0) {
            ws.addRow([`위치: ${path.join(' > ')}`])
            ws.addRow([])
          }

          rows.forEach((tblRow: any, ri: number) => {
            const cells = Array.isArray(tblRow.cells) ? tblRow.cells : []
            const rowData = cells.map(cell => Array.isArray(cell) ? inlineToText(cell) : '')
            const addedRow = ws.addRow(rowData)

            addedRow.eachCell(cell => {
              cell.font = { name: '맑은 고딕', size: 10, bold: ri === 0 }
              cell.border = {
                top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
                left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
                bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
                right: { style: 'thin', color: { argb: 'FFE5E7EB' } }
              }
              if (ri === 0) {
                cell.fill = {
                  type: 'pattern',
                  pattern: 'solid',
                  fgColor: { argb: 'FFF8FAFC' }
                }
              }
            })
          })

          ws.columns.forEach(col => {
            let maxLen = 10
            col.eachCell({ includeEmpty: false }, cell => {
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

        lines.forEach(line => {
          const row = mainSheet.addRow(['', `  ${line}`])
          row.getCell(2).font = { name: 'Consolas', size: 9, color: { argb: 'FF0F172A' } }
          row.getCell(2).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFF8FAFC' }
          }
          excelRowIdx++
        })
        mainSheet.addRow([])
        excelRowIdx++
        break
      }
      default:
        break
    }

    if (Array.isArray(block.children)) {
      block.children.forEach(c => writeBlockToExcel(c, depth + 1))
    }
  }

  blocks.forEach(b => writeBlockToExcel(b))

  if (excelRowIdx <= 3) {
    const ws = wb.addWorksheet('데이터 없음')
    ws.addRow(['이 문서에는 본문 텍스트 또는 표 데이터가 없습니다.'])
  }

  const buffer = await wb.xlsx.writeBuffer()
  return Buffer.from(buffer)
}

// ══════════════════════════════════════════════════════════════
// 4. PPTX 내보내기 (백엔드 분산 변환 노드 버전)
// ══════════════════════════════════════════════════════════════
export async function exportToPPTX(blocks: any[]): Promise<Buffer> {
  const pptx = new pptxgen()
  pptx.layout = 'LAYOUT_16x9'
  pptx.author = 'AMEVA'

  interface SlideContent {
    type: 'bullet' | 'image' | 'table' | 'code'
    text?: string
    url?: string
    tableRows?: any[]
  }

  interface SlideData {
    title: string
    contents: SlideContent[]
  }

  const slides: SlideData[] = []
  let currentSlide: SlideData = { title: 'Presentation', contents: [] }

  const processBlock = (block: any) => {
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

  // 표지 슬라이드 생성
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
        const formattedTableData = rawRows.map((rowObj: any, ri: number) => {
          const cells = Array.isArray(rowObj.cells) ? rowObj.cells : []
          return cells.map(cell => {
            const txt = Array.isArray(cell) ? inlineToText(cell) : ''
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

// ══════════════════════════════════════════════════════════════
// 5. HWPX 내보내기 (백엔드 분산 변환 노드 버전)
// ══════════════════════════════════════════════════════════════
export async function exportToHWPX(blocks: any[]): Promise<Buffer> {
  const zip = new JSZip()
  zip.file('mimetype', 'application/hwp+zip', { compression: 'STORE' })
  zip.file('_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.hancom.co.kr/hwpml/2011/relation/document" Target="Contents/content.hwpml"/>
</Relationships>`)
  zip.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="xml" ContentType="application/xml"/>
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="hwpml" ContentType="application/vnd.hancom.hwpml+xml"/>
  <Override PartName="/Contents/content.hwpml" ContentType="application/vnd.hancom.hwpml+xml"/>
  <Override PartName="/Contents/section0.xml" ContentType="application/vnd.hancom.hwpml+xml"/>
</Types>`)

  let section0 = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<hs:sec xmlns:hs="http://schemas.hancom.co.kr/hwpml/2011/section" version="1.0">`

  const toHWPML = (block: any): string => {
    const text = escapeHtml(getPlainTextFromNormalized(block))
    let charId = '0'
    if (block.type === 'heading') {
      const lvl = Number(block.props?.level) || 1
      charId = lvl === 1 ? '1' : lvl === 2 ? '2' : '3'
    } else if (block.type === 'codeBlock') {
      charId = '4'
    }

    if (block.type === 'table') {
      const rows = block.tableRows ?? []
      if (rows.length === 0) return ''
      const colCnt = (rows[0]?.cells?.length) || 1
      let tbl = `<hp:tbl xmlns:hp="http://schemas.hancom.co.kr/hwpml/2011/paragraph" borderType="1" colCnt="${colCnt}" rowCnt="${rows.length}">`
      rows.forEach((row: any) => {
        tbl += '<hp:tr>'
        const cells = Array.isArray(row.cells) ? row.cells : []
        cells.forEach((cell: any) => {
          const ct = escapeHtml(Array.isArray(cell) ? inlineToText(cell) : '')
          tbl += `<hp:tc><hp:p charPrRef="0"><hp:run><hp:t>${ct}</hp:t></hp:run></hp:p></hp:tc>`
        })
        tbl += '</hp:tr>'
      })
      tbl += '</hp:tbl>'
      return tbl
    }

    const lines = (block.type === 'codeBlock' ? getPlainTextFromNormalized(block) : text).split('\n')
    let result = lines.map(line =>
      `<hp:p xmlns:hp="http://schemas.hancom.co.kr/hwpml/2011/paragraph" charPrRef="${charId}"><hp:run><hp:t>${escapeHtml(line) || ' '}</hp:t></hp:run></hp:p>`
    ).join('')

    if (Array.isArray(block.children)) block.children.forEach(c => { result += toHWPML(c) })
    return result
  }

  blocks.forEach(b => { section0 += toHWPML(b) })
  section0 += '</hs:sec>'

  zip.file('Contents/section0.xml', section0)
  zip.file('Contents/header.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<hh:idmap xmlns:hh="http://schemas.hancom.co.kr/hwpml/2011/header" version="1.0">
  <hh:fontFaces>
    <hh:fontFace id="0" lang="hangul" face="맑은 고딕"/>
    <hh:fontFace id="1" lang="hangul" face="나눔고딕 ExtraBold"/>
    <hh:fontFace id="2" lang="latin" face="Consolas"/>
  </hh:fontFaces>
  <hh:charProperties>
    <hh:charPr id="0" height="1000" fontRef="0"/>
    <hh:charPr id="1" height="1800" bold="true" fontRef="1"/>
    <hh:charPr id="2" height="1400" bold="true" fontRef="1"/>
    <hh:charPr id="3" height="1100" bold="true" fontRef="1"/>
    <hh:charPr id="4" height="900" fontRef="2"/>
  </hh:charProperties>
  <hh:tabProperties><hh:tabPr id="0"/></hh:tabProperties>
  <hh:numberings/>
</hh:idmap>`)
  zip.file('Contents/content.hwpml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<hc:hwpml xmlns:hc="http://schemas.hancom.co.kr/hwpml/2011/core" version="1.0">
  <hc:head target="Contents/header.xml"/>
  <hc:body>
    <hc:sec target="Contents/section0.xml"/>
  </hc:body>
</hc:hwpml>`)

  const blob = await zip.generateAsync({ type: 'nodebuffer' })
  return Buffer.from(blob)
}

// ══════════════════════════════════════════════════════════════
// 6. XML 내보내기 (백엔드 분산 변환 노드 버전)
// ══════════════════════════════════════════════════════════════
export function exportToXML(blocks: any[]): string {
  const renderXML = (block: any, indent = '  '): string => {
    let xml = `${indent}<block id="${block.id}" type="${block.type}">\n`

    if (Object.keys(block.props || {}).length > 0) {
      xml += `${indent}  <props>\n`
      for (const [k, v] of Object.entries(block.props)) {
        xml += `${indent}    <prop name="${k}"><![CDATA[${v}]]></prop>\n`
      }
      xml += `${indent}  </props>\n`
    }

    if (block.type === 'table') {
      const rows = block.tableRows ?? []
      xml += `${indent}  <table>\n`
      rows.forEach((row: any) => {
        xml += `${indent}    <row>\n`
        const cells = Array.isArray(row.cells) ? row.cells : []
        cells.forEach((cell: any) => {
          xml += `${indent}      <cell><![CDATA[${Array.isArray(cell) ? inlineToText(cell) : ''}]]></cell>\n`
        })
        xml += `${indent}    </row>\n`
      })
      xml += `${indent}  </table>\n`
    } else {
      xml += `${indent}  <content><![CDATA[${getPlainTextFromNormalized(block)}]]></content>\n`
    }

    if (Array.isArray(block.children) && block.children.length > 0) {
      xml += `${indent}  <children>\n`
      block.children.forEach(c => { xml += renderXML(c, indent + '    ') })
      xml += `${indent}  </children>\n`
    }

    xml += `${indent}</block>\n`
    return xml
  }

  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`
  xml += `<!-- AMEVA Document Export: ${new Date().toISOString()} -->\n`
  xml += `<document>\n`
  blocks.forEach(b => { xml += renderXML(b) })
  xml += `</document>`
  return xml
}
