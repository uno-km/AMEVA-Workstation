import { useState, useEffect } from 'react'
import { type AppSettings } from '../../components/SettingsModal'
import * as ipc from '../../services/ipc/electronApiAdapter'
import { useProcessStore } from '../../stores/useProcessStore'

export function useAppSettingsManager(activeRightTab: string, setActiveRightTab: (tab: any) => void) {
  const { setEditorZoom, adjustEditorZoom, setBrowserZoom } = useProcessStore()

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
      const stored = localStorage.getItem('app-settings')
      if (stored) {
        const parsed = JSON.parse(stored)
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

  const handleUpdateSettings = (newSettings: Partial<AppSettings>) => {
    setSettings((prev) => {
      const updated = { ...prev, ...newSettings }
      try {
        localStorage.setItem('app-settings', JSON.stringify(updated))
      } catch {}
      return updated
    })
  }

  const handleInstallPlugin = async (id: string, scriptUrl: string) => {
    try {
      const existingScript = document.getElementById(`script-plugin-${id}`)
      if (!existingScript) {
        const res = await fetch(scriptUrl)
        if (!res.ok) throw new Error('플러그인 다운로드 실패')
        const scriptText = await res.text()
        const script = document.createElement('script')
        script.id = `script-plugin-${id}`
        script.text = scriptText
        document.body.appendChild(script)
      }
      return new Promise<void>((resolve, reject) => {
        let checkCount = 0
        const checkInterval = setInterval(() => {
          checkCount++
          if ((window as any).AMEVA_PLUGINS?.[id]) {
            clearInterval(checkInterval)
            const current = settings.installedPlugins || []
            if (!current.includes(id)) {
              setSettings(prev => {
                const next = { ...prev, installedPlugins: [...(prev.installedPlugins || []), id] }
                localStorage.setItem('app-settings', JSON.stringify(next))
                return next
              })
            }
            resolve()
          }
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

  const handleUninstallPlugin = (id: string) => {
    const script = document.getElementById(`script-plugin-${id}`)
    if (script) script.remove()
    if ((window as any).AMEVA_PLUGINS?.[id]) delete (window as any).AMEVA_PLUGINS[id]
    
    setSettings(prev => {
      const next = { ...prev, installedPlugins: (prev.installedPlugins || []).filter(p => p !== id) }
      localStorage.setItem('app-settings', JSON.stringify(next))
      return next
    })

    if ((id === 'outline' || id === 'calculator') && activeRightTab === id) {
      setActiveRightTab('ai')
    }
  }

  const handleOpenGithub = () => {
    if (ipc.isElectronEnv()) {
      ipc.openExternalLink('https://github.com/uno-km/AMEVA-Model-Nexus')
    } else {
      window.open('https://github.com/uno-km/AMEVA-Model-Nexus', '_blank', 'noopener,noreferrer')
    }
  }

  const handleCloseApp = () => {
    if (ipc.isElectronEnv()) {
      ipc.closeApp()
    }
  }

  const handleToggleFullscreen = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen()
    } else {
      document.documentElement.requestFullscreen()
    }
  }

  const handleZoomIn = () => adjustEditorZoom(0.1)
  const handleZoomOut = () => adjustEditorZoom(-0.1)
  const handleZoomReset = () => {
    setEditorZoom(1.0)
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
