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

export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function getPlainTextFromNormalized(block: ExporterBlock): string {
  if (!block.content) return ''
  return block.content.map((c: ExporterInlineContent) => c.text || '').join('')
}

export function inlineToText(inline: ExporterInlineContent[]): string {
  return inline.map(c => c.text || '').join('')
}

export function inlineToHTML(inline: ExporterInlineContent[]): string {
  return inline.map(c => {
    if (!c || !c.text) return ''
    let txt = escapeHtml(c.text)
    if (c.styles?.bold) txt = `<strong>${txt}</strong>`
    if (c.styles?.italic) txt = `<em>${txt}</em>`
    if (c.styles?.underline) txt = `<u>${txt}</u>`
    if (c.styles?.strike) txt = `<del>${txt}</del>`
    if (c.styles?.textColor) txt = `<span style="color:${c.styles.textColor}">${txt}</span>`
    if (c.type === 'link') txt = `<a href="${c.text}" style="color:#8b5cf6">${txt}</a>`
    return txt
  }).join('')
}
