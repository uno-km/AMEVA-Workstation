import * as ipc from '../../services/ipc/electronApiAdapter'
import { DiffModal } from '../DiffModal'
import { SettingsModal } from '../SettingsModal'
import { AboutModal } from '../AboutModal'
import { MarkdownGuideModal } from '../MarkdownGuideModal'
import { MarketplaceModal } from '../MarketplaceModal'
import { PricingModal } from '../PricingModal'
import { ExportModal, IDLE_PROGRESS } from '../ExportModal'
import { QuitConfirmModal } from '../QuitConfirmModal'

import { RefreshConfirmModal } from '../RefreshConfirmModal'

import { useAppContext } from '../../contexts/AppContext'
import { useUIStore } from '../../stores/useUIStore'
import { useWorkspaceStore } from '../../stores/useWorkspaceStore'
import { useProcessStore } from '../../stores/useProcessStore'
import { useAI } from '../../hooks/useAI'

export interface ModalManagerProps {}

export function ModalManager({}: ModalManagerProps = {}) {
  const {
    settings, handleUpdateSettings, handleInstallPlugin, handleUninstallPlugin, isProPlan,
    username, setUsername, userColor, setUserColor, getLineDiff, handleRollback,
    handleOpenGithub, refreshMcpServers, handleCloseApp
  } = useAppContext()
  
  const {
    isDiffOpen, setIsDiffOpen, isSettingsOpen, settingsInitialTab, setIsSettingsOpen,
    setShowModelHub, isAboutOpen, setIsAboutOpen, isGuideOpen, setIsGuideOpen,
    showMarketplaceModal, setShowMarketplaceModal, showPricingModal, setShowPricingModal,
    isQuitConfirmOpen, setIsQuitConfirmOpen, isRefreshConfirmOpen, setIsRefreshConfirmOpen
  } = useUIStore()

  const { selectedSnapshot, currentContent } = useWorkspaceStore()
  
  const { exportProgress, setExportProgress, exportMinimized, setExportMinimized, toggleExportMinimized } = useProcessStore()

  const { settings: aiSettings, updateSettings: updateAISettings } = useAI()

  const handleQuitConfirm = () => {
    setIsQuitConfirmOpen(false)
    handleCloseApp()
  }

  const handleRefreshConfirm = () => {
    setIsRefreshConfirmOpen(false)
    window.location.reload()
  }
  return (
    <>
      <DiffModal
        isOpen={isDiffOpen}
        onClose={() => setIsDiffOpen(false)}
        snapshot={selectedSnapshot}
        currentContent={currentContent}
        getLineDiff={getLineDiff}
        onRollback={handleRollback}
      />
      <SettingsModal
        isOpen={isSettingsOpen}
        initialTab={settingsInitialTab as any}
        onClose={() => {
          setIsSettingsOpen(false)
          refreshMcpServers()
        }}
        settings={settings}
        onUpdateSettings={handleUpdateSettings}
        aiSettings={aiSettings}
        onUpdateAISettings={updateAISettings}
        username={username}
        userColor={userColor}
        onUpdateUser={(name, color) => {
          setUsername(name)
          setUserColor(color)
        }}
        onOpenModelHub={() => {
          setIsSettingsOpen(false)
          setShowModelHub(true)
        }}
      />
      <AboutModal
        isOpen={isAboutOpen}
        onClose={() => setIsAboutOpen(false)}
        onOpenGithub={handleOpenGithub}
      />
      <MarkdownGuideModal
        isOpen={isGuideOpen}
        onClose={() => setIsGuideOpen(false)}
      />
      <MarketplaceModal
        isOpen={showMarketplaceModal}
        onClose={() => setShowMarketplaceModal(false)}
        installedPlugins={settings.installedPlugins || []}
        onInstallPlugin={handleInstallPlugin}
        onUninstallPlugin={handleUninstallPlugin}
        isProPlan={isProPlan}
      />
      <PricingModal
        isOpen={showPricingModal}
        onClose={() => setShowPricingModal(false)}
      />
      <ExportModal
        progress={exportProgress}
        minimized={exportMinimized}
        onMinimize={toggleExportMinimized}
        onClose={() => { setExportProgress(IDLE_PROGRESS); setExportMinimized(false) }}
        onOpenFile={(path) => {
          const fileUrl = path.startsWith('http') ? path : `file:///${path.replace(/\\/g, '/')}`
          ipc.openExternalLink(fileUrl)
        }}
      />
      <QuitConfirmModal
        isOpen={isQuitConfirmOpen}
        onClose={() => setIsQuitConfirmOpen(false)}
        onConfirm={handleQuitConfirm}
      />
      {isRefreshConfirmOpen && setIsRefreshConfirmOpen && handleRefreshConfirm && (
        <RefreshConfirmModal
          isOpen={isRefreshConfirmOpen}
          onClose={() => setIsRefreshConfirmOpen(false)}
          onConfirm={handleRefreshConfirm}
        />
      )}
    </>
  )
}
