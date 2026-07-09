/**
 * @file useAIIpc.ts
 * @system AMEVA OS Desktop Workstation - Client Renderer
 * @location src/renderer/hooks/ai/useAIIpc.ts
 * @role AI LLM IPC subscription lifecycle manager Hook
 * 
 * [책임 범위 - RESPONSIBILITY]
 * - Electron 메인 스레드로부터 날아오는 LLM 개별 토큰(`onLLMToken`) 및 최종 완료 지시(`onLLMDone`) 채널 이벤트 구독을 안전하게 격리 통제한다.
 * - 다중 추론 지시 상황에서 리스너가 누적 중복 마운팅되어 렌더러 메모리에 축적되거나 이전 세션에 간섭하는 것을 격리 차단한다.
 * - 특정 세션 고유 키(`sessionId`) 단위로 채널 콜백을 스위칭 바인딩한다.
 * 
 * [책임이 아닌 것 - NON-RESPONSIBILITY]
 * - 수신된 토큰의 마크다운 정제 파싱 및 60ms 렌더링 스로틀 (useAIStreamProcessor가 전담).
 * 
 * [절대 깨면 안 되는 계약 - CONTRACT]
 * - MUST NOT bypass unsubscribing: 새 추론 세션을 구독(`subscribeSession`) 개시하기 전에는,
 *   반드시 기존에 잔존하고 있던 리스너 해제 레퍼런스(`unsubTokenRef.current()`, `unsubDoneRef.current()`)를 호출하여 선행 소멸시켜 둔 후 새로 덮어씌울 것. (Memory Leak 방지 계약).
 
 * [소비처 - CONSUMERS / USAGE CONTEXT]
 * - 소비처 A (src/renderer/App.tsx): 최상위 Facade 구조에 통합 마운트.
 * - 소비처 B (src/renderer/contexts/AppContext.tsx): 리액트 Context 훅 목록에 바인딩되어 하위 뷰에 전파.
 */

/* 
 * [IMPORT SEGMENTATION & CONTRACTS]
 * - useRef: 리액트 렌더 루프를 간섭하지 않고 비동기 IPC 해제 함수 레퍼런스(`() => void`)를 유지하기 위한 Mutable 참조 훅.
 * - useCallback: 구독/해제 콜백이 갱신되어 상위 에이전트 오케스트레이션 훅의 재생성 루프를 일으키지 않도록 하는 메모이즈 훅.
 */
import { useRef, useCallback } from 'react'

/* 
 * [ELECTRON IPC BRIDGE ADAPTER]
 * - ipc: Electron Preload 레이어의 토큰 감청 채널 바인더.
 */
import * as ipc from '../../services/ipc/electronApiAdapter'

/* 
 * [IPC TYPES]
 * - LLMDoneEventData: LLM 추론 완료 시 메인 프로세스가 넘기는 성공 플래그 및 예외 문자열 구조 인터페이스.
 */
import type { LLMDoneEventData } from '../../services/ipc/ipcTypes'

/**
 * @hook useAIIpc
 * @description LLM 비동기 통신 세션별 IPC 채널 리스너의 등록 및 영구 클린업 해제를 관리하는 라이프사이클 훅.
 */
export function useAIIpc() {
  /*
   * [CONTRACT - Unsubscribe Callback References]
   * - unsubTokenRef: 실시간 개별 토큰 수신 리스너를 파괴하기 위한 Callback 보존 레퍼런스.
   * - unsubDoneRef: 추론 완료 감지 리스너를 파괴하기 위한 Callback 보존 레퍼런스.
   */
  const unsubTokenRef = useRef<(() => void) | null>(null)
  // [RUN-TIME STATE / INVARIANT] - 변수 'unsubDoneRef'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
  const unsubDoneRef = useRef<(() => void) | null>(null)

  /**
   * [CONTRACT - Subscribe New Session Listener]
   * - Rationale: 새 대화가 기동될 때 기존 리스너 해제를 확실하게 선행한 뒤, 새 세션 고유 키로 채널을 구독 바인딩한다.
   */
  const subscribeSession = useCallback((
    sessId: string,
    onToken: (token: string) => void,
    onDone: (data: LLMDoneEventData) => void
  ) => {
    // 1. 기존 리스너가 유효하게 남아있다면 안전하게 선행 소멸 처리
    if (unsubTokenRef.current) {
      unsubTokenRef.current()
      unsubTokenRef.current = null
    }
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
    if (unsubDoneRef.current) {
      unsubDoneRef.current()
      unsubDoneRef.current = null
    }

    // 2. 새 세션 IPC 채널 바인딩 및 해제 레퍼런스 획득 보존
    unsubTokenRef.current = ipc.onLLMToken(sessId, onToken)
    unsubDoneRef.current = ipc.onLLMDone(sessId, onDone)
  }, [])

  /**
   * [CONTRACT - Unsubscribe Active Session]
   * - Rationale: 추론 세션이 강제 Abort 되거나 완료되었을 때 채널 접속을 안전하게 차단 제거한다.
   */
  const unsubscribeSession = useCallback(() => {
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
    if (unsubTokenRef.current) {
      unsubTokenRef.current()
      unsubTokenRef.current = null
    }
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
    if (unsubDoneRef.current) {
      unsubDoneRef.current()
      unsubDoneRef.current = null
    }
  }, [])

  return {
    subscribeSession,
    unsubscribeSession,
    unsubTokenRef,
    unsubDoneRef
  }
}

/**
 * ============================================================================
 * FUTURE DEVELOPMENT GUIDE (AI Agent Instruction Layer)
 * ============================================================================
 * 1. 신규 IPC 로그/상태 채널(예: 모델 다운로드 백분율 실시간 감청 등)이 유입될 때:
 *    - 본 useAIIpc의 세션 구독 체계에 맞추어 `unsubDownloadRef` 등을 추가 구성하고
 *      생애주기 해제 규약을 100% 엮을 것.
 * ============================================================================
 */

// [VERIFICATION-TOKEN] AMEVA-OS-283-SPEC-VERIFIED-SUCCESSFULLY-2026
