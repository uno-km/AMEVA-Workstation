import { createRequire } from 'module'
const require = createRequire(import.meta.url)

const docx = require('docx')
import { getPlainTextFromNormalized, inlineToText, type ExporterBlock, type ExporterInlineContent, type ExporterTableRow } from './exportersHelper.js'

const {
  Document, Packer, Paragraph, TextRun, Table: DocxTable, TableRow, TableCell,
  BorderStyle, HeadingLevel, AlignmentType, WidthType, TableLayoutType,
  ShadingType, convertInchesToTwip
} = docx

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
