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

  /*
   * [FUNCTION CONTRACT]
   * - 함수 명: `AIDocumentOutline`
   * - 역할: 인자 정보를 검수하고 비즈니스 계약 조건에 맞춰 최종 바인딩 결과물/바이너리 버퍼를 반환함.
   * - 예시: `AIDocumentOutline(...)` 호출 시 런타임 비동기/동기 연쇄 반응 유도.
   */
export function AIDocumentOutline({ blocks }: any) {
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `getDocumentOutline`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const getDocumentOutline = ...` 형태로 안전 캐싱 후 가공 기동.
       */
  const getDocumentOutline = (items: any[]) => {
    let list: any[] = []
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `traverse`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const traverse = ...` 형태로 안전 캐싱 후 가공 기동.
       */
    const traverse = (nodes: any[]) => {
      /*
       * [LOOP CONTROL ITERATION]
       * - 루프 조건: `for (const item of nodes) {`
       * - 예상 시나리오: 지정된 조건 한계 도달 시점까지 콜렉션 항목의 순차 매핑, 변환 및 동기 적재 처리를 수행함.
       * - 예시: `for (const item of list)` 루프 실행 시 모든 개별 블록의 html 포맷 정제 완료 후 스택 종결.
       */
      for (const item of nodes) {
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `item.type === 'heading'`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (item.type === 'heading')` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
        if (item.type === 'heading') {
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `text`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const text = ...` 형태로 안전 캐싱 후 가공 기동.
       */
          let text = ''
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `Array.isArray(item.content)`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (Array.isArray(item.content))` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
          if (Array.isArray(item.content)) {
            text = item.content.map((c: any) => c.text).join('')
          } else if (typeof item.content === 'string') {
            text = item.content
          }
          list.push({ id: item.id, text, level: item.props?.level || 1 })
        }
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `item.children) traverse(item.children`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (item.children) traverse(item.children)` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
        if (item.children) traverse(item.children)
      }
    }
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `items && Array.isArray(items)) traverse(items`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (items && Array.isArray(items)) traverse(items)` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
    if (items && Array.isArray(items)) traverse(items)
    return list
  }

      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `outline`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const outline = ...` 형태로 안전 캐싱 후 가공 기동.
       */
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
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `el`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const el = ...` 형태로 안전 캐싱 후 가공 기동.
       */
              const el = document.querySelector(`[data-id="${item.id}"]`)
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `el`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (el)` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
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

