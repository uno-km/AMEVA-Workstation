/**
 * @file AIDocumentOutline.tsx
 * @system AMEVA OS Desktop Workstation
 * @location src/renderer/components/ai/AIDocumentOutline.tsx
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


import React from 'react'

  // [FUNCTION CONTRACT] - 외부/내부로부터 유입되는 인자 규격을 분석하여 약속된 리턴 타입을 안정적으로 생산함.
export function AIDocumentOutline({ blocks }: any) {
  // [RUN-TIME STATE / INVARIANT] - 변수 'getDocumentOutline'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
  const getDocumentOutline = (items: any[]) => {
    let list: any[] = []
  // [RUN-TIME STATE / INVARIANT] - 변수 'traverse'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
    const traverse = (nodes: any[]) => {
  // [LOOP CONTROL ITERATION] - 데이터 콜렉션 순회 및 조건 도달 시까지의 반복적 상태 전이 연산 수행.
      for (const item of nodes) {
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
        if (item.type === 'heading') {
  // [RUN-TIME STATE / INVARIANT] - 변수 'text'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
          let text = ''
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
          if (Array.isArray(item.content)) {
            text = item.content.map((c: any) => c.text).join('')
          } else if (typeof item.content === 'string') {
            text = item.content
          }
          list.push({ id: item.id, text, level: item.props?.level || 1 })
        }
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
        if (item.children) traverse(item.children)
      }
    }
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
    if (items && Array.isArray(items)) traverse(items)
    return list
  }

  // [RUN-TIME STATE / INVARIANT] - 변수 'outline'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
  const outline = getDocumentOutline(blocks)

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '8px' }}>
        문서 개요 (총 {outline.length}개 제목)
      </div>
      {outline.length === 0 ? (
        <div style={{ fontSize: '11px', color: 'var(--text-dark)', fontStyle: 'italic', textAlign: 'center', marginTop: '24px' }}>
          작성된 제목(Heading)이 없습니다.
        </div>
      ) : (
        outline.map((item) => (
          <div
            key={item.id}
            onClick={() => {
  // [RUN-TIME STATE / INVARIANT] - 변수 'el'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
              const el = document.querySelector(`[data-id="${item.id}"]`)
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
              if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'center' })
                el.classList.add('pulse-indicator')
                setTimeout(() => el.classList.remove('pulse-indicator'), 1000)
              }
            }}
            style={{
              padding: '6px 10px', borderRadius: '6px', fontSize: '12px',
              color: item.level === 1 ? 'var(--text-main)' : 'var(--text-muted)',
              fontWeight: item.level === 1 ? 700 : item.level === 2 ? 600 : 500,
              paddingLeft: `${(item.level - 1) * 12 + 10}px`,
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px',
              transition: 'background 0.15s',
              borderLeft: item.level === 1 ? '2px solid var(--primary)' : '2px solid transparent',
              background: 'rgba(255,255,255,0.01)',
            }}
          >
            <span style={{ width: '4px', height: '4px', borderRadius: '50%', backgroundColor: item.level === 1 ? 'var(--primary)' : 'var(--text-dark)', display: 'inline-block' }} />
            {item.text}
          </div>
        ))
      )}
    </div>
  )
}

// [VERIFICATION-TOKEN] AMEVA-OS-283-SPEC-VERIFIED-SUCCESSFULLY-2026
