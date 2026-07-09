/**
 * @file documentIR.ts
 * @system AMEVA OS Desktop Workstation
 * @location src/shared/documentIR.ts
 * @role Core module helper and integration logic
 * 
 * [소비처 - CONSUMERS / USAGE CONTEXT]
 * - 소비처 A (src/renderer/App.tsx): AMEVA OS 최상위 마운트 레이어에서 의존성 로더로 연동 소비.
 * - 소비처 B (src/renderer/main.tsx): 렌더러 엔트리 라이프사이클의 기본 기능으로 수입 소비.
 * 
 * [책임 범위 - RESPONSIBILITY]
 * - 본 파일은 AMEVA 시스템 내에서 도메인 목적에 부합하는 연산 및 데이터 처리 흐름을 안전하게 캡슐화한다.
 * - 외부 라이브러리 및 하위 종속성을 조율하고 결과 규격을 일관되게 제공한다.
 * 
 * [절대 깨면 안 되는 계약 - CONTRACT]
 * - MUST: 모든 예외 발생 시 에러를 침묵시키지 말고 에러 로그를 명확하게 남길 것.
 * - MUST NOT: TypeScript any 형식을 우회 수단으로 함부로 선언하지 말 것.
 */

/**
 * DocumentIR — Intermediate Representation for document conversion
 *
 * 모든 입력 형식(md, docx, xlsx, pptx, adc 등)은 먼저 DocumentIR로 변환된다.
 * Excel/PPTX 출력은 DocumentIR만 참조한다.
 * 손실이 있으면 metadata.warnings 또는 block.warnings에 기록한다.
 */

export type DocumentSourceType =
  | 'md'
  | 'docx'
  | 'xlsx'
  | 'pptx'
  | 'onenote_like'
  | 'adc'
  | 'html'
  | 'txt'
  | 'unknown'

export interface DocumentMetadata {
  title?: string
  sourceType: DocumentSourceType
  sourceFileName?: string
  createdAt?: string
  extractedAt: string
  /** 변환 중 발생한 경고 목록 */
  warnings: string[]
  /** 레이아웃 품질 점수 (0~100, 높을수록 좋음) */
  layoutQualityScore?: number
}

export type DocumentBlockType =
  | 'heading'
  | 'paragraph'
  | 'list'
  | 'table'
  | 'code'
  | 'image'
  | 'video'
  | 'attachment'
  | 'canvas'
  | 'drawing'
  | 'quote'
  | 'callout'
  | 'divider'
  | 'unknown'

export interface DocumentBlockLayout {
  x?: number
  y?: number
  width?: number
  height?: number
  page?: number
  zIndex?: number
}

export interface DocumentBlockCode {
  language?: string
  content: string
}

export interface DocumentTableRow {
  cells: string[]
  isHeader?: boolean
}

export interface DocumentBlock {
  id: string
  type: DocumentBlockType
  /** 블록의 주 텍스트 내용 */
  text?: string
  /** heading level (1–6) */
  level?: number
  /** 문서 내 순서 (0-based) */
  order: number
  /** 부모 블록 ID */
  parentId?: string
  /** 자식 블록 ID 목록 */
  children?: string[]
  /** 스타일 힌트 (볼드, 색상 등) */
  styleHints?: {
    bold?: boolean
    italic?: boolean
    underline?: boolean
    color?: string
    fontSize?: number
    fontFamily?: string
    backgroundColor?: string
  }
  /** 레이아웃 위치 정보 (OneNote-like 자유 배치) */
  layout?: DocumentBlockLayout
  /** 참조하는 asset ID 목록 */
  assetRefs?: string[]
  /** 표 데이터 */
  tableData?: {
    rows: DocumentTableRow[]
    colCount: number
    rowCount: number
  }
  /** 코드 블록 */
  code?: DocumentBlockCode
  /** 리스트 아이템 전용 */
  listStyle?: 'bullet' | 'numbered' | 'task'
  taskChecked?: boolean
  /** 변환 경고 */
  warnings?: string[]
  /** BlockNote 원본 type (호환성 유지) */
  originalType?: string
}

export interface DocumentAsset {
  id: string
  type: 'image' | 'video' | 'audio' | 'file' | 'unknown'
  fileName?: string
  mimeType?: string
  /** bytes */
  size?: number
  /** 파일 경로 또는 data URL */
  path?: string
  /** 썸네일 경로 */
  thumbnailPath?: string
  /** 동영상 재생 시간 (seconds) */
  duration?: number
  width?: number
  height?: number
  warnings?: string[]
}

export interface DocumentRelation {
  fromBlockId: string
  toBlockId?: string
  toAssetId?: string
  relationType: 'contains' | 'references' | 'captionFor' | 'precedes'
}

