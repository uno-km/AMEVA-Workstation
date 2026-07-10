/**
 * @file useAIHealthCheck.ts
 * @system AMEVA OS Desktop Workstation - Client Renderer
 * @location src/renderer/hooks/ai/useAIHealthCheck.ts
 * @role Background engine health status verification monitor Hook
 * 
 * [책임 범위 - RESPONSIBILITY]
 * - Llama.cpp 및 Ollama 서버의 백그라운드 활성 상태를 5초마다 체크(`checkHealth`)한다.
 * - [FIX-FLICKER-001] AI 모델 로드 지연이나 일시적 소켓 병목으로 인해 UI가 꺼진 상태(Offline 빨간불)로 수시 깜빡이는 현상을 막고자,
 *   **연속 5회 이상 실패(`failCountRef.current >= 5`)** 시에만 가용 상태 플래그를 꺼짐(`setIsAvailable(false)`)으로 처리하는 Threshold 필터를 적용한다.
 * - 브라우저 WebGPU WASM 방식과 클라우드 API 모드는 항상 사용 가능 상태(`setIsAvailable(true)`)로 가드 처리한다.
 * 
 * [책임이 아닌 것 - NON-RESPONSIBILITY]
 * - 실제 로컬 데몬 바이너리 프로세스 강제 킬(Kill) 및 소켓 리셋 (useLocalAIEngine의 책임).
 * 
 * [절대 깨면 안 되는 계약 - CONTRACT]
 * - MUST NOT bypass fetch timeout: Ollama 엔드포인트 헬스체크 fetch 시 렌더러가 멈추는 일이 없도록,
 *   반드시 `AbortSignal.timeout(3000)` 타임아웃 가드를 이식하여 3초 내에 커넥션을 중단할 것.
 * - MUST: 훅이 언마운트되거나 settings.apiType 변경 시, `timer` 인스턴스를 즉시 `clearInterval` 하여 타이머 유실에 따른 렌더러 메모리 크래시를 차단할 것.
 
 * [소비처 - CONSUMERS / USAGE CONTEXT]
 * - 소비처 A (src/renderer/App.tsx): 최상위 Facade 구조에 통합 마운트.
 * - 소비처 B (src/renderer/contexts/AppContext.tsx): 리액트 Context 훅 목록에 바인딩되어 하위 뷰에 전파.
 */

/* 
 * [IMPORT SEGMENTATION & CONTRACTS]
 * - useEffect: 5초 주기 주기적 인터벌 가동을 위한 라이프사이클 훅.
 * - useRef: 렌더링에 영향 없이 연속 실패 횟수(failCount)를 누적하기 위한 Mutable 참조 훅.
 */
import { useEffect, useRef } from 'react'

/* 
 * [ELECTRON IPC BRIDGE]
 * - ipc: 네이티브 Llama 프로세스의 가용 상태 및 모델 로딩 현황(/health)을 감청하기 위한 채널 어댑터.
 */
import * as ipc from '../../services/ipc/electronApiAdapter'

/* 
 * [TYPES]
 * - AISettings: AI 엔진 파라미터 구조체.
 */
import type { AISettings } from '../../types/aiTypes'
import { WebLLMEngine } from '../../services/ai/WebLLMEngine'
import { WebCPUEngine } from '../../services/ai/WebCPUEngine'

/**
 * @hook useAIHealthCheck
 * @description 로컬/원격 AI 모델 기동 서버들의 헬스 상태를 실시간 진단하고 깜빡임 방지용 임계값(Threshold)을 관리하는 훅.
 */
