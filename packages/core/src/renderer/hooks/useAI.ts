/**
 * @file useAI.ts
 * @system AMEVA OS Desktop Workstation - Client Renderer
 * @location src/renderer/hooks/useAI.ts
 * @role Orchestrator Facade Hook (Facade Pattern)
 * 
 * [설계 의도 - DESIGN INTENT / ADR]
 * - 이 훅은 무거운 AI 비즈니스 로직을 직접 수행하지 않고, 도메인별로 고도로 모듈화된 다른 훅들(Solve et Coagula 패턴)을 중재한다.
 * - 로컬 모델 파일 제어 및 다운로드 처리는 `useLocalAIEngine`에 위임한다.
 * - 스트리밍 응답 가공 및 상태 보존, 에이전트 모드 컨트롤은 `useAIAgent`에 위임한다.
 * - 상태 보존소인 Zustand Store(`useAIState`, `useAILogStore`)를 중재(Orchestration)하여 단일 API 진입점을 제공한다.
 * 
 * [책임 범위 - RESPONSIBILITY]
 * - AI 패널 컴포넌트(AIPanel 등)가 개별 도메인 훅을 각각 구독하여 결합도가 분산되는 것을 차단하고 단일 게이트웨이 역할을 수행한다.
 * 
 * [절대 깨면 안 되는 계약 - CONTRACT]
 * - INVARIANT: `useAI`는 오케스트레이션만을 수행하므로, 본 파일 내에 직접적인 AI 메시지 파싱이나 DB 쿼리, IPC llm API를 직접 바인딩하지 말 것.
 * - MUST NOT: `useAIState`와 `useAIAgent` 간의 변수 추출 시, 중복 변수가 얽혀 경고를 생성하지 않도록 사용 범위를 사전에 격리할 것.
 
 * [소비처 - CONSUMERS / USAGE CONTEXT]
 * - 소비처 A (src/renderer/App.tsx): 최상위 Facade 구조에 통합 마운트.
 * - 소비처 B (src/renderer/contexts/AppContext.tsx): 리액트 Context 훅 목록에 바인딩되어 하위 뷰에 전파.
 */

/* 
 * [IMPORT SEGMENTATION & CONTRACTS]
 * - useAIState: 로컬/원격 LLM 가동 여부, 활성 모델명, 파라미터 설정을 담는 Zustand 전역 스토어.
 * - useAILogStore: 에이전트 챗팅 대화 기록(messages) 및 실시간 토큰 텍스트 보존 Zustand 전역 스토어.
 */
import { useAIState } from '../stores/useAIState';
import { useAILogStore } from '../stores/useAILogStore';

/* 
 * [DEPENDENT DOMAIN CONTROLLERS]
 * - useLocalAIEngine: Llama.cpp 및 WebGPU WASM 엔진 기동/로드 저수준 API 커넥터.
 * - useAIAgent: LLM 토큰 처리기, 큐 스케줄러, 에디터 패치 연동을 조율하는 AI 라이프사이클 핵심 훅.
 */
import { useLocalAIEngine } from './useLocalAIEngine';
import { useAIAgent } from './useAIAgent';

/**
 * @hook useAI
 * @description Local Engine과 Agent Flow를 결합하여 AI 관련 모든 제어 상태와 액션을 통합 반환하는 핵심 파사드 훅.
 */
