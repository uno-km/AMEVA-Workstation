import { useState, useEffect, useCallback, useRef } from 'react'
import * as Y from 'yjs'
import type { WebsocketProvider } from 'y-websocket'

export interface ChatMessage {
  id: string
  author: string
  color: string
  content: string
  timestamp: number
  type: 'text' | 'system'
}

export function useChat(
  ydoc: Y.Doc | null,
  provider: WebsocketProvider | null,
  username: string,
  userColor: string,
  serverRunning: boolean
) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const yArrayRef = useRef<Y.Array<ChatMessage> | null>(null)

  // Y.js Array 초기화 및 옵저버 등록
  useEffect(() => {
    if (!ydoc) return

    const yMessages = ydoc.getArray<ChatMessage>('chat-messages')
    yArrayRef.current = yMessages

    const observer = () => {
      setMessages(yMessages.toArray())
    }

    yMessages.observe(observer)
    setMessages(yMessages.toArray())

    return () => {
      yMessages.unobserve(observer)
    }
  }, [ydoc])

  // 서버 연결 시 입장 메시지
  useEffect(() => {
    if (!serverRunning || !yArrayRef.current) return

    const joinMsg: ChatMessage = {
      id: `sys_${Date.now()}`,
      author: 'System',
      color: '#10b981',
      content: `${username} 님이 입장했습니다.`,
      timestamp: Date.now(),
      type: 'system',
    }

    yArrayRef.current.push([joinMsg])
  }, [serverRunning, username])

  const sendMessage = useCallback((content: string) => {
    if (!yArrayRef.current || !content.trim()) return

    const msg: ChatMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      author: username,
      color: userColor,
      content: content.trim(),
      timestamp: Date.now(),
      type: 'text',
    }

    yArrayRef.current.push([msg])
  }, [username, userColor])

  const clearMessages = useCallback(() => {
    if (!yArrayRef.current) return
    // 로컬에서만 초기화 (Y.js는 분산이므로 전체 삭제는 하지 않음)
    setMessages([])
  }, [])

  return {
    messages,
    sendMessage,
    clearMessages,
  }
}
