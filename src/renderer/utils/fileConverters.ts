import * as ipc from '../services/ipc/electronApiAdapter'
import { packMarkdownToADC, unpackADCToMarkdown } from './adcPackager'
import {
  blocksToHTML, exportToWord, exportToExcel, exportToHWPX
} from './exporters'
import JSZip from 'jszip'
import ExcelJS from 'exceljs'

export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = ''
  const bytes = new Uint8Array(buffer)
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return window.btoa(binary)
}

export function triggerBrowserDownload(data: Blob | string, filename: string) {
  const blob = typeof data === 'string' ? new Blob([data], { type: 'text/plain' }) : data
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export function convertMarkdownToIpynb(markdown: string): string {
  const cells: any[] = []
  const lines = markdown.split('\n')
  let currentMarkdownLines: string[] = []
  let isCodeBlock = false
  let codeBlockLines: string[] = []
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (line.trim().startsWith('```')) {
      if (isCodeBlock) {
        cells.push({
          cell_type: 'code',
          execution_count: null,
          metadata: {},
          outputs: [],
          source: codeBlockLines.map((l, idx) => idx === codeBlockLines.length - 1 ? l : l + '\n')
        })
        codeBlockLines = []
        isCodeBlock = false
      } else {
        if (currentMarkdownLines.length > 0) {
          cells.push({
            cell_type: 'markdown',
            metadata: {},
            source: currentMarkdownLines.map((l, idx) => idx === currentMarkdownLines.length - 1 ? l : l + '\n')
          })
          currentMarkdownLines = []
        }
        isCodeBlock = true
      }
    } else {
      if (isCodeBlock) {
        codeBlockLines.push(line)
      } else {
        currentMarkdownLines.push(line)
      }
    }
  }
  
  if (currentMarkdownLines.length > 0) {
    cells.push({
      cell_type: 'markdown',
      metadata: {},
      source: currentMarkdownLines.map((l, idx) => idx === currentMarkdownLines.length - 1 ? l : l + '\n')
    })
  }
  
  const notebook = {
    cells,
    metadata: {
      kernelspec: { display_name: 'Python 3', language: 'python', name: 'python3' }
    },
    nbformat: 4,
    nbformat_minor: 2
  }
  return JSON.stringify(notebook, null, 2)
}

export async function convertMarkdownToBinary(editorInstance: any, filePath: string): Promise<string> {
  const ext = filePath.split('.').pop()?.toLowerCase() || ''
  
  const copyBlocks = (blocks: any[]): any[] => {
    return blocks.map(block => {
      const copy = { ...block }
      if (copy.type === 'jupyter') {
        copy.type = 'codeBlock'
        const lang = copy.props?.language || 'javascript'
        const finalCodeText = copy.props?.code || ''
        copy.content = [{ type: 'text', text: finalCodeText, styles: {} }]
        copy.props = { language: lang }
      } else if (copy.children) {
        copy.children = copyBlocks(copy.children)
      }
      return copy
    })
  }
  const rawBlocks = copyBlocks(editorInstance.document)
  
  if (ext === 'docx') {
    const blob = await exportToWord(rawBlocks)
    const arrayBuffer = await blob.arrayBuffer()
    return arrayBufferToBase64(arrayBuffer as ArrayBuffer)
  }
  
  if (ext === 'xlsx') {
    const uint8 = await exportToExcel(rawBlocks)
    return arrayBufferToBase64(uint8.buffer as ArrayBuffer)
  }
  
  if (ext === 'hwpx') {
    const blob = await exportToHWPX(rawBlocks)
    const arrayBuffer = await blob.arrayBuffer()
    return arrayBufferToBase64(arrayBuffer as ArrayBuffer)
  }
  
  if (ext === 'pdf') {
    const html = blocksToHTML(rawBlocks)
    if (ipc.isElectronEnv()) {
      const base64 = await ipc.printToPDF(html)
      return base64 || ''
    }
    // [HIGH-002] 브라우저 환경: 숨김 iframe + window.print() fallback
    await new Promise<void>((resolve) => {
      const iframe = document.createElement('iframe')
      iframe.style.position = 'fixed'
      iframe.style.top = '-9999px'
      iframe.style.left = '-9999px'
      iframe.style.width = '210mm'
      iframe.style.height = '297mm'
      document.body.appendChild(iframe)
      const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document
      if (iframeDoc) {
        iframeDoc.open()
        iframeDoc.write(html)
        iframeDoc.close()
        iframe.contentWindow?.focus()
        setTimeout(() => {
          iframe.contentWindow?.print()
          setTimeout(() => {
            document.body.removeChild(iframe)
            resolve()
          }, 500)
        }, 300)
      } else {
        document.body.removeChild(iframe)
        resolve()
      }
    })
    return ''
  }
  
  if (ext === 'adc') {
    const markdown = await editorInstance.blocksToMarkdownLossy(rawBlocks)
    const blob = await packMarkdownToADC(markdown)
    const arrayBuffer = await blob.arrayBuffer()
    return arrayBufferToBase64(arrayBuffer)
  }
  
  return ''
}

