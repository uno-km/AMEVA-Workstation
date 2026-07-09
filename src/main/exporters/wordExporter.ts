/**
 * @file wordExporter.ts
 * @system AMEVA OS Desktop Workstation - Exporter Engine
 * @location src/main/exporters/wordExporter.ts
 * @role Markdown-to-Office Word (.docx) compile exporter
 * 
 * [소비처 - CONSUMERS / USAGE CONTEXT]
 * - 임포트/소비처 A (src/main/exporters/officeExporter.ts): `exportToWord`를 가져가 Excel, PPTX 등과 함께 officeExporter의 통합 인터페이스로 렌더링 노출시킴.
 * - 임포트/소비처 B (src/renderer/utils/fileConverters.ts): 렌더러가 `.docx` 저장을 결정하여 `convertMarkdownToBinary`를 부를 때 내부적으로 워드 바이너리 버퍼 생성기로 소비함.
 * - 결합 규격: 본 파일은 Electron Node.js main process의 파일 시스템 쓰기 및 IPC 핸들러 바인딩 시 핵심 가교 역할을 수행함.
 * 
 * [책임 범위 - RESPONSIBILITY]
 * - 정규화된 마크다운 블록 배열(`ExporterBlock[]`)을 순회하며 docx 문서 객체(`Document`)를 구성하고 바이너리 버퍼(`Buffer`)로 출력한다.
 * - 제목(heading), 단락(paragraph), 목록(bullet/numbered), 소스코드 블록(codeBlock), 테이블(table), 선(divider) 등 각 요소의 서식을 워드 고유 속성으로 매핑한다.
 * - 다차원 목록을 순회하여 계층적 인덴트 단락 들여쓰기(`depth * 720` Twips) 깊이를 재귀적으로 계산(`addBlock`) 누적한다.
 * 
 * [절대 깨면 안 되는 계약 - CONTRACT]
 * - MUST: ES 모듈 환경 내에서 CommonJS 패키지인 `docx` 라이브러리를 동적 파싱하기 위해,
 *   반드시 모듈 require 폴리필(`createRequire(import.meta.url)`) 구조 계약을 유지할 것.
 * - MUST: 테이블 렌더러 실패 시 문서 전체 출력이 크래시되는 것을 차단하기 위해,
 *   반드시 테이블 순회 처리부를 `try-catch` 가드로 캡슐화하여 테이블 고장 시 에러 텍스트 표시로 선방 유도할 것.
 */

/* 
 * [IMPORT SEGMENTATION & CONTRACTS]
 * - createRequire: ES 모듈 내에서 CJS 모듈을 임포트하기 위한 Node.js 모듈 헬퍼.
 */
