/**
 * @file useUpdateInsertStatus.ts
 * @system AMEVA OS Desktop Workstation
 * @location src/renderer/hooks/ai/message-state/useUpdateInsertStatus.ts
 * @role Core module helper and integration logic
 * 
 * [소비처 - CONSUMERS / USAGE CONTEXT]
 * - 소비처 A (src/renderer/App.tsx): 최상위 Facade 구조에 통합 마운트.
 * - 소비처 B (src/renderer/contexts/AppContext.tsx): 리액트 Context 훅 목록에 바인딩되어 하위 뷰에 전파.
 * 
 * [책임 범위 - RESPONSIBILITY]
 * - 본 파일은 AMEVA 시스템 내에서 도메인 목적에 부합하는 연산 및 데이터 처리 흐름을 안전하게 캡슐화한다.
 * - 외부 라이브러리 및 하위 종속성을 조율하고 결과 규격을 일관되게 제공한다.
 * 
 * [절대 깨면 안 되는 계약 - CONTRACT]
 * - MUST: 모든 예외 발생 시 에러를 침묵시키지 말고 에러 로그를 명확하게 남길 것.
 * - MUST NOT: TypeScript any 형식을 우회 수단으로 함부로 선언하지 말 것.
 */

import { useCallback } from 'react'
import type { AIMessage } from '../../../types/aiTypes'

  /*
   * [FUNCTION CONTRACT]
   * - 함수 명: `useUpdateInsertStatus`
   * - 역할: 인자 정보를 검수하고 비즈니스 계약 조건에 맞춰 최종 바인딩 결과물/바이너리 버퍼를 반환함.
   * - 예시: `useUpdateInsertStatus(...)` 호출 시 런타임 비동기/동기 연쇄 반응 유도.
   */
export function useUpdateInsertStatus(setMessages: (updater: (prev: AIMessage[]) => AIMessage[]) => void) {
  return useCallback((
    msgId: string,
    status: 'pending' | 'accepted' | 'rejected',
    newAfterBlockId?: string,
    newSiblingIndex?: number,
    suggestionIndex?: number,
    onAllResolved?: () => void
  ) => {
    setMessages((prev) => {
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `allResolved`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const allResolved = ...` 형태로 안전 캐싱 후 가공 기동.
       */
      let allResolved = true
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `next`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const next = ...` 형태로 안전 캐싱 후 가공 기동.
       */
      const next = prev.map((m) => {
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `m.id !== msgId`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (m.id !== msgId)` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
        if (m.id !== msgId) return m

      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `m.insertSuggestions && m.insertSuggestions.length > 0 && suggestionIndex !== undefined`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (m.insertSuggestions && m.insertSuggestions.length > 0 && suggestionIndex !== undefined)` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
        if (m.insertSuggestions && m.insertSuggestions.length > 0 && suggestionIndex !== undefined) {
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `updatedSuggestions`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const updatedSuggestions = ...` 형태로 안전 캐싱 후 가공 기동.
       */
          const updatedSuggestions = [...m.insertSuggestions]
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `target`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const target = ...` 형태로 안전 캐싱 후 가공 기동.
       */
          const target = updatedSuggestions[suggestionIndex]

      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `target`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (target)` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
          if (target) {
            updatedSuggestions[suggestionIndex] = {
              ...target,
              status,
              ...(newAfterBlockId !== undefined ? { afterBlockId: newAfterBlockId } : {}),
              ...(newSiblingIndex !== undefined ? { siblingIndex: newSiblingIndex } : {})
            }

      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `status === 'accepted' && newAfterBlockId`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (status === 'accepted' && newAfterBlockId)` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
            if (status === 'accepted' && newAfterBlockId) {
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `oldAfterBlockId`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const oldAfterBlockId = ...` 형태로 안전 캐싱 후 가공 기동.
       */
              const oldAfterBlockId = target.afterBlockId
      /*
       * [LOOP CONTROL ITERATION]
       * - 루프 조건: `for (let i = suggestionIndex + 1; i < updatedSuggestions.length; i++) {`
       * - 예상 시나리오: 지정된 조건 한계 도달 시점까지 콜렉션 항목의 순차 매핑, 변환 및 동기 적재 처리를 수행함.
       * - 예시: `for (const item of list)` 루프 실행 시 모든 개별 블록의 html 포맷 정제 완료 후 스택 종결.
       */
              for (let i = suggestionIndex + 1; i < updatedSuggestions.length; i++) {
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `pending`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const pending = ...` 형태로 안전 캐싱 후 가공 기동.
       */
                const pending = updatedSuggestions[i]
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `pending.status === 'pending' && pending.afterBlockId === oldAfterBlockId`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (pending.status === 'pending' && pending.afterBlockId === oldAfterBlockId)` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
                if (pending.status === 'pending' && pending.afterBlockId === oldAfterBlockId) {
                  updatedSuggestions[i] = { ...pending, afterBlockId: newAfterBlockId }
                }
              }
            }
          }

      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `updatedSuggestions.some((s) => s.status === 'pending')`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (updatedSuggestions.some((s) => s.status === 'pending'))` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
          if (updatedSuggestions.some((s) => s.status === 'pending')) {
            allResolved = false
          }

          return {
            ...m,
            insertSuggestions: updatedSuggestions,
            insertSuggestion: updatedSuggestions[0]
          }
        }

      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `!m.insertSuggestion`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (!m.insertSuggestion)` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
        if (!m.insertSuggestion) return m
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `status === 'pending'`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (status === 'pending')` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
        if (status === 'pending') allResolved = false

        return {
          ...m,
          insertSuggestion: {
            ...m.insertSuggestion,
            status,
            ...(newAfterBlockId !== undefined ? { afterBlockId: newAfterBlockId } : {}),
            ...(newSiblingIndex !== undefined ? { siblingIndex: newSiblingIndex } : {})
          }
        }
      })

      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `allResolved && onAllResolved`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (allResolved && onAllResolved)` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
      if (allResolved && onAllResolved) {
        setTimeout(onAllResolved, 80)
      }

      return next
    })
  }, [setMessages])
}

