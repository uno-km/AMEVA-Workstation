/**
 * @file useAIState.ts
 * @system AMEVA OS Desktop Workstation
 * @location src/renderer/stores/useAIState.ts
 * @role Core module helper and integration logic
 * 
 * [소비처 - CONSUMERS / USAGE CONTEXT]
 * - 소비처 A (src/renderer/hooks/): 도메인 훅 내부에서 상태 값 바인딩 및 변경 액션 호출 시 소비.
 * - 소비처 B (src/renderer/components/): 컴포넌트 내 렌더 조건 판단을 위해 실시간 구독(Subscribe) 소비.
 * 
 * [책임 범위 - RESPONSIBILITY]
 * - 본 파일은 AMEVA 시스템 내에서 도메인 목적에 부합하는 연산 및 데이터 처리 흐름을 안전하게 캡슐화한다.
 * - 외부 라이브러리 및 하위 종속성을 조율하고 결과 규격을 일관되게 제공한다.
 * 
 * [절대 깨면 안 되는 계약 - CONTRACT]
 * - MUST: 모든 예외 발생 시 에러를 침묵시키지 말고 에러 로그를 명확하게 남길 것.
 * - MUST NOT: TypeScript any 형식을 우회 수단으로 함부로 선언하지 말 것.
 */

import { create } from 'zustand';
import type { AISettings } from '../types/aiTypes';
import type { AgentPhase, TaskPlan } from '../services/ai/orchestrator/types';
import { AI_TERMINAL_CONSTANTS } from '../features/ai-terminal/constants';
import type { RecoveryState, RecoveryReason, InferencePhase } from '../services/ai/orchestrator/recovery/types';

export interface AIState {
  // 1. 전역 생성 상태
  isGenerating: boolean;
  setIsGenerating: (isGenerating: boolean) => void;

  // 2. AI 환경 설정 (로컬 스토리지 연동)
  settings: AISettings;
  updateSettings: (newSettings: Partial<AISettings>) => void;

  // 3. 모델 가용성 및 목록 상태
  isAvailable: boolean;
  setIsAvailable: (isAvailable: boolean) => void;

  models: { name: string; filename: string; path: string; size: number }[];
  setModels: (models: { name: string; filename: string; path: string; size: number }[]) => void;

  codeModels: { name: string; filename: string; path: string; size: number }[];
  setCodeModels: (codeModels: { name: string; filename: string; path: string; size: number }[]) => void;

  // 4. 비동기 작업 큐 (AgentEngine 관련)
  pendingQueue: Array<unknown>;
  setPendingQueue: (queue: Array<unknown>) => void;
  addPendingQueue: (item: unknown) => void;
  clearPendingQueue: () => void;
  removeFromQueue: (id: string) => void;

  // 5. 오케스트레이터 에이전트 실시간 상태 슬라이스
  //    Zustand Slice 패턴(AGENTS.md 규칙 3) 준수 - God Store 방지를 위해 별도 슬라이스로 격리.
  /**
   * agentPhase: 현재 에이전트 실행 단계.
   * - 예상 값: 'idle' | 'thinking' | 'tool_calling' | 'observing' | 'answering' | 'done' | 'error'
   * - 소비처: AgentThoughtBubble.tsx (UI 단계 배지 렌더링), useAIAgentMode.ts (루프 제어)
   */
  agentPhase: AgentPhase;
  setAgentPhase: (phase: AgentPhase) => void;

  /**
   * agentThoughts: 현재 에이전트의 혼잣말(<thought>) 텍스트 누적 배열.
   * - 예상 값: 각 청크 문자열의 배열. 초기값: [].
   * - 소비처: AgentThoughtBubble.tsx (아코디언 내부 혼잣말 텍스트 표시)
   */
  agentThoughts: string[];
  appendAgentThought: (thought: string) => void;
  clearAgentThoughts: () => void;

  /**
   * agentTaskPlan: 에이전트가 수립한 Task Plan 체크리스트.
   * - 예상 값: TaskPlan 객체 또는 null (Plan 없는 단순 요청의 경우).
   * - 소비처: AgentTaskChecklist.tsx (체크리스트 UI 렌더링)
   */
  agentTaskPlan: TaskPlan | null;
  setAgentTaskPlan: (plan: TaskPlan | null) => void;
  updateAgentTaskStepStatus: (stepId: number, status: TaskPlan['steps'][number]['status']) => void;

  /** 신규 Task Runtime 실시간 진행률 (%) */
  taskProgress: number;
  setTaskProgress: (progress: number) => void;

  /** 에이전트 Task Plan UI의 접힘(Collapsed) 상태 */
  agentTaskPlanCollapsed: boolean;
  setAgentTaskPlanCollapsed: (collapsed: boolean) => void;

