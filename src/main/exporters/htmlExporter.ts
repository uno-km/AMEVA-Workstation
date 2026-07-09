/**
 * @file htmlExporter.ts
 * @system AMEVA OS Desktop Workstation
 * @location src/main/exporters/htmlExporter.ts
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

import { escapeHtml, getPlainTextFromNormalized, inlineToText, inlineToHTML, type ExporterBlock, type ExporterTableRow, type ExporterInlineContent } from './exportersHelper.js'

// ══════════════════════════════════════════════════════════════
// 1. HTML 내보내기 (백엔드 분산 변환 노드 버전)
// ══════════════════════════════════════════════════════════════
export function blocksToHTML(blocks: ExporterBlock[]): string {
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `css`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const css = ...` 형태로 안전 캐싱 후 가공 기동.
       */
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

      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `body`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const body = ...` 형태로 안전 캐싱 후 가공 기동.
       */
  let body = ''
  let listType: 'ul' | 'ol' | null = null

      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `closeList`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const closeList = ...` 형태로 안전 캐싱 후 가공 기동.
       */
  const closeList = () => {
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `listType`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (listType)` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
    if (listType) { body += `</${listType}>\n`; listType = null }
  }

      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `renderBlock`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const renderBlock = ...` 형태로 안전 캐싱 후 가공 기동.
       */
  const renderBlock = (block: ExporterBlock, depth = 0): string => {
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `indent`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const indent = ...` 형태로 안전 캐싱 후 가공 기동.
       */
    const indent = depth > 0 ? ` style="margin-left:${depth * 20}px"` : ''
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `contentHtml`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const contentHtml = ...` 형태로 안전 캐싱 후 가공 기동.
       */
    const contentHtml = inlineToHTML(block.content || [])

      /*
       * [SWITCH ROUTING CASE]
       * - 라우팅 키: `switch (block.type) {`
       * - 예상 시나리오: 유입된 상태 변수 분기값과 일치하는 케이스 블록으로 런타임 제어를 즉시 라우팅함.
       * - 예시: `switch (format)` 분기 시 매치되는 변환 포맷 서브 모듈이 가동됨.
       */
    switch (block.type) {
    /*
     * [CASE ROUTING DECISION BINDING]
     * - 분기 타겟: `case 'heading': {`
     * - 만족 시: 본 케이스 전용 연산을 이행하고 break/return을 거쳐 스위치 게이트를 마감함.
     * - 예시: `case 'heading': {` 만족 시 해당 포맷 바이너리 빌더 호출.
     */
      case 'heading': {
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `lvl`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const lvl = ...` 형태로 안전 캐싱 후 가공 기동.
       */
        const lvl = Math.min(6, Math.max(1, Number(block.props?.level) || 1))
        return `<h${lvl}>${contentHtml}</h${lvl}>\n`
      }
    /*
     * [CASE ROUTING DECISION BINDING]
     * - 분기 타겟: `case 'paragraph':`
     * - 만족 시: 본 케이스 전용 연산을 이행하고 break/return을 거쳐 스위치 게이트를 마감함.
     * - 예시: `case 'paragraph':` 만족 시 해당 포맷 바이너리 빌더 호출.
     */
      case 'paragraph':
        return `<p>${contentHtml || '&nbsp;'}</p>\n`
    /*
     * [CASE ROUTING DECISION BINDING]
     * - 분기 타겟: `case 'bulletListItem':`
     * - 만족 시: 본 케이스 전용 연산을 이행하고 break/return을 거쳐 스위치 게이트를 마감함.
     * - 예시: `case 'bulletListItem':` 만족 시 해당 포맷 바이너리 빌더 호출.
     */
      case 'bulletListItem':
        return `<li${indent}>${contentHtml}${
          block.children?.length ? `<ul>${block.children.map((c: ExporterBlock) => renderBlock(c, depth + 1)).join('')}</ul>` : ''
        }</li>\n`
    /*
     * [CASE ROUTING DECISION BINDING]
     * - 분기 타겟: `case 'numberedListItem':`
     * - 만족 시: 본 케이스 전용 연산을 이행하고 break/return을 거쳐 스위치 게이트를 마감함.
     * - 예시: `case 'numberedListItem':` 만족 시 해당 포맷 바이너리 빌더 호출.
     */
      case 'numberedListItem':
        return `<li${indent}>${contentHtml}${
          block.children?.length ? `<ol>${block.children.map((c: ExporterBlock) => renderBlock(c, depth + 1)).join('')}</ol>` : ''
        }</li>\n`
    /*
     * [CASE ROUTING DECISION BINDING]
     * - 분기 타겟: `case 'codeBlock': {`
     * - 만족 시: 본 케이스 전용 연산을 이행하고 break/return을 거쳐 스위치 게이트를 마감함.
     * - 예시: `case 'codeBlock': {` 만족 시 해당 포맷 바이너리 빌더 호출.
     */
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
       * - 변수 명: `code`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const code = ...` 형태로 안전 캐싱 후 가공 기동.
       */
        const code = escapeHtml(getPlainTextFromNormalized(block))
        return `<pre><span class="lang-badge">${escapeHtml(lang)}</span><code class="language-${lang}">${code}</code></pre>\n`
      }
    /*
     * [CASE ROUTING DECISION BINDING]
     * - 분기 타겟: `case 'checkListItem': {`
     * - 만족 시: 본 케이스 전용 연산을 이행하고 break/return을 거쳐 스위치 게이트를 마감함.
     * - 예시: `case 'checkListItem': {` 만족 시 해당 포맷 바이너리 빌더 호출.
     */
      case 'checkListItem': {
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `checked`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const checked = ...` 형태로 안전 캐싱 후 가공 기동.
       */
        const checked = block.props?.checked ? 'checked' : ''
        return `<li style="list-style:none;display:flex;gap:8px"><input type="checkbox" ${checked} disabled /><span>${contentHtml}</span></li>\n`
      }
    /*
     * [CASE ROUTING DECISION BINDING]
     * - 분기 타겟: `case 'image': {`
     * - 만족 시: 본 케이스 전용 연산을 이행하고 break/return을 거쳐 스위치 게이트를 마감함.
     * - 예시: `case 'image': {` 만족 시 해당 포맷 바이너리 빌더 호출.
     */
      case 'image': {
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `url`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const url = ...` 형태로 안전 캐싱 후 가공 기동.
       */
        const url = block.props?.url || ''
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `caption`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const caption = ...` 형태로 안전 캐싱 후 가공 기동.
       */
        const caption = block.props?.caption || ''
        return `<figure style="text-align:center;margin:1.2rem 0"><img src="${url}" alt="${escapeHtml(caption)}" />${caption ? `<figcaption style="font-size:12px;color:#9ca3af;margin-top:6px">${escapeHtml(caption)}</figcaption>` : ''}</figure>\n`
      }
    /*
     * [CASE ROUTING DECISION BINDING]
     * - 분기 타겟: `case 'table': {`
     * - 만족 시: 본 케이스 전용 연산을 이행하고 break/return을 거쳐 스위치 게이트를 마감함.
     * - 예시: `case 'table': {` 만족 시 해당 포맷 바이너리 빌더 호출.
     */
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
       * - 조건 식: `rows.length === 0`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (rows.length === 0)` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
        if (rows.length === 0) return ''
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `html`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const html = ...` 형태로 안전 캐싱 후 가공 기동.
       */
        let html = '<table>\n<tbody>\n'
        rows.forEach((row: ExporterTableRow, ri: number) => {
          html += '<tr>\n'
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `cells`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const cells = ...` 형태로 안전 캐싱 후 가공 기동.
       */
          const cells = (Array.isArray(row.cells) ? row.cells : []) as (ExporterInlineContent[] | unknown)[]
          cells.forEach((cell: ExporterInlineContent[] | unknown) => {
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `cellText`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const cellText = ...` 형태로 안전 캐싱 후 가공 기동.
       */
            const cellText = Array.isArray(cell) ? inlineToText(cell as ExporterInlineContent[]) : ''
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `tag`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const tag = ...` 형태로 안전 캐싱 후 가공 기동.
       */
            const tag = ri === 0 ? 'th' : 'td'
            html += `<${tag}>${escapeHtml(cellText)}</${tag}>\n`
          })
          html += '</tr>\n'
        })
        html += '</tbody>\n</table>\n'
        return html
      }
    /*
     * [CASE ROUTING DECISION BINDING]
     * - 분기 타겟: `case 'quote':`
     * - 만족 시: 본 케이스 전용 연산을 이행하고 break/return을 거쳐 스위치 게이트를 마감함.
     * - 예시: `case 'quote':` 만족 시 해당 포맷 바이너리 빌더 호출.
     */
      case 'quote':
        return `<blockquote>${contentHtml}</blockquote>\n`
    /*
     * [CASE ROUTING DECISION BINDING]
     * - 분기 타겟: `case 'divider':`
     * - 만족 시: 본 케이스 전용 연산을 이행하고 break/return을 거쳐 스위치 게이트를 마감함.
     * - 예시: `case 'divider':` 만족 시 해당 포맷 바이너리 빌더 호출.
     */
      case 'divider':
        return '<hr />\n'
    /*
     * [CASE ROUTING DECISION BINDING]
     * - 분기 타겟: `default:`
     * - 만족 시: 본 케이스 전용 연산을 이행하고 break/return을 거쳐 스위치 게이트를 마감함.
     * - 예시: `default:` 만족 시 해당 포맷 바이너리 빌더 호출.
     */
      default:
        return contentHtml ? `<p>${contentHtml}</p>\n` : ''
    }
  }

  blocks.forEach((block) => {
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `block.type === 'bulletListItem'`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (block.type === 'bulletListItem')` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
    if (block.type === 'bulletListItem') {
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `listType !== 'ul') { closeList(`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (listType !== 'ul') { closeList()` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
      if (listType !== 'ul') { closeList(); body += '<ul>\n'; listType = 'ul' }
      body += renderBlock(block)
    } else if (block.type === 'numberedListItem') {
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `listType !== 'ol') { closeList(`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (listType !== 'ol') { closeList()` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
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
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `renderXML`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const renderXML = ...` 형태로 안전 캐싱 후 가공 기동.
       */
  const renderXML = (block: ExporterBlock, indent = '  '): string => {
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `xml`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const xml = ...` 형태로 안전 캐싱 후 가공 기동.
       */
    let xml = `${indent}<block id="${block.id}" type="${block.type}">\n`

      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `Object.keys(block.props || {}).length > 0`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (Object.keys(block.props || {}).length > 0)` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
    if (Object.keys(block.props || {}).length > 0) {
      xml += `${indent}  <props>\n`
      /*
       * [LOOP CONTROL ITERATION]
       * - 루프 조건: `for (const [k, v] of Object.entries(block.props)) {`
       * - 예상 시나리오: 지정된 조건 한계 도달 시점까지 콜렉션 항목의 순차 매핑, 변환 및 동기 적재 처리를 수행함.
       * - 예시: `for (const item of list)` 루프 실행 시 모든 개별 블록의 html 포맷 정제 완료 후 스택 종결.
       */
      for (const [k, v] of Object.entries(block.props)) {
        xml += `${indent}    <prop name="${k}"><![CDATA[${v}]]></prop>\n`
      }
      xml += `${indent}  </props>\n`
    }

      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `block.type === 'table'`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (block.type === 'table')` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
    if (block.type === 'table') {
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `rows`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const rows = ...` 형태로 안전 캐싱 후 가공 기동.
       */
      const rows = block.tableRows ?? []
      xml += `${indent}  <table>\n`
      rows.forEach((row: ExporterTableRow) => {
        xml += `${indent}    <row>\n`
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `cells`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const cells = ...` 형태로 안전 캐싱 후 가공 기동.
       */
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

      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `Array.isArray(block.children) && block.children.length > 0`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (Array.isArray(block.children) && block.children.length > 0)` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
    if (Array.isArray(block.children) && block.children.length > 0) {
      xml += `${indent}  <children>\n`
      block.children.forEach((c: ExporterBlock) => { xml += renderXML(c, indent + '    ') })
      xml += `${indent}  </children>\n`
    }

    xml += `${indent}</block>\n`
    return xml
  }

      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `xml`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const xml = ...` 형태로 안전 캐싱 후 가공 기동.
       */
  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`
  xml += `<!-- AMEVA Document Export: ${new Date().toISOString()} -->\n`
  xml += `<document>\n`
  blocks.forEach(b => { xml += renderXML(b) })
  xml += `</document>`
  return xml
}

