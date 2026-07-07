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