  /** persistent reasoning logs를 위한 디버그 모드 (Issue 8) */
  agentDebugMode: boolean;
  setAgentDebugMode: (debugMode: boolean) => void;

  /** 최종 작성된 미션 성적 보고서 마크다운 */
  finalReport: string | null;
  setFinalReport: (report: string | null) => void;

  /**
   * agentCurrentToolName: 현재 실행 중인 도구 명칭.
   * - 예상 값: 도구 명칭 문자열 또는 null (도구 미실행 상태).
   * - 소비처: AgentThoughtBubble.tsx ('Working...' 상태에서 도구명 표시)
   */
  agentCurrentToolName: string | null;
  setAgentCurrentToolName: (name: string | null) => void;

  /**
   * agentAccumulatedAnswer: 스트리밍 중 누적된 최종 답변 텍스트.
   * - 예상 값: 빈 문자열(초기) 또는 누적 답변 텍스트.
   * - 소비처: AgentThoughtBubble.tsx (Done 상태 답변 표시)
   */
  agentAccumulatedAnswer: string;
  setAgentAccumulatedAnswer: (answer: string) => void;

  // 6. Recovery-First 자가회복 모듈용 상태 슬라이스
  recoveryState: RecoveryState;
  setRecoveryState: (state: RecoveryState) => void;

  recoveryReason: RecoveryReason | null;
  setRecoveryReason: (reason: RecoveryReason | null) => void;

  recoveryElapsed: number;
  setRecoveryElapsed: (elapsed: number) => void;

  inferencePhase: InferencePhase;
  setInferencePhase: (phase: InferencePhase) => void;

  resumeFromCheckpoint: (() => Promise<void>) | null;
  setResumeFromCheckpoint: (callback: (() => Promise<void>) | null) => void;

  // ── 플랜 승인/리뷰 대기 상태 슬라이스 ──
  planApprovalState: 'idle' | 'pending' | 'approved' | 'rejected';
  setPlanApprovalState: (state: 'idle' | 'pending' | 'approved' | 'rejected') => void;
  resolvePlanApproval: ((value: { approved: boolean; feedback?: string }) => void) | null;
  setResolvePlanApproval: (resolve: ((value: { approved: boolean; feedback?: string }) => void) | null) => void;

  /** 오케스트레이터 상태 전체 초기화 (새 세션 시작 시 사용) */
  resetAgentState: () => void;
}

const DEFAULT_SETTINGS: AISettings = {
  modelPath: 'C:\\ameva\\models\\llm\\Qwen2.5-7B-Instruct-Q4_K_M.gguf',
  codeModelPath: '',
  temperature: AI_TERMINAL_CONSTANTS.DEFAULT_TEMPERATURE,
  maxTokens: AI_TERMINAL_CONSTANTS.DEFAULT_MAX_TOKENS,
  systemPrompt: `당신은 AMEVA 문서 에디터에 내장된 AI 문서 편집 어시스턴트입니다.
사용자의 문서를 직접 읽고, 분석하고, 수정하거나 새로운 내용을 삽입하는 것이 당신의 주 역할입니다.

# CoT 사고 과정 지침
답변하기 전에 반드시 <think>...</think> 태그 안에 한국어로 사고 과정을 작성하십시오.
- 사용자의 요청을 분석하고
- 문서 구조(블록 목록)를 검토하며
- 어떤 액션(WRITE/EDIT/CHAT)이 적합할지 판단하고
- 삽입 위치나 수정 대상 블록을 결정하는 이유를 설명하십시오.
예시:
<think>
사용자가 [요청 주제]에 대해 작성/수정을 요청했다. 문서 상태가 [비어있음/내용있음]이므로 afterBlockId=[블록ID], type=[블록타입]이 적합하다.
</think>

# 절대 금지 사항
- JavaScript/Python/코드 예시를 답변에 포함하지 마십시오. 절대 금지.`,
  apiType: 'local',
};

const loadInitialSettings = (): AISettings => {
  try {
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem('ameva_ai_settings') || localStorage.getItem('ai-settings');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.systemPrompt && (
          parsed.systemPrompt.includes('치즈') ||
          parsed.systemPrompt.includes('간결하고 명확하게 답하세요') ||
          !parsed.systemPrompt.includes('CoT 사고 과정 지침')
        )) {
          parsed.systemPrompt = DEFAULT_SETTINGS.systemPrompt;
          localStorage.setItem('ameva_ai_settings', JSON.stringify(parsed));
          localStorage.setItem('ai-settings', JSON.stringify(parsed));
        }
        return { ...DEFAULT_SETTINGS, ...parsed };
      }
    }
  } catch (e) {
    console.error('설정 로드 실패:', e);
  }
  return DEFAULT_SETTINGS;
};

