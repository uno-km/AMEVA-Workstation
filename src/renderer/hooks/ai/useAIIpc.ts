/**
 * useAIIpc.ts
 *
 * AI LLM IPC 구독 생애주기 관리 전담 훅.
 * onLLMToken, onLLMDone 이벤트의 구독 및 해제를 담당하며,
 * 세션 격리(sessionId 기반) 및 중복 구독 방지 로직을 포함한다.
 *
 * [단일 책임]
 * - IPC 이벤트 리스너 등록/해제
 * - 세션 ID 기반 격리 (타 세션 토큰 무시)
 * - 리스너 참조(Ref) 관리
 * 실제 메시지 상태나 스트리밍 처리 로직은 별도 훅에서 담당한다.
 */

import { useRef, useCallback } from 'react'
import * as ipc from '../../services/ipc/electronApiAdapter'
import type { LLMDoneEventData } from '../../services/ipc/ipcTypes'

/**
 * useAIIpc
 * LLM IPC 이벤트 구독 생애주기를 관리한다.
 */
export function useAIIpc() {
  // 현재 세션의 Token 이벤트 unsubscribe 함수 참조
  const unsubTokenRef = useRef<(() => void) | null>(null)
  // 현재 세션의 Done 이벤트 unsubscribe 함수 참조
  const unsubDoneRef = useRef<(() => void) | null>(null)

  /**
   * subscribeSession
   * 새 세션에 대한 LLM 이벤트 리스너를 등록한다.
   * 기존 리스너가 있다면 먼저 해제한 후 새로 등록한다.
   *
   * @param sessId - 현재 LLM 세션 ID
   * @param onToken - 토큰 수신 콜백
   * @param onDone - 완료 이벤트 콜백
   */
  const subscribeSession = useCallback((
    sessId: string,
    onToken: (token: string) => void,
    onDone: (data: LLMDoneEventData) => void
  ) => {
    // 기존 리스너 안전 해제 (중복 구독 방지)
    if (unsubTokenRef.current) {
      unsubTokenRef.current()
      unsubTokenRef.current = null
    }
    if (unsubDoneRef.current) {
      unsubDoneRef.current()
      unsubDoneRef.current = null
    }

    // 새 세션 리스너 등록
    unsubTokenRef.current = ipc.onLLMToken(sessId, onToken)
    unsubDoneRef.current = ipc.onLLMDone(sessId, onDone)
  }, [])

  /**
   * unsubscribeSession
   * 현재 세션의 모든 IPC 리스너를 해제한다.
   * 컴포넌트 언마운트 또는 세션 완료 시 반드시 호출해야 한다.
   */
  const unsubscribeSession = useCallback(() => {
    if (unsubTokenRef.current) {
      unsubTokenRef.current()
      unsubTokenRef.current = null
    }
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
