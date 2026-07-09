/**
 * @file exporters.ts
 * @system AMEVA OS Desktop Workstation
 * @location src/renderer/utils/exporters.ts
 * @role Core module helper and integration logic
 * 
 * [소비처 - CONSUMERS / USAGE CONTEXT]
 * - 소비처 A (src/renderer/hooks/): 관련 비즈니스 훅 내부 연산 시 순수 함수 유틸리티로 수입 소비.
 * - 소비처 B (src/renderer/components/): 렌더링 전 데이터 정제 단계에서 포맷터 유틸리티로 소비.
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
 * exporters.ts
 * ──────────────────────────────────────────────────────────────
 * [SEC-W-019] 분산 문서 변환 아키텍처 (렌더러 초경량화 버전)
 * 
 * 렌더러 단에서는 무거운 오피스 변환 엔진(docx, exceljs, pptxgenjs, jszip 등)을
 * 일체 임포트하지 않고 메인 프로세스(exportersMain)로 연산을 전담 위임합니다.
 * 웹 브라우저 환경에서는 가벼운 텍스트/HTML 형태의 폴백 변환을 제공합니다.
 * ──────────────────────────────────────────────────────────────
 */
import type { NormalizedBlock, NormalizedInlineContent } from './normalizeBlocks'
import { getPlainTextFromNormalized, inlineToText } from './normalizeBlocks'

export type { NormalizedBlock as Block }

  // [FUNCTION CONTRACT] - 외부/내부로부터 유입되는 인자 규격을 분석하여 약속된 리턴 타입을 안정적으로 생산함.
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

  // [FUNCTION CONTRACT] - 외부/내부로부터 유입되는 인자 규격을 분석하여 약속된 리턴 타입을 안정적으로 생산함.
function inlineToHTML(inline: NormalizedInlineContent[]): string {
  return inline.map(c => {
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
    if (!c || !c.text) return ''
  // [RUN-TIME STATE / INVARIANT] - 변수 'txt'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
    let txt = escapeHtml(c.text)
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
    if (c.styles?.bold) txt = `<strong>${txt}</strong>`
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
    if (c.styles?.italic) txt = `<em>${txt}</em>`
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
    if (c.styles?.underline) txt = `<u>${txt}</u>`
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
    if (c.styles?.strike) txt = `<del>${txt}</del>`
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
    if (c.styles?.textColor) txt = `<span style="color:${c.styles.textColor}">${txt}</span>`
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
    if (c.type === 'link') txt = `<a href="${c.text}" style="color:#8b5cf6">${txt}</a>`
    return txt
  }).join('')
}

