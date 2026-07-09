/**
 * @file InlineMermaidRenderer.tsx
 * @system AMEVA OS Desktop Workstation
 * @location src/renderer/components/jupyter/InlineMermaidRenderer.tsx
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

import React, { useState, useEffect, useRef } from 'react'
import mermaid from 'mermaid'

// Mermaid Diagram 렌더러
export function InlineMermaidRenderer({ code }: { code: string }) {
  const [svg, setSvg] = useState<string>('')
  const [error, setError] = useState<string | null>(null)
  const elementId = useRef(`mermaid-preview-${Math.random().toString(36).substr(2, 9)}`)

  useEffect(() => {
    let active = true
    const renderDiagram = async () => {
      try {
        const cleanCode = code.replace(/^(\s*)end([가-힣a-zA-Z]+)/gm, '$1end\n$1$2')
        
        document.querySelectorAll('[id^="dmermaid"]').forEach(el => el.remove())

        try {
          await mermaid.parse(cleanCode)
        } catch (parseErr: any) {
          if (active) {
            setError(parseErr.message || 'Mermaid 문법 오류가 감지되었습니다.')
          }
          return
        }

        const { svg: renderedSvg } = await mermaid.render(elementId.current, cleanCode)
        if (active) {
          setSvg(renderedSvg)
          setError(null)
        }
      } catch (err: any) {
        if (active) {
          setError(err.message || 'Mermaid 렌더링에 실패했습니다.')
        }
      }
    }
    renderDiagram()
    return () => { active = false }
  }, [code])

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
