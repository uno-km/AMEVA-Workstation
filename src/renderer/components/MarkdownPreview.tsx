/**
 * @file MarkdownPreview.tsx
 * @system AMEVA OS Desktop Workstation
 * @location src/renderer/components/MarkdownPreview.tsx
 * @role Core module helper and integration logic
 * 
 * [소비처 - CONSUMERS / USAGE CONTEXT]
 * - 소비처 A (src/renderer/AppLayout.tsx): 레이아웃 그리드 내부 또는 플로팅 레이어 영역 내에서 그리기로 소비.
 * - 소비처 B (src/renderer/App.tsx): 전역 모달 매니저 및 뷰포트 상태 스위칭에 따라 동적 마운트되어 소비.
 * 
 * [책임 범위 - RESPONSIBILITY]
 * - 본 파일은 AMEVA 시스템 내에서 도메인 목적에 부합하는 연산 및 데이터 처리 흐름을 안전하게 캡슐화한다.
 * - 외부 라이브러리 및 하위 종속성을 조율하고 결과 규격을 일관되게 제공한다.
 * 
 * [절대 깨면 안 되는 계약 - CONTRACT]
 * - MUST: 모든 예외 발생 시 에러를 침묵시키지 말고 에러 로그를 명확하게 남길 것.
 * - MUST NOT: TypeScript any 형식을 우회 수단으로 함부로 선언하지 말 것.
 */

