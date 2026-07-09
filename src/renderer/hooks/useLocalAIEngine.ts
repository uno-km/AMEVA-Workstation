/**
 * @file useLocalAIEngine.ts
 * @system AMEVA OS Desktop Workstation - Client Renderer
 * @location src/renderer/hooks/useLocalAIEngine.ts
 * @role Low-level Local llama-cli & WebGPU binary lifecycle management Hook
 * 
 * [책임 범위 - RESPONSIBILITY]
 * - 로컬 바이너리(llama.cpp/llama-cli)의 가동(`startEngine`), 정지(`stopEngine`), 가용성 상태 검사(`checkIsAvailable`)를 중재한다.
 * - 신규 GGUF 모델 파일 선택 대화상자를 띄우고 디렉터리 복사 임포트(`importModel`) 프로세스를 구동한다.
 * - 로컬에 적재된 채팅 모델 및 코드 생성 FIM 모델 사양 목록을 비동기로 로드(`loadModels`)하여 Zustand Store에 반영한다.
 * - local/ollama API 타입 구동 시, 3초 주기 주기적 백그라운드 헬스체크를 가동하여 가용 상태(isAvailable)를 실시간 갱신한다.
 * 
 * [책임이 아닌 것 - NON-RESPONSIBILITY]
 * - 실제 추론 토큰 스트리밍 수신 파싱 및 챗 리스트 추가 (useAIAgent 및 useAIStreamProcessor가 소유).
 * 
 * [절대 깨면 안 되는 계약 - CONTRACT]
 * - MUST NOT swallow critical process management errors: `startEngine` 및 `stopEngine` 시 발생하는 예외는
 *   바이너리가 좀비 프로세스화되어 메모리에 남는 치명적인 버그를 유발하므로, catch 블록에서 삼키지 않고 위로 전파(Rethrow)할 것.
 * - MUST: 컴포넌트 언마운트 시 백그라운드 3초 주기의 인터벌 타이머(`interval`)를 확실하게 `clearInterval` 하여 렌더러 메모리 유실을 철저히 방지할 것.
 
 * [소비처 - CONSUMERS / USAGE CONTEXT]
 * - 소비처 A (src/renderer/App.tsx): 최상위 Facade 구조에 통합 마운트.
 * - 소비처 B (src/renderer/contexts/AppContext.tsx): 리액트 Context 훅 목록에 바인딩되어 하위 뷰에 전파.
 */

/* 
 * [IMPORT SEGMENTATION & CONTRACTS]
 * - useCallback: 로컬 엔진 제어 콜백이 하위 컴포넌트 프롭스 변경을 매번 촉발하지 않도록 메모이즈하는 기본 훅.
 * - useEffect: 3초 주기 백그라운드 헬스 체크 인터벌 구동 및 클린업 메모리 관리를 위한 리액트 훅.
 */
import { useCallback, useEffect } from 'react';

/* 
 * [ZUSTAND GLOBAL STORES]
 * - useAIState: 로컬/원격 구동 옵션, 가용 여부 플래그, 챗/코드 모델 목록을 들고 있는 전역 스토어.
 * - useAILogStore: 에이징 로그 수집 및 터미널 출력 이력 스토어.
 */
import { useAIState } from '../stores/useAIState';
import { useAILogStore } from '../stores/useAILogStore';

/* 
 * [IPC CONNECTOR BRIDGE]
 * - ipc: Electron Preload IPC 스위치를 통해 네이티브 llama CLI 시작, 정지, 헬스 체크 등을 호출하는 모듈.
 */
import * as ipc from '../services/ipc/electronApiAdapter';

/**
 * @hook useLocalAIEngine
 * @description 로컬 AI 바이너리 프로세스 및 모델 파일 바인딩 라이프사이클을 통제하는 훅.
 */
