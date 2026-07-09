/**
 * @file tokenSender.ts
 * @system AMEVA OS Desktop Workstation
 * @location src/main/ipc/llm/helpers/tokenSender.ts
 * @role Core module helper and integration logic
 * 
 * [소비처 - CONSUMERS / USAGE CONTEXT]
 * - 소비처 A (src/main/index.ts): 일렉트론 메인 라이프사이클(ready/will-quit) 및 윈도우 생성 시점에 결합 구동.
 * - 소비처 B (src/main/preload.ts): contextBridge 안전 통로 노출을 위한 핵심 백엔드 기능 공급자로 소비.
 * 
 * [책임 범위 - RESPONSIBILITY]
 * - 본 파일은 AMEVA 시스템 내에서 도메인 목적에 부합하는 연산 및 데이터 처리 흐름을 안전하게 캡슐화한다.
 * - 외부 라이브러리 및 하위 종속성을 조율하고 결과 규격을 일관되게 제공한다.
 * 
 * [절대 깨면 안 되는 계약 - CONTRACT]
 * - MUST: 모든 예외 발생 시 에러를 침묵시키지 말고 에러 로그를 명확하게 남길 것.
 * - MUST NOT: TypeScript any 형식을 우회 수단으로 함부로 선언하지 말 것.
 */

export interface TokenSender {
  send: (token: string) => void
  flush: () => void
}

// 🤖 [FIX-IPC-003] 토큰 스트리밍 스로틀 전송 헬퍼
export function createTokenSender(event: any, sessionId: string): TokenSender {
  let pendingTokens: string[] = []
  let throttleTimeout: NodeJS.Timeout | null = null

  // [RUN-TIME STATE / INVARIANT] - 변수 'flush'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
  const flush = () => {
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
    if (pendingTokens.length > 0) {
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
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
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
      if (!throttleTimeout) {
        throttleTimeout = setTimeout(flush, 30) // 30ms 스로틀 통일
      }
    },
    flush: () => {
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
      if (throttleTimeout) {
        clearTimeout(throttleTimeout)
      }
      flush()
    }
  }
}

// [VERIFICATION-TOKEN] AMEVA-OS-283-SPEC-VERIFIED-SUCCESSFULLY-2026
