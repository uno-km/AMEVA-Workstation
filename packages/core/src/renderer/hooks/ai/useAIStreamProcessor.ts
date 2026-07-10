/**
 * @file useAIStreamProcessor.ts
 * @system AMEVA OS Desktop Workstation - Client Renderer
 * @location src/renderer/hooks/ai/useAIStreamProcessor.ts
 * @role Throttled LLM Streaming Token Buffer & Sanitizer Manager
 * 
 * [책임 범위 - RESPONSIBILITY]
 * - LLM 추론 스트림으로부터 전달받은 원본 토큰들을 정제 가공하는 `StreamingSanitizer` 인스턴스의 전체 생명주기를 주도한다.
 * - 생각 과정을 나타내는 `<thought>` 추론 태그와 실시간 렌더링용 안전 문자열(safe output)을 추출 관리한다.
 * - 브라우저 렌더링 렉 및 말더듬 현상(visual jitter)을 방지하기 위해 **60ms 렌더링 디바운싱/스로틀링**을 적용하여 UI 상태를 갱신한다.
 * 
 * [책임이 아닌 것 - NON-RESPONSIBILITY]
 * - Llama.cpp 네이티브 소켓 및 IPC 통신 호출 직접 주도 (useAIIpc 및 electronApiAdapter에서 처리).
 * - 대기 큐 스케줄러 관리 (useAIQueue에서 단독 수행).
 * 
 * [절대 깨면 안 되는 계약 - CONTRACT]
 * - MUST NOT: UI 업데이트 스로틀 주기인 `60ms`를 임의로 늘리거나 줄이지 말 것. 늘리면 타이핑 반응 속도가 답답해지고,
 *   줄이면 React 상태 리렌더링 폭풍으로 인해 CPU 점유율 과부하가 발생함.
 * - MUST: 생성 세션 ID(`currentSessionIdRef.current`)와 토큰 유입 시의 세션 ID를 매번 대조 검증하여,
 *   네트워크 지연으로 인해 이전 세션의 잔여 토큰이 현재 대화창에 뒤섞이는 오작동을 완전히 방지할 것.
 
 * [소비처 - CONSUMERS / USAGE CONTEXT]
 * - 소비처 A (src/renderer/App.tsx): 최상위 Facade 구조에 통합 마운트.
 * - 소비처 B (src/renderer/contexts/AppContext.tsx): 리액트 Context 훅 목록에 바인딩되어 하위 뷰에 전파.
 */

/* 
 * [IMPORT SEGMENTATION & CONTRACTS]
 * - useRef: 렌더 트리를 흔들지 않고 토큰 버퍼 및 이전 렌더 타임스탬프를 유지하기 위한 Mutable 참조 객체 생성 훅.
 * - useCallback: 콜백이 불필요하게 갱신되어 자식 리렌더링 폭풍을 일으키는 것을 막기 위한 훅.
 */
import { useRef, useCallback } from 'react'

/* 
 * [UTILITIES & STORES]
 * - StreamingSanitizer: LLM의 추론 생각 태그를 제거하고 실시간 정제 출력을 산출하는 파싱 엔진.
 * - useAILogStore: 실시간 출력 및 이전 대화 목록 메시지를 영구/임시 보존하는 Zustand 스토어.
 */
import { StreamingSanitizer } from '../../utils/responseSanitizer'
import { useAILogStore } from '../../stores/useAILogStore'

/* 
 * [SHARED SCHEMAS]
 * - ReasoningTraceEvent: 실시간으로 발라낸 생각 과정을 AI 추론 생각 트레이스 형태로 형상화한 타입 규격.
 */
import type { ReasoningTraceEvent } from '../../../shared/reasoningTypes'

/** 
 * 스트리밍 UI 업데이트 함수 시그니처 
 */
export interface StreamUpdateFn {
  (params: {
    safeText: string
    thinkingText: string
    currentAssistantId: string | null
  }): void
}

/**
 * @hook useAIStreamProcessor
 * @description 스트리밍 토큰 유입 시 버퍼 누적 및 스로틀 기반 UI 업데이트를 주도하는 훅.
 */
