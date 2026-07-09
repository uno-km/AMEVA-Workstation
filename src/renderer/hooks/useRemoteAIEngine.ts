/**
 * @file useRemoteAIEngine.ts
 * @system AMEVA OS Desktop Workstation - Client Renderer
 * @location src/renderer/hooks/useRemoteAIEngine.ts
 * @role Remote AI Cloud API & Local Ollama endpoint health monitoring Hook
 * 
 * [책임 범위 - RESPONSIBILITY]
 * - 원격 AI 클라우드 제공사(Gemini, Claude, GPT) 및 로컬 포트 Ollama 서버의 접속 가용 상태를 검사(`checkRemoteHealth`)한다.
 * - Ollama 서버의 가용성을 진단하기 위해 로컬 엔드포인트 `/api/tags`로 1500ms 타임아웃 HTTP GET 검사를 가동한다.
 * - 비로컬 타입(api, ollama, wasm)인 경우, 4초 주기 헬스 체크 폴링을 가동하여 가용 플래그(`isAvailable`) 상태를 실시간 동기화한다.
 * 
 * [책임이 아닌 것 - NON-RESPONSIBILITY]
 * - 네이티브 Llama CLI 바이너리 기동/정지 제어 (useLocalAIEngine의 단독 소유).
 * 
 * [절대 깨면 안 되는 계약 - CONTRACT]
 * - MUST NOT cause fetch block: Ollama fetch 진단 시 무한 대기로 렌더러가 멈추는 프리징을 차단하기 위해,
 *   반드시 `AbortSignal.timeout(1500)` 가드 계약을 보존하여 1.5초 이내에 강제 실패 처리할 것.
 * - MUST: 훅 해제 시 4초 주기 인터벌 타이머(`timer`)를 완벽하게 `clearInterval` 하여 렌더러의 메모리 누수를 철저히 차단할 것.
 */

/* 
 * [IMPORT SEGMENTATION & CONTRACTS]
 * - useCallback: 원격 헬스 체크 콜백 메모이즈를 위한 리액트 기본 훅.
 * - useEffect: 4초 주기 폴링 스케줄링 가동 및 클린업을 위한 리액트 훅.
 */
import { useCallback, useEffect } from 'react';

/* 
 * [ZUSTAND STORE]
 * - useAIState: AI 설정 상태 정보 및 가용 여부 플래그 액션 세터.
 */
import { useAIState } from '../stores/useAIState';

/**
 * @hook useRemoteAIEngine
 * @description 원격 모델 및 Ollama 엔드포인트의 네트워크 생존 상태를 확인하고 관리하는 훅.
 */
export function useRemoteAIEngine() {
  /*
   * [ZUSTAND STORE SELECTORS]
   * - settings: API 키, 주소 정보 등을 담고 있는 전역 속성.
   * - setIsAvailable: AI 엔진 정상 가동 여부 플래그 세터.
   */
  const { settings, setIsAvailable } = useAIState();

  /**
   * [CONTRACT - Remote Server Connection Health Check]
   * - Rationale: API 타입별로 분류하여 상태를 판별한다. Ollama의 경우 실제 fetch 핑 테스트를 가동한다.
   */
  const checkRemoteHealth = useCallback(async () => {
    // 런타임에 유효한 apiType 획득 (디폴트는 local)
    const type = settings.apiType || 'local';

    // 1. 외부 클라우드 API (Gemini/Claude 등)
    if (type === 'api') {
      // Rationale: API 호출은 외부 인터넷 환경이므로 사전에 검사하지 않고 가용하다고 보며, 실제 추론 실패 시 catch로 처리함
      setIsAvailable(true);
      return;
    }

    // 2. 로컬에 켜진 Ollama 서버
    if (type === 'ollama') {
      try {
        const ollamaUrl = settings.apiEndpoint || 'http://localhost:11434';
        
        // CONTRACT: 1.5초 타임아웃 제한 fetch 검사 가동
        const res = await fetch(`${ollamaUrl}/api/tags`, { 
          method: 'GET', 
          signal: AbortSignal.timeout(1500) 
        });
        setIsAvailable(res.ok);
      } catch {
        // 접속 에러 또는 타임아웃 발생 시 즉시 불가 처리
        setIsAvailable(false);
      }
      return;
    }

    // 3. 브라우저 WebGPU 내장 WASM 엔진
    if (type === 'wasm') {
      setIsAvailable(true);
      return;
    }
  }, [settings.apiType, settings.apiEndpoint, setIsAvailable]);

  /**
   * [SIDE EFFECT - 4s Health Check Polling]
   * - Rationale: 로컬 파일 구동 모드가 아닌 경우, 네트워크 변경에 민감히 대처하기 위해 4초 주기 헬스 체크를 실행한다.
   */
  useEffect(() => {
    const type = settings.apiType;
    // local 타입일 경우 useLocalAIEngine 측에서 3초 주기로 따로 점검하므로 즉시 탈출
    if (type === 'local' || !type) return;

    // 최초 1회 Ping 테스트 구동
    checkRemoteHealth();
    
    // 4초 타이머 가동
    const timer = setInterval(checkRemoteHealth, 4000);
    
    // CONTRACT: 메모리 누수 차단 타이머 클린업 계약 이행
    return () => clearInterval(timer);
  }, [settings.apiType, checkRemoteHealth]);

  return {
    checkRemoteHealth
  };
}

/**
 * ============================================================================
 * FUTURE DEVELOPMENT GUIDE (AI Agent Instruction Layer)
 * ============================================================================
 * 1. 신규 원격 API 제공사(예: DeepSeek 등)의 독자적 헬스 체크가 필요할 때:
 *    - `checkRemoteHealth` 내부 분기 노드에 해당 서버의 핑 엔드포인트 패치 로직을 확장할 것.
 * ============================================================================
 */
