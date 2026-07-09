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

export function useAIPanelScroll(
  messages: any[],
  engineLogs: string,
  taggedBlocks: any[],
  isOpen: boolean
) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const logContainerRef = useRef<HTMLDivElement>(null)
  const logEndRef = useRef<HTMLDivElement>(null)

  // 메시지 스마트 스크롤
  useEffect(() => {
    const container = messagesContainerRef.current
    if (container) {
      const lastMessage = messages[messages.length - 1]
      const isUserMsg = lastMessage?.role === 'user'
      const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 60
      if ((isNearBottom || isUserMsg) && messagesEndRef.current) {
        messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
      }
    }
  }, [messages])

  // 로그 스마트 스크롤
  useEffect(() => {
    const container = logContainerRef.current
    if (container) {
      const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 60
      if (isNearBottom && logEndRef.current) {
        logEndRef.current.scrollIntoView({ behavior: 'auto' })
      }
    }
  }, [engineLogs])

  // 태그 블록 지정 시 포커싱
  useEffect(() => {
    if (isOpen && taggedBlocks.length > 0) {
      const timer = setTimeout(() => {
        textareaRef.current?.focus()
      }, 100)
      return () => clearTimeout(timer)
    }
  }, [taggedBlocks.length, isOpen])

  return { textareaRef, messagesContainerRef, messagesEndRef, logContainerRef, logEndRef }
}
