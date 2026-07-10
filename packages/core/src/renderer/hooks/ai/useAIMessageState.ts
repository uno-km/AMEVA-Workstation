/**
 * @file useAIMessageState.ts
 * @system AMEVA OS Desktop Workstation - Client Renderer
 * @location src/renderer/hooks/ai/useAIMessageState.ts
 * @role AI Message State Orchestrator Facade Hook (Facade Pattern)
 * 
 * [설계 의도 - DESIGN INTENT / ADR]
 * - AI 대화 말풍선 추가 및 편집에 따른 수동 승인/반영 히스토리 갱신 등의 로직을 결합하고 중재(Facade)한다.
 * - [Solve et Coagula] 개별 상태 편집 책임을 도메인별 훅(useAddMessages, useFinalizeMessage 등)으로 완전히 찢어 격리함으로써 단일 책임 원칙(SRP)을 준수한다.
 * 
 * [책임 범위 - RESPONSIBILITY]
 * - useAILogStore 및 useAIState에서 추출된 액션 함수들을 자식 훅들에게 매핑하여 하나의 통합 API 형태로 반환한다.
 * 
 * [책임이 아닌 것 - NON-RESPONSIBILITY]
 * - 실제 UI 말풍선 컴포넌트 마운트 및 렌더링 (AIChatList가 전담).
 * - 에디터 블록 직접 삭제 또는 수정 명령 실행 (useAIResponseHandler가 전담).
 * 
 * [절대 깨면 안 되는 계약 - CONTRACT]
 * - INVARIANT: 메시지 리스트 갱신 함수들이 스토어 참조를 잃어 대화 버퍼가 꼬이지 않도록,
 *   반드시 Zustand 스토어 세터(`setMessages`, `setStreamingText`) 레퍼런스를 하위 자식 훅 생성자(factory)에 안전하게 이식해 보존할 것.
 
 * [소비처 - CONSUMERS / USAGE CONTEXT]
 * - 소비처 A (src/renderer/App.tsx): 최상위 Facade 구조에 통합 마운트.
 * - 소비처 B (src/renderer/contexts/AppContext.tsx): 리액트 Context 훅 목록에 바인딩되어 하위 뷰에 전파.
 */

/* 
 * [IMPORT SEGMENTATION & CONTRACTS]
 * - useAILogStore: 메시지 배열(messages) 및 실시간 타이핑 버퍼 보존 전역 스토어.
 * - useAIState: 생성 상태 락(isGenerating) 해제 제어용 전역 스토어.
 */
import { useAILogStore } from '../../stores/useAILogStore'
import { useAIState } from '../../stores/useAIState'

/* 
 * [MODULIZED CORE ACTIONS]
 * - useAddMessages: 유저 인풋 말풍선과 어시스턴트 말풍선을 원자적(atomic)으로 동시 추가하는 훅.
 * - useFinalizeMessage: 추론 생성 완료 통보를 수신하여 최종 Answer와 Reasoning Trace를 패치해 락을 푸는 훅.
 * - useUpdateDiffState: 에디터 수정 제안(수락/거절) 시 메시지 카드 내의 Diff UI 상태 지표 변경 훅.
 * - useUpdateInsertStatus: 에디터 문단 삽입 제안(수락/거절) 시 메시지 카드 내의 삽입 UI 상태 지표 변경 훅.
 */
import { useAddMessages } from './message-state/useAddMessages'
import { useFinalizeMessage } from './message-state/useFinalizeMessage'
import { useUpdateDiffState } from './message-state/useUpdateDiffState'
import { useUpdateInsertStatus } from './message-state/useUpdateInsertStatus'

/**
 * @hook useAIMessageState
 * @description 에이전트 대화 메시지 상태의 제반 조작 콜백들을 취합 제공하는 파사드 훅.
 */
export function useAIMessageState() {
  /*
   * [ZUSTAND LOG STORE SUBSCRIPTIONS]
   * - messages: 현재 세션 활성 메시지 배열.
   * - setMessages: 메시지 갱신 액션 세터.
   * - setStreamingText: 누적 텍스트 갱신 액션 세터.
   */
  const { messages, setMessages, setStreamingText } = useAILogStore()
  
  /*
   * [ZUSTAND AI STATE SUBSCRIPTION]
   * - setIsGenerating: 추론 생성 락 갱신 세터.
   */
  const { setIsGenerating } = useAIState()

  /*
   * [SUB-HOOKS INSTANTIATION & CONTRACTS]
   * - Rationale: 각 액션 훅들에 전역 상태 세터 함수 레퍼런스를 인자로 공급하여 결합을 보장한다.
   */
  const addUserAndAssistantMessages = useAddMessages(setMessages)
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `finalizeAssistantMessage`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const finalizeAssistantMessage = ...` 형태로 안전 캐싱 후 가공 기동.
       */
  const finalizeAssistantMessage = useFinalizeMessage(setMessages, setStreamingText, setIsGenerating)
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `updateMessageDiffState`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const updateMessageDiffState = ...` 형태로 안전 캐싱 후 가공 기동.
       */
  const updateMessageDiffState = useUpdateDiffState(setMessages)
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `updateInsertSuggestionStatus`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const updateInsertSuggestionStatus = ...` 형태로 안전 캐싱 후 가공 기동.
       */
  const updateInsertSuggestionStatus = useUpdateInsertStatus(setMessages)

  return {
    messages,
    addUserAndAssistantMessages,
    finalizeAssistantMessage,
    updateMessageDiffState,
    updateInsertSuggestionStatus
  }
}

/**
 * ============================================================================
 * FUTURE DEVELOPMENT GUIDE (AI Agent Instruction Layer)
 * ============================================================================
 * 1. 챗 메시지에 신규 속성(예: 사용자 피드백 별점, 읽음 시간 등) 업데이트 함수가 추가될 때:
 *    - 본 파일 useAIMessageState.ts에 구현하지 말 것.
 *    - `src/renderer/hooks/ai/message-state/` 하위에 전용 조작 훅 모듈을 신설한 뒤,
 *      이 파사드의 리턴 항목에 바인딩하여 노출할 것.
 * ============================================================================
 */

