/**
 * @file pptxExporter.ts
 * @system AMEVA OS Desktop Workstation
 * @location src/main/exporters/pptxExporter.ts
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

import { createRequire } from 'module'
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `require`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const require = ...` 형태로 안전 캐싱 후 가공 기동.
       */
const require = createRequire(import.meta.url)

      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `pptxgen`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const pptxgen = ...` 형태로 안전 캐싱 후 가공 기동.
       */
const pptxgen = require('pptxgenjs')
import { getPlainTextFromNormalized, inlineToText, type ExporterBlock, type ExporterInlineContent, type ExporterTableRow } from './exportersHelper.js'

export async function exportToPPTX(blocks: ExporterBlock[]): Promise<Buffer> {
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `pptx`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const pptx = ...` 형태로 안전 캐싱 후 가공 기동.
       */
  const pptx = new pptxgen()
  pptx.layout = 'LAYOUT_16x9'
  pptx.author = 'AMEVA'

  interface SlideContent {
    type: 'bullet' | 'image' | 'table' | 'code'
    text?: string
    url?: string
    tableRows?: ExporterTableRow[]
  }

  interface SlideData {
    title: string
    contents: SlideContent[]
  }

  const slides: SlideData[] = []
  let currentSlide: SlideData = { title: 'Presentation', contents: [] }

      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `processBlock`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const processBlock = ...` 형태로 안전 캐싱 후 가공 기동.
       */
  const processBlock = (block: ExporterBlock) => {
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `text`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const text = ...` 형태로 안전 캐싱 후 가공 기동.
       */
    const text = getPlainTextFromNormalized(block)

      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `block.type === 'heading'`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (block.type === 'heading')` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
    if (block.type === 'heading') {
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `level`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const level = ...` 형태로 안전 캐싱 후 가공 기동.
       */
      const level = Number(block.props?.level) || 1
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `level === 1`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (level === 1)` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
      if (level === 1) {
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `currentSlide.contents.length > 0 || currentSlide.title !== 'Presentation'`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (currentSlide.contents.length > 0 || currentSlide.title !== 'Presentation')` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
        if (currentSlide.contents.length > 0 || currentSlide.title !== 'Presentation') {
          slides.push(currentSlide)
        }
        currentSlide = { title: text, contents: [] }
      } else {
        currentSlide.contents.push({ type: 'bullet', text: `[${level}단계] ${text}` })
      }
    } else if (['bulletListItem', 'numberedListItem', 'paragraph'].includes(block.type)) {
      if (text.trim()) {
        currentSlide.contents.push({ type: 'bullet', text: (block.type === 'numberedListItem' ? '1. ' : '') + text })
      }
    } else if (block.type === 'codeBlock') {
      const lang = block.props?.language || ''
      if (lang === 'ameva-excel') {
        try {
          const sheets = JSON.parse(text)
          if (Array.isArray(sheets) && sheets.length > 0) {
            for (const sheet of sheets) {
              const celldata = sheet.celldata || []
              if (celldata.length === 0) continue
              let maxRow = 0
              let maxCol = 0
              for (const cell of celldata) {
                if (cell.r > maxRow) maxRow = cell.r
                if (cell.c > maxCol) maxCol = cell.c
              }
              const grid = Array(maxRow + 1).fill(null).map(() => Array(maxCol + 1).fill(null))
              for (const cell of celldata) {
                grid[cell.r][cell.c] = cell.v
              }
              currentSlide.contents.push({ type: 'bullet', text: `[Excel] ${sheet.name || 'Sheet'}` })
              
              const rows = []
              for (let r = 0; r <= maxRow; r++) {
                const cells = []
                for (let c = 0; c <= maxCol; c++) {
                  const v = grid[r][c]
                  let val = ''
                  if (v) {
                    if (typeof v === 'string' || typeof v === 'number') val = String(v)
                    else if (v.m !== undefined) val = String(v.m)
                    else if (v.v !== undefined) val = String(v.v)
                  }
                  cells.push([{ text: val }])
                }
                rows.push({ cells })
              }
              currentSlide.contents.push({ type: 'table', tableRows: rows })
            }
          }
        } catch (e) {
          console.error('[exportToPPTX] ameva-excel 파싱 실패:', e)
        }
    } else if (block.type === 'kanban') {
      try {
        const text = block.props?.data || '{}'
        const board = JSON.parse(text)
        const cols = board.columns || []
        if (cols.length > 0) {
          currentSlide.contents.push({ type: 'bullet', text: `[Kanban Board]` })
          const maxCards = Math.max(...cols.map(c => (c.cards || []).length))
          const rows = []
          
          // Header
          rows.push({
            cells: cols.map(col => [{ text: `${col.title || 'Untitled'} (${(col.cards||[]).length})` }])
          })
          
          // Cards
          for (let i = 0; i < maxCards; i++) {
            rows.push({
              cells: cols.map(col => {
                const card = (col.cards || [])[i]
                let val = ''
                if (card) {
                  val += card.title || ''
                  if (card.labels && card.labels.length > 0) {
                    val += ' ' + card.labels.map(l => `[${l.text}]`).join(' ')
                  }
                  if (card.description) {
                    val += ' - ' + card.description
                  }
                }
                return [{ text: val }]
              })
            })
          }
          currentSlide.contents.push({ type: 'table', tableRows: rows })
        }
      } catch (e) {
        console.error('[exportToPPTX] ameva-kanban 파싱 실패:', e)
      }
    } else if (block.type === 'codeBlock') {
      currentSlide.contents.push({ type: 'code', text: extractText(block) })
    } else if (block.type === 'image' && block.props?.url) {
      currentSlide.contents.push({ type: 'image', url: block.props.url })
    } else if (block.type === 'table') {
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
        currentSlide.contents.push({ type: 'table', tableRows: rows })
      }
    }

      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `Array.isArray(block.children)`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (Array.isArray(block.children))` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
    if (Array.isArray(block.children)) {
      block.children.forEach(processBlock)
    }
  }

  blocks.forEach(processBlock)
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `currentSlide.contents.length > 0 || currentSlide.title !== 'Presentation'`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (currentSlide.contents.length > 0 || currentSlide.title !== 'Presentation')` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
  if (currentSlide.contents.length > 0 || currentSlide.title !== 'Presentation') {
    slides.push(currentSlide)
  }

      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `slides.length === 0`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (slides.length === 0)` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
  if (slides.length === 0) {
    slides.push({ title: 'AMEVA Document Summary', contents: [{ type: 'bullet', text: '문서 내용이 비어 있습니다.' }] })
  }

      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `coverSlide`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const coverSlide = ...` 형태로 안전 캐싱 후 가공 기동.
       */
  const coverSlide = pptx.addSlide()
  coverSlide.background = { fill: '0B0F19' }
  coverSlide.addShape(pptx.shapes.RECTANGLE, { x: 0.8, y: 3.4, w: 11.7, h: 0.04, fill: { type: 'solid', color: '8B5CF6' }, line: { color: 'transparent' } })
  coverSlide.addText('AMEVA WORKSTATION PRESENTATION', { x: 0.8, y: 2.8, w: 11.7, h: 0.4, fontSize: 13, bold: true, color: '8B5CF6', fontFace: 'Calibri', charSpacing: 6 })
  coverSlide.addText(slides[0]?.title || 'Document Report', { x: 0.8, y: 3.8, w: 11.7, h: 1.8, fontSize: 44, bold: true, color: 'FFFFFF', fontFace: 'Calibri' })
  coverSlide.addText(new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' }) + ' · Generated by AMEVA', { x: 0.8, y: 6.2, w: 8, h: 0.4, fontSize: 11, color: '6B7280', fontFace: 'Calibri' })

  slides.forEach((slideData, idx) => {
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `MAX_BULLETS_PER_PAGE`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const MAX_BULLETS_PER_PAGE = ...` 형태로 안전 캐싱 후 가공 기동.
       */
    const MAX_BULLETS_PER_PAGE = 6
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `bulletItems`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const bulletItems = ...` 형태로 안전 캐싱 후 가공 기동.
       */
    const bulletItems = slideData.contents.filter(c => c.type === 'bullet')
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `images`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const images = ...` 형태로 안전 캐싱 후 가공 기동.
       */
    const images = slideData.contents.filter(c => c.type === 'image')
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `tables`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const tables = ...` 형태로 안전 캐싱 후 가공 기동.
       */
    const tables = slideData.contents.filter(c => c.type === 'table')
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `codes`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const codes = ...` 형태로 안전 캐싱 후 가공 기동.
       */
    const codes = slideData.contents.filter(c => c.type === 'code')

      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `codes.length > 0 && bulletItems.length === 0 && tables.length === 0`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (codes.length > 0 && bulletItems.length === 0 && tables.length === 0)` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
    if (codes.length > 0 && bulletItems.length === 0 && tables.length === 0) {
      codes.forEach((codeItem, cIdx) => {
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `slide`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const slide = ...` 형태로 안전 캐싱 후 가공 기동.
       */
        const slide = pptx.addSlide()
        slide.background = { fill: '0F172A' }
        slide.addText(`${slideData.title} - Source Code ${codes.length > 1 ? `(${cIdx + 1})` : ''}`, { x: 0.6, y: 0.4, w: 12.0, h: 0.8, fontSize: 26, bold: true, color: '8B5CF6', fontFace: 'Calibri' })
        slide.addText(codeItem.text || '', {
          x: 0.6, y: 1.4, w: 12.0, h: 5.2,
          fontSize: 12,
          color: '38BDF8',
          fontFace: 'Courier New',
          fill: { color: '030712' },
          line: { color: '334155', width: 1.5 },
          valign: 'top',
          margin: [15, 15, 15, 15]
        })
      })
      return
    }

      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `tables.length > 0`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (tables.length > 0)` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
    if (tables.length > 0) {
      tables.forEach((tableItem, tIdx) => {
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `slide`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const slide = ...` 형태로 안전 캐싱 후 가공 기동.
       */
        const slide = pptx.addSlide()
        slide.background = { fill: '0A0A14' }
        slide.addText(`${slideData.title} - Table ${tables.length > 1 ? `(${tIdx + 1})` : ''}`, { x: 0.6, y: 0.4, w: 12.0, h: 0.8, fontSize: 26, bold: true, color: 'FFFFFF', fontFace: 'Calibri' })
        
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `bulletItems.length > 0`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (bulletItems.length > 0)` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
        if (bulletItems.length > 0) {
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `leadText`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const leadText = ...` 형태로 안전 캐싱 후 가공 기동.
       */
          const leadText = bulletItems.slice(0, 2).map(b => b.text).join('\n')
          slide.addText(leadText, { x: 0.6, y: 1.2, w: 12.0, h: 0.8, fontSize: 13, color: '9CA3AF', fontFace: 'Calibri' })
        }

      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `rawRows`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const rawRows = ...` 형태로 안전 캐싱 후 가공 기동.
       */
        const rawRows = tableItem.tableRows || []
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `formattedTableData`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const formattedTableData = ...` 형태로 안전 캐싱 후 가공 기동.
       */
        const formattedTableData = rawRows.map((rowObj: ExporterTableRow, ri: number) => {
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `cells`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const cells = ...` 형태로 안전 캐싱 후 가공 기동.
       */
          const cells = (Array.isArray(rowObj.cells) ? rowObj.cells : []) as (ExporterInlineContent[] | unknown)[]
          return cells.map((cell: ExporterInlineContent[] | unknown) => {
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `txt`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const txt = ...` 형태로 안전 캐싱 후 가공 기동.
       */
            const txt = Array.isArray(cell) ? inlineToText(cell as ExporterInlineContent[]) : ''
            return {
              text: txt,
              options: {
                fill: ri === 0 ? '1F2937' : '111827',
                color: ri === 0 ? '8B5CF6' : 'D1D5DB',
                bold: ri === 0,
                align: 'center',
                fontFace: 'Calibri',
                fontSize: 11,
                border: { pt: 1, color: '374151' }
              }
            }
          })
        })

      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `formattedTableData.length > 0`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (formattedTableData.length > 0)` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
        if (formattedTableData.length > 0) {
          slide.addTable(formattedTableData, {
            x: 0.6,
            y: bulletItems.length > 0 ? 2.1 : 1.4,
            w: 12.0,
            h: bulletItems.length > 0 ? 4.5 : 5.2
          })
        }
      })
      return
    }

      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `totalPages`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const totalPages = ...` 형태로 안전 캐싱 후 가공 기동.
       */
    const totalPages = Math.max(1, Math.ceil(bulletItems.length / MAX_BULLETS_PER_PAGE))
    
      /*
       * [LOOP CONTROL ITERATION]
       * - 루프 조건: `for (let pageIdx = 0; pageIdx < totalPages; pageIdx++) {`
       * - 예상 시나리오: 지정된 조건 한계 도달 시점까지 콜렉션 항목의 순차 매핑, 변환 및 동기 적재 처리를 수행함.
       * - 예시: `for (const item of list)` 루프 실행 시 모든 개별 블록의 html 포맷 정제 완료 후 스택 종결.
       */
    for (let pageIdx = 0; pageIdx < totalPages; pageIdx++) {
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `slide`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const slide = ...` 형태로 안전 캐싱 후 가공 기동.
       */
      const slide = pptx.addSlide()
      slide.background = { fill: '0A0A14' }
      slide.addShape(pptx.shapes.RECTANGLE, { x: 0, y: 0, w: 0.05, h: 7.5, fill: { type: 'solid', color: idx % 2 === 0 ? '8B5CF6' : '06B6D4' }, line: { color: 'transparent' } })

      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `pageSuffix`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const pageSuffix = ...` 형태로 안전 캐싱 후 가공 기동.
       */
      const pageSuffix = totalPages > 1 ? ` (${pageIdx + 1}/${totalPages})` : ''
      slide.addText(slideData.title + pageSuffix, { x: 0.6, y: 0.4, w: 12.0, h: 0.8, fontSize: 28, bold: true, color: 'FFFFFF', fontFace: 'Calibri' })
      slide.addShape(pptx.shapes.RECTANGLE, { x: 0.6, y: 1.25, w: 12.0, h: 0.01, fill: { type: 'solid', color: '374151' }, line: { color: 'transparent' } })

      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `startIdx`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const startIdx = ...` 형태로 안전 캐싱 후 가공 기동.
       */
      const startIdx = pageIdx * MAX_BULLETS_PER_PAGE
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `endIdx`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const endIdx = ...` 형태로 안전 캐싱 후 가공 기동.
       */
      const endIdx = startIdx + MAX_BULLETS_PER_PAGE
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `pageBullets`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const pageBullets = ...` 형태로 안전 캐싱 후 가공 기동.
       */
      const pageBullets = bulletItems.slice(startIdx, endIdx)

      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `hasImage`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const hasImage = ...` 형태로 안전 캐싱 후 가공 기동.
       */
      const hasImage = images.length > 0 && pageIdx === 0
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `textWidth`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const textWidth = ...` 형태로 안전 캐싱 후 가공 기동.
       */
      const textWidth = hasImage ? 7.0 : 12.0
      
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `pageBullets.length > 0`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (pageBullets.length > 0)` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
      if (pageBullets.length > 0) {
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `textRuns`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const textRuns = ...` 형태로 안전 캐싱 후 가공 기동.
       */
        const textRuns = pageBullets.map(b => ({
          text: `\n${b.text}`,
          options: { fontSize: 16, color: 'D1D5DB', fontFace: 'Calibri', paraSpaceAfter: 12 }
        }))
        slide.addText(textRuns, { x: 0.6, y: 1.5, w: textWidth, h: 5.0, valign: 'top' })
      }

      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `hasImage && images[0].url`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (hasImage && images[0].url)` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
      if (hasImage && images[0].url) {
        try {
          slide.addImage({
            path: images[0].url,
            x: 7.9,
            y: 1.5,
            w: 4.8,
            h: 4.8,
            sizing: { type: 'contain', w: 4.8, h: 4.8 }
          })
        } catch (imgErr) {
          console.warn('[exportToPPTX] 이미지 삽입 실패:', imgErr)
        }
      }

      slide.addText(`${pageIdx + 1} / ${totalPages}`, { x: 11.5, y: 7.0, w: 1.2, h: 0.3, fontSize: 9, color: '4B5563', fontFace: 'Calibri', align: 'right' })
    }
  })

      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `buffer`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const buffer = ...` 형태로 안전 캐싱 후 가공 기동.
       */
  const buffer = await pptx.write('arraybuffer')
  return Buffer.from(buffer)
}