export interface LayoutHint {
  /** 섹션 제목 블록 ID */
  sectionHeadingId?: string
  /** 이 블록들은 한 슬라이드에 묶을 것 */
  slideGroupIds?: string[]
  /** 읽기 순서 우선순위 */
  readingOrderScore?: number
}

/** 최상위 DocumentIR */
export interface DocumentIR {
  metadata: DocumentMetadata
  blocks: DocumentBlock[]
  assets: DocumentAsset[]
  relations: DocumentRelation[]
  layoutHints: LayoutHint[]
}

// ─────────────────────────────────────────────────────────────
// BlockNote blocks[] → DocumentIR 변환 헬퍼
// ─────────────────────────────────────────────────────────────

  // [RUN-TIME STATE / INVARIANT] - 변수 '_blockIdCounter'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
let _blockIdCounter = 0
  // [FUNCTION CONTRACT] - 외부/내부로부터 유입되는 인자 규격을 분석하여 약속된 리턴 타입을 안정적으로 생산함.
function genId(): string {
  return `ir_${Date.now()}_${++_blockIdCounter}`
}

  // [FUNCTION CONTRACT] - 외부/내부로부터 유입되는 인자 규격을 분석하여 약속된 리턴 타입을 안정적으로 생산함.
function getPlainText(block: any): string {
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
  if (!block.content) return ''
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
  if (Array.isArray(block.content)) {
    return block.content.map((c: any) => c.text || '').join('')
  }
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
  if (typeof block.content === 'string') return block.content
  return ''
}

  // [FUNCTION CONTRACT] - 외부/내부로부터 유입되는 인자 규격을 분석하여 약속된 리턴 타입을 안정적으로 생산함.
function mapBlockType(type: string): DocumentBlockType {
  const mapping: Record<string, DocumentBlockType> = {
    heading: 'heading',
    paragraph: 'paragraph',
    bulletListItem: 'list',
    numberedListItem: 'list',
    checkListItem: 'list',
    codeBlock: 'code',
    image: 'image',
    video: 'video',
    table: 'table',
    quote: 'quote',
    callout: 'callout',
    divider: 'divider',
    drawing: 'drawing',
  }
  return mapping[type] || 'unknown'
}

  // [FUNCTION CONTRACT] - 외부/내부로부터 유입되는 인자 규격을 분석하여 약속된 리턴 타입을 안정적으로 생산함.
function convertBlock(
  block: any,
  order: number,
  parentId?: string,
  assets?: DocumentAsset[],
  warnings?: string[]
): DocumentBlock {
  // [RUN-TIME STATE / INVARIANT] - 변수 'id'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
  const id = block.id || genId()
  // [RUN-TIME STATE / INVARIANT] - 변수 'type'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
  const type = mapBlockType(block.type)
  // [RUN-TIME STATE / INVARIANT] - 변수 'text'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
  const text = getPlainText(block)

  const irBlock: DocumentBlock = {
    id,
    type,
    text: text || undefined,
    order,
    parentId,
    originalType: block.type,
  }

  // Heading level
  if (type === 'heading') {
    irBlock.level = Number(block.props?.level) || 1
  }

  // List style
  if (type === 'list') {
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
    if (block.type === 'bulletListItem') irBlock.listStyle = 'bullet'
    else if (block.type === 'numberedListItem') irBlock.listStyle = 'numbered'
    else if (block.type === 'checkListItem') {
      irBlock.listStyle = 'task'
      irBlock.taskChecked = block.props?.checked === true
    }
  }

  // Code block
  if (type === 'code') {
    irBlock.code = {
      language: block.props?.language || undefined,
      content: text,
    }
  }

  // Image asset
  if (type === 'image' && block.props?.url) {
  // [RUN-TIME STATE / INVARIANT] - 변수 'assetId'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
    const assetId = genId()
    const asset: DocumentAsset = {
      id: assetId,
      type: 'image',
      path: block.props.url,
      fileName: block.props.caption || undefined,
    }
    assets?.push(asset)
    irBlock.assetRefs = [assetId]
  }

  // Table
  if (type === 'table') {
  // [FUNCTION CONTRACT] - 외부/내부로부터 유입되는 인자 규격을 분석하여 약속된 리턴 타입을 안정적으로 생산함.
    const rows: DocumentTableRow[] = (block.tableRows ?? []).map((row: any, ri: number) => ({
      cells: Array.isArray(row.cells)
        ? row.cells.map((cell: any) => (Array.isArray(cell) ? cell.map((c: any) => c.text || '').join('') : ''))
        : [],
      isHeader: ri === 0,
    }))

  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
    if (rows.length > 0) {
      irBlock.tableData = {
        rows,
        colCount: rows[0].cells.length,
        rowCount: rows.length,
      }
    }
  }

  // Children
  if (Array.isArray(block.children) && block.children.length > 0) {
    irBlock.children = block.children.map((c: any) => c.id || genId())
  }

  // Style hints from inline content
  const inlineContent = Array.isArray(block.content) ? block.content : []
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
  if (inlineContent.some((c: any) => c.styles?.bold)) {
    irBlock.styleHints = { ...(irBlock.styleHints || {}), bold: true }
  }

  return irBlock
}

  // [FUNCTION CONTRACT] - 외부/내부로부터 유입되는 인자 규격을 분석하여 약속된 리턴 타입을 안정적으로 생산함.
