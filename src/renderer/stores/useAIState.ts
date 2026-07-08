import { create } from 'zustand';
import type { AISettings } from '../types/aiTypes';
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
  setPendingQueue: (queue: Array<any>) => void;
  addPendingQueue: (item: any) => void;
  clearPendingQueue: () => void;
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
사용자가 [요청 주제]에 대해 작성/수정을 요청했다. 문서 상태가 [비어있음/내용있음]이므로 afterBlockId=[블록ID], type=[블록타입]이 적합하다.
</think>

# 절대 금지 사항
- JavaScript/Python/코드 예시를 답변에 포함하지 마십시오. 절대 금지.`,
  apiType: 'local',
};

const loadInitialSettings = (): AISettings => {
  try {
    // ameva_ai_settings와 ai-settings 두 키 모두 확인하여 마이그레이션 호환성 보장
    const saved = localStorage.getItem('ameva_ai_settings') || localStorage.getItem('ai-settings');
    if (saved) {
      const parsed = JSON.parse(saved);
      // 구버전 치즈 예시나 구버전 프롬프트가 저장되어 있는 경우 기본값으로 덮어씀
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
  setPendingQueue: (queue) => set({ pendingQueue: queue }),
  addPendingQueue: (item) => set((state) => ({ pendingQueue: [...state.pendingQueue, item] })),
  clearPendingQueue: () => set({ pendingQueue: [] }),
  removeFromQueue: (id) => set((state) => ({
    pendingQueue: state.pendingQueue.filter(item => item.id !== id),
  })),
}));
