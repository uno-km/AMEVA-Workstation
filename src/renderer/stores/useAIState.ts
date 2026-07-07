import { create } from 'zustand';
import type { AISettings } from '../hooks/useAI'; // (추후 타입 정의 파일로 이동 예정)
import { AI_TERMINAL_CONSTANTS } from '../features/ai-terminal/constants';

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
  pendingQueue: Array<any>;
  setPendingQueue: (queue: Array<any> | ((prev: Array<any>) => Array<any>)) => void;
  removeFromQueue: (id: string) => void;
}

const DEFAULT_SETTINGS: AISettings = {
  modelPath: 'C:\\ameva\\models\\llm\\qwen2.5-3b-instruct-q4_k_m.gguf',
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
사용자가 치즈 보관 방법에 대해 요청했다. 문서가 비어있으므로 afterBlockId=START, type=heading, level=1이 적합하다.
</think>

# 절대 금지 사항
- JavaScript/Python/코드 예시를 답변에 포함하지 마십시오. 절대 금지.`,
  apiType: 'local',
};

// 로컬 스토리지에서 초기 설정을 불러오는 유틸리티 함수
const loadInitialSettings = (): AISettings => {
  try {
    const saved = localStorage.getItem('ameva_ai_settings');
    if (saved) {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
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
    const updated = { ...state.settings, ...newSettings };
    // 상태 변경 시 자동으로 로컬 스토리지에 동기화합니다.
    localStorage.setItem('ameva_ai_settings', JSON.stringify(updated));
    return { settings: updated };
  }),

  isAvailable: false,
  setIsAvailable: (isAvailable) => set({ isAvailable }),

  models: [],
  setModels: (models) => set({ models }),

  codeModels: [],
  setCodeModels: (codeModels) => set({ codeModels }),

  pendingQueue: [],
  setPendingQueue: (updater) => set((state) => ({
    pendingQueue: typeof updater === 'function' ? updater(state.pendingQueue) : updater,
  })),
  removeFromQueue: (id) => set((state) => ({
    pendingQueue: state.pendingQueue.filter(item => item.id !== id),
  })),
}));