export function useAIStreamProcessor() {
  /*
   * [CONTRACT - Log Store Decoupling Selector]
   * - setMessages: AI 메시지 노드의 내용을 60ms 간격으로 교체하기 위한 액션 세터.
   * - setStreamingText: 터미널 디버깅 로그용 원본 텍스트 갱신 세터.
   */
  const { setMessages, setStreamingText } = useAILogStore()

  /*
   * [CONTRACT - Mutable References Initialization]
   * - sanitizerRef: 세션 시작 시 새로 기동되는 생각 태그 필터링 객체 레퍼런스.
   * - rawAccumRef: EDIT 제안서 및 Jupyter 삽입 파싱을 위해 보존하는 원본 누적 문자열 버퍼 레퍼런스.
   * - currentAssistantIdRef: 현재 실시간 글자가 타이핑되고 있는 Assistant 메시지 말풍선의 고유 ID 레퍼런스.
   * - currentSessionIdRef: 다른 세션으로부터의 토큰 난입을 가드하는 고유 추론 세션 ID 레퍼런스.
   * - isAgentRunningRef: AI 도구 실행 루프 동안 임시로 일반 스트림 수신을 무력화하기 위한 플래그 레퍼런스.
   * - lastRenderTimeRef: 스로틀 구현을 위해 이전 UI 갱신 타임스탬프를 보존하는 밀리초 레퍼런스.
   * - pendingTokenUpdateRef: 60ms 스로틀 제한 시간 동안 추가로 유입된 토큰들의 렌더링 지연 예약을 위한 타이머 플래그 레퍼런스.
   */
  const sanitizerRef = useRef<StreamingSanitizer>(new StreamingSanitizer())
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `rawAccumRef`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const rawAccumRef = ...` 형태로 안전 캐싱 후 가공 기동.
       */
  const rawAccumRef = useRef<string>('')
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `currentAssistantIdRef`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const currentAssistantIdRef = ...` 형태로 안전 캐싱 후 가공 기동.
       */
  const currentAssistantIdRef = useRef<string | null>(null)
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `currentSessionIdRef`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const currentSessionIdRef = ...` 형태로 안전 캐싱 후 가공 기동.
       */
  const currentSessionIdRef = useRef<string | null>(null)
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `isAgentRunningRef`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const isAgentRunningRef = ...` 형태로 안전 캐싱 후 가공 기동.
       */
  const isAgentRunningRef = useRef<boolean>(false)
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `lastRenderTimeRef`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const lastRenderTimeRef = ...` 형태로 안전 캐싱 후 가공 기동.
       */
  const lastRenderTimeRef = useRef<number>(0)
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `pendingTokenUpdateRef`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const pendingTokenUpdateRef = ...` 형태로 안전 캐싱 후 가공 기동.
       */
  const pendingTokenUpdateRef = useRef<boolean>(false)

  /**
   * [CONTRACT - Reset Session Lifecycle]
   * - Rationale: 새 대화 전송 시작 시, 기존의 누적 찌꺼기 버퍼와 이전 세션 ID를 완전히 초기화(Invariant)한다.
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
   * [CONTRACT - Token Streaming Processing Stream]
   * - Rationale: IPC 소켓으로부터 문자열 청크가 조각날 때마다 버퍼에 붙이고, 60ms 주기로 화면 렌더링 스케줄링을 가동한다.
   */
  const processToken = useCallback((token: string, sessId: string) => {
    // 1. 타 세션 토큰 유입 가드 필터링
    if (sessId !== currentSessionIdRef.current) return
    // 2. AI 도구 스크립트 가동 중 일반 스트림 덮어쓰기 방지 가드
    if (isAgentRunningRef.current) return

    // 원본 및 정제용 필터 객체에 토큰 청크 추가
    rawAccumRef.current += token
    sanitizerRef.current.appendChunk(token)

    // 실시간 렌더링 주기 판정용 밀리초 획득
    const now = Date.now()

    /*
     * [INVARIANT - UI State Update Callback]
     * - Rationale: 60ms 스로틀 조건 만족 시, 누적 버퍼의 정제 텍스트와 생각 버퍼 내용을 추출하여 리액트 UI 상태를 변경한다.
     */
    const updateUI = () => {
      // 꼬임 방지를 위해 실행 시점에 다시 한번 세션 ID를 교차 검증함
      if (sessId !== currentSessionIdRef.current) return
      setStreamingText(rawAccumRef.current)

      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `assistantId`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const assistantId = ...` 형태로 안전 캐싱 후 가공 기동.
       */
      const assistantId = currentAssistantIdRef.current
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `!assistantId`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (!assistantId)` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
      if (!assistantId) return

      // 생각 부분과 안전 텍스트 부분의 파싱 데이터 획득
      const safeText = sanitizerRef.current.getSafeOutput()
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `thinkingText`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const thinkingText = ...` 형태로 안전 캐싱 후 가공 기동.
       */
      const thinkingText = sanitizerRef.current.getThinkingBuffer()

      setMessages((prev) =>
        prev.map((m) => {
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `m.id !== assistantId`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (m.id !== assistantId)` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
          if (m.id !== assistantId) return m

          // 실시간으로 흘러나오는 생각 흐름 정보 구성
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

    // 60ms 스로틀 주기가 완료되었을 때 즉시 렌더링
    if (now - lastRenderTimeRef.current > 60) {
      lastRenderTimeRef.current = now
      updateUI()
    } 
    // 미완료 상태에서 추가 토큰 유입 시 60ms 지연 렌더링 예약
    else if (!pendingTokenUpdateRef.current) {
      pendingTokenUpdateRef.current = true
      setTimeout(() => {
        pendingTokenUpdateRef.current = false
        lastRenderTimeRef.current = Date.now()
        updateUI()
      }, 60)
    }
  }, [setMessages, setStreamingText])

  /**
   * [CONTRACT - Terminate Session / Rationale]
   * - 스트리밍 최종 완료 시, StreamingSanitizer 필터링 라이프사이클을 종결하여 최종 생각 로그 및 안전 텍스트 반환.
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

/**
 * ============================================================================
 * FUTURE DEVELOPMENT GUIDE (AI Agent Instruction Layer)
 * ============================================================================
 * 1. AI 렌더링 스로틀 속도를 조정하고자 하는 경우:
 *    - 본 파일 내 `60ms` 임계치를 제어하는 하드코딩 수치들을 환경 상수로 치환하여 제어할 것.
 * 
 * 2. 생각 흐름 추적기(Reasoning Trace) 렌더링 중 커스텀 마크다운 렌더링을 얹고 싶을 때:
 *    - `liveTrace` 구조의 속성에 파싱용 플래그 메타데이터를 추가할 것.
 * ============================================================================
 */

