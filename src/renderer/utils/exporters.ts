/**
 * exporters.ts
 * ──────────────────────────────────────────────────────────────
 * 모든 export 함수는 normalizeBlocks()를 통과한 NormalizedBlock[]만 처리.
 * raw editor.document를 직접 처리하지 않는다.
 *
 * 안정 구현: Markdown, HTML, PDF(=HTML), DOCX
 * 불안정(disabled 표시용 유지): XLSX, PPTX, HWPX, XML
 * ──────────────────────────────────────────────────────────────
 */
import {
  Document, Packer, Paragraph, TextRun, Table as DocxTable, TableRow, TableCell,
  BorderStyle, HeadingLevel, AlignmentType, WidthType, TableLayoutType,
  ShadingType, convertInchesToTwip,
} from 'docx'
import * as XLSX from 'xlsx'
import pptxgen from 'pptxgenjs'
import JSZip from 'jszip'
import type { NormalizedBlock, NormalizedInlineContent } from './normalizeBlocks'
import { getPlainTextFromNormalized, inlineToText } from './normalizeBlocks'

// re-export so App.tsx가 기존 import 경로로도 사용 가능
export type { NormalizedBlock as Block }

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

function inlineToHTML(inline: NormalizedInlineContent[]): string {
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
// 1. HTML 내보내기
// ══════════════════════════════════════════════════════════════
export function blocksToHTML(rawBlocks: any): string {
  // 방어: normalizeBlocks는 App.tsx에서 호출하지만, 여기서도 한 번 더 검증
  const blocks: NormalizedBlock[] = Array.isArray(rawBlocks) ? rawBlocks : []

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

  const renderBlock = (block: NormalizedBlock, depth = 0): string => {
    const indent = depth > 0 ? ` style="margin-left:${depth * 20}px"` : ''
    const contentHtml = inlineToHTML(block.content)

    switch (block.type) {
      case 'heading': {
        const lvl = Math.min(6, Math.max(1, Number(block.props?.level) || 1))
        return `<h${lvl}>${contentHtml}</h${lvl}>\n`
      }
      case 'paragraph':
        return `<p>${contentHtml || '&nbsp;'}</p>\n`
      case 'bulletListItem':
        return `<li${indent}>${contentHtml}${
          block.children?.length ? `<ul>${block.children.map(c => renderBlock(c, depth + 1)).join('')}</ul>` : ''
        }</li>\n`
      case 'numberedListItem':
        return `<li${indent}>${contentHtml}${
          block.children?.length ? `<ol>${block.children.map(c => renderBlock(c, depth + 1)).join('')}</ol>` : ''
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
        rows.forEach((row, ri) => {
          html += '<tr>\n'
          const cells = Array.isArray(row.cells) ? row.cells : []
          cells.forEach((cell) => {
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
// 2. Word (DOCX) 내보내기
// ══════════════════════════════════════════════════════════════
export async function exportToWord(rawBlocks: any): Promise<Blob> {
  const blocks: NormalizedBlock[] = Array.isArray(rawBlocks) ? rawBlocks : []
  const docChildren: any[] = []

  const headingSizes: Record<number, number> = { 1: 44, 2: 36, 3: 28 }
  const headingColors: Record<number, string> = { 1: '111827', 2: '1f2937', 3: '374151' }

  const inlineToRuns = (inline: NormalizedInlineContent[]): TextRun[] =>
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

  const addBlock = (block: NormalizedBlock, depth = 0) => {
    const runs = inlineToRuns(block.content)
    const plainText = getPlainTextFromNormalized(block)

    switch (block.type) {
      case 'heading': {
        const level = Math.min(3, Math.max(1, Number(block.props?.level) || 1))
        const hLevel = level === 1 ? HeadingLevel.HEADING_1 : level === 2 ? HeadingLevel.HEADING_2 : HeadingLevel.HEADING_3
        const hRuns = block.content.length > 0
          ? block.content.map(c => new TextRun({ text: c.text, bold: true, font: 'Calibri', size: headingSizes[level] || 28, color: headingColors[level] || '374151' }))
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
            const docxRows: TableRow[] = rows.map((row, ri) => {
              const cells = Array.isArray(row.cells) ? row.cells : []
              const docxCells = cells.map((cell) => {
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
      block.children.forEach(child => addBlock(child, depth + 1))
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

  return await Packer.toBlob(doc)
}

// ══════════════════════════════════════════════════════════════
// 3. Excel (XLSX) 내보내기 — 테이블만 추출
// ══════════════════════════════════════════════════════════════
export function exportToExcel(rawBlocks: any): Uint8Array {
  const blocks: NormalizedBlock[] = Array.isArray(rawBlocks) ? rawBlocks : []
  const wb = XLSX.utils.book_new()
  let tableCount = 0

  const metaSheet = XLSX.utils.aoa_to_sheet([
    ['AMEVA Document Export'],
    ['생성 일시', new Date().toLocaleString('ko-KR')],
    [''],
  ])
  XLSX.utils.book_append_sheet(wb, metaSheet, '문서 정보')

  const findTables = (list: NormalizedBlock[], headingPath: string[] = []) => {
    list.forEach(block => {
      if (block.type === 'heading') {
        const level = Number(block.props?.level) || 1
        headingPath[level - 1] = getPlainTextFromNormalized(block)
        headingPath.splice(level)
      }

      if (block.type === 'table') {
        tableCount++
        const rows = block.tableRows ?? []
        if (rows.length > 0) {
          const sheetData: any[][] = []
          if (headingPath.length > 0) {
            sheetData.push([`위치: ${headingPath.filter(Boolean).join(' > ')}`])
            sheetData.push([])
          }
          rows.forEach(row => {
            const cells = Array.isArray(row.cells) ? row.cells : []
            const rowData = cells.map(cell => Array.isArray(cell) ? inlineToText(cell) : '')
            sheetData.push(rowData)
          })
          const ws = XLSX.utils.aoa_to_sheet(sheetData)
          const colWidths = (sheetData[0] || []).map((_: any, ci: number) => ({
            wch: Math.min(50, Math.max(10, ...sheetData.map(row => (row[ci] ? String(row[ci]).length : 0))))
          }))
          ws['!cols'] = colWidths
          XLSX.utils.book_append_sheet(wb, ws, `표_${tableCount}`.slice(0, 31))
        }
      }

      if (Array.isArray(block.children)) findTables(block.children, [...headingPath])
    })
  }

  findTables(blocks)

  if (tableCount === 0) {
    const ws = XLSX.utils.aoa_to_sheet([
      ['이 문서에는 추출할 표 데이터가 없습니다.'],
      ['표(Table) 블록을 문서에 추가한 후 다시 시도하세요.'],
    ])
    XLSX.utils.book_append_sheet(wb, ws, '데이터 없음')
  }

  return new Uint8Array(XLSX.write(wb, { bookType: 'xlsx', type: 'array' }))
}

// ══════════════════════════════════════════════════════════════
// 4. PPTX 내보내기
// ══════════════════════════════════════════════════════════════
export async function exportToPPTX(rawBlocks: any): Promise<any> {
  const blocks: NormalizedBlock[] = Array.isArray(rawBlocks) ? rawBlocks : []
  const pptx = new pptxgen()
  pptx.layout = 'LAYOUT_16x9'
  pptx.author = 'AMEVA'

  interface SlideData { title: string; bullets: string[]; images: string[]; codeBlocks: string[] }
  const slides: SlideData[] = []
  let current: SlideData = { title: '제목 없음', bullets: [], images: [], codeBlocks: [] }

  const processBlock = (block: NormalizedBlock) => {
    const text = getPlainTextFromNormalized(block)
    if (block.type === 'heading') {
      const level = Number(block.props?.level) || 1
      if (level === 1) {
        if (current.bullets.length > 0 || current.images.length > 0 || current.title !== '제목 없음') slides.push(current)
        current = { title: text, bullets: [], images: [], codeBlocks: [] }
      } else { current.bullets.push(`• ${text}`) }
    } else if (['bulletListItem', 'numberedListItem', 'paragraph'].includes(block.type)) {
      if (text.trim()) current.bullets.push(text)
    } else if (block.type === 'codeBlock') {
      current.codeBlocks.push(text.slice(0, 200))
    } else if (block.type === 'image' && block.props?.url) {
      current.images.push(block.props.url)
    }
    if (Array.isArray(block.children)) block.children.forEach(processBlock)
  }

  blocks.forEach(processBlock)
  if (current.bullets.length > 0 || current.images.length > 0 || current.title !== '제목 없음') slides.push(current)
  if (slides.length === 0) slides.push({ title: 'AMEVA Presentation', bullets: ['내용을 여기에 추가하세요.'], images: [], codeBlocks: [] })

  const coverSlide = pptx.addSlide()
  coverSlide.background = { fill: '060610' }
  coverSlide.addShape(pptx.shapes.RECTANGLE, { x: 0, y: 6.2, w: 13.33, h: 0.06, fill: { type: 'solid', color: '8b5cf6' }, line: { color: '8b5cf6' } })
  coverSlide.addText('AMEVA', { x: 0.6, y: 1.6, w: 12, h: 0.8, fontSize: 18, bold: true, color: '8b5cf6', fontFace: 'Calibri', charSpacing: 8 })
  coverSlide.addText(slides[0]?.title || 'Presentation', { x: 0.6, y: 2.2, w: 12, h: 2, fontSize: 48, bold: true, color: 'FFFFFF', fontFace: 'Calibri' })
  coverSlide.addText(new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' }), { x: 0.6, y: 5.6, w: 6, h: 0.4, fontSize: 13, color: '6B7280', fontFace: 'Calibri' })

  slides.forEach((slideData, idx) => {
    const slide = pptx.addSlide()
    slide.background = { fill: '0a0a18' }
    slide.addShape(pptx.shapes.RECTANGLE, { x: 0, y: 0, w: 0.06, h: 7.5, fill: { type: 'solid', color: idx % 2 === 0 ? '8b5cf6' : '06b6d4' }, line: { color: idx % 2 === 0 ? '8b5cf6' : '06b6d4' } })
    slide.addText(slideData.title, { x: 0.4, y: 0.35, w: 12.5, h: 0.9, fontSize: 32, bold: true, color: 'FFFFFF', fontFace: 'Calibri' })
    slide.addShape(pptx.shapes.RECTANGLE, { x: 0.4, y: 1.2, w: 12.5, h: 0.02, fill: { type: 'solid', color: idx % 2 === 0 ? '8b5cf669' : '06b6d469' }, line: { color: 'transparent' } })
    slide.addText(`${idx + 1} / ${slides.length}`, { x: 11.5, y: 6.9, w: 1.5, h: 0.3, fontSize: 9, color: '4B5563', fontFace: 'Calibri', align: 'right' })
    const hasImage = slideData.images.length > 0
    const contentWidth = hasImage ? 7.2 : 12.5
    if (slideData.bullets.length > 0) {
      const bulletItems = slideData.bullets.map(b => ({ text: b, options: { fontSize: 17, color: 'D1D5DB', fontFace: 'Calibri', paraSpaceAfter: 8 } }))
      slide.addText(bulletItems, { x: 0.4, y: 1.4, w: contentWidth, h: 5.2, valign: 'top' })
    }
    if (slideData.codeBlocks.length > 0 && slideData.bullets.length === 0) {
      slide.addText(slideData.codeBlocks[0].slice(0, 300), { x: 0.4, y: 1.5, w: contentWidth, h: 4.5, fontSize: 12, color: 'A3E635', fontFace: 'Courier New', fill: { color: '0F172A' }, line: { color: '1E293B', width: 1 } })
    }
    if (hasImage && slideData.images[0].startsWith('http')) {
      try { slide.addImage({ path: slideData.images[0], x: 7.9, y: 1.4, w: 5, h: 4.5, sizing: { type: 'contain', w: 5, h: 4.5 } }) } catch {}
    }
  })

  return pptx.write('arraybuffer')
}

// ══════════════════════════════════════════════════════════════
// 5. HWPX 내보내기
// ══════════════════════════════════════════════════════════════
export async function exportToHWPX(rawBlocks: any): Promise<Blob> {
  const blocks: NormalizedBlock[] = Array.isArray(rawBlocks) ? rawBlocks : []
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

  const toHWPML = (block: NormalizedBlock): string => {
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
      rows.forEach(row => {
        tbl += '<hp:tr>'
        const cells = Array.isArray(row.cells) ? row.cells : []
        cells.forEach(cell => {
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

  return await zip.generateAsync({ type: 'blob' })
}

// ══════════════════════════════════════════════════════════════
// 6. XML 내보내기
// ══════════════════════════════════════════════════════════════
export function exportToXML(rawBlocks: any): string {
  const blocks: NormalizedBlock[] = Array.isArray(rawBlocks) ? rawBlocks : []

  const renderXML = (block: NormalizedBlock, indent = '  '): string => {
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
      rows.forEach(row => {
        xml += `${indent}    <row>\n`
        const cells = Array.isArray(row.cells) ? row.cells : []
        cells.forEach(cell => {
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