import { createRequire } from 'module'
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `require`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const require = ...` 형태로 안전 캐싱 후 가공 기동.
       */
const require = createRequire(import.meta.url)

// docx 모듈 바인딩
const docx = require('docx')

/* 
 * [EXPORTER INNER HELPERS]
 * - getPlainTextFromNormalized: 블록 내 평문 추출 유틸.
 * - inlineToText: 인라인 스타일 제거된 원시 텍스트 결합기.
 * - ExporterBlock: 정형화된 블록 단위 규격.
 */
import { getPlainTextFromNormalized, inlineToText, type ExporterBlock, type ExporterInlineContent, type ExporterTableRow } from './exportersHelper.js'

// docx API 디스트럭처링 추출
const {
  Document, Packer, Paragraph, TextRun, Table: DocxTable, TableRow, TableCell,
  BorderStyle, HeadingLevel, AlignmentType, WidthType, TableLayoutType,
  ShadingType, convertInchesToTwip
} = docx

/**
 * @function exportToWord
 * @description 마크다운 블록 트리를 순회 해석해 Calibri 폰트 테마의 정제된 .docx 문서 바이너리 버퍼를 생성한다.
 */
export async function exportToWord(blocks: ExporterBlock[]): Promise<Buffer> {
  /*
   * [INVARIANT - Exporter Children Registers]
   * - docChildren: 최종 워드 단락들이 적재되는 배열 버퍼.
   * - headingSizes: H1/H2/H3 전용 워드 글자 크기 매핑(2단위).
   * - headingColors: 헤딩 구분 색상 (Hex 포맷).
   */
  const docChildren: unknown[] = []
  const headingSizes: Record<number, number> = { 1: 44, 2: 36, 3: 28 }
  const headingColors: Record<number, string> = { 1: '111827', 2: '1f2937', 3: '374151' }

  /**
   * [CONTRACT - Inline Text Style Parser]
   * - Rationale: 인라인 볼드, 이탤릭, 밑줄, 취소선, 글자 색상 스타일을 docx.TextRun 속성으로 투영 변환한다.
   */
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

  /**
   * [CONTRACT - Recursive Block Parser / Rationale]
   * - Rationale: 하위 자식 노드가 있으면 depth+1로 재귀 파싱하여 들여쓰기 탭 마킹을 누적하고, 
   *   마크다운 요소 타입에 적응해 워드 문단을 push 적재한다.
   */
  const addBlock = (block: ExporterBlock, depth = 0) => {
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `runs`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const runs = ...` 형태로 안전 캐싱 후 가공 기동.
       */
    const runs = inlineToRuns(block.content || [])
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `plainText`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const plainText = ...` 형태로 안전 캐싱 후 가공 기동.
       */
    const plainText = getPlainTextFromNormalized(block)

      /*
       * [SWITCH ROUTING CASE]
       * - 라우팅 키: `switch (block.type) {`
       * - 예상 시나리오: 유입된 상태 변수 분기값과 일치하는 케이스 블록으로 런타임 제어를 즉시 라우팅함.
       * - 예시: `switch (format)` 분기 시 매치되는 변환 포맷 서브 모듈이 가동됨.
       */
    switch (block.type) {
      // 1) 헤더 타이틀 요소
      case 'heading': {
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `level`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const level = ...` 형태로 안전 캐싱 후 가공 기동.
       */
        const level = Math.min(3, Math.max(1, Number(block.props?.level) || 1))
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `hLevel`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const hLevel = ...` 형태로 안전 캐싱 후 가공 기동.
       */
        const hLevel = level === 1 ? HeadingLevel.HEADING_1 : level === 2 ? HeadingLevel.HEADING_2 : HeadingLevel.HEADING_3
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `hRuns`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const hRuns = ...` 형태로 안전 캐싱 후 가공 기동.
       */
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

      // 2) 일반 단락 요소 (가로 들여쓰기 인덴트 적용)
      case 'paragraph':
        docChildren.push(new Paragraph({
          children: runs.length > 0 ? runs : [new TextRun({ text: '' })],
          spacing: { after: 120 },
          indent: depth > 0 ? { left: depth * 720 } : undefined,
        }))
        break

      // 3) 글머리 기호 목록
      case 'bulletListItem':
        docChildren.push(new Paragraph({ children: runs, bullet: { level: depth }, spacing: { after: 80 } }))
        break

      // 4) 번호 매기기 목록
      case 'numberedListItem':
        docChildren.push(new Paragraph({ children: runs, numbering: { reference: 'default-numbering', level: depth }, spacing: { after: 80 } }))
        break

      // 5) 코드 블록 (다크 테마 배경에 연두색 폰트로 가시성 매핑)
      case 'codeBlock': {
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `lang`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const lang = ...` 형태로 안전 캐싱 후 가공 기동.
       */
        const lang = block.props?.language || ''
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `lines`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const lines = ...` 형태로 안전 캐싱 후 가공 기동.
       */
        const lines = plainText.split('\n')
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `lang`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (lang)` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
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

      // 6) 이미지 요소 (경로 텍스트화 대체)
      case 'image':
        docChildren.push(new Paragraph({
          children: [new TextRun({ text: `[이미지: ${block.props?.url || ''}]`, italics: true, color: '9CA3AF', size: 20 })],
          spacing: { after: 120 },
        }))
        break

      // 7) 표/테이블 요소 (가드 절차 적용)
      case 'table': {
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `rows`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const rows = ...` 형태로 안전 캐싱 후 가공 기동.
       */
        const rows = block.tableRows ?? []
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `rows.length > 0`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (rows.length > 0)` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
        if (rows.length > 0) {
          try {
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `docxRows`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const docxRows = ...` 형태로 안전 캐싱 후 가공 기동.
       */
            const docxRows = rows.map((row: ExporterTableRow, ri: number) => {
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `cells`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const cells = ...` 형태로 안전 캐싱 후 가공 기동.
       */
              const cells = (Array.isArray(row.cells) ? row.cells : []) as (ExporterInlineContent[] | unknown)[]
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `docxCells`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const docxCells = ...` 형태로 안전 캐싱 후 가공 기동.
       */
              const docxCells = cells.map((cell: ExporterInlineContent[] | unknown) => {
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `cellText`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const cellText = ...` 형태로 안전 캐싱 후 가공 기동.
       */
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

      // 8) 구분선
      case 'divider':
        docChildren.push(new Paragraph({
          children: [],
          border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: 'E5E7EB', space: 4 } },
          spacing: { before: 160, after: 160 },
        }))
        break

    /*
     * [CASE ROUTING DECISION BINDING]
     * - 분기 타겟: `default:`
     * - 만족 시: 본 케이스 전용 연산을 이행하고 break/return을 거쳐 스위치 게이트를 마감함.
     * - 예시: `default:` 만족 시 해당 포맷 바이너리 빌더 호출.
     */
      default:
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `runs.length > 0) docChildren.push(new Paragraph({ children: runs, spacing: { after: 120 } })`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (runs.length > 0) docChildren.push(new Paragraph({ children: runs, spacing: { after: 120 } }))` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
        if (runs.length > 0) docChildren.push(new Paragraph({ children: runs, spacing: { after: 120 } }))
    }

    // 자식 노드가 더 있을 경우 재귀 깊이 인덴트 기입
    if (Array.isArray(block.children)) {
      block.children.forEach((child: ExporterBlock) => addBlock(child, depth + 1))
    }
  }

  // 본 블록 전체 파싱 시작
  blocks.forEach(b => addBlock(b))

  // 만약 취합 결과가 없다면 내용 없음 가이드 추가
  if (docChildren.length === 0) {
    docChildren.push(new Paragraph({ children: [new TextRun({ text: '(내용 없음)' })] }))
  }

  // 넘버링 스키마 및 용지 여백 설정
  const doc = new Document({
    numbering: {
      config: [{
        reference: 'default-numbering',
        levels: [{ level: 0, numFmt: 'decimal', text: '%1.', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } }],
      }],
    },
    sections: [{
      properties: { page: { margin: { top: convertInchesToTwip(1), bottom: convertInchesToTwip(1), left: convertInchesToTwip(1.2), right: convertInchesToTwip(1.2) } } },
      children: docChildren as any[],
    }],
  })

  // .docx 바이너리 완성 반환
  return await Packer.toBuffer(doc)
}

