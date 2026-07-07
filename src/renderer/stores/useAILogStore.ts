import { create } from 'zustand';
import { AI_TERMINAL_CONSTANTS } from '../features/ai-terminal/constants';
import type { AIMessage } from '../types/aiTypes';

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

  // 내부 용어: 다중 클라이언트 브로드캐스트 로그 처리용
  _flushExternalLogs: (logs: string[]) => void;
}

// ----------------------------------------------------------------------------
// [버퍼링(Buffering) & BroadcastChannel 인프라]
// React 렌더링 및 Zustand 상태 업데이트를 우회하여 
// 로그를 메모리에 임시 적재한 뒤 Batch Update를 수행합니다.
// ----------------------------------------------------------------------------
let pendingSensorLogs: string[] = [];
let flushTimeout: NodeJS.Timeout | null = null;
let broadcastChannel: BroadcastChannel | null = null;

if (typeof window !== 'undefined' && window.BroadcastChannel) {
  broadcastChannel = new BroadcastChannel('ameva-sensor-logs-channel');
  
  // 다른 클라이언트(브라우저 탭, 창)에서 보낸 로그를 수신
  // Yjs(CRDT)를 거치지 않으므로 히스토리가 팽창(메모리 릭)하지 않습니다.
  broadcastChannel.onmessage = (event) => {
    if (event.data && event.data.type === 'new-logs') {
      const logs = event.data.logs as string[];
      // 외부 로그는 다시 브로드캐스트하지 않고 로컬 상태에만 합칩니다 (무한 루프 방지).
      useAILogStore.getState()._flushExternalLogs(logs);
    }
  };
}
// ----------------------------------------------------------------------------

export const useAILogStore = create<AILogState>((set) => ({
  sensorLogs: [],
  
  _flushExternalLogs: (logs: string[]) => {
    set((state) => {
      let newLogs = [...state.sensorLogs, ...logs];
      if (newLogs.length > AI_TERMINAL_CONSTANTS.MAX_LOG_BUFFER) {
        newLogs = newLogs.slice(newLogs.length - AI_TERMINAL_CONSTANTS.MAX_LOG_BUFFER);
      }
      return { sensorLogs: newLogs };
    });
  },

  addSensorLog: (log: string) => {
    pendingSensorLogs.push(log);
    
    // 이미 타이머가 예약되어 있다면 반환
    if (flushTimeout) return;
    
    // Batch Update: SENSOR_POLLING_RATE_MS 간격으로 한 번에 상태를 업데이트합니다.
    flushTimeout = setTimeout(() => {
      const logsToFlush = [...pendingSensorLogs];
      pendingSensorLogs = [];
      flushTimeout = null;

      // Broadcast 전송 (내가 발생시킨 로그만 전파)
      if (broadcastChannel) {
        broadcastChannel.postMessage({ type: 'new-logs', logs: logsToFlush });
      }

      // Zustand 상태 일괄 업데이트
      set((state) => {
        let newLogs = [...state.sensorLogs, ...logsToFlush];
        // 링 버퍼 패턴 (Ring Buffer): 가장 오래된 로그부터 자동 폐기
        if (newLogs.length > AI_TERMINAL_CONSTANTS.MAX_LOG_BUFFER) {
          newLogs = newLogs.slice(newLogs.length - AI_TERMINAL_CONSTANTS.MAX_LOG_BUFFER);
        }
        return { sensorLogs: newLogs };
      });
    }, AI_TERMINAL_CONSTANTS.SENSOR_POLLING_RATE_MS || 100);
  },
  
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
