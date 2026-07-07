import type { ExportFormat } from '../../../../shared/types'
import { type AmevaEditor } from '../../../editor/amevaBlockSchema'
import * as ipc from '../../../services/ipc/electronApiAdapter'
import { blocksToHTML } from '../../../utils/exporters'
import { convertJupyterToCodeBlocks } from '../../../utils/markdownUtils'

export async function handleElectronExport(
  editor: AmevaEditor,
  format: ExportFormat,
  blocks: any[],
  setP: (percent: number, message: string) => void
): Promise<string | null> {
  let savedPath: string | null = null

  switch (format) {
    case 'md': {
      setP(40, 'Markdown 생성 중...')
      const markdown = await editor.blocksToMarkdownLossy(convertJupyterToCodeBlocks(editor.document))
      setP(65, '저장 대화상자 열기...')
      savedPath = await ipc.saveExportedFile(
        markdown, false, 'document.md',
        [{ name: 'Markdown', extensions: ['md', 'markdown'] }]
      )
      break
    }
    case 'html': {
      setP(40, 'HTML 변환 중...')
      const res = await ipc.exportConvert({ blocks, format: 'html', defaultName: 'document.html' })
      savedPath = res.success ? (res.savedPath ?? null) : null
      if (!res.success && res.error) throw new Error(res.error)
      break
    }
    case 'pdf': {
      setP(30, 'HTML 렌더링 중...')
      const html = blocksToHTML(blocks)
      setP(50, 'PDF 렌더링 (Chromium)...')
      savedPath = await ipc.printToPDF(html)
      break
    }
    case 'docx': {
      setP(40, 'Word 변환 중...')
      const res = await ipc.exportConvert({ blocks, format: 'docx', defaultName: 'document.docx' })
      savedPath = res.success ? (res.savedPath ?? null) : null
      if (!res.success && res.error) throw new Error(res.error)
      break
    }
    case 'xlsx': {
      setP(40, 'Excel 변환 중...')
      const res = await ipc.exportConvert({ blocks, format: 'xlsx', defaultName: 'tables.xlsx' })
      savedPath = res.success ? (res.savedPath ?? null) : null
      if (!res.success && res.error) throw new Error(res.error)
      break
    }
    case 'pptx': {
      setP(40, 'PowerPoint 변환 중...')
      const res = await ipc.exportConvert({ blocks, format: 'pptx', defaultName: 'presentation.pptx' })
      savedPath = res.success ? (res.savedPath ?? null) : null
      if (!res.success && res.error) throw new Error(res.error)
      break
    }
    case 'hwpx': {
      setP(40, '한글 변환 중...')
      const res = await ipc.exportConvert({ blocks, format: 'hwpx', defaultName: 'document.hwpx' })
      savedPath = res.success ? (res.savedPath ?? null) : null
      if (!res.success && res.error) throw new Error(res.error)
      break
    }
    case 'xml': {
      setP(40, 'XML 변환 중...')
      const res = await ipc.exportConvert({ blocks, format: 'xml', defaultName: 'document.xml' })
      savedPath = res.success ? (res.savedPath ?? null) : null
      if (!res.success && res.error) throw new Error(res.error)
      break
    }
    default:
      throw new Error(`지원하지 않는 형식입니다: ${format}`)
  }

  return savedPath
}
