
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
