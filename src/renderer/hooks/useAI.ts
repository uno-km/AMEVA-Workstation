import { useAIState } from '../stores/useAIState';
import { useAILogStore } from '../stores/useAILogStore';
import { useLocalAIEngine } from './useLocalAIEngine';
import { useRemoteAIEngine } from './useRemoteAIEngine';
import { useAIAgent } from './useAIAgent';
import type { AISettings } from '../types/aiTypes';

/**
 * useAI (Orchestrator Facade)
 * 이 훅은 더 이상 무거운 로직을 직접 처리하지 않습니다. (Solve et Coagula 패턴)
 * 내부적으로 `useLocalAIEngine`, `useAIAgent`, 그리고 `Zustand` 스토어들을 조합하여
 * UI 컴포넌트(AIPanel 등)에 필요한 모든 인터페이스를 단일 진입점으로 제공합니다.
 */
export function useAI() {
  // 1. 상태 스토어 구독
  const { messages, setMessages } = useAILogStore();
  const { 
    isGenerating, 
    isAvailable, 
    models, 
    codeModels,
    settings, 
    setSettings, 
    engineStatus, 
    setEngineStatus,
    removeFromQueue
  } = useAIState();

  // 2. 도메인별 분리된 훅 호출
  const localEngine = useLocalAIEngine();
  const remoteEngine = useRemoteAIEngine();
  const agent = useAIAgent();

  // 3. 환경 설정 업데이트 헬퍼
  const updateSettings = (newSettings: Partial<AISettings>) => {
    setSettings((prev: AISettings) => ({ ...prev, ...newSettings }));
  };

  // 4. UI를 위한 통합 객체 반환
  return {
    // 상태 (State)
    messages,
    setMessages,
    isGenerating,
    isAvailable,
    models,
    codeModels,
    settings,
    engineStatus,
    setEngineStatus,
    streamingText: agent.streamingText,
    engineLogs: agent.engineLogs,
    pendingQueue: agent.pendingQueue,
    
    // 에이전트 액션 (useAIAgent)
    setEngineLogs: agent.setEngineLogs,
    generateResponse: agent.generateResponse,
    processBlock: agent.processBlock,
    abortGeneration: agent.abortGeneration,
    clearHistory: agent.clearHistory,
    updateMessageDiffState: agent.updateMessageDiffState,
    updateInsertSuggestionStatus: agent.updateInsertSuggestionStatus,
    removeFromQueue,
    
    // 로컬 엔진 액션 (useLocalAIEngine)
    loadModels: localEngine.loadModels,
    refreshModels: () => {
      localEngine.loadModels('chat');
      localEngine.loadModels('code');
    },
    checkIsAvailable: localEngine.checkIsAvailable,
    importModel: localEngine.importModel,
    startEngine: localEngine.startEngine,
    stopEngine: localEngine.stopEngine,
    
    // 유틸
    updateSettings,
  };
}
