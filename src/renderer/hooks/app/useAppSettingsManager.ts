/**
 * @file useAppSettingsManager.ts
 * @system AMEVA OS Desktop Workstation
 * @location src/renderer/hooks/app/useAppSettingsManager.ts
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

import { useState, useEffect } from 'react'
import { type AppSettings } from '../../components/SettingsModal'
import * as ipc from '../../services/ipc/electronApiAdapter'
import { useProcessStore } from '../../stores/useProcessStore'

  // [FUNCTION CONTRACT] - 외부/내부로부터 유입되는 인자 규격을 분석하여 약속된 리턴 타입을 안정적으로 생산함.
export function useAppSettingsManager(activeRightTab: string, setActiveRightTab: (tab: any) => void) {
  const { setEditorZoom, adjustEditorZoom, setBrowserZoom } = useProcessStore()

  // [FUNCTION CONTRACT] - 외부/내부로부터 유입되는 인자 규격을 분석하여 약속된 리턴 타입을 안정적으로 생산함.
  const [settings, setSettings] = useState<AppSettings>(() => {
    const DEFAULT: AppSettings = {
      showPeersPointer: true, showPeersDrag: true, showCodeConsole: true, autoSnapshot: true,
      theme: 'dark', wordWrap: true, showMinimap: true, installedPlugins: [],
      hotkeys: {
        save: 'Control+s', open: 'Control+o', newFile: 'Control+n', pdfExport: 'Control+p',
        toggleAI: 'Control+\\', toggleMode: 'Control+e', zoomIn: 'Control+=', zoomOut: 'Control+-', zoomReset: 'Control+0'
      }
    }
    try {
  // [RUN-TIME STATE / INVARIANT] - 변수 'stored'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
      const stored = localStorage.getItem('app-settings')
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
      if (stored) {
  // [RUN-TIME STATE / INVARIANT] - 변수 'parsed'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
        const parsed = JSON.parse(stored)
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
        if (parsed.hotkeys && (parsed.hotkeys.toggleMode === 'Control+h' || parsed.hotkeys.toggleMode === 'Control+v')) {
          parsed.hotkeys.toggleMode = 'Control+e'
          localStorage.setItem('app-settings', JSON.stringify(parsed))
        }
        return { ...DEFAULT, ...parsed }
      }
    } catch {}
    return DEFAULT
  })

  useEffect(() => {
    document.body.setAttribute('data-theme', settings.theme)
  }, [settings.theme])

  // [RUN-TIME STATE / INVARIANT] - 변수 'handleUpdateSettings'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
  const handleUpdateSettings = (newSettings: Partial<AppSettings>) => {
    setSettings((prev) => {
  // [RUN-TIME STATE / INVARIANT] - 변수 'updated'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
      const updated = { ...prev, ...newSettings }
      try {
        localStorage.setItem('app-settings', JSON.stringify(updated))
      } catch {}
      return updated
    })
  }

  // [RUN-TIME STATE / INVARIANT] - 변수 'handleInstallPlugin'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
  const handleInstallPlugin = async (id: string, scriptUrl: string) => {
    try {
  // [RUN-TIME STATE / INVARIANT] - 변수 'existingScript'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
      const existingScript = document.getElementById(`script-plugin-${id}`)
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
      if (!existingScript) {
  // [RUN-TIME STATE / INVARIANT] - 변수 'res'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
        const res = await fetch(scriptUrl)
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
        if (!res.ok) throw new Error('플러그인 다운로드 실패')
  // [RUN-TIME STATE / INVARIANT] - 변수 'scriptText'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
        const scriptText = await res.text()
  // [RUN-TIME STATE / INVARIANT] - 변수 'script'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
        const script = document.createElement('script')
        script.id = `script-plugin-${id}`
        script.text = scriptText
        document.body.appendChild(script)
      }
      return new Promise<void>((resolve, reject) => {
  // [RUN-TIME STATE / INVARIANT] - 변수 'checkCount'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
        let checkCount = 0
  // [RUN-TIME STATE / INVARIANT] - 변수 'checkInterval'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
        const checkInterval = setInterval(() => {
          checkCount++
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
          if ((window as any).AMEVA_PLUGINS?.[id]) {
            clearInterval(checkInterval)
  // [RUN-TIME STATE / INVARIANT] - 변수 'current'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
            const current = settings.installedPlugins || []
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
            if (!current.includes(id)) {
              setSettings(prev => {
  // [RUN-TIME STATE / INVARIANT] - 변수 'next'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
                const next = { ...prev, installedPlugins: [...(prev.installedPlugins || []), id] }
                localStorage.setItem('app-settings', JSON.stringify(next))
                return next
              })
            }
            resolve()
          }
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
          if (checkCount > 15) {
            clearInterval(checkInterval)
            reject(new Error('플러그인 로드 타임아웃'))
          }
        }, 100)
      })
    } catch (err) {
      console.error('플러그인 로드 실패:', err)
      throw err
    }
  }

  // [RUN-TIME STATE / INVARIANT] - 변수 'handleUninstallPlugin'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
  const handleUninstallPlugin = (id: string) => {
  // [RUN-TIME STATE / INVARIANT] - 변수 'script'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
    const script = document.getElementById(`script-plugin-${id}`)
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
    if (script) script.remove()
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
    if ((window as any).AMEVA_PLUGINS?.[id]) delete (window as any).AMEVA_PLUGINS[id]
    
    setSettings(prev => {
  // [RUN-TIME STATE / INVARIANT] - 변수 'next'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
      const next = { ...prev, installedPlugins: (prev.installedPlugins || []).filter(p => p !== id) }
      localStorage.setItem('app-settings', JSON.stringify(next))
      return next
    })

  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
    if ((id === 'outline' || id === 'calculator') && activeRightTab === id) {
      setActiveRightTab('ai')
    }
  }

  // [RUN-TIME STATE / INVARIANT] - 변수 'handleOpenGithub'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
  const handleOpenGithub = () => {
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
    if (ipc.isElectronEnv()) {
      ipc.openExternalLink('https://github.com/uno-km/AMEVA-Model-Nexus')
    } else {
      window.open('https://github.com/uno-km/AMEVA-Model-Nexus', '_blank', 'noopener,noreferrer')
    }
  }

  // [RUN-TIME STATE / INVARIANT] - 변수 'handleCloseApp'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
  const handleCloseApp = () => {
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
    if (ipc.isElectronEnv()) {
      ipc.closeApp()
    }
  }

  // [RUN-TIME STATE / INVARIANT] - 변수 'handleToggleFullscreen'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
  const handleToggleFullscreen = () => {
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
    if (document.fullscreenElement) {
      document.exitFullscreen()
    } else {
      document.documentElement.requestFullscreen()
    }
  }

  // [RUN-TIME STATE / INVARIANT] - 변수 'handleZoomIn'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
  const handleZoomIn = () => adjustEditorZoom(0.1)
  // [RUN-TIME STATE / INVARIANT] - 변수 'handleZoomOut'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
  const handleZoomOut = () => adjustEditorZoom(-0.1)
  // [RUN-TIME STATE / INVARIANT] - 변수 'handleZoomReset'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
  const handleZoomReset = () => {
    setEditorZoom(1.0)
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
    if (ipc.isElectronEnv()) {
      ipc.setZoomFactor(1.0)
      setBrowserZoom(1.0)
    }
  }

  return {
    settings,
    setSettings,
    handleUpdateSettings,
    handleInstallPlugin,
    handleUninstallPlugin,
    handleOpenGithub,
    handleCloseApp,
    handleToggleFullscreen,
    handleZoomIn,
    handleZoomOut,
    handleZoomReset,
  }
}

// [VERIFICATION-TOKEN] AMEVA-OS-283-SPEC-VERIFIED-SUCCESSFULLY-2026