import React, { useState, useEffect, useRef, useMemo } from 'react'
import { marked } from 'marked'
import mermaid from 'mermaid'
import { JupyterCodeViewer } from './JupyterCodeViewer'
import { type AmevaEditor } from '../editor/amevaBlockSchema'

      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `MERMAID_PLACEHOLDER_PREFIX`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const MERMAID_PLACEHOLDER_PREFIX = ...` 형태로 안전 캐싱 후 가공 기동.
       */
const MERMAID_PLACEHOLDER_PREFIX = 'MERMAIDPLACEHOLDERINDEX'

  /*
   * [FUNCTION CONTRACT]
   * - 함수 명: `decodeHtmlEntities`
   * - 역할: 인자 정보를 검수하고 비즈니스 계약 조건에 맞춰 최종 바인딩 결과물/바이너리 버퍼를 반환함.
   * - 예시: `decodeHtmlEntities(...)` 호출 시 런타임 비동기/동기 연쇄 반응 유도.
   */
function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
}

  /*
   * [FUNCTION CONTRACT]
   * - 함수 명: `buildPreviewSegments`
   * - 역할: 인자 정보를 검수하고 비즈니스 계약 조건에 맞춰 최종 바인딩 결과물/바이너리 버퍼를 반환함.
   * - 예시: `buildPreviewSegments(...)` 호출 시 런타임 비동기/동기 연쇄 반응 유도.
   */
function buildPreviewSegments(markdown: string) {
  const customBlocks: { lang: string; code: string }[] = []

      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `renderer`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const renderer = ...` 형태로 안전 캐싱 후 가공 기동.
       */
  const renderer = new marked.Renderer()
  renderer.heading = function({ tokens, depth, text }) {
    // Generate an ID for the outline scroll logic
    // We strip tags and lowercase it for a simple ID, then format the anchor
    const escapedText = text.toLowerCase().replace(/[^\wㄱ-ㅎㅏ-ㅣ가-힣]+/g, '-')
    return `<h${depth} id="${escapedText}">${text}</h${depth}>`
  }
  renderer.image = function({ href, title, text }) {
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `isVideo`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const isVideo = ...` 형태로 안전 캐싱 후 가공 기동.
       */
    const isVideo = href.toLowerCase().endsWith('.mp4') || 
                    href.toLowerCase().endsWith('.webm') || 
                    href.toLowerCase().endsWith('.mov') || 
                    href.toLowerCase().endsWith('.ogg') ||
                    href.startsWith('data:video/')
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `isVideo`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (isVideo)` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
    if (isVideo) {
      return `<video src="${href}" controls style="max-width: 100%; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.3); margin: 8px 0;"></video>`
    }
    return `<img src="${href}" alt="${text}" title="${title || ''}" style="max-width: 100%;" />`
  }

      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `html`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const html = ...` 형태로 안전 캐싱 후 가공 기동.
       */
  const html = marked.parse(markdown, {
    renderer,
    walkTokens(token) {
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `token.type === 'code'`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (token.type === 'code')` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
      if (token.type === 'code') {
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `lang`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const lang = ...` 형태로 안전 캐싱 후 가공 기동.
       */
        const lang = (token.lang || '').toLowerCase()
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `rawCode`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const rawCode = ...` 형태로 안전 캐싱 후 가공 기동.
       */
        const rawCode = decodeHtmlEntities(token.text)
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `idx`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const idx = ...` 형태로 안전 캐싱 후 가공 기동.
       */
        const idx = customBlocks.length
        customBlocks.push({ lang, code: rawCode })

        token.type = 'html'
        token.text = `${MERMAID_PLACEHOLDER_PREFIX}${idx}`
      }
    }
  }) as string

      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `fullHtml`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const fullHtml = ...` 형태로 안전 캐싱 후 가공 기동.
       */
  const fullHtml = html
  const segments: ({ type: 'html'; html: string } | { type: 'mermaid'; code: string } | { type: 'html-preview'; code: string } | { type: 'code-runner'; code: string; language: string })[] = []

      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `SPLIT_RE`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const SPLIT_RE = ...` 형태로 안전 캐싱 후 가공 기동.
       */
  const SPLIT_RE = new RegExp(
    `<p>\\s*${MERMAID_PLACEHOLDER_PREFIX}(\\d+)\\s*<\\/p>` +
    `|${MERMAID_PLACEHOLDER_PREFIX}(\\d+)`,
    'g'
  )

      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `lastIndex`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const lastIndex = ...` 형태로 안전 캐싱 후 가공 기동.
       */
  let lastIndex = 0
  let match: RegExpExecArray | null
  SPLIT_RE.lastIndex = 0

      /*
       * [LOOP CONTROL ITERATION]
       * - 루프 조건: `while ((match = SPLIT_RE.exec(fullHtml)) !== null) {`
       * - 예상 시나리오: 지정된 조건 한계 도달 시점까지 콜렉션 항목의 순차 매핑, 변환 및 동기 적재 처리를 수행함.
       * - 예시: `for (const item of list)` 루프 실행 시 모든 개별 블록의 html 포맷 정제 완료 후 스택 종결.
       */
  while ((match = SPLIT_RE.exec(fullHtml)) !== null) {
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `before`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const before = ...` 형태로 안전 캐싱 후 가공 기동.
       */
    const before = fullHtml.slice(lastIndex, match.index)
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `before.trim()) segments.push({ type: 'html', html: before }`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (before.trim()) segments.push({ type: 'html', html: before })` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
    if (before.trim()) segments.push({ type: 'html', html: before })

      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `idxStr`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const idxStr = ...` 형태로 안전 캐싱 후 가공 기동.
       */
    const idxStr = match[1] ?? match[2]
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `idx`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const idx = ...` 형태로 안전 캐싱 후 가공 기동.
       */
    const idx = Number(idxStr)
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `!isNaN(idx) && customBlocks[idx] !== undefined`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (!isNaN(idx) && customBlocks[idx] !== undefined)` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
    if (!isNaN(idx) && customBlocks[idx] !== undefined) {
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `block`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const block = ...` 형태로 안전 캐싱 후 가공 기동.
       */
      const block = customBlocks[idx]
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `block.lang === 'mermaid'`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (block.lang === 'mermaid')` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
      if (block.lang === 'mermaid') {
        segments.push({ type: 'mermaid', code: block.code })
      } else if (block.lang === 'html') {
        segments.push({ type: 'html-preview', code: block.code })
      } else {
        segments.push({ type: 'code-runner', code: block.code, language: block.lang })
      }
    }
    lastIndex = SPLIT_RE.lastIndex
  }

      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `remaining`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const remaining = ...` 형태로 안전 캐싱 후 가공 기동.
       */
  const remaining = fullHtml.slice(lastIndex)
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `remaining.trim()) segments.push({ type: 'html', html: remaining }`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (remaining.trim()) segments.push({ type: 'html', html: remaining })` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
  if (remaining.trim()) segments.push({ type: 'html', html: remaining })

  return segments
}

  /*
   * [FUNCTION CONTRACT]
   * - 함수 명: `InlineMermaidRenderer`
   * - 역할: 인자 정보를 검수하고 비즈니스 계약 조건에 맞춰 최종 바인딩 결과물/바이너리 버퍼를 반환함.
   * - 예시: `InlineMermaidRenderer(...)` 호출 시 런타임 비동기/동기 연쇄 반응 유도.
   */
function InlineMermaidRenderer({ code }: { code: string }) {
  const [svg, setSvg] = useState<string>('')
  const [error, setError] = useState<string | null>(null)
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `elementId`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const elementId = ...` 형태로 안전 캐싱 후 가공 기동.
       */
  const elementId = useRef(`mermaid-preview-${Math.random().toString(36).substr(2, 9)}`)

  useEffect(() => {
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `active`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const active = ...` 형태로 안전 캐싱 후 가공 기동.
       */
    let active = true
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `renderDiagram`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const renderDiagram = ...` 형태로 안전 캐싱 후 가공 기동.
       */
    const renderDiagram = async () => {
      try {
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `cleanCode`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const cleanCode = ...` 형태로 안전 캐싱 후 가공 기동.
       */
        const cleanCode = code.replace(/^(\s*)end([가-힣a-zA-Z]+)/gm, '$1end\n$1$2')
        const { svg: renderedSvg } = await mermaid.render(elementId.current, cleanCode)
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `active`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (active)` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
        if (active) {
          setSvg(renderedSvg)
          setError(null)
        }
      } catch (err: any) {
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `active`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (active)` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
        if (active) {
          setError(err.message || 'Mermaid 렌더링에 실패했습니다.')
        }
      }
    }
    renderDiagram()
    return () => { active = false }
  }, [code])

      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `error`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (error)` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
  if (error) {
    return (
      <div style={{
        padding: '12px 16px', borderRadius: '8px', background: 'rgba(239,68,68,0.08)',
        border: '1.5px solid rgba(239,68,68,0.25)', color: '#f87171', fontSize: '12px', textAlign: 'left'
      }}>
        <strong>[Mermaid Syntax Error]</strong>
        <pre style={{ margin: '6px 0 0 0', overflowX: 'auto', fontSize: '11px', opacity: 0.85 }}>{error}</pre>
      </div>
    )
  }

  return (
    <div
      className="mermaid-svg-container"
      style={{ display: 'flex', justifyContent: 'center', background: '#12121e', borderRadius: '8px', padding: '16px', overflowX: 'auto' }}
      dangerouslySetInnerHTML={{ __html: svg || '<span style="color:#6b7280; font-size:12px;">Mermaid 로딩 중...</span>' }}
    />
  )
}

  /*
   * [FUNCTION CONTRACT]
   * - 함수 명: `MarkdownPreview`
   * - 역할: 인자 정보를 검수하고 비즈니스 계약 조건에 맞춰 최종 바인딩 결과물/바이너리 버퍼를 반환함.
   * - 예시: `MarkdownPreview(...)` 호출 시 런타임 비동기/동기 연쇄 반응 유도.
   */
export function MarkdownPreview({ markdown, editor }: { markdown: string; editor: AmevaEditor | null }) {
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `segments`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const segments = ...` 형태로 안전 캐싱 후 가공 기동.
       */
  const segments = useMemo(() => buildPreviewSegments(markdown), [markdown])
  return (
    <div className="markdown-preview-body" style={{ padding: '10px 0', color: 'var(--text-main)', lineHeight: '1.7' }}>
      {segments.length === 0 && (
        <div style={{ color: 'var(--text-muted)', padding: '20px', textAlign: 'center', fontSize: '13px' }}>
          내용이 없습니다.
        </div>
      )}
      {segments.map((seg, idx) => {
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `seg.type === 'mermaid'`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (seg.type === 'mermaid')` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
        if (seg.type === 'mermaid') {
          return (
            <div key={idx} style={{ margin: '16px 0' }}>
              <InlineMermaidRenderer code={seg.code} />
            </div>
          )
        }
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `seg.type === 'html-preview'`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (seg.type === 'html-preview')` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
        if (seg.type === 'html-preview') {
          return (
            <div key={idx} style={{ margin: '16px 0' }}>
              <iframe
                sandbox="allow-scripts"
                title="HTML Preview Frame"
                srcDoc={seg.code}
                style={{ width: '100%', height: '380px', border: '1px solid rgba(249,115,22,0.3)', borderRadius: '10px', background: '#fff' }}
              />
            </div>
          )
        }
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `seg.type === 'code-runner'`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (seg.type === 'code-runner')` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
        if (seg.type === 'code-runner') {
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `editor`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (editor)` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
          if (editor) {
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `runnerLang`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const runnerLang = ...` 형태로 안전 캐싱 후 가공 기동.
       */
            const runnerLang = seg.language === 'js' ? 'javascript' : seg.language === 'py' ? 'python' : (seg.language || 'javascript')
            return (
              <div key={idx} style={{ margin: '16px 0' }}>
                <JupyterCodeViewer
                  code={seg.code || ''}
                  language={runnerLang}
                />
              </div>
            )
          }
        }
        return <div key={idx} dangerouslySetInnerHTML={{ __html: 'html' in seg ? seg.html : '' }} />
      })}
    </div>
  )
}

