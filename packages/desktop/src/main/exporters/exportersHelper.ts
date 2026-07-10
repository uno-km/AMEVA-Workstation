/**
 * @file exportersHelper.ts
 * @system AMEVA OS Desktop Workstation
 * @location src/main/exporters/exportersHelper.ts
 * @role Core module helper and integration logic
 * 
 * [소비처 - CONSUMERS / USAGE CONTEXT]
 * - 소비처 A (src/main/index.ts): 일렉트론 메인 라이프사이클(ready/will-quit) 및 윈도우 생성 시점에 결합 구동.
 * - 소비처 B (src/main/preload.ts): contextBridge 안전 통로 노출을 위한 핵심 백엔드 기능 공급자로 소비.
 * 
 * [책임 범위 - RESPONSIBILITY]
 * - 본 파일은 AMEVA 시스템 내에서 도메인 목적에 부합하는 연산 및 데이터 처리 흐름을 안전하게 캡슐화한다.
 * - 외부 라이브러리 및 하위 종속성을 조율하고 결과 규격을 일관되게 제공한다.
 * 
 * [절대 깨면 안 되는 계약 - CONTRACT]
 * - MUST: 모든 예외 발생 시 에러를 침묵시키지 말고 에러 로그를 명확하게 남길 것.
 * - MUST NOT: TypeScript any 형식을 우회 수단으로 함부로 선언하지 말 것.
 */

// ─────────────────────────────────────────────────────────────
// 내보내기 공통 헬퍼
// ─────────────────────────────────────────────────────────────

export interface ExporterInlineStyle {
  bold?: boolean
  italic?: boolean
  underline?: boolean
  strike?: boolean
  textColor?: string
  [key: string]: unknown
}

export interface ExporterInlineContent {
  type?: string
  text?: string
  styles?: ExporterInlineStyle
  [key: string]: unknown
}

export interface ExporterTableRow {
  cells?: ExporterInlineContent[][] | unknown[]
  [key: string]: unknown
}

export interface ExporterBlock {
  id?: string
  type?: string
  content?: ExporterInlineContent[]
  children?: ExporterBlock[]
  props?: {
    level?: number | string
    language?: string
    url?: string
    caption?: string
    [key: string]: unknown
  }
  tableRows?: ExporterTableRow[]
  [key: string]: unknown
}

  /*
   * [FUNCTION CONTRACT]
   * - 함수 명: `escapeHtml`
   * - 역할: 인자 정보를 검수하고 비즈니스 계약 조건에 맞춰 최종 바인딩 결과물/바이너리 버퍼를 반환함.
   * - 예시: `escapeHtml(...)` 호출 시 런타임 비동기/동기 연쇄 반응 유도.
   */
export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

  /*
   * [FUNCTION CONTRACT]
   * - 함수 명: `getPlainTextFromNormalized`
   * - 역할: 인자 정보를 검수하고 비즈니스 계약 조건에 맞춰 최종 바인딩 결과물/바이너리 버퍼를 반환함.
   * - 예시: `getPlainTextFromNormalized(...)` 호출 시 런타임 비동기/동기 연쇄 반응 유도.
   */
export function getPlainTextFromNormalized(block: ExporterBlock): string {
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `!block.content`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (!block.content)` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
  if (!block.content) return ''
  return block.content.map((c: ExporterInlineContent) => c.text || '').join('')
}

  /*
   * [FUNCTION CONTRACT]
   * - 함수 명: `inlineToText`
   * - 역할: 인자 정보를 검수하고 비즈니스 계약 조건에 맞춰 최종 바인딩 결과물/바이너리 버퍼를 반환함.
   * - 예시: `inlineToText(...)` 호출 시 런타임 비동기/동기 연쇄 반응 유도.
   */
export function inlineToText(inline: ExporterInlineContent[]): string {
  return inline.map(c => c.text || '').join('')
}

  /*
   * [FUNCTION CONTRACT]
   * - 함수 명: `inlineToHTML`
   * - 역할: 인자 정보를 검수하고 비즈니스 계약 조건에 맞춰 최종 바인딩 결과물/바이너리 버퍼를 반환함.
   * - 예시: `inlineToHTML(...)` 호출 시 런타임 비동기/동기 연쇄 반응 유도.
   */
export function inlineToHTML(inline: ExporterInlineContent[]): string {
  return inline.map(c => {
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `!c || !c.text`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (!c || !c.text)` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
    if (!c || !c.text) return ''
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `txt`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const txt = ...` 형태로 안전 캐싱 후 가공 기동.
       */
    let txt = escapeHtml(c.text)
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `c.styles?.bold`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (c.styles?.bold)` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
    if (c.styles?.bold) txt = `<strong>${txt}</strong>`
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `c.styles?.italic`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (c.styles?.italic)` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
    if (c.styles?.italic) txt = `<em>${txt}</em>`
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `c.styles?.underline`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (c.styles?.underline)` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
    if (c.styles?.underline) txt = `<u>${txt}</u>`
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `c.styles?.strike`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (c.styles?.strike)` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
    if (c.styles?.strike) txt = `<del>${txt}</del>`
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `c.styles?.textColor`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (c.styles?.textColor)` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
    if (c.styles?.textColor) txt = `<span style="color:${c.styles.textColor}">${txt}</span>`
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `c.type === 'link'`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (c.type === 'link')` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
    if (c.type === 'link') txt = `<a href="${c.text}" style="color:#8b5cf6">${txt}</a>`
    return txt
  }).join('')
}

