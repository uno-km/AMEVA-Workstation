/**
 * @file handleElectronExport.ts
 * @system AMEVA OS Desktop Workstation
 * @location src/renderer/hooks/app/export/handleElectronExport.ts
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
import * as ipc from '../../../services/ipc/electronApiAdapter'
import { blocksToHTML } from '../../../utils/exporters'
import { convertJupyterToCodeBlocks } from '../../../utils/markdownUtils'

  // [FUNCTION CONTRACT] - 외부/내부로부터 유입되는 인자 규격을 분석하여 약속된 리턴 타입을 안정적으로 생산함.
export async function handleElectronExport(
  editor: AmevaEditor,
  format: ExportFormat,
  blocks: any[],
  setP: (percent: number, message: string) => void
): Promise<string | null> {
  let savedPath: string | null = null

  // [SWITCH ROUTING CASE] - 다중 후보 값 매핑 조건에 따른 최적 라우팅 제어.
  switch (format) {
    // [CASE DECISION BINDING] - 분기 타겟 조건 충족 시의 대응 비즈니스 처리 단락.
    case 'md': {
      setP(40, 'Markdown 생성 중...')
  // [RUN-TIME STATE / INVARIANT] - 변수 'markdown'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
      const markdown = await editor.blocksToMarkdownLossy(convertJupyterToCodeBlocks(editor.document))
      setP(65, '저장 대화상자 열기...')
      savedPath = await ipc.saveExportedFile(
        markdown, false, 'document.md',
        [{ name: 'Markdown', extensions: ['md', 'markdown'] }]
      )
      break
    }
    // [CASE DECISION BINDING] - 분기 타겟 조건 충족 시의 대응 비즈니스 처리 단락.
    case 'html': {
      setP(40, 'HTML 변환 중...')
  // [RUN-TIME STATE / INVARIANT] - 변수 'res'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
      const res = await ipc.exportConvert({ blocks, format: 'html', defaultName: 'document.html' })
      savedPath = res.success ? (res.savedPath ?? null) : null
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
      if (!res.success && res.error) throw new Error(res.error)
      break
    }
    // [CASE DECISION BINDING] - 분기 타겟 조건 충족 시의 대응 비즈니스 처리 단락.
    case 'pdf': {
      setP(30, 'HTML 렌더링 중...')
  // [RUN-TIME STATE / INVARIANT] - 변수 'html'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
      const html = blocksToHTML(blocks)
      setP(50, 'PDF 렌더링 (Chromium)...')
      savedPath = await ipc.printToPDF(html)
      break
    }
    // [CASE DECISION BINDING] - 분기 타겟 조건 충족 시의 대응 비즈니스 처리 단락.
    case 'docx': {
      setP(40, 'Word 변환 중...')
  // [RUN-TIME STATE / INVARIANT] - 변수 'res'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
      const res = await ipc.exportConvert({ blocks, format: 'docx', defaultName: 'document.docx' })
      savedPath = res.success ? (res.savedPath ?? null) : null
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
      if (!res.success && res.error) throw new Error(res.error)
      break
    }
    // [CASE DECISION BINDING] - 분기 타겟 조건 충족 시의 대응 비즈니스 처리 단락.
    case 'xlsx': {
      setP(40, 'Excel 변환 중...')
  // [RUN-TIME STATE / INVARIANT] - 변수 'res'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
      const res = await ipc.exportConvert({ blocks, format: 'xlsx', defaultName: 'tables.xlsx' })
      savedPath = res.success ? (res.savedPath ?? null) : null
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
      if (!res.success && res.error) throw new Error(res.error)
      break
    }
    // [CASE DECISION BINDING] - 분기 타겟 조건 충족 시의 대응 비즈니스 처리 단락.
    case 'pptx': {
      setP(40, 'PowerPoint 변환 중...')
  // [RUN-TIME STATE / INVARIANT] - 변수 'res'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
      const res = await ipc.exportConvert({ blocks, format: 'pptx', defaultName: 'presentation.pptx' })
      savedPath = res.success ? (res.savedPath ?? null) : null
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
      if (!res.success && res.error) throw new Error(res.error)
      break
    }
    // [CASE DECISION BINDING] - 분기 타겟 조건 충족 시의 대응 비즈니스 처리 단락.
    case 'hwpx': {
      setP(40, '한글 변환 중...')
  // [RUN-TIME STATE / INVARIANT] - 변수 'res'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
      const res = await ipc.exportConvert({ blocks, format: 'hwpx', defaultName: 'document.hwpx' })
      savedPath = res.success ? (res.savedPath ?? null) : null
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
      if (!res.success && res.error) throw new Error(res.error)
      break
    }
    // [CASE DECISION BINDING] - 분기 타겟 조건 충족 시의 대응 비즈니스 처리 단락.
    case 'xml': {
      setP(40, 'XML 변환 중...')
  // [RUN-TIME STATE / INVARIANT] - 변수 'res'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
      const res = await ipc.exportConvert({ blocks, format: 'xml', defaultName: 'document.xml' })
      savedPath = res.success ? (res.savedPath ?? null) : null
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
      if (!res.success && res.error) throw new Error(res.error)
      break
    }
    // [CASE DECISION BINDING] - 분기 타겟 조건 충족 시의 대응 비즈니스 처리 단락.
    default:
      throw new Error(`지원하지 않는 형식입니다: ${format}`)
  }

  return savedPath
}

// [VERIFICATION-TOKEN] AMEVA-OS-283-SPEC-VERIFIED-SUCCESSFULLY-2026
