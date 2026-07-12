/**
 * @file useAIQueue.ts
 * @system AMEVA OS Desktop Workstation - Client Renderer
 * @location src/renderer/hooks/ai/useAIQueue.ts
 * @role SaaS Request Serialization Queue Manager
 * 
 * [책임 범위 - RESPONSIBILITY]
 * - AI 추론 요청이 몰리거나 연쇄 도구 호출 실행이 진행 중일 때, 요청 패킷을 FIFO(선입선출) 큐로 직렬화 관리한다.
 * - 대기 큐(`pendingQueue`)의 전역 상태 갱신 및 로컬 Ref 동기화를 제어한다.
 * - 사용자의 생성 강제 중단(Abort) 발생 시 큐 버퍼를 전수 비워 후속 연쇄 추론이 자동 촉발되는 것을 격리 차단한다.
 * 
 * [책임이 아닌 것 - NON-RESPONSIBILITY]
 * - 실제 LLM API 전송 가동 및 응답 수신 (useAIGenerator 및 useAIStreamProcessor가 소유).
 * - 순환 참조를 피하기 위해 `generateResponse` 호출 시 해당 함수 객체를 `generateFn` 매개변수 콜백 형태로 주입받아 구동한다.
 * 
 * [절대 깨면 안 되는 계약 - CONTRACT]
 * - MUST: React 렌더링 생명주기의 비동기 타이밍 어긋남으로 인해 큐 데이터 유실(Race Condition)이 일어나는 것을 막기 위해,
 *   반드시 Zustand 스토어 세터(`setPendingQueue`) 호출과 동시에 로컬 Mutable `pendingQueueRef.current`에도 1:1 동기화 적재할 것.
 * - MUST NOT: `isGeneratingRef.current`가 참(True)인 동안에는 스케줄러가 절대 다음 요청을 Dequeue해서는 안 됨. (추론 동기 락 붕괴 방지).
 
 * [소비처 - CONSUMERS / USAGE CONTEXT]
 * - 소비처 A (src/renderer/App.tsx): 최상위 Facade 구조에 통합 마운트.
 * - 소비처 B (src/renderer/contexts/AppContext.tsx): 리액트 Context 훅 목록에 바인딩되어 하위 뷰에 전파.
 */

/* 
 * [IMPORT SEGMENTATION & CONTRACTS]
 * - useRef: 렌더 루프 동기화 밖에서 실시간 큐 어레이를 안전하게 push/shift하기 위한 Mutable 레퍼런스 훅.
 * - useCallback: 큐 조작 함수들이 자식 컴포넌트에 프롭스로 전달될 때 렌더링 렉을 유발하지 않도록 하는 메모이즈 훅.
 */
import { useRef, useCallback, useEffect } from 'react'

/* 
 * [ZUSTAND STORE]
 * - useAIState: 대기 큐 어레이(`pendingQueue`) 및 큐 수동 제거를 보존하는 전역 스토어.
 */
import { useAIState } from '../../stores/useAIState'

/* 
 * [TYPES]
 * - AISettings: AI 엔진 온도, 최대 토큰 등의 속성 구조체.
 * - AgentModeResult: 에이전트 모드 실행 결과 구조체.
 */
import type { AISettings } from '../../types/aiTypes'
import type { AgentModeResult } from './useAIAgentMode'

/** 
 * 대기 큐 항목 타입 정의
 */
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

/** 
 * generateResponse 함수의 콜백 시그니처 정의
 * - [EXPECTED VALUE FLOW]: string / Partial<AISettings> / editorInstance / taggedBlocks -> Promise<void | AgentModeResult>
 * - [Rationale]: 에이전트 모드 도입으로 generateResponse가 AgentModeResult를 반환하므로 콜백 호환성을 위해 리턴 타입을 void에서 AgentModeResult 유니온으로 확장함.
 */
export type GenerateFn = (
  userMessage: string,
  context?: string,
  originalText?: string,
  blockId?: string,
  runtimeSettings?: Partial<AISettings>,
  editorInstance?: any,
  taggedBlocks?: { id: string; text: string }[]
) => Promise<void | AgentModeResult>

