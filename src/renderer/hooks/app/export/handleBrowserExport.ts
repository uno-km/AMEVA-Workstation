import type { ExportFormat } from '../../../../shared/types'
import { type AmevaEditor } from '../../../editor/amevaBlockSchema'
import { blocksToHTML, exportToWord, exportToExcel, exportToPPTX, exportToHWPX, exportToXML } from '../../../utils/exporters'
import { triggerBrowserDownload } from './exportUtils'

export async function handleBrowserExport(
  editor: AmevaEditor,
  format: ExportFormat,
  blocks: any[]
): Promise<string | null> {
  let savedPath: string | null = null

  switch (format) {
    case 'md': {
      const md = await editor.blocksToMarkdownLossy(editor.document)
      triggerBrowserDownload(md, 'document.md')
      savedPath = 'document.md (브라우저 다운로드)'
      break
    }
    case 'html': {
      const html = blocksToHTML(blocks)
      triggerBrowserDownload(html, 'document.html')
      savedPath = 'document.html (브라우저 다운로드)'
      break
    }
    case 'pdf': {
      const html = blocksToHTML(blocks)
      const iframe = document.createElement('iframe')
      Object.assign(iframe.style, { position: 'fixed', right: '0', bottom: '0', width: '0', height: '0', border: '0' })
      document.body.appendChild(iframe)
      const doc = iframe.contentWindow?.document || iframe.contentDocument
      if (doc) {
        doc.write(html); doc.close()
        await new Promise(r => setTimeout(r, 500))
        iframe.contentWindow?.focus(); iframe.contentWindow?.print()
        document.body.removeChild(iframe)
      }
      savedPath = 'PDF 인쇄 대화상자'
      break
    }
    case 'docx': triggerBrowserDownload(await exportToWord(blocks), 'document.docx'); savedPath = 'document.docx'; break
    case 'xlsx': triggerBrowserDownload(new Blob([exportToExcel(blocks) as any]), 'tables.xlsx'); savedPath = 'tables.xlsx'; break
    case 'pptx': triggerBrowserDownload(new Blob([(await exportToPPTX(blocks)) as any]), 'presentation.pptx'); savedPath = 'presentation.pptx'; break
    case 'hwpx': triggerBrowserDownload(await exportToHWPX(blocks), 'document.hwpx'); savedPath = 'document.hwpx'; break
    case 'xml': triggerBrowserDownload(exportToXML(blocks), 'document.xml'); savedPath = 'document.xml'; break
    default: throw new Error(`지원하지 않는 형식입니다: ${format}`)
  }

  return savedPath
}
