import { useCallback, useRef } from 'react';
import { useAIState } from '../stores/useAIState';
import { useAILogStore } from '../stores/useAILogStore';

/**
 * useLocalAIEngine
 * 로컬 llama-cli / llama.cpp 프로세스의 기동, 중단, 상태 확인을 전담하는 훅입니다.
 */
export function useLocalAIEngine() {
  const { isAvailable, setIsAvailable, models, setModels, codeModels, setCodeModels, settings } = useAIState();
  const { addSensorLog } = useAILogStore();

  const loadModels = useCallback(async (type: 'chat' | 'code' = 'chat') => {
    if (!window.electronAPI) return;
    try {
      const list = await window.electronAPI.llmListModels(type);
      if (type === 'chat') {
        setModels(list);
      } else {
        setCodeModels(list);
      }
    } catch (e: any) {
      console.error('모델 목록 로드 실패:', e);
      // 에러를 UI로 던지지 않고 로그만 남기는 경우 의도적임을 명시 (폴백/초기화 시도 중이므로 치명적이지 않음)
    }
  }, [setModels, setCodeModels]);

  const checkIsAvailable = useCallback(async () => {
    if (!window.electronAPI) {
      setIsAvailable(false);
      return;
    }
    
    try {
      if (window.electronAPI.llmCheckHealth) {
        const res = await window.electronAPI.llmCheckHealth();
        if (res && res.status === 'ready') {
          setIsAvailable(true);
        } else {
          setIsAvailable(false);
        }
      }
    } catch (e: any) {
      console.error('가용성 체크 실패:', e);
      setIsAvailable(false);
    }
  }, [setIsAvailable]);

  const importModel = useCallback(async () => {
    if (!window.electronAPI) return;
    try {
      const filePaths = await window.electronAPI.selectLocalFile([
        { name: 'GGUF Models', extensions: ['gguf', 'bin'] },
        { name: 'All Files', extensions: ['*'] }
      ]);
      if (filePaths && filePaths.length > 0) {
        const sourcePath = filePaths[0];
        const res = await window.electronAPI.llmImportModel(sourcePath);
        if (res.success) {
          await loadModels('chat');
          await loadModels('code');
          return true;
        } else {
          console.error('모델 임포트 실패:', res.error);
          return false;
        }
      }
    } catch (error: any) {
      console.error('모델 파일 선택 중 오류:', error);
      throw error; // Rethrow to UI
    }
    return false;
  }, [loadModels]);

  const startEngine = useCallback(async () => {
    if (!window.electronAPI) return;
    if (!settings.modelPath) {
      addSensorLog('[Error] 모델 경로가 설정되지 않았습니다.');
      return;
    }

    try {
      addSensorLog('[System] 로컬 AI 엔진(llama-cli)을 시작합니다...');
      const res = await window.electronAPI.llmStart(settings.modelPath);
      if (res.success) {
        addSensorLog('[System] 엔진이 성공적으로 시작되었습니다.');
        setIsAvailable(true);
      } else {
        addSensorLog(`[Error] 엔진 시작 실패: ${res.error}`);
        setIsAvailable(false);
      }
    } catch (e: any) {
      console.error('엔진 시작 중 오류:', e);
      addSensorLog(`[Error] 엔진 시작 중 예외 발생: ${e.message}`);
      setIsAvailable(false);
      throw e; // 치명적인 엔진 시작 실패는 에러를 위로 전파
    }
  }, [settings.modelPath, addSensorLog, setIsAvailable]);

  const stopEngine = useCallback(async () => {
    if (!window.electronAPI) return;
    try {
      addSensorLog('[System] 엔진 정지를 요청합니다...');
      await window.electronAPI.llmStop();
      setIsAvailable(false);
      addSensorLog('[System] 엔진이 정지되었습니다.');
    } catch (e: any) {
      console.error('엔진 정지 중 오류:', e);
      addSensorLog(`[Error] 엔진 정지 중 예외 발생: ${e.message}`);
      throw e; // 정지 실패도 프로세스 좀비화를 막기 위해 에러 전파
    }
  }, [addSensorLog, setIsAvailable]);

  return {
    loadModels,
    checkIsAvailable,
    importModel,
    startEngine,
    stopEngine,
  };
}
