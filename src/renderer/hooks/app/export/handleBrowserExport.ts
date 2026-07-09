/**
 * @file handleBrowserExport.ts
 * @system AMEVA OS Desktop Workstation
 * @location src/renderer/hooks/app/export/handleBrowserExport.ts
 * @role Core module helper and integration logic
 * 
 * [소비처 - CONSUMERS / USAGE CONTEXT]
 * - 소비처 A (src/renderer/App.tsx): 최상위 Facade 구조에 통합 마운트.
 * - 소비처 B (src/renderer/contexts/AppContext.tsx): 리액트 Context 훅 목록에 바인딩되어 하위 뷰에 전파.
 * 
 * [책임 범위 - RESPONSIBILITY]
 * - 본 파일은 AMEVA 시스템 내에서 도메인 목적에 부합하는 연산 및 데이터 처리 흐름을 안전하게 캡슐화한다.
 * - 외부 라이브러리 및 하위 종속성을 조율하고 결과 규격을 일관되게 제공한다.
 * 
 * [절대 깨면 안 되는 계약 - CONTRACT]
 * - MUST: 모든 예외 발생 시 에러를 침묵시키지 말고 에러 로그를 명확하게 남길 것.
 * - MUST NOT: TypeScript any 형식을 우회 수단으로 함부로 선언하지 말 것.
 */

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