export function useLocalAIEngine() {
  /*
   * [ZUSTAND STORE ACTIONS]
   * - setIsAvailable: AI 엔진 정상 가동 여부 플래그 세터.
   * - setModels: 가용한 챗 모델 목록 갱신 세터.
   * - setCodeModels: 가용한 코드 FIM 모델 목록 갱신 세터.
   * - settings: API 주소 및 기동 모델명 등을 담은 전역 속성.
   */
  const { setIsAvailable, setModels, setCodeModels, settings } = useAIState();

  /*
   * [ZUSTAND LOG STORE ACTION]
   * - addSensorLog: 엔진 시스템 구동 상태 알림을 터미널 콘솔 로그에 푸시하는 헬퍼.
   */
  const { addSensorLog } = useAILogStore();

  /**
   * [CONTRACT - Load Models List]
   * - Rationale: 로컬 모델 폴더 내의 GGUF 목록을 긁어 렌더링 목록용으로 가공 후 Zustand 스토어에 분류 저장한다.
   */
  const loadModels = useCallback(async (type: 'chat' | 'code' = 'chat') => {
    // Electron 데스크톱 브라우징 환경 외에는 바이너리가 없으므로 실행 취소
    if (!ipc.isElectronEnv()) return;
    try {
      // IPC를 통해 대상 엔진(llm 또는 code) 타입에 따른 파일 검색 수행
      const list = await ipc.llmListModels(type === 'chat' ? 'llm' : 'code');
      
      // UI 노출을 위한 최적화 형태로 맵 변환 수행
      const mappedList = list.map(m => ({
        path: m.path,
        filename: m.filename,
        name: m.name || m.filename,
        size: m.size || 0
      }));

      // 타깃에 따른 스토어 선택 갱신
      if (type === 'chat') {
        setModels(mappedList);
      } else {
        setCodeModels(mappedList);
      }
    } catch (e: any) {
      // WARNING: 앱 최초 구동 단계 등에서 빈 디렉터리 판정 시 경고가 발생하므로 의도적으로 로깅 폴백 처리함
      console.error('모델 목록 로드 실패:', e);
    }
  }, [setModels, setCodeModels]);

  /**
   * [CONTRACT - Check Local Health Connection]
   * - Rationale: Llama.cpp 네이티브 로컬 포트에 Ping 헬스 요청을 보내 응답에 따라 UI 점등 여부(isAvailable)를 판단한다.
   */
  const checkIsAvailable = useCallback(async () => {
    // 데스크톱 런타임 외에는 사용 불가 처리
    if (!ipc.isElectronEnv()) {
      setIsAvailable(false);
      return;
    }
    
    try {
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `res`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const res = ...` 형태로 안전 캐싱 후 가공 기동.
       */
      const res = await ipc.llmCheckHealth();
      // 응답 레코드가 존재하고 상태 지표가 ok 또는 ready 인지 판별
      if (res && (res.status === 'ok' || (res.status as string) === 'ready')) {
        setIsAvailable(true);
      } else {
        setIsAvailable(false);
      }
    } catch (e: any) {
      console.error('가용성 체크 실패:', e);
      setIsAvailable(false);
    }
  }, [setIsAvailable]);

  /**
   * [CONTRACT - GGUF File Import]
   * - Rationale: 유저가 PC에 가지고 있는 GGUF/GGUF2 파일을 열어 프로젝트 모델 전용 폴더에 이식 복사한다.
   */
  const importModel = useCallback(async () => {
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `!ipc.isElectronEnv()`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (!ipc.isElectronEnv())` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
    if (!ipc.isElectronEnv()) return;
    try {
      // OS 네이티브 탐색기 파일 선택 팝업 오픈
      const resObj = await ipc.selectLocalFile([
        { name: 'GGUF Models', extensions: ['gguf', 'bin'] },
        { name: 'All Files', extensions: ['*'] }
      ]);
      
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `resObj && resObj.filePath`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (resObj && resObj.filePath)` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
      if (resObj && resObj.filePath) {
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `sourcePath`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const sourcePath = ...` 형태로 안전 캐싱 후 가공 기동.
       */
        const sourcePath = resObj.filePath;
        
        // 탐색된 파일 경로로 모델 임포트 IPC 개시
        const res = await ipc.llmImportModel(sourcePath);
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `res.success`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (res.success)` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
        if (res.success) {
          // 임포트 성공 시 챗/코드 양대 목록을 즉시 갱신 동기화함
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
      throw error; // UI 모달 단에서 경고를 띄울 수 있도록 즉시 전파
    }
    return false;
  }, [loadModels]);

  /**
   * [CONTRACT - Start Native Engine Process]
   * - Rationale: 선택된 모델 파일 경로를 인자로 넘겨 Llama.cpp 로컬 데몬 프로세스를 쉘 커맨드로 포크(Fork) 기동한다.
   */
  const startEngine = useCallback(async () => {
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `!ipc.isElectronEnv()`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (!ipc.isElectronEnv())` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
    if (!ipc.isElectronEnv()) return;
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `!settings.modelPath`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (!settings.modelPath)` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
    if (!settings.modelPath) {
      addSensorLog('[Error] 모델 경로가 설정되지 않았습니다.');
      return;
    }

    try {
      addSensorLog('[System] 로컬 AI 엔진(llama-cli)을 시작합니다...');
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `res`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const res = ...` 형태로 안전 캐싱 후 가공 기동.
       */
      const res = await ipc.llmStart(settings.modelPath);
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `res.success`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (res.success)` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
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
      throw e; // 치명적인 엔진 시작 실패는 좀비 방지를 위해 상위 UI(ModelHub)로 즉시 전파
    }
  }, [settings.modelPath, addSensorLog, setIsAvailable]);

  /**
   * [CONTRACT - Stop Engine Process]
   * - Rationale: 백그라운드에서 동작 중인 Llama.cpp 서버 프로세스에 kill 시그널을 발송해 종료 처리한다.
   */
  const stopEngine = useCallback(async () => {
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `!ipc.isElectronEnv()`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (!ipc.isElectronEnv())` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
    if (!ipc.isElectronEnv()) return;
    try {
      addSensorLog('[System] 엔진 정지를 요청합니다...');
      await ipc.llmStop();
      setIsAvailable(false);
      addSensorLog('[System] 엔진이 정지되었습니다.');
    } catch (e: any) {
      console.error('엔진 정지 중 오류:', e);
      addSensorLog(`[Error] 엔진 정지 중 예외 발생: ${e.message}`);
      throw e; // 프로세스 자원 홀딩 및 메모리 누출 차단을 위해 상위 전파
    }
  }, [addSensorLog, setIsAvailable]);

  /**
   * [SIDE EFFECT - Periodic Health Check Interval]
   * - Rationale: API 타입이 로컬 구동 조건(local/ollama)인 경우, 실시간 점검을 위해 3초 주기 인터벌을 가동한다.
   */
  useEffect(() => {
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `settings.apiType !== 'local' && settings.apiType !== 'ollama'`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (settings.apiType !== 'local' && settings.apiType !== 'ollama')` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
    if (settings.apiType !== 'local' && settings.apiType !== 'ollama') {
      return;
    }
    
    // 초기 마운트 시 즉각 1회 Ping 동적 테스트
    checkIsAvailable();
    
    // 3초 타이머 바인딩
    const interval = setInterval(() => {
      checkIsAvailable();
    }, 3000); 
    
    // CONTRACT: 메모리 누수 방지 타이머 클린업 계약 준수
    return () => clearInterval(interval);
  }, [settings.apiType, checkIsAvailable]);

  return {
    loadModels,
    checkIsAvailable,
    importModel,
    startEngine,
    stopEngine,
  };
}

/**
 * ============================================================================
 * FUTURE DEVELOPMENT GUIDE (AI Agent Instruction Layer)
 * ============================================================================
 * 1. 로컬 AI 서버 구동 시 파라미터(온도, 컨텍스트 윈도우 크기 등) 인자 전달을 추가하고자 할 때:
 *    - `startEngine` 내의 `ipc.llmStart` 호출 구문에 옵션 객체를 보강할 것.
 * 
 * 2. 헬스 체크 인터벌 주기(3000ms) 변경 시:
 *    - `useEffect` 내의 밀리초 값을 조절하되, 너무 잦은 Ping 요청으로 인한 스레드 병목 현상에 각별히 유의할 것.
 * ============================================================================
 */