export function useAI() {
  /*
   * [CONTRACT - Global Store Subscription]
   * - messages: 현재 활성 세션에 노출할 챗 메시지 배열.
   * - setMessages: 챗 메시지 변경용 Zustand 세터.
   */
  const { messages, setMessages } = useAILogStore();

  /*
   * [CONTRACT - Global AI State Subscription]
   * - isGenerating: 현재 LLM 연산 혹은 에이전트 챗 응답이 생성 중인지 락 플래그.
   * - isAvailable: 현재 선택된 로컬 엔진 혹은 API 공급자의 호출 가능 상태 플래그.
   * - models: 로드/다운로드 가능한 전체 채팅 모델 사양 배열.
   * - codeModels: 에디터 FIM(Fill-in-the-Middle) 코드 생성용 모델 사양 배열.
   * - settings: AI 온도, 최대 토큰 제한, API Key 등을 보존하는 전역 설정 객체.
   * - updateSettings: 전역 AI 설정 수정용 Zustand 액션 세터.
   */
  const { 
    isGenerating, 
    isAvailable, 
    models, 
    codeModels,
    settings, 
    updateSettings, 
  } = useAIState();

  /*
   * [DOWNSTREAM DEPENDENCY - Local Engine Controls]
   * - localEngine: Llama.cpp 네이티브 바이너리 파일 로드 및 가동(Start/Stop) API 제공 인스턴스.
   */
  const localEngine = useLocalAIEngine();

  /*
   * [DOWNSTREAM DEPENDENCY - AI Agent Actions]
   * - agent: LLM 스트림 토큰 처리, 비동기 스케줄러 큐 조작 및 에디터 직접 패치를 조율하는 인스턴스.
   */
  const agent = useAIAgent();

  /*
   * [CONTRACT - Composition Return Interface]
   * - AIPanel 등 하위 UI 컴포넌트들이 이 Facade 훅의 반환형만을 통해 소통할 수 있도록 일관된 구조를 반환한다.
   */
  return {
    // ── 전역 상태 데이터 (State) ──────────────────────────────────────────────
    messages,
    setMessages,
    isGenerating,
    isAvailable,
    models,
    codeModels,
    settings,
    updateSettings,
    streamingText: agent.streamingText,
    engineLogs: agent.engineLogs,
    pendingQueue: agent.pendingQueue,
    
    // ── 에이전트 라이프사이클 및 응답 제어 (useAIAgent) ─────────────────────────
    setEngineLogs: agent.setEngineLogs,
    generateResponse: agent.generateResponse,
    processBlock: agent.processBlock,
    abortGeneration: agent.abortGeneration,
    clearHistory: agent.clearHistory,
    updateMessageDiffState: agent.updateMessageDiffState,
    updateInsertSuggestionStatus: agent.updateInsertSuggestionStatus,
    removeFromQueue: agent.removeFromQueue,
    
    // ── 로컬 AI 바이너리/라이브러리 통신 액션 (useLocalAIEngine) ──────────────
    loadModels: localEngine.loadModels,
    refreshModels: () => {
      // CONTRACT: 챗용 모델과 코드 작성용 모델(FIM)을 둘 다 갱신하여 캐시 정합성을 유지한다.
      localEngine.loadModels('chat');
      localEngine.loadModels('code');
    },
    checkIsAvailable: localEngine.checkIsAvailable,
    importModel: localEngine.importModel,
    startEngine: localEngine.startEngine,
    stopEngine: localEngine.stopEngine,
  };
}

/**
 * ============================================================================
 * FUTURE DEVELOPMENT GUIDE (AI Agent Instruction Layer)
 * ============================================================================
 * 1. AI 패널 관련 신규 상태나 저수준 조작 API가 추가될 때:
 *    - 본 useAI 훅에 로직을 직접 구현하지 말고, `useAIAgent`나 `useLocalAIEngine` 같은
 *      하위 도메인 전용 훅에 먼저 구현한 후, 이 Facade의 리턴 객체에 키값으로 랩핑하여 공급할 것.
 * 
 * 2. 타입 정의 추가 위치:
 *    - `src/renderer/types/aiTypes.ts` 내부의 `AISettings` 혹은 인터페이스에 추가할 것.
 * 
 * 3. 에러 발생 시 우선 의심 포인트:
 *    - `agent.xxx`나 `localEngine.xxx` 중 하나가 undefined를 뿜는 경우,
 *      해당 훅 파일들의 리턴 형태에 변동이 생겼는지 가장 먼저 대조 점검할 것.
 * ============================================================================
 */

