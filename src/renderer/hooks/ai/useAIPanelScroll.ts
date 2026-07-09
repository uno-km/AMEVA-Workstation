/**
 * @file useAIPanelScroll.ts
 * @system AMEVA OS Desktop Workstation
 * @location src/renderer/hooks/ai/useAIPanelScroll.ts
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


import { useRef, useEffect } from 'react'

  /*
   * [FUNCTION CONTRACT]
   * - 함수 명: `useAIPanelScroll`
   * - 역할: 인자 정보를 검수하고 비즈니스 계약 조건에 맞춰 최종 바인딩 결과물/바이너리 버퍼를 반환함.
   * - 예시: `useAIPanelScroll(...)` 호출 시 런타임 비동기/동기 연쇄 반응 유도.
   */
export function useAIPanelScroll(
  messages: any[],
  engineLogs: string,
  taggedBlocks: any[],
  isOpen: boolean
) {
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `textareaRef`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const textareaRef = ...` 형태로 안전 캐싱 후 가공 기동.
       */
  const textareaRef = useRef<HTMLTextAreaElement>(null)
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `messagesContainerRef`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const messagesContainerRef = ...` 형태로 안전 캐싱 후 가공 기동.
       */
  const messagesContainerRef = useRef<HTMLDivElement>(null)
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `messagesEndRef`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const messagesEndRef = ...` 형태로 안전 캐싱 후 가공 기동.
       */
  const messagesEndRef = useRef<HTMLDivElement>(null)
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `logContainerRef`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const logContainerRef = ...` 형태로 안전 캐싱 후 가공 기동.
       */
  const logContainerRef = useRef<HTMLDivElement>(null)
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `logEndRef`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const logEndRef = ...` 형태로 안전 캐싱 후 가공 기동.
       */
  const logEndRef = useRef<HTMLDivElement>(null)

  // 메시지 스마트 스크롤
  useEffect(() => {
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `container`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const container = ...` 형태로 안전 캐싱 후 가공 기동.
       */
    const container = messagesContainerRef.current
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `container`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (container)` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
    if (container) {
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `lastMessage`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const lastMessage = ...` 형태로 안전 캐싱 후 가공 기동.
       */
      const lastMessage = messages[messages.length - 1]
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `isUserMsg`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const isUserMsg = ...` 형태로 안전 캐싱 후 가공 기동.
       */
      const isUserMsg = lastMessage?.role === 'user'
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `isNearBottom`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const isNearBottom = ...` 형태로 안전 캐싱 후 가공 기동.
       */
      const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 60
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `(isNearBottom || isUserMsg) && messagesEndRef.current`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if ((isNearBottom || isUserMsg) && messagesEndRef.current)` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
      if ((isNearBottom || isUserMsg) && messagesEndRef.current) {
        messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
      }
    }
  }, [messages])

  // 로그 스마트 스크롤
  useEffect(() => {
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `container`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const container = ...` 형태로 안전 캐싱 후 가공 기동.
       */
    const container = logContainerRef.current
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `container`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (container)` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
    if (container) {
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `isNearBottom`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const isNearBottom = ...` 형태로 안전 캐싱 후 가공 기동.
       */
      const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 60
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `isNearBottom && logEndRef.current`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (isNearBottom && logEndRef.current)` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
      if (isNearBottom && logEndRef.current) {
        logEndRef.current.scrollIntoView({ behavior: 'auto' })
      }
    }
  }, [engineLogs])

  // 태그 블록 지정 시 포커싱
  useEffect(() => {
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `isOpen && taggedBlocks.length > 0`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (isOpen && taggedBlocks.length > 0)` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
    if (isOpen && taggedBlocks.length > 0) {
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `timer`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const timer = ...` 형태로 안전 캐싱 후 가공 기동.
       */
      const timer = setTimeout(() => {
        textareaRef.current?.focus()
      }, 100)
      return () => clearTimeout(timer)
    }
  }, [taggedBlocks.length, isOpen])

  return { textareaRef, messagesContainerRef, messagesEndRef, logContainerRef, logEndRef }
}

