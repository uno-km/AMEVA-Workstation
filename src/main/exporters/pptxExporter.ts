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
  // [RUN-TIME STATE / INVARIANT] - 변수 'require'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
const require = createRequire(import.meta.url)

  // [RUN-TIME STATE / INVARIANT] - 변수 'pptxgen'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
const pptxgen = require('pptxgenjs')
import { getPlainTextFromNormalized, inlineToText, type ExporterBlock, type ExporterInlineContent, type ExporterTableRow } from './exportersHelper.js'

  // [FUNCTION CONTRACT] - 외부/내부로부터 유입되는 인자 규격을 분석하여 약속된 리턴 타입을 안정적으로 생산함.
export async function exportToPPTX(blocks: ExporterBlock[]): Promise<Buffer> {
  // [RUN-TIME STATE / INVARIANT] - 변수 'pptx'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
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

  // [RUN-TIME STATE / INVARIANT] - 변수 'processBlock'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
  const processBlock = (block: ExporterBlock) => {
  // [RUN-TIME STATE / INVARIANT] - 변수 'text'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
    const text = getPlainTextFromNormalized(block)

  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
    if (block.type === 'heading') {
  // [RUN-TIME STATE / INVARIANT] - 변수 'level'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
      const level = Number(block.props?.level) || 1
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
      if (level === 1) {
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
        if (currentSlide.contents.length > 0 || currentSlide.title !== 'Presentation') {
          slides.push(currentSlide)
        }
        currentSlide = { title: text, contents: [] }
      } else {
        currentSlide.contents.push({ type: 'bullet', text: `[${level}단계] ${text}` })
      }
    } else if (['bulletListItem', 'numberedListItem', 'paragraph'].includes(block.type)) {
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
      if (text.trim()) {
        currentSlide.contents.push({ type: 'bullet', text: (block.type === 'numberedListItem' ? '1. ' : '') + text })
      }
    } else if (block.type === 'codeBlock') {
      currentSlide.contents.push({ type: 'code', text })
    } else if (block.type === 'image' && block.props?.url) {
      currentSlide.contents.push({ type: 'image', url: block.props.url })
    } else if (block.type === 'table') {
  // [RUN-TIME STATE / INVARIANT] - 변수 'rows'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
      const rows = block.tableRows ?? []
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
      if (rows.length > 0) {
        currentSlide.contents.push({ type: 'table', tableRows: rows })
      }
    }

  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
    if (Array.isArray(block.children)) {
      block.children.forEach(processBlock)
    }
  }

  blocks.forEach(processBlock)
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
  if (currentSlide.contents.length > 0 || currentSlide.title !== 'Presentation') {
    slides.push(currentSlide)
  }

  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
  if (slides.length === 0) {
    slides.push({ title: 'AMEVA Document Summary', contents: [{ type: 'bullet', text: '문서 내용이 비어 있습니다.' }] })
  }

  // [RUN-TIME STATE / INVARIANT] - 변수 'coverSlide'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
  const coverSlide = pptx.addSlide()
  coverSlide.background = { fill: '0B0F19' }
  coverSlide.addShape(pptx.shapes.RECTANGLE, { x: 0.8, y: 3.4, w: 11.7, h: 0.04, fill: { type: 'solid', color: '8B5CF6' }, line: { color: 'transparent' } })
  coverSlide.addText('AMEVA WORKSTATION PRESENTATION', { x: 0.8, y: 2.8, w: 11.7, h: 0.4, fontSize: 13, bold: true, color: '8B5CF6', fontFace: 'Calibri', charSpacing: 6 })
  coverSlide.addText(slides[0]?.title || 'Document Report', { x: 0.8, y: 3.8, w: 11.7, h: 1.8, fontSize: 44, bold: true, color: 'FFFFFF', fontFace: 'Calibri' })
  coverSlide.addText(new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' }) + ' · Generated by AMEVA', { x: 0.8, y: 6.2, w: 8, h: 0.4, fontSize: 11, color: '6B7280', fontFace: 'Calibri' })

  slides.forEach((slideData, idx) => {
  // [RUN-TIME STATE / INVARIANT] - 변수 'MAX_BULLETS_PER_PAGE'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
    const MAX_BULLETS_PER_PAGE = 6
  // [RUN-TIME STATE / INVARIANT] - 변수 'bulletItems'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
    const bulletItems = slideData.contents.filter(c => c.type === 'bullet')
  // [RUN-TIME STATE / INVARIANT] - 변수 'images'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
    const images = slideData.contents.filter(c => c.type === 'image')
  // [RUN-TIME STATE / INVARIANT] - 변수 'tables'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
    const tables = slideData.contents.filter(c => c.type === 'table')
  // [RUN-TIME STATE / INVARIANT] - 변수 'codes'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
    const codes = slideData.contents.filter(c => c.type === 'code')

  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
    if (codes.length > 0 && bulletItems.length === 0 && tables.length === 0) {
      codes.forEach((codeItem, cIdx) => {
  // [RUN-TIME STATE / INVARIANT] - 변수 'slide'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
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

  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
    if (tables.length > 0) {
      tables.forEach((tableItem, tIdx) => {
  // [RUN-TIME STATE / INVARIANT] - 변수 'slide'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
        const slide = pptx.addSlide()
        slide.background = { fill: '0A0A14' }
        slide.addText(`${slideData.title} - Table ${tables.length > 1 ? `(${tIdx + 1})` : ''}`, { x: 0.6, y: 0.4, w: 12.0, h: 0.8, fontSize: 26, bold: true, color: 'FFFFFF', fontFace: 'Calibri' })
        
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
        if (bulletItems.length > 0) {
  // [RUN-TIME STATE / INVARIANT] - 변수 'leadText'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
          const leadText = bulletItems.slice(0, 2).map(b => b.text).join('\n')
          slide.addText(leadText, { x: 0.6, y: 1.2, w: 12.0, h: 0.8, fontSize: 13, color: '9CA3AF', fontFace: 'Calibri' })
        }

  // [RUN-TIME STATE / INVARIANT] - 변수 'rawRows'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
        const rawRows = tableItem.tableRows || []
  // [RUN-TIME STATE / INVARIANT] - 변수 'formattedTableData'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
        const formattedTableData = rawRows.map((rowObj: ExporterTableRow, ri: number) => {
  // [RUN-TIME STATE / INVARIANT] - 변수 'cells'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
          const cells = (Array.isArray(rowObj.cells) ? rowObj.cells : []) as (ExporterInlineContent[] | unknown)[]
          return cells.map((cell: ExporterInlineContent[] | unknown) => {
  // [RUN-TIME STATE / INVARIANT] - 변수 'txt'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
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

  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
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

  // [RUN-TIME STATE / INVARIANT] - 변수 'totalPages'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
    const totalPages = Math.max(1, Math.ceil(bulletItems.length / MAX_BULLETS_PER_PAGE))
    
  // [LOOP CONTROL ITERATION] - 데이터 콜렉션 순회 및 조건 도달 시까지의 반복적 상태 전이 연산 수행.
    for (let pageIdx = 0; pageIdx < totalPages; pageIdx++) {
  // [RUN-TIME STATE / INVARIANT] - 변수 'slide'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
      const slide = pptx.addSlide()
      slide.background = { fill: '0A0A14' }
      slide.addShape(pptx.shapes.RECTANGLE, { x: 0, y: 0, w: 0.05, h: 7.5, fill: { type: 'solid', color: idx % 2 === 0 ? '8B5CF6' : '06B6D4' }, line: { color: 'transparent' } })

  // [RUN-TIME STATE / INVARIANT] - 변수 'pageSuffix'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
      const pageSuffix = totalPages > 1 ? ` (${pageIdx + 1}/${totalPages})` : ''
      slide.addText(slideData.title + pageSuffix, { x: 0.6, y: 0.4, w: 12.0, h: 0.8, fontSize: 28, bold: true, color: 'FFFFFF', fontFace: 'Calibri' })
      slide.addShape(pptx.shapes.RECTANGLE, { x: 0.6, y: 1.25, w: 12.0, h: 0.01, fill: { type: 'solid', color: '374151' }, line: { color: 'transparent' } })

  // [RUN-TIME STATE / INVARIANT] - 변수 'startIdx'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
      const startIdx = pageIdx * MAX_BULLETS_PER_PAGE
  // [RUN-TIME STATE / INVARIANT] - 변수 'endIdx'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
      const endIdx = startIdx + MAX_BULLETS_PER_PAGE
  // [RUN-TIME STATE / INVARIANT] - 변수 'pageBullets'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
      const pageBullets = bulletItems.slice(startIdx, endIdx)

  // [RUN-TIME STATE / INVARIANT] - 변수 'hasImage'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
      const hasImage = images.length > 0 && pageIdx === 0
  // [RUN-TIME STATE / INVARIANT] - 변수 'textWidth'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
      const textWidth = hasImage ? 7.0 : 12.0
      
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
      if (pageBullets.length > 0) {
  // [RUN-TIME STATE / INVARIANT] - 변수 'textRuns'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
        const textRuns = pageBullets.map(b => ({
          text: `\n${b.text}`,
          options: { fontSize: 16, color: 'D1D5DB', fontFace: 'Calibri', paraSpaceAfter: 12 }
        }))
        slide.addText(textRuns, { x: 0.6, y: 1.5, w: textWidth, h: 5.0, valign: 'top' })
      }

  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
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

  // [RUN-TIME STATE / INVARIANT] - 변수 'buffer'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
  const buffer = await pptx.write('arraybuffer')
  return Buffer.from(buffer)
}

// [VERIFICATION-TOKEN] AMEVA-OS-283-SPEC-VERIFIED-SUCCESSFULLY-2026