/**
 * @hook useAIQueue
 * @description AI 실행 요청의 스케줄링 적재 및 순차 처리를 관장하는 큐 관리 훅.
 */
export function useAIQueue(
  /*
   * [PARAMETER CONTRACTS]
   * - isGeneratingRef: 현재 생성 중 플래그.
   */
  isGeneratingRef: React.RefObject<boolean>
) {
  /*
   * [ZUSTAND STORE SELECTORS]
   * - pendingQueue: UI에 바인딩할 대기 큐 목록.
   * - setPendingQueue: 대기 큐 변경 액션.
   * - removeFromQueue: 특정 항목 수동 삭제 액션.
   */
  const { pendingQueue, setPendingQueue, removeFromQueue } = useAIState()

  /*
   * [INVARIANT - Synchronous Queue Buffer]
   * - pendingQueueRef: 리액트 비동기 배치 업데이트 렉을 피해 동기적으로 `shift()` 및 `push()`를 판정하기 위한 실시간 큐 레퍼런스 어레이.
   */
  const pendingQueueRef = useRef<QueueItem[]>([])

  // Zustand 스토어의 pendingQueue 상태 변경 시 로컬 동기용 Ref를 1:1 싱크 맞춤 (좀비 큐 부활 버그 차단)
  // - Rationale: Zustand 스토어의 pendingQueue 타입을 QueueItem[] 으로 안전하게 단언하여 컴파일 타입 에러를 해결함.
  useEffect(() => {
    pendingQueueRef.current = [...pendingQueue] as QueueItem[]
  }, [pendingQueue])

  /**
   * [CONTRACT - Add To Queue Lifecycle]
   * - Rationale: 새 추론 명령이 유입될 때 고유 키를 부여하고, 동기/비동기 버퍼에 이중 적재한다.
   */
  const enqueue = useCallback((item: Omit<QueueItem, 'id'>) => {
    // 큐 항목 구분을 위한 시간 기반 고유 ID 생성
    const queueId = `q_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`
    const newItem: QueueItem = { ...item, id: queueId }
    
    // 동기식 레퍼런스에 push 후 즉시 전역 스토어 상태를 갱신
    pendingQueueRef.current.push(newItem)
    setPendingQueue([...pendingQueueRef.current])
  }, [setPendingQueue])

  /**
   * [CONTRACT - Dequeue Scheduler Execution]
   * - Rationale: 이전 작업 완료 트리거 수신 시, 생성 중 락을 검사한 후 큐 최전방 원소를 꺼내 추론을 가동한다.
   */
  const checkAndProcessNextQueue = useCallback((generateFn: GenerateFn) => {
    // 락이 걸려있거나 대기 건수가 0이면 스케줄링 연산을 스킵함
    if (isGeneratingRef.current) return
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `pendingQueueRef.current.length === 0`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (pendingQueueRef.current.length === 0)` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
    if (pendingQueueRef.current.length === 0) return

    // FIFO(선입선출) 규격에 따라 맨 처음 인입 원소를 추출
    const nextReq = pendingQueueRef.current.shift()
    
    // 큐에서 제거된 상태를 즉시 전역 스토어 뷰에 동기화
    setPendingQueue([...pendingQueueRef.current])

      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `nextReq`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (nextReq)` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
    if (nextReq) {
      // 주입받은 추론 시그니처 함수를 실행하여 생성을 연속 개시
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
   * [CONTRACT - Clear Queue On Abort]
   * - Rationale: 사용자가 강제 중단 버튼을 클릭했을 때 대기 중이던 큐가 후속 기동되는 참사(Invariant)를 막고자 전체 목록을 완전히 날려버린다.
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

/**
 * ============================================================================
 * FUTURE DEVELOPMENT GUIDE (AI Agent Instruction Layer)
 * ============================================================================
 * 1. 큐 항목들의 우선순위 스케줄링(예: 사용자가 요청한 명령 우선)이 추가될 때:
 *    - `enqueue` 시에 순차 push 대신 우선순위 정렬 루프를 삽입할 것.
 *    - 이 과정에서도 `pendingQueueRef.current`와 스토어 상태의 동기화 상태는 100% 일치해야 함을 명심할 것.
 * ============================================================================
 */

