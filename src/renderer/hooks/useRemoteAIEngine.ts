import { useCallback, useEffect } from 'react';
import { useAIState } from '../stores/useAIState';

/**
 * useRemoteAIEngine
 * 원격 API (OpenAI 호환, Claude, Ollama 등)의 연결 상태 검증 및 폴링을 담당하는 훅.
 */
export function useRemoteAIEngine() {
  const { settings, setIsAvailable } = useAIState();

  const checkRemoteHealth = useCallback(async () => {
    const type = settings.apiType || 'local';

    if (type === 'api') {
      // API 모드일 경우 즉각적으로 가용하다고 간주합니다. 
      // (토큰 기반이거나 외부망 연결이므로 사전 ping을 생략하고 실제 호출 시 에러 처리)
      setIsAvailable(true);
      return;
    }

    if (type === 'ollama') {
      try {
        const ollamaUrl = settings.apiEndpoint || 'http://localhost:11434';
        const res = await fetch(`${ollamaUrl}/api/tags`, { 
          method: 'GET', 
          signal: AbortSignal.timeout(1500) 
        });
        setIsAvailable(res.ok);
      } catch {
        setIsAvailable(false);
      }
      return;
    }

    if (type === 'wasm') {
      setIsAvailable(true);
      return;
    }
  }, [settings.apiType, settings.apiEndpoint, setIsAvailable]);

  // 원격 엔진 폴링 루프 설정
  useEffect(() => {
    const type = settings.apiType;
    if (type === 'local' || !type) return;

    checkRemoteHealth(); // 최초 1회 실행
    const timer = setInterval(checkRemoteHealth, 4000); // 4초마다
    
    return () => clearInterval(timer);
  }, [settings.apiType, checkRemoteHealth]);

  return {
    checkRemoteHealth
  };
}