export function useAIHealthCheck(
  /*
   * [HOOK CONFIG PARAMETERS]
   * - settings: AI 구동 설정 객체.
   * - setIsAvailable: 가용 플래그 변경 세터.
   */
  settings: AISettings,
  setIsAvailable: (val: boolean) => void
) {
  /*
   * [INVARIANT - Fail Count Debouncer]
   * - failCountRef: 연속으로 헬스 검사에 실패한 회수를 보존하는 변수.
   * - Rationale: React 렌더 렉을 방지하며, 누적 5회 미만일 때는 가용성 표시등을 켜두기 위한 카운터.
   */
  const failCountRef = useRef(0)

  /**
   * [SIDE EFFECT - 5s Interval Health Checker]
   * - Rationale: API 설정 변화를 감지하여 이전 타이머를 버리고 5초 타이머를 재구동한다.
   */
  useEffect(() => {
    // 세팅 변경 시 실패 횟수를 0으로 원자적 리셋
    failCountRef.current = 0

    // WASM 엔진은 로컬 ping 대신, 실제 WebLLM/WebCPU 모델 로드 여부를 확인하여 가용성 상태를 반영함
    if (settings.apiType === 'wasm') {
      const checkWasmLoaded = () => {
        const isWasmLoaded = settings.gpuOnly
          ? WebLLMEngine.getInstance().isLoaded()
          : WebCPUEngine.getInstance().isLoaded()
        setIsAvailable(isWasmLoaded)
      }
      checkWasmLoaded()
      const timer = setInterval(checkWasmLoaded, 2000)
      return () => clearInterval(timer)
    }

    // [FIX-FLICKER-API] 상용 클라우드 API도 사전 핑 없이 켜진 것으로 간주
    if (settings.apiType === 'api') {
      setIsAvailable(true)
      return
    }

    /*
     * [INVARIANT - Background Ping Checker]
     * - Rationale: 5초마다 동작하는 비동기 진단 함수. Ollama의 경우 fetch, Local의 경우 IPC 핑을 이용함.
     */
    const checkHealth = async () => {
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `type`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const type = ...` 형태로 안전 캐싱 후 가공 기동.
       */
      const type = settings.apiType || 'local'

      // 성공 시 실패 카운트 리셋 및 가용 플래그 true 처리
      const handleSuccess = () => {
        failCountRef.current = 0
        setIsAvailable(true)
      }

      // [FIX-FLICKER-001] 실패 시 5회 누적 시점부터 가용성 false 반영
      const handleFail = () => {
        failCountRef.current += 1
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `failCountRef.current >= 5`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (failCountRef.current >= 5)` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
        if (failCountRef.current >= 5) {
          setIsAvailable(false)
        }
      }

      // 1. Ollama 엔드포인트 헬스 체크
      if (type === 'ollama') {
        try {
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `ep`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const ep = ...` 형태로 안전 캐싱 후 가공 기동.
       */
          const ep = settings.apiEndpoint || 'http://127.0.0.1:11434'
          
          // CONTRACT: 3초 타임아웃 GET fetch
          const res = await fetch(`${ep}/api/tags`, {
            method: 'GET',
            signal: AbortSignal.timeout(3000)
          })
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `res.ok) handleSuccess(`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (res.ok) handleSuccess()` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
          if (res.ok) handleSuccess()
          else handleFail()
        } catch {
          // 커넥션 오류 발생 시 실패 처리
          handleFail()
        }
        return
      }

      // 2. Llama.cpp 로컬 바이너리 헬스 체크
      // Rationale: 모델이 올라가는 중(loading model)일 때도 가용한 것으로 임시 판단 처리함
      const result = await ipc.llmCheckHealth()
      
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `result.status === 'ok' || result.status === 'loading model'`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (result.status === 'ok' || result.status === 'loading model')` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
      if (result.status === 'ok' || result.status === 'loading model') {
        handleSuccess()
      } else {
        handleFail()
      }
    }

    // 초기 마운트 시 즉시 1회 실행
    checkHealth()
    
    // 5초 간격 타이머 설정
    const timer = setInterval(checkHealth, 5000)
    
    // CONTRACT: 타이머 누수 제거 클린업 이행
    return () => clearInterval(timer)
  }, [settings.apiType, settings.apiEndpoint, setIsAvailable])
}

/**
 * ============================================================================
 * FUTURE DEVELOPMENT GUIDE (AI Agent Instruction Layer)
 * ============================================================================
 * 1. 연속 실패 임계 임계치(5회)를 변경하고 싶을 때:
 *    - `failCountRef.current >= 5` 수식을 변경하되, 임계치를 너무 낮추면 네트워크 단선에 따른 Offline 깜빡임이 재발함에 유의할 것.
 * ============================================================================
 */

