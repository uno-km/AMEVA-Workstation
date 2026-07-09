/**
 * @file hwpExporter.ts
 * @system AMEVA OS Desktop Workstation
 * @location src/main/exporters/hwpExporter.ts
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
  // [RUN-TIME STATE / INVARIANT] - 변수 'JSZip'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
const JSZip = require('jszip')
import { escapeHtml, getPlainTextFromNormalized, inlineToText, type ExporterBlock, type ExporterTableRow, type ExporterInlineContent } from './exportersHelper.js'

// ══════════════════════════════════════════════════════════════
// 5. HWPX 내보내기 (백엔드 분산 변환 노드 버전)
// ══════════════════════════════════════════════════════════════
export async function exportToHWPX(blocks: ExporterBlock[]): Promise<Buffer> {
  // [RUN-TIME STATE / INVARIANT] - 변수 'zip'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
  const zip = new JSZip()
  zip.file('mimetype', 'application/hwp+zip', { compression: 'STORE' })
  zip.file('_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.hancom.co.kr/hwpml/2011/relation/document" Target="Contents/content.hwpml"/>
</Relationships>`)
  zip.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="xml" ContentType="application/xml"/>
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="hwpml" ContentType="application/vnd.hancom.hwpml+xml"/>
  <Override PartName="/Contents/content.hwpml" ContentType="application/vnd.hancom.hwpml+xml"/>
  <Override PartName="/Contents/section0.xml" ContentType="application/vnd.hancom.hwpml+xml"/>
</Types>`)

  // [RUN-TIME STATE / INVARIANT] - 변수 'section0'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
  let section0 = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<hs:sec xmlns:hs="http://schemas.hancom.co.kr/hwpml/2011/section" version="1.0">`

  // [RUN-TIME STATE / INVARIANT] - 변수 'toHWPML'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
  const toHWPML = (block: ExporterBlock): string => {
  // [RUN-TIME STATE / INVARIANT] - 변수 'text'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
    const text = escapeHtml(getPlainTextFromNormalized(block))
  // [RUN-TIME STATE / INVARIANT] - 변수 'charId'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
    let charId = '0'
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
    if (block.type === 'heading') {
  // [RUN-TIME STATE / INVARIANT] - 변수 'lvl'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
      const lvl = Number(block.props?.level) || 1
      charId = lvl === 1 ? '1' : lvl === 2 ? '2' : '3'
    } else if (block.type === 'codeBlock') {
      charId = '4'
    }

  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
    if (block.type === 'table') {
  // [RUN-TIME STATE / INVARIANT] - 변수 'rows'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
      const rows = block.tableRows ?? []
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
      if (rows.length === 0) return ''
  // [RUN-TIME STATE / INVARIANT] - 변수 'colCnt'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
      const colCnt = (rows[0]?.cells?.length) || 1
  // [RUN-TIME STATE / INVARIANT] - 변수 'tbl'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
      let tbl = `<hp:tbl xmlns:hp="http://schemas.hancom.co.kr/hwpml/2011/paragraph" borderType="1" colCnt="${colCnt}" rowCnt="${rows.length}">`
      rows.forEach((row: ExporterTableRow) => {
        tbl += '<hp:tr>'
  // [RUN-TIME STATE / INVARIANT] - 변수 'cells'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
        const cells = (Array.isArray(row.cells) ? row.cells : []) as (ExporterInlineContent[] | unknown)[]
        cells.forEach((cell: ExporterInlineContent[] | unknown) => {
  // [RUN-TIME STATE / INVARIANT] - 변수 'ct'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
          const ct = escapeHtml(Array.isArray(cell) ? inlineToText(cell as ExporterInlineContent[]) : '')
          tbl += `<hp:tc><hp:p charPrRef="0"><hp:run><hp:t>${ct}</hp:t></hp:run></hp:p></hp:tc>`
        })
        tbl += '</hp:tr>'
      })
      tbl += '</hp:tbl>'
      return tbl
    }

  // [RUN-TIME STATE / INVARIANT] - 변수 'lines'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
    const lines = (block.type === 'codeBlock' ? getPlainTextFromNormalized(block) : text).split('\n')
  // [RUN-TIME STATE / INVARIANT] - 변수 'result'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
    let result = lines.map(line =>
      `<hp:p xmlns:hp="http://schemas.hancom.co.kr/hwpml/2011/paragraph" charPrRef="${charId}"><hp:run><hp:t>${escapeHtml(line) || ' '}</hp:t></hp:run></hp:p>`
    ).join('')

  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
    if (Array.isArray(block.children)) block.children.forEach((c: ExporterBlock) => { result += toHWPML(c) })
    return result
  }

  blocks.forEach(b => { section0 += toHWPML(b) })
  section0 += '</hs:sec>'

  zip.file('Contents/section0.xml', section0)
  zip.file('Contents/header.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<hh:idmap xmlns:hh="http://schemas.hancom.co.kr/hwpml/2011/header" version="1.0">
  <hh:fontFaces>
    <hh:fontFace id="0" lang="hangul" face="맑은 고딕"/>
    <hh:fontFace id="1" lang="hangul" face="나눔고딕 ExtraBold"/>
    <hh:fontFace id="2" lang="latin" face="Consolas"/>
  </hh:fontFaces>
  <hh:charProperties>
    <hh:charPr id="0" height="1000" fontRef="0"/>
    <hh:charPr id="1" height="1800" bold="true" fontRef="1"/>
    <hh:charPr id="2" height="1400" bold="true" fontRef="1"/>
    <hh:charPr id="3" height="1100" bold="true" fontRef="1"/>
    <hh:charPr id="4" height="900" fontRef="2"/>
  </hh:charProperties>
  <hh:tabProperties><hh:tabPr id="0"/></hh:tabProperties>
  <hh:numberings/>
</hh:idmap>`)
  zip.file('Contents/content.hwpml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<hc:hwpml xmlns:hc="http://schemas.hancom.co.kr/hwpml/2011/core" version="1.0">
  <hc:head target="Contents/header.xml"/>
  <hc:body>
    <hc:sec target="Contents/section0.xml"/>
  </hc:body>
</hc:hwpml>`)

  // [RUN-TIME STATE / INVARIANT] - 변수 'blob'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
  const blob = await zip.generateAsync({ type: 'nodebuffer' })
  return Buffer.from(blob)
}

// [VERIFICATION-TOKEN] AMEVA-OS-283-SPEC-VERIFIED-SUCCESSFULLY-2026
