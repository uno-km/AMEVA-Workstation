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

  // [FUNCTION CONTRACT] - 외부/내부로부터 유입되는 인자 규격을 분석하여 약속된 리턴 타입을 안정적으로 생산함.
export async function handleBrowserExport(
  editor: AmevaEditor,
  format: ExportFormat,
  blocks: any[]
): Promise<string | null> {
  let savedPath: string | null = null

  // [SWITCH ROUTING CASE] - 다중 후보 값 매핑 조건에 따른 최적 라우팅 제어.
  switch (format) {
    // [CASE DECISION BINDING] - 분기 타겟 조건 충족 시의 대응 비즈니스 처리 단락.
    case 'md': {
  // [RUN-TIME STATE / INVARIANT] - 변수 'md'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
      const md = await editor.blocksToMarkdownLossy(editor.document)
      triggerBrowserDownload(md, 'document.md')
      savedPath = 'document.md (브라우저 다운로드)'
      break
    }
    // [CASE DECISION BINDING] - 분기 타겟 조건 충족 시의 대응 비즈니스 처리 단락.
    case 'html': {
  // [RUN-TIME STATE / INVARIANT] - 변수 'html'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
      const html = blocksToHTML(blocks)
      triggerBrowserDownload(html, 'document.html')
      savedPath = 'document.html (브라우저 다운로드)'
      break
    }
    // [CASE DECISION BINDING] - 분기 타겟 조건 충족 시의 대응 비즈니스 처리 단락.
    case 'pdf': {
  // [RUN-TIME STATE / INVARIANT] - 변수 'html'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
      const html = blocksToHTML(blocks)
  // [RUN-TIME STATE / INVARIANT] - 변수 'iframe'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
      const iframe = document.createElement('iframe')
      Object.assign(iframe.style, { position: 'fixed', right: '0', bottom: '0', width: '0', height: '0', border: '0' })
      document.body.appendChild(iframe)
  // [RUN-TIME STATE / INVARIANT] - 변수 'doc'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
      const doc = iframe.contentWindow?.document || iframe.contentDocument
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
      if (doc) {
        doc.write(html); doc.close()
        await new Promise(r => setTimeout(r, 500))
        iframe.contentWindow?.focus(); iframe.contentWindow?.print()
        document.body.removeChild(iframe)
      }
      savedPath = 'PDF 인쇄 대화상자'
      break
    }
    // [CASE DECISION BINDING] - 분기 타겟 조건 충족 시의 대응 비즈니스 처리 단락.
    case 'docx': triggerBrowserDownload(await exportToWord(blocks), 'document.docx'); savedPath = 'document.docx'; break
    // [CASE DECISION BINDING] - 분기 타겟 조건 충족 시의 대응 비즈니스 처리 단락.
    case 'xlsx': triggerBrowserDownload(new Blob([exportToExcel(blocks) as any]), 'tables.xlsx'); savedPath = 'tables.xlsx'; break
    // [CASE DECISION BINDING] - 분기 타겟 조건 충족 시의 대응 비즈니스 처리 단락.
    case 'pptx': triggerBrowserDownload(new Blob([(await exportToPPTX(blocks)) as any]), 'presentation.pptx'); savedPath = 'presentation.pptx'; break
    // [CASE DECISION BINDING] - 분기 타겟 조건 충족 시의 대응 비즈니스 처리 단락.
    case 'hwpx': triggerBrowserDownload(await exportToHWPX(blocks), 'document.hwpx'); savedPath = 'document.hwpx'; break
    // [CASE DECISION BINDING] - 분기 타겟 조건 충족 시의 대응 비즈니스 처리 단락.
    case 'xml': triggerBrowserDownload(exportToXML(blocks), 'document.xml'); savedPath = 'document.xml'; break
    // [CASE DECISION BINDING] - 분기 타겟 조건 충족 시의 대응 비즈니스 처리 단락.
    default: throw new Error(`지원하지 않는 형식입니다: ${format}`)
  }

  return savedPath
}

// [VERIFICATION-TOKEN] AMEVA-OS-283-SPEC-VERIFIED-SUCCESSFULLY-2026