export async function parseFileToMarkdown(content: string, filePath: string, isBinary: boolean): Promise<string> {
  const ext = filePath.split('.').pop()?.toLowerCase() || ''
  
  if (!isBinary) {
    if (ext === 'ipynb') {
      try {
        const json = JSON.parse(content)
        const cells = json.cells || []
        const mdLines: string[] = []
        
        let kernelLang = 'python'
        try {
          kernelLang = json.metadata?.kernelspec?.language || 'python'
        } catch {}
        
        for (const cell of cells) {
          const source = Array.isArray(cell.source) ? cell.source.join('') : cell.source || ''
          if (cell.cell_type === 'markdown') {
            mdLines.push(source)
            mdLines.push('')
          } else if (cell.cell_type === 'code') {
            mdLines.push(`\`\`\`${kernelLang}`)
            mdLines.push(source)
            mdLines.push('```')
            mdLines.push('')
          }
        }
        return mdLines.join('\n')
      } catch (err: any) {
        return `Error parsing Jupyter Notebook: ${err.message}`
      }
    }
    return content
  }
  
  let binaryString = ''
  try {
    binaryString = window.atob(content.replace(/\s/g, ''))
  } catch (e) {
    console.warn('[parseFileToMarkdown] atob 디코딩 실패, 원본 텍스트 폴백 사용:', e)
    return content
  }
  
  const bytes = new Uint8Array(binaryString.length)
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i)
  }
  const arrayBuffer = bytes.buffer
  
  if (ext === 'docx') {
    try {
      const mammoth = await import('mammoth')
      const result = await (mammoth as any).convertToMarkdown({ arrayBuffer })
      return result.value
    } catch (err: any) {
      try {
        const zip = await JSZip.loadAsync(arrayBuffer)
        const docXml = await zip.file('word/document.xml')?.async('text')
        if (!docXml) return `Error parsing DOCX: word/document.xml not found`
        const pMatches = docXml.match(/<w:p[\s\S]*?>([\s\S]*?)<\/w:p>/g) || []
        const lines: string[] = []
        for (const pXml of pMatches) {
          const tMatches = pXml.match(/<w:t[\s\S]*?>([\s\S]*?)<\/w:t>/g) || []
          let pText = ''
          for (const tXml of tMatches) {
            const text = tXml.replace(/<w:t[\s\S]*?>/, '').replace('</w:t>', '')
            pText += text
          }
          if (pText) lines.push(pText)
        }
        return lines.join('\n\n')
      } catch (innerErr: any) {
        return `Error parsing DOCX: ${err.message} (Backup failed: ${innerErr.message})`
      }
    }
  }

  if (ext === 'adc') {
    try {
      const markdown = await unpackADCToMarkdown(arrayBuffer)
      return markdown
    } catch (err: any) {
      return `Error unpacking Ameva Document: ${err.message}`
    }
  }
  
  if (ext === 'hwpx') {
    try {
      const zip = await JSZip.loadAsync(arrayBuffer)
      const sectionXml = await zip.file('Contents/section0.xml')?.async('text')
      if (!sectionXml) return 'Error parsing HWPX: section0.xml not found'
      const pMatches = sectionXml.match(/<hp:p[\s\S]*?>([\s\S]*?)<\/hp:p>/g) || []
      const lines: string[] = []
      for (const pXml of pMatches) {
        const tMatches = pXml.match(/<hp:t[\s\S]*?>([\s\S]*?)<\/hp:t>/g) || []
        let pText = ''
        for (const tXml of tMatches) {
          const text = tXml.replace(/<hp:t[\s\S]*?>/, '').replace('</hp:t>', '')
          pText += text
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&amp;/g, '&')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
        }
        lines.push(pText.trim())
      }
      return lines.join('\n\n')
    } catch (err: any) {
      return `Error parsing HWPX: ${err.message}`
    }
  }
  
  if (ext === 'xlsx' || ext === 'xls') {
    try {
      const wb = new ExcelJS.Workbook()
      await wb.xlsx.load(bytes.buffer as ArrayBuffer)
      const mdLines: string[] = []
      wb.eachSheet((worksheet) => {
        mdLines.push(`## Sheet: ${worksheet.name}`)
        mdLines.push('')
        const sheetRows: string[][] = []
        worksheet.eachRow((row) => {
          const cells = (row.values as any[]).slice(1).map(v =>
            v != null ? String(v).replace(/\|/g, '\\|') : ''
          )
          sheetRows.push(cells)
        })
        if (sheetRows.length === 0) {
          mdLines.push('*Empty Sheet*')
          mdLines.push('')
          return
        }
        const mdTableLines = sheetRows.map((cells, idx) => {
          const line = '| ' + cells.join(' | ') + ' |'
          if (idx === 0) {
            const separator = '| ' + cells.map(() => '---').join(' | ') + ' |'
            return line + '\n' + separator
          }
          return line
        })
        mdLines.push(mdTableLines.join('\n'))
        mdLines.push('')
      })
      return mdLines.join('\n')
    } catch (err: any) {
      return `Error parsing Excel: ${err.message}`
    }
  }
  
  return `Binary file loaded. Content size: ${bytes.length} bytes.`
}
