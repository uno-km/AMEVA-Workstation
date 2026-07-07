import { escapeHtml, getPlainTextFromNormalized, inlineToText, inlineToHTML, type ExporterBlock, type ExporterTableRow, type ExporterInlineContent } from './exportersHelper.js'

// ══════════════════════════════════════════════════════════════
// 1. HTML 내보내기 (백엔드 분산 변환 노드 버전)
// ══════════════════════════════════════════════════════════════
export function blocksToHTML(blocks: ExporterBlock[]): string {
  const css = `
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Fira+Code:wght@400;500&display=swap');
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Inter', -apple-system, sans-serif; background: #fff; color: #1f2937; line-height: 1.7; font-size: 15px; }
    .doc-container { max-width: 780px; margin: 0 auto; padding: 48px 56px; }
    h1 { font-size: 2.2rem; font-weight: 800; color: #111827; margin: 2rem 0 1rem; border-bottom: 2px solid #e5e7eb; padding-bottom: 0.5rem; }
    h2 { font-size: 1.6rem; font-weight: 700; color: #1f2937; margin: 1.8rem 0 0.8rem; }
    h3 { font-size: 1.2rem; font-weight: 600; color: #374151; margin: 1.4rem 0 0.6rem; }
    p { margin-bottom: 1rem; color: #374151; }
    ul, ol { padding-left: 1.6rem; margin-bottom: 1rem; }
    li { margin-bottom: 0.4rem; }
    pre { background: #0f172a; border-radius: 10px; padding: 20px 24px; overflow-x: auto; margin: 1.2rem 0; border: 1px solid #1e293b; }
    code { font-family: 'Fira Code', 'Consolas', monospace; font-size: 13px; background: #f1f5f9; padding: 2px 6px; border-radius: 4px; color: #7c3aed; }
    pre code { background: transparent; padding: 0; color: #a3e635; font-size: 13px; white-space: pre; line-height: 1.65; }
    .lang-badge { font-family: 'Fira Code', monospace; font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.08em; display: block; margin-bottom: 10px; }
    table { border-collapse: collapse; width: 100%; margin: 1.2rem 0; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; }
    th { background: #f8fafc; font-weight: 700; padding: 11px 16px; text-align: left; font-size: 13px; border-bottom: 2px solid #e5e7eb; }
    td { padding: 10px 16px; font-size: 14px; border-bottom: 1px solid #f1f5f9; }
    tr:last-child td { border-bottom: none; }
    blockquote { border-left: 4px solid #8b5cf6; padding: 12px 20px; background: #faf5ff; border-radius: 0 8px 8px 0; margin: 1rem 0; }
    img { max-width: 100%; border-radius: 8px; margin: 1rem 0; }
    hr { border: none; border-top: 1px solid #e5e7eb; margin: 2rem 0; }
    @media print { body { font-size: 12pt; } .doc-container { padding: 0; } }
  `

  let body = ''
  let listType: 'ul' | 'ol' | null = null

  const closeList = () => {
    if (listType) { body += `</${listType}>\n`; listType = null }
  }

  const renderBlock = (block: ExporterBlock, depth = 0): string => {
    const indent = depth > 0 ? ` style="margin-left:${depth * 20}px"` : ''
    const contentHtml = inlineToHTML(block.content || [])

    switch (block.type) {
      case 'heading': {
        const lvl = Math.min(6, Math.max(1, Number(block.props?.level) || 1))
        return `<h${lvl}>${contentHtml}</h${lvl}>\n`
      }
      case 'paragraph':
        return `<p>${contentHtml || '&nbsp;'}</p>\n`
      case 'bulletListItem':
        return `<li${indent}>${contentHtml}${
          block.children?.length ? `<ul>${block.children.map((c: ExporterBlock) => renderBlock(c, depth + 1)).join('')}</ul>` : ''
        }</li>\n`
      case 'numberedListItem':
        return `<li${indent}>${contentHtml}${
          block.children?.length ? `<ol>${block.children.map((c: ExporterBlock) => renderBlock(c, depth + 1)).join('')}</ol>` : ''
        }</li>\n`
      case 'codeBlock': {
        const lang = block.props?.language || ''
        const code = escapeHtml(getPlainTextFromNormalized(block))
        return `<pre><span class="lang-badge">${escapeHtml(lang)}</span><code class="language-${lang}">${code}</code></pre>\n`
      }
      case 'checkListItem': {
        const checked = block.props?.checked ? 'checked' : ''
        return `<li style="list-style:none;display:flex;gap:8px"><input type="checkbox" ${checked} disabled /><span>${contentHtml}</span></li>\n`
      }
      case 'image': {
        const url = block.props?.url || ''
        const caption = block.props?.caption || ''
        return `<figure style="text-align:center;margin:1.2rem 0"><img src="${url}" alt="${escapeHtml(caption)}" />${caption ? `<figcaption style="font-size:12px;color:#9ca3af;margin-top:6px">${escapeHtml(caption)}</figcaption>` : ''}</figure>\n`
      }
      case 'table': {
        const rows = block.tableRows ?? []
        if (rows.length === 0) return ''
        let html = '<table>\n<tbody>\n'
        rows.forEach((row: ExporterTableRow, ri: number) => {
          html += '<tr>\n'
          const cells = (Array.isArray(row.cells) ? row.cells : []) as (ExporterInlineContent[] | unknown)[]
          cells.forEach((cell: ExporterInlineContent[] | unknown) => {
            const cellText = Array.isArray(cell) ? inlineToText(cell as ExporterInlineContent[]) : ''
            const tag = ri === 0 ? 'th' : 'td'
            html += `<${tag}>${escapeHtml(cellText)}</${tag}>\n`
          })
          html += '</tr>\n'
        })
        html += '</tbody>\n</table>\n'
        return html
      }
      case 'quote':
        return `<blockquote>${contentHtml}</blockquote>\n`
      case 'divider':
        return '<hr />\n'
      default:
        return contentHtml ? `<p>${contentHtml}</p>\n` : ''
    }
  }

  blocks.forEach((block) => {
    if (block.type === 'bulletListItem') {
      if (listType !== 'ul') { closeList(); body += '<ul>\n'; listType = 'ul' }
      body += renderBlock(block)
    } else if (block.type === 'numberedListItem') {
      if (listType !== 'ol') { closeList(); body += '<ol>\n'; listType = 'ol' }
      body += renderBlock(block)
    } else {
      closeList()
      body += renderBlock(block)
    }
  })
  closeList()

  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>AMEVA Document</title>
  <style>${css}</style>
</head>
<body>
<div class="doc-container">
${body}
</div>
</body>
</html>`
}

// ══════════════════════════════════════════════════════════════
// 6. XML 내보내기 (백엔드 분산 변환 노드 버전)
// ══════════════════════════════════════════════════════════════
export function exportToXML(blocks: ExporterBlock[]): string {
  const renderXML = (block: ExporterBlock, indent = '  '): string => {
    let xml = `${indent}<block id="${block.id}" type="${block.type}">\n`

    if (Object.keys(block.props || {}).length > 0) {
      xml += `${indent}  <props>\n`
      for (const [k, v] of Object.entries(block.props)) {
        xml += `${indent}    <prop name="${k}"><![CDATA[${v}]]></prop>\n`
      }
      xml += `${indent}  </props>\n`
    }

    if (block.type === 'table') {
      const rows = block.tableRows ?? []
      xml += `${indent}  <table>\n`
      rows.forEach((row: ExporterTableRow) => {
        xml += `${indent}    <row>\n`
        const cells = (Array.isArray(row.cells) ? row.cells : []) as (ExporterInlineContent[] | unknown)[]
        cells.forEach((cell: ExporterInlineContent[] | unknown) => {
          xml += `${indent}      <cell><![CDATA[${Array.isArray(cell) ? inlineToText(cell as ExporterInlineContent[]) : ''}]]></cell>\n`
        })
        xml += `${indent}    </row>\n`
      })
      xml += `${indent}  </table>\n`
    } else {
      xml += `${indent}  <content><![CDATA[${getPlainTextFromNormalized(block)}]]></content>\n`
    }

    if (Array.isArray(block.children) && block.children.length > 0) {
      xml += `${indent}  <children>\n`
      block.children.forEach((c: ExporterBlock) => { xml += renderXML(c, indent + '    ') })
      xml += `${indent}  </children>\n`
    }

    xml += `${indent}</block>\n`
    return xml
  }

  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`
  xml += `<!-- AMEVA Document Export: ${new Date().toISOString()} -->\n`
  xml += `<document>\n`
  blocks.forEach(b => { xml += renderXML(b) })
  xml += `</document>`
  return xml
}
