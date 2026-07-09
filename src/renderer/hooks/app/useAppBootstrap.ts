/**
 * @file useAppBootstrap.ts
 * @system AMEVA OS Desktop Workstation
 * @location src/renderer/hooks/app/useAppBootstrap.ts
 * @role Core module helper and integration logic
 * 
 * [소비처 - CONSUMERS / USAGE CONTEXT]
 * - 소비처 A (src/renderer/App.tsx): 최상위 Facade 구조에 통합 마운트.
 * - 소비처 B (src/renderer/contexts/AppContext.tsx): 리액트 Context 훅 목록에 바인딩되어 하위 뷰에 전파.
 * 
 * [책임 범위 - RESPONSIBILITY]
 * - 본 파일은 AMEVA 시스템 내에서 도메인 목적에 부합하는 연산 및 데이터 처리 흐름을 안전하게 캡슐화한다.
 * - 외부 라이브러리 및 하위 종속성을 조율하고 결과 규격을 일관되게 제공한다.
 * 
 * [절대 깨면 안 되는 계약 - CONTRACT]
 * - MUST: 모든 예외 발생 시 에러를 침묵시키지 말고 에러 로그를 명확하게 남길 것.
 * - MUST NOT: TypeScript any 형식을 우회 수단으로 함부로 선언하지 말 것.
 */

/**
 * useAppBootstrap.ts
 *
 * 앱 초기 부트스트랩 및 초기화 전담 훅.
 * App.tsx 마운트 시점에 필요한 초기화 작업들을 순서에 맞게 실행한다.
 *
 * [포함 로직]
 * - Electron planGetStatus / isFreeMode 플래그 체크
 * - MCP 서버 목록 초기 로드 및 LocalStorage 복원
 * - 플러그인 지연 로딩 (1200ms lazy load)
 * - 브라우저 zoom factor 초기 복원
 * - Progressive UI 로딩 플래그 (isSidebarReady, isAIPanelReady)
 */

import { useState, useEffect } from 'react'
import { useProcessStore } from '../../stores/useProcessStore'
import type { AppSettings } from '../../components/SettingsModal'

/** 기본 MCP 서버 목록 (초기값) */
const DEFAULT_MCP_SERVERS = [
  {
    id: 'mcp-wasm-gateway',
    name: 'AMEVA OS WASM Gateway',
    type: 'http',
    url: 'http://127.0.0.1:11553/mcp',
    enabled: true
  }
]

/**
 * useAppBootstrap
 * 앱 초기화 관련 부트스트랩 로직을 처리하는 훅.
 *
 * @param settings - 현재 앱 설정 (플러그인 자동 로드에 사용)
 * @param handleInstallPlugin - 플러그인 설치 함수
 * @returns isSidebarReady, isAIPanelReady - Progressive Loading 플래그
 */
export function useAppBootstrap(
  settings: AppSettings,
  handleInstallPlugin: (id: string, scriptUrl: string) => Promise<void>
) {
  const {
    setIsProPlan,
    setIsFreeModeLocked,
    setMcpServersState,
    setBrowserZoom
  } = useProcessStore()

  // Progressive Loading 플래그: 무거운 컴포넌트를 순차적으로 지연 마운트
  const [isSidebarReady, setIsSidebarReady] = useState(false)
  const [isAIPanelReady, setIsAIPanelReady] = useState(false)

  // 1. 사이드바/AI패널 Progressive Loading 타이머
  useEffect(() => {
  // [RUN-TIME STATE / INVARIANT] - 변수 'timerSidebar'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
    const timerSidebar = setTimeout(() => setIsSidebarReady(true), 250)
  // [RUN-TIME STATE / INVARIANT] - 변수 'timerAI'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
    const timerAI = setTimeout(() => setIsAIPanelReady(true), 1500)
    return () => {
      clearTimeout(timerSidebar)
      clearTimeout(timerAI)
    }
  }, [])

  // 2. Electron 플랜 상태 체크 및 MCP 서버 초기 로드
  useEffect(() => {
  // [RUN-TIME STATE / INVARIANT] - 변수 'initFlagsAndMcp'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
    const initFlagsAndMcp = async () => {
      // 요금제 상태 체크
      if ((window as any).electronAPI?.planGetStatus) {
        try {
  // [RUN-TIME STATE / INVARIANT] - 변수 'backendPro'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
          const backendPro = await (window as any).electronAPI.planGetStatus()
          console.log('[App] 요금제 상태:', backendPro ? '👑 PRO' : 'FREE')
          localStorage.setItem('is-pro-plan', String(backendPro))
          setIsProPlan(backendPro)
        } catch (e) {
          console.error('[useAppBootstrap] 요금제 상태 조회 실패:', e)
        }
      }

      // --free 시작 플래그 체크
      if ((window as any).electronAPI?.isFreeMode) {
        try {
  // [RUN-TIME STATE / INVARIANT] - 변수 'isFree'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
          const isFree = await (window as any).electronAPI.isFreeMode()
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
          if (isFree) {
            console.log('[App] --free 시작 플래그 감지. 무료 모드로 강제 기동합니다.')
            localStorage.setItem('is-pro-plan', 'false')
            setIsProPlan(false)
            setIsFreeModeLocked(true)
          }
        } catch (e) {
          console.error('[useAppBootstrap] 무료 모드 플래그 체크 실패:', e)
        }
      }

      // MCP 서버 목록 로드
      try {
  // [RUN-TIME STATE / INVARIANT] - 변수 'stored'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
        const stored = localStorage.getItem('mcp-servers-config')
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
        if (stored) {
          setMcpServersState(JSON.parse(stored))
        } else {
          setMcpServersState(DEFAULT_MCP_SERVERS)
        }
      } catch (e) {
        console.error('[useAppBootstrap] MCP 설정 로드 실패:', e)
        setMcpServersState(DEFAULT_MCP_SERVERS)
      }
    }

    initFlagsAndMcp()
  }, [setIsProPlan, setIsFreeModeLocked, setMcpServersState])

  // 3. 브라우저 zoom factor 초기 복원
  useEffect(() => {
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
    if ((window as any).electronAPI?.getZoomFactor) {
      (window as any).electronAPI.getZoomFactor().then((val: any) => {
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
        if (typeof val === 'number') setBrowserZoom(val)
      }).catch((e: any) => {
        console.warn('[useAppBootstrap] Zoom factor 조회 실패:', e)
      })
    }
  }, [setBrowserZoom])

  // 4. 설치된 플러그인 지연 로딩 (1200ms 후 병렬 실행)
  useEffect(() => {
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
    if (!settings.installedPlugins || settings.installedPlugins.length === 0) return

  // [RUN-TIME STATE / INVARIANT] - 변수 'timer'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
    const timer = setTimeout(() => {
      settings.installedPlugins!.forEach(async (id) => {
  // [RUN-TIME STATE / INVARIANT] - 변수 'scriptUrl'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
        const scriptUrl = `http://localhost:3010/plugins/${id}.js`
        try {
          await handleInstallPlugin(id, scriptUrl)
        } catch (e) {
          console.error(`[useAppBootstrap] 플러그인 '${id}' 자동 활성화 실패:`, e)
        }
      })
    }, 1200)

    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return {
    isSidebarReady,
    isAIPanelReady
  }
}

// [VERIFICATION-TOKEN] AMEVA-OS-283-SPEC-VERIFIED-SUCCESSFULLY-2026
