/**
 * useAIQueue.ts
 *
 * AI 요청 대기 큐 관리 전담 훅.
 * 현재 생성이 진행 중일 때 새 요청을 큐에 적재하고,
 * 생성 완료 시 다음 항목을 꺼내 순차적으로 실행하는 SaaS Request Queue를 담당한다.
 *
 * [단일 책임]
 * - 대기 큐(pendingQueue) 상태 관리
 * - 큐에 새 항목 추가 (enqueue)
 * - 큐에서 다음 항목 꺼내기 (dequeue + 실행)
 * - 큐 전체 초기화 (중단 시)
 * generateResponse 자체는 이 훅에서 직접 호출하며, 순환 참조를 피하기 위해
 * generateFn 콜백 방식으로 주입받는다.
 */

import { useRef, useCallback } from 'react'
import { useAIState } from '../../stores/useAIState'
import type { AISettings } from '../../types/aiTypes'

/** 대기 큐 항목 타입 */
export interface QueueItem {
  id: string
  userMessage: string
  context?: string
  originalText?: string
  blockId?: string
  runtimeSettings?: Partial<AISettings>
  editorInstance?: any
  taggedBlocks?: { id: string; text: string }[]
}

/** generateResponse 함수의 콜백 시그니처 */
export type GenerateFn = (
  userMessage: string,
  context?: string,
  originalText?: string,
  blockId?: string,
  runtimeSettings?: Partial<AISettings>,
  editorInstance?: any,
  taggedBlocks?: { id: string; text: string }[]
) => Promise<void>

/**
 * useAIQueue
 * AI 요청 대기 큐를 관리한다.
 *
 * @param isGeneratingRef - 현재 생성 중 여부 ref (큐 진입 차단용)
 */
export function useAIQueue(isGeneratingRef: React.RefObject<boolean>) {
  const { pendingQueue, setPendingQueue, removeFromQueue } = useAIState()
  // 동기적 큐 조작을 위한 Ref (React 렌더링 사이클 외부에서 접근)
  const pendingQueueRef = useRef<QueueItem[]>([])

  /**
   * enqueue
   * 새 요청을 대기 큐에 추가한다.
   * 생성이 진행 중일 때만 호출한다.
   */
  const enqueue = useCallback((item: Omit<QueueItem, 'id'>) => {
    const queueId = `q_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`
    const newItem: QueueItem = { ...item, id: queueId }
    pendingQueueRef.current.push(newItem)
    setPendingQueue([...pendingQueueRef.current])
  }, [setPendingQueue])

  /**
   * checkAndProcessNextQueue
   * 생성이 완료된 시점에 호출하여 대기 큐의 다음 항목을 실행한다.
   * 대기 결정(수정 제안 승인 대기)이 있는 경우에는 호출하지 않는다.
   *
   * @param generateFn - 실제 generateResponse 함수 (순환 참조 방지를 위해 주입)
   */
  const checkAndProcessNextQueue = useCallback((generateFn: GenerateFn) => {
    // 생성 중이거나 큐가 비어있으면 무시
    if (isGeneratingRef.current) return
    if (pendingQueueRef.current.length === 0) return

    const nextReq = pendingQueueRef.current.shift()
    // 큐에서 제거 후 UI 상태 즉시 반영
    setPendingQueue([...pendingQueueRef.current])

    if (nextReq) {
      // 대기 안내 메시지 필터 제거 (msg_queue_ prefix 메시지)
      // 실제 메시지 제거는 useAILogStore에서 처리하므로 여기서는 실행만 담당
      generateFn(
        nextReq.userMessage,
        nextReq.context,
        nextReq.originalText,
        nextReq.blockId,
        nextReq.runtimeSettings,
        nextReq.editorInstance,
        nextReq.taggedBlocks
      )
    }
  }, [isGeneratingRef, setPendingQueue])

  /**
   * clearQueue
   * 대기 큐를 완전히 비운다.
   * 사용자가 생성을 강제 중단할 때 연쇄 실행 방지를 위해 호출한다.
   */
  const clearQueue = useCallback(() => {
    pendingQueueRef.current = []
    setPendingQueue([])
  }, [setPendingQueue])

  return {
    pendingQueue,
    pendingQueueRef,
    removeFromQueue,
    enqueue,
    checkAndProcessNextQueue,
    clearQueue
  }
}
