export interface TokenSender {
  send: (token: string) => void
  flush: () => void
}

// 🤖 [FIX-IPC-003] 토큰 스트리밍 스로틀 전송 헬퍼
export function createTokenSender(event: any, sessionId: string): TokenSender {
  let pendingTokens: string[] = []
  let throttleTimeout: NodeJS.Timeout | null = null

  const flush = () => {
    if (pendingTokens.length > 0) {
      if (!event.sender.isDestroyed()) {
        event.sender.send(`llm:token:${sessionId}`, { token: pendingTokens.join('') })
      }
      pendingTokens = []
    }
    throttleTimeout = null
  }

  return {
    send: (token: string) => {
      pendingTokens.push(token)
      if (!throttleTimeout) {
        throttleTimeout = setTimeout(flush, 30) // 30ms 스로틀 통일
      }
    },
    flush: () => {
      if (throttleTimeout) {
        clearTimeout(throttleTimeout)
      }
      flush()
    }
  }
}