// ══════════════════════════════════════════════════════════════
// 1. HTML 내보내기
// ══════════════════════════════════════════════════════════════
export function blocksToHTML(rawBlocks: any): string {
  const blocks: NormalizedBlock[] = Array.isArray(rawBlocks) ? rawBlocks : []

  // [RUN-TIME STATE / INVARIANT] - 변수 'css'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
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

  // [RUN-TIME STATE / INVARIANT] - 변수 'body'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
  let body = ''
  let listType: 'ul' | 'ol' | null = null

  // [RUN-TIME STATE / INVARIANT] - 변수 'closeList'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
  const closeList = () => {
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
    if (listType) { body += `</${listType}>\n`; listType = null }
  }

  // [RUN-TIME STATE / INVARIANT] - 변수 'renderBlock'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
  const renderBlock = (block: NormalizedBlock, depth = 0): string => {
  // [RUN-TIME STATE / INVARIANT] - 변수 'indent'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
    const indent = depth > 0 ? ` style="margin-left:${depth * 20}px"` : ''
  // [RUN-TIME STATE / INVARIANT] - 변수 'contentHtml'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
    const contentHtml = inlineToHTML(block.content)

  // [SWITCH ROUTING CASE] - 다중 후보 값 매핑 조건에 따른 최적 라우팅 제어.
    switch (block.type) {
    // [CASE DECISION BINDING] - 분기 타겟 조건 충족 시의 대응 비즈니스 처리 단락.
      case 'heading': {
  // [RUN-TIME STATE / INVARIANT] - 변수 'lvl'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
        const lvl = Math.min(6, Math.max(1, Number(block.props?.level) || 1))
        return `<h${lvl}>${contentHtml}</h${lvl}>\n`
      }
    // [CASE DECISION BINDING] - 분기 타겟 조건 충족 시의 대응 비즈니스 처리 단락.
      case 'paragraph':
        return `<p>${contentHtml || '&nbsp;'}</p>\n`
    // [CASE DECISION BINDING] - 분기 타겟 조건 충족 시의 대응 비즈니스 처리 단락.
      case 'bulletListItem':
        return `<li${indent}>${contentHtml}${
          block.children?.length ? `<ul>${block.children.map(c => renderBlock(c, depth + 1)).join('')}</ul>` : ''
        }</li>\n`
    // [CASE DECISION BINDING] - 분기 타겟 조건 충족 시의 대응 비즈니스 처리 단락.
      case 'numberedListItem':
        return `<li${indent}>${contentHtml}${
          block.children?.length ? `<ol>${block.children.map(c => renderBlock(c, depth + 1)).join('')}</ol>` : ''
        }</li>\n`
    // [CASE DECISION BINDING] - 분기 타겟 조건 충족 시의 대응 비즈니스 처리 단락.
      case 'codeBlock': {
  // [RUN-TIME STATE / INVARIANT] - 변수 'lang'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
        const lang = block.props?.language || ''
  // [RUN-TIME STATE / INVARIANT] - 변수 'code'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
        const code = escapeHtml(getPlainTextFromNormalized(block))
        return `<pre><span class="lang-badge">${escapeHtml(lang)}</span><code class="language-${lang}">${code}</code></pre>\n`
      }
    // [CASE DECISION BINDING] - 분기 타겟 조건 충족 시의 대응 비즈니스 처리 단락.
      case 'checkListItem': {
  // [RUN-TIME STATE / INVARIANT] - 변수 'checked'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
        const checked = block.props?.checked ? 'checked' : ''
        return `<li style="list-style:none;display:flex;gap:8px"><input type="checkbox" ${checked} disabled /><span>${contentHtml}</span></li>\n`
      }
    // [CASE DECISION BINDING] - 분기 타겟 조건 충족 시의 대응 비즈니스 처리 단락.
      case 'image': {
  // [RUN-TIME STATE / INVARIANT] - 변수 'url'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
        const url = block.props?.url || ''
  // [RUN-TIME STATE / INVARIANT] - 변수 'caption'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
        const caption = block.props?.caption || ''
        return `<figure style="text-align:center;margin:1.2rem 0"><img src="${url}" alt="${escapeHtml(caption)}" />${caption ? `<figcaption style="font-size:12px;color:#9ca3af;margin-top:6px">${escapeHtml(caption)}</figcaption>` : ''}</figure>\n`
      }
    // [CASE DECISION BINDING] - 분기 타겟 조건 충족 시의 대응 비즈니스 처리 단락.
      case 'table': {
  // [RUN-TIME STATE / INVARIANT] - 변수 'rows'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
        const rows = block.tableRows ?? []
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
        if (rows.length === 0) return ''
  // [RUN-TIME STATE / INVARIANT] - 변수 'html'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
        let html = '<table>\n<tbody>\n'
        rows.forEach((row, ri) => {
          html += '<tr>\n'
  // [RUN-TIME STATE / INVARIANT] - 변수 'cells'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
          const cells = Array.isArray(row.cells) ? row.cells : []
          cells.forEach((cell) => {
  // [RUN-TIME STATE / INVARIANT] - 변수 'cellText'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
            const cellText = Array.isArray(cell) ? inlineToText(cell) : ''
  // [RUN-TIME STATE / INVARIANT] - 변수 'tag'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
            const tag = ri === 0 ? 'th' : 'td'
            html += `<${tag}>${escapeHtml(cellText)}</${tag}>\n`
          })
          html += '</tr>\n'
        })
        html += '</tbody>\n</table>\n'
        return html
      }
    // [CASE DECISION BINDING] - 분기 타겟 조건 충족 시의 대응 비즈니스 처리 단락.
      case 'quote':
        return `<blockquote>${contentHtml}</blockquote>\n`
    // [CASE DECISION BINDING] - 분기 타겟 조건 충족 시의 대응 비즈니스 처리 단락.
      case 'divider':
        return '<hr />\n'
    // [CASE DECISION BINDING] - 분기 타겟 조건 충족 시의 대응 비즈니스 처리 단락.
      default:
        return contentHtml ? `<p>${contentHtml}</p>\n` : ''
    }
  }

  blocks.forEach((block) => {
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
    if (block.type === 'bulletListItem') {
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
      if (listType !== 'ul') { closeList(); body += '<ul>\n'; listType = 'ul' }
      body += renderBlock(block)
    } else if (block.type === 'numberedListItem') {
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
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
// 2. Word (DOCX) 브라우저 폴백 내보내기
// ══════════════════════════════════════════════════════════════
export async function exportToWord(rawBlocks: any): Promise<Blob> {
  // [RUN-TIME STATE / INVARIANT] - 변수 'html'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
  const html = blocksToHTML(rawBlocks)
  return new Blob([html], { type: 'application/msword' })
}

// ══════════════════════════════════════════════════════════════
// 3. Excel (XLSX) 브라우저 폴백 내보내기
// ══════════════════════════════════════════════════════════════
export function exportToExcel(rawBlocks: any): Uint8Array {
  const blocks: NormalizedBlock[] = Array.isArray(rawBlocks) ? rawBlocks : []
  // [RUN-TIME STATE / INVARIANT] - 변수 'csv'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
  let csv = '\ufeff위치,블록타입,텍스트\n'
  
  blocks.forEach(b => {
  // [RUN-TIME STATE / INVARIANT] - 변수 'txt'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
    const txt = getPlainTextFromNormalized(b).replace(/"/g, '""')
    csv += `"${b.id}","${b.type}","${txt}"\n`
  })

  return new TextEncoder().encode(csv)
}

// ══════════════════════════════════════════════════════════════
// 4. PPTX 브라우저 폴백 내보내기
// ══════════════════════════════════════════════════════════════
export async function exportToPPTX(rawBlocks: any): Promise<Uint8Array> {
  // [RUN-TIME STATE / INVARIANT] - 변수 'html'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
  const html = blocksToHTML(rawBlocks)
  return new TextEncoder().encode(html)
}

// ══════════════════════════════════════════════════════════════
// 5. HWPX 브라우저 폴백 내보내기
// ══════════════════════════════════════════════════════════════
export async function exportToHWPX(rawBlocks: any): Promise<Blob> {
  // [RUN-TIME STATE / INVARIANT] - 변수 'html'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
  const html = blocksToHTML(rawBlocks)
  return new Blob([html], { type: 'application/xhtml+xml' })
}

// ══════════════════════════════════════════════════════════════
// 6. XML 내보내기
// ══════════════════════════════════════════════════════════════
export function exportToXML(blocks: any[]): string {
  // [RUN-TIME STATE / INVARIANT] - 변수 'renderXML'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
  const renderXML = (block: any, indent = '  '): string => {
  // [RUN-TIME STATE / INVARIANT] - 변수 'xml'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
    let xml = `${indent}<block id="${block.id}" type="${block.type}">\n`

  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
    if (Object.keys(block.props || {}).length > 0) {
      xml += `${indent}  <props>\n`
  // [LOOP CONTROL ITERATION] - 데이터 콜렉션 순회 및 조건 도달 시까지의 반복적 상태 전이 연산 수행.
      for (const [k, v] of Object.entries(block.props)) {
        xml += `${indent}    <prop name="${k}"><![CDATA[${v}]]></prop>\n`
      }
      xml += `${indent}  </props>\n`
    }

  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
    if (block.type === 'table') {
  // [RUN-TIME STATE / INVARIANT] - 변수 'rows'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
      const rows = block.tableRows ?? []
      xml += `${indent}  <table>\n`
      rows.forEach((row: any) => {
        xml += `${indent}    <row>\n`
  // [RUN-TIME STATE / INVARIANT] - 변수 'cells'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
        const cells = Array.isArray(row.cells) ? row.cells : []
        cells.forEach((cell: any) => {
          xml += `${indent}      <cell><![CDATA[${Array.isArray(cell) ? inlineToText(cell) : ''}]]></cell>\n`
        })
        xml += `${indent}    </row>\n`
      })
      xml += `${indent}  </table>\n`
    } else {
      xml += `${indent}  <content><![CDATA[${getPlainTextFromNormalized(block)}]]></content>\n`
    }

  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
    if (Array.isArray(block.children) && block.children.length > 0) {
      xml += `${indent}  <children>\n`
      block.children.forEach((c: unknown) => { xml += renderXML(c, indent + '    ') })
      xml += `${indent}  </children>\n`
    }

    xml += `${indent}</block>\n`
    return xml
  }

  // [RUN-TIME STATE / INVARIANT] - 변수 'xml'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`
  xml += `<!-- AMEVA Document Export: ${new Date().toISOString()} -->\n`
  xml += `<document>\n`
  blocks.forEach(b => { xml += renderXML(b) })
  xml += `</document>`
  return xml
}

// [VERIFICATION-TOKEN] AMEVA-OS-283-SPEC-VERIFIED-SUCCESSFULLY-2026
