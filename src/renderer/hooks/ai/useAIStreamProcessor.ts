/**
 * useAIStreamProcessor.ts
 *
 * AI 스트리밍 토큰 처리 전담 훅.
 * StreamingSanitizer 인스턴스와 raw 누적 버퍼를 관리하며,
 * 60ms 렌더링 스로틀링을 통해 화면 깜빡임 없는 실시간 업데이트를 보장한다.
 *
 * [단일 책임]
 * - StreamingSanitizer 인스턴스 생명주기 관리
 * - raw 텍스트 누적 (EDIT_SUGGESTION 파싱용 un-sanitized 버퍼)
 * - 60ms 스로틀링 기반 UI 업데이트 스케줄링
 * - 현재 assistant 메시지 ID 추적
 */

import { useRef, useCallback } from 'react'
import { StreamingSanitizer } from '../../utils/responseSanitizer'
import { useAILogStore } from '../../stores/useAILogStore'
import type { ReasoningTraceEvent } from '../../../shared/reasoningTypes'

/** 스트리밍 UI 업데이트 함수 시그니처 */
export interface StreamUpdateFn {
  (params: {
    safeText: string
    thinkingText: string
    currentAssistantId: string | null
  }): void
}

/**
 * useAIStreamProcessor
 * AI 스트리밍 토큰 처리 및 throttled UI 업데이트를 담당한다.
 */
export function useAIStreamProcessor() {
  const { setMessages, setStreamingText } = useAILogStore()

  // StreamingSanitizer 인스턴스: 세션마다 리셋
  const sanitizerRef = useRef<StreamingSanitizer>(new StreamingSanitizer())
  // Raw 누적 버퍼: sanitize 이전 원본 텍스트 (EDIT_SUGGESTION 파싱에 필요)
  const rawAccumRef = useRef<string>('')
  // 현재 스트리밍 중인 assistant 메시지 ID
  const currentAssistantIdRef = useRef<string | null>(null)
  // 현재 활성 세션 ID (타 세션 토큰 무시용)
  const currentSessionIdRef = useRef<string | null>(null)
  // 에이전트 실행 중 락 (에이전트 모드에서 일반 토큰 리스너 차단)
  const isAgentRunningRef = useRef<boolean>(false)

  // 60ms 렌더링 스로틀링 상태 변수
  const lastRenderTimeRef = useRef<number>(0)
  const pendingTokenUpdateRef = useRef<boolean>(false)

  /**
   * resetSession
   * 새 생성 세션 시작 시 상태를 초기화한다.
   * sanitizer, rawAccum, assistantId, sessionId를 리셋한다.
   *
   * @param newSessionId - 새 세션 ID
   * @param newAssistantId - 새 assistant 메시지 ID
   */
  const resetSession = useCallback((newSessionId: string, newAssistantId: string) => {
    sanitizerRef.current = new StreamingSanitizer()
    rawAccumRef.current = ''
    currentAssistantIdRef.current = newAssistantId
    currentSessionIdRef.current = newSessionId
    lastRenderTimeRef.current = 0
    pendingTokenUpdateRef.current = false
    isAgentRunningRef.current = false
  }, [])

  /**
   * processToken
   * 수신된 스트리밍 토큰을 처리한다.
   * raw 버퍼에 누적하고, sanitizer를 통해 처리한 뒤 60ms 스로틀링으로 UI를 업데이트한다.
   *
   * @param token - LLM이 방출한 토큰 문자열
   * @param sessId - 현재 요청의 세션 ID (타 세션 차단용)
   */
  const processToken = useCallback((token: string, sessId: string) => {
    // 타 세션 토큰 무시
    if (sessId !== currentSessionIdRef.current) return
    // 에이전트 실행 중 차단
    if (isAgentRunningRef.current) return

    rawAccumRef.current += token
    sanitizerRef.current.appendChunk(token)

    // 60ms 스로틀링: 렌더링 주기 조절
    const now = Date.now()
    const updateUI = () => {
      if (sessId !== currentSessionIdRef.current) return
      setStreamingText(rawAccumRef.current)

      const assistantId = currentAssistantIdRef.current
      if (!assistantId) return

      const safeText = sanitizerRef.current.getSafeOutput()
      const thinkingText = sanitizerRef.current.getThinkingBuffer()

      setMessages((prev) =>
        prev.map((m) => {
          if (m.id !== assistantId) return m

          const liveTrace: ReasoningTraceEvent[] = thinkingText
            ? [{
                id: `trace_live_${m.id}`,
                source: 'model' as const,
                type: 'thinking' as const,
                text: thinkingText,
                model: 'streaming',
                timestamp: new Date().toISOString()
              }]
            : []

          return {
            ...m,
            content: safeText,
            isStreaming: true,
            reasoningTrace: liveTrace
          }
        })
      )
    }

    if (now - lastRenderTimeRef.current > 60) {
      lastRenderTimeRef.current = now
      updateUI()
    } else if (!pendingTokenUpdateRef.current) {
      pendingTokenUpdateRef.current = true
      setTimeout(() => {
        pendingTokenUpdateRef.current = false
        lastRenderTimeRef.current = Date.now()
        updateUI()
      }, 60)
    }
  }, [setMessages, setStreamingText])

  /**
   * finalize
   * 생성 완료 시 sanitizer를 종료하고 최종 결과를 반환한다.
   * 이 메서드 호출 후 resetSession을 호출해야 다음 세션을 준비할 수 있다.
   *
   * @returns sanitizer 최종 결과 (finalContent, thinkingContent, hadInternalTags)
   */
  const finalize = useCallback(() => {
    return sanitizerRef.current.finalize()
  }, [])

  return {
    sanitizerRef,
    rawAccumRef,
    currentAssistantIdRef,
    currentSessionIdRef,
    isAgentRunningRef,
    resetSession,
    processToken,
    finalize
  }
}
