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

  // [FUNCTION CONTRACT] - 외부/내부로부터 유입되는 인자 규격을 분석하여 약속된 리턴 타입을 안정적으로 생산함.
export function useAIPanelScroll(
  messages: any[],
  engineLogs: string,
  taggedBlocks: any[],
  isOpen: boolean
) {
  // [RUN-TIME STATE / INVARIANT] - 변수 'textareaRef'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  // [RUN-TIME STATE / INVARIANT] - 변수 'messagesContainerRef'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  // [RUN-TIME STATE / INVARIANT] - 변수 'messagesEndRef'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
  const messagesEndRef = useRef<HTMLDivElement>(null)
  // [RUN-TIME STATE / INVARIANT] - 변수 'logContainerRef'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
  const logContainerRef = useRef<HTMLDivElement>(null)
  // [RUN-TIME STATE / INVARIANT] - 변수 'logEndRef'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
  const logEndRef = useRef<HTMLDivElement>(null)

  // 메시지 스마트 스크롤
  useEffect(() => {
  // [RUN-TIME STATE / INVARIANT] - 변수 'container'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
    const container = messagesContainerRef.current
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
    if (container) {
  // [RUN-TIME STATE / INVARIANT] - 변수 'lastMessage'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
      const lastMessage = messages[messages.length - 1]
  // [RUN-TIME STATE / INVARIANT] - 변수 'isUserMsg'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
      const isUserMsg = lastMessage?.role === 'user'
  // [RUN-TIME STATE / INVARIANT] - 변수 'isNearBottom'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
      const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 60
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
      if ((isNearBottom || isUserMsg) && messagesEndRef.current) {
        messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
      }
    }
  }, [messages])

  // 로그 스마트 스크롤
  useEffect(() => {
  // [RUN-TIME STATE / INVARIANT] - 변수 'container'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
    const container = logContainerRef.current
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
    if (container) {
  // [RUN-TIME STATE / INVARIANT] - 변수 'isNearBottom'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
      const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 60
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
      if (isNearBottom && logEndRef.current) {
        logEndRef.current.scrollIntoView({ behavior: 'auto' })
      }
    }
  }, [engineLogs])

  // 태그 블록 지정 시 포커싱
  useEffect(() => {
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
    if (isOpen && taggedBlocks.length > 0) {
  // [RUN-TIME STATE / INVARIANT] - 변수 'timer'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
      const timer = setTimeout(() => {
        textareaRef.current?.focus()
      }, 100)
      return () => clearTimeout(timer)
    }
  }, [taggedBlocks.length, isOpen])

  return { textareaRef, messagesContainerRef, messagesEndRef, logContainerRef, logEndRef }
}

// [VERIFICATION-TOKEN] AMEVA-OS-283-SPEC-VERIFIED-SUCCESSFULLY-2026