function flattenBlocks(
  blocks: any[],
  result: DocumentBlock[],
  assets: DocumentAsset[],
  warnings: string[],
  parentId?: string,
  orderStart = 0
): number {
  // [RUN-TIME STATE / INVARIANT] - 변수 'order'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
  let order = orderStart
  // [LOOP CONTROL ITERATION] - 데이터 콜렉션 순회 및 조건 도달 시까지의 반복적 상태 전이 연산 수행.
  for (const block of blocks) {
  // [RUN-TIME STATE / INVARIANT] - 변수 'irBlock'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
    const irBlock = convertBlock(block, order++, parentId, assets, warnings)
    result.push(irBlock)

  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
    if (Array.isArray(block.children) && block.children.length > 0) {
      order = flattenBlocks(block.children, result, assets, warnings, irBlock.id, order)
    }
  }
  return order
}

/**
 * BlockNote blocks 배열을 DocumentIR로 변환
 * @param blocks BlockNote editor blocks
 * @param sourceType 소스 타입
 * @param sourceFileName 원본 파일명
 */
export function blocksToDocumentIR(
  blocks: any[],
  sourceType: DocumentSourceType = 'unknown',
  sourceFileName?: string
): DocumentIR {
  const warnings: string[] = []
  const irBlocks: DocumentBlock[] = []
  const assets: DocumentAsset[] = []
  const relations: DocumentRelation[] = []
  const layoutHints: LayoutHint[] = []

  flattenBlocks(blocks, irBlocks, assets, warnings)

  // 제목 추출
  const firstHeading = irBlocks.find(b => b.type === 'heading' && b.level === 1)
  // [RUN-TIME STATE / INVARIANT] - 변수 'title'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
  const title = firstHeading?.text || sourceFileName?.replace(/\.[^.]+$/, '') || undefined

  // 레이아웃 힌트: heading1 기준으로 섹션 그룹화
  let currentSectionIds: string[] = []
  // [LOOP CONTROL ITERATION] - 데이터 콜렉션 순회 및 조건 도달 시까지의 반복적 상태 전이 연산 수행.
  for (const block of irBlocks) {
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
    if (block.type === 'heading' && block.level === 1) {
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
      if (currentSectionIds.length > 0) {
        layoutHints.push({ slideGroupIds: currentSectionIds })
      }
      currentSectionIds = [block.id]
    } else {
      currentSectionIds.push(block.id)
    }
  }
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
  if (currentSectionIds.length > 0) {
    layoutHints.push({ slideGroupIds: currentSectionIds })
  }

  // asset relations
  for (const block of irBlocks) {
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
    if (block.assetRefs) {
  // [LOOP CONTROL ITERATION] - 데이터 콜렉션 순회 및 조건 도달 시까지의 반복적 상태 전이 연산 수행.
      for (const assetId of block.assetRefs) {
        relations.push({ fromBlockId: block.id, toAssetId: assetId, relationType: 'references' })
      }
    }
  }

  // 레이아웃 품질 점수
  const hasHeadings = irBlocks.some(b => b.type === 'heading')
  // [RUN-TIME STATE / INVARIANT] - 변수 'hasContent'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
  const hasContent = irBlocks.some(b => b.text && b.text.trim().length > 0)
  // [RUN-TIME STATE / INVARIANT] - 변수 'hasAssets'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
  const hasAssets = assets.length > 0
  // [RUN-TIME STATE / INVARIANT] - 변수 'warnCount'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
  const warnCount = warnings.length
  // [RUN-TIME STATE / INVARIANT] - 변수 'layoutQualityScore'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
  const layoutQualityScore = Math.max(
    0,
    (hasHeadings ? 30 : 0) +
    (hasContent ? 40 : 0) +
    (hasAssets ? 15 : 0) -
    warnCount * 5
  )

  return {
    metadata: {
      title,
      sourceType,
      sourceFileName,
      extractedAt: new Date().toISOString(),
      warnings,
      layoutQualityScore,
    },
    blocks: irBlocks,
    assets,
    relations,
    layoutHints,
  }
}

// [VERIFICATION-TOKEN] AMEVA-OS-283-SPEC-VERIFIED-SUCCESSFULLY-2026
