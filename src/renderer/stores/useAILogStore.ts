import { create } from 'zustand';
import { AI_TERMINAL_CONSTANTS } from '../features/ai-terminal/constants';
import type { AIMessage } from '../hooks/useAI'; // (추후 타입 정의 파일로 이동 예정)

export interface AILogState {
  // 1. 순수 센서 및 시스템 로그를 보관하는 링 버퍼
  sensorLogs: string[];
  addSensorLog: (log: string) => void;
  clearSensorLogs: () => void;

  // 2. AI 채팅 메시지 목록 (기존 useState 완전 대체)
  messages: AIMessage[];
  setMessages: (updater: AIMessage[] | ((prev: AIMessage[]) => AIMessage[])) => void;
  addMessage: (msg: AIMessage) => void;
  updateMessage: (id: string, updater: (msg: AIMessage) => AIMessage) => void;
  deleteMessage: (id: string) => void;
  clearMessages: () => void;

  // 3. Transient Updates (React 렌더링 우회용 최신 텍스트 조각)
  streamingText: string;
  setStreamingText: (text: string) => void;
}

export const useAILogStore = create<AILogState>((set) => ({
  sensorLogs: [],
  addSensorLog: (log: string) => set((state) => {
    const newLogs = [...state.sensorLogs, log];
    // 최대 버퍼 길이를 초과하면 가장 오래된 로그를 폐기합니다 (메모리 릭 방지).
    if (newLogs.length > AI_TERMINAL_CONSTANTS.MAX_LOG_BUFFER) {
      return { sensorLogs: newLogs.slice(newLogs.length - AI_TERMINAL_CONSTANTS.MAX_LOG_BUFFER) };
    }
    return { sensorLogs: newLogs };
  }),
  clearSensorLogs: () => set({ sensorLogs: [] }),

  messages: [],
  setMessages: (updater) => set((state) => ({
    messages: typeof updater === 'function' ? updater(state.messages) : updater,
  })),
  addMessage: (msg) => set((state) => ({ messages: [...state.messages, msg] })),
  updateMessage: (id, updater) => set((state) => ({
    messages: state.messages.map((m) => (m.id === id ? updater(m) : m)),
  })),
  deleteMessage: (id) => set((state) => ({
    messages: state.messages.filter((m) => m.id !== id),
  })),
  clearMessages: () => set({ messages: [] }),

  streamingText: '',
  setStreamingText: (text: string) => set({ streamingText: text }),
}));