export const useAIState = create<AIState>((set) => ({
  isGenerating: false,
  setIsGenerating: (isGenerating) => set({ isGenerating }),

  settings: loadInitialSettings(),
  updateSettings: (newSettings) => set((state) => {
    const isDifferent = (Object.keys(newSettings) as Array<keyof AISettings>).some(
      (key) => state.settings[key] !== newSettings[key]
    )
    if (!isDifferent) return state
    const updated = { ...state.settings, ...newSettings };
    localStorage.setItem('ameva_ai_settings', JSON.stringify(updated));
    return { settings: updated };
  }),

  isAvailable: false,
  setIsAvailable: (isAvailable) => set((state) => {
    if (state.isAvailable === isAvailable) return state;
    return { isAvailable };
  }),

  models: [],
  setModels: (models) => set({ models }),

  codeModels: [],
  setCodeModels: (codeModels) => set({ codeModels }),

  pendingQueue: [],
  setPendingQueue: (queue) => set({ pendingQueue: queue }),
  addPendingQueue: (item) => set((state) => ({ pendingQueue: [...state.pendingQueue, item] })),
  clearPendingQueue: () => set({ pendingQueue: [] }),
  removeFromQueue: (id) => set((state) => ({
    pendingQueue: state.pendingQueue.filter(
      (item) => (item as Record<string, unknown>)['id'] !== id
    ),
  })),

  // ── Orchestrator Agent State Slice ──────────────────────────────
  /*
   * [AGENT PHASE SLICE]
   * - 에이전트 단계 상태를 실시간 구독하는 슬라이스.
   * - AgentThoughtBubble.tsx가 이 값을 구독하여 Thinking/Working/Done UI를 전환한다.
   */
  agentPhase: 'idle',
  setAgentPhase: (agentPhase) => set({ agentPhase }),

  agentThoughts: [],
  appendAgentThought: (thought) => set((state) => ({
    agentThoughts: [...state.agentThoughts, thought]
  })),
  clearAgentThoughts: () => set({ agentThoughts: [] }),

  agentTaskPlan: null,
  setAgentTaskPlan: (agentTaskPlan) => set({ agentTaskPlan }),
  updateAgentTaskStepStatus: (stepId, status) => set((state) => {
    if (!state.agentTaskPlan) return state;
    return {
      agentTaskPlan: {
        ...state.agentTaskPlan,
        steps: state.agentTaskPlan.steps.map((step) =>
          step.id === stepId ? { ...step, status } : step
        )
      }
    };
  }),

  taskProgress: 0,
  setTaskProgress: (progress) => set({ taskProgress: progress }),

  agentTaskPlanCollapsed: false,
  setAgentTaskPlanCollapsed: (collapsed) => set({ agentTaskPlanCollapsed: collapsed }),

  agentDebugMode: false,
  setAgentDebugMode: (debugMode) => set({ agentDebugMode: debugMode }),

  finalReport: null,
  setFinalReport: (finalReport) => set({ finalReport }),

  agentCurrentToolName: null,
  setAgentCurrentToolName: (agentCurrentToolName) => set({ agentCurrentToolName }),

  agentAccumulatedAnswer: '',
  setAgentAccumulatedAnswer: (agentAccumulatedAnswer) => set({ agentAccumulatedAnswer }),

  recoveryState: 'normal',
  setRecoveryState: (recoveryState) => set({ recoveryState }),

  recoveryReason: null,
  setRecoveryReason: (recoveryReason) => set({ recoveryReason }),

  recoveryElapsed: 0,
  setRecoveryElapsed: (recoveryElapsed) => set({ recoveryElapsed }),

  inferencePhase: 'Planning',
  setInferencePhase: (inferencePhase) => set({ inferencePhase }),

  resumeFromCheckpoint: null,
  setResumeFromCheckpoint: (resumeFromCheckpoint) => set({ resumeFromCheckpoint }),

  planApprovalState: 'idle',
  setPlanApprovalState: (planApprovalState) => set({ planApprovalState }),
  resolvePlanApproval: null,
  setResolvePlanApproval: (resolvePlanApproval) => set({ resolvePlanApproval }),

  resetAgentState: () => set({
    agentPhase: 'idle',
    agentThoughts: [],
    agentTaskPlan: null,
    taskProgress: 0,
    agentTaskPlanCollapsed: false,
    finalReport: null,
    agentCurrentToolName: null,
    agentAccumulatedAnswer: '',
    recoveryState: 'normal',
    recoveryReason: null,
    recoveryElapsed: 0,
    inferencePhase: 'Planning',
    resumeFromCheckpoint: null,
    planApprovalState: 'idle',
    resolvePlanApproval: null
  })
}));


