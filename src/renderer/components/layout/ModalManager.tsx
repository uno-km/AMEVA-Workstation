
import * as ipc from '../../services/ipc/electronApiAdapter'
import { DiffModal } from '../DiffModal'
import { SettingsModal, type AppSettings } from '../SettingsModal'
import { AboutModal } from '../AboutModal'
import { MarkdownGuideModal } from '../MarkdownGuideModal'
import { MarketplaceModal } from '../MarketplaceModal'
import { PricingModal } from '../PricingModal'
import { ExportModal, IDLE_PROGRESS } from '../ExportModal'
import { type DocumentSnapshot, type ExportProgress } from '../../../shared/types'

export interface ModalManagerProps {
  isDiffOpen: boolean
  setIsDiffOpen: (open: boolean) => void
  selectedSnapshot: DocumentSnapshot | null
  currentContent: string
  getLineDiff: any
  handleRollback: (content: string) => void
  isSettingsOpen: boolean
  setIsSettingsOpen: (open: boolean) => void
  refreshMcpServers: () => void
  settings: AppSettings
  handleUpdateSettings: (newSettings: Partial<AppSettings>) => void
  username: string
  userColor: string
  setUsername: (name: string) => void
  setUserColor: (color: string) => void
  setShowModelHub: (show: boolean) => void
  isAboutOpen: boolean
  setIsAboutOpen: (open: boolean) => void
  handleOpenGithub: () => void
  isGuideOpen: boolean
  setIsGuideOpen: (open: boolean) => void
  showMarketplaceModal: boolean
  setShowMarketplaceModal: (show: boolean) => void
  handleInstallPlugin: (id: string, scriptUrl: string) => Promise<void>
  handleUninstallPlugin: (id: string) => void
  isProPlan: boolean
  showPricingModal: boolean
  setShowPricingModal: (show: boolean) => void
  exportProgress: ExportProgress
  setExportProgress: (prog: ExportProgress) => void
  exportMinimized: boolean
  setExportMinimized: (min: boolean) => void
  toggleExportMinimized: () => void
}

export function ModalManager({
  isDiffOpen,
  setIsDiffOpen,
  selectedSnapshot,
  currentContent,
  getLineDiff,
  handleRollback,
  isSettingsOpen,
  setIsSettingsOpen,
  refreshMcpServers,
  settings,
  handleUpdateSettings,
  username,
  userColor,
  setUsername,
  setUserColor,
  setShowModelHub,
  isAboutOpen,
  setIsAboutOpen,
  handleOpenGithub,
  isGuideOpen,
  setIsGuideOpen,
  showMarketplaceModal,
  setShowMarketplaceModal,
  handleInstallPlugin,
  handleUninstallPlugin,
  isProPlan,
  showPricingModal,
  setShowPricingModal,
  exportProgress,
  setExportProgress,
  exportMinimized,
  setExportMinimized,
  toggleExportMinimized,
}: ModalManagerProps) {
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
        onClose={() => {
          setIsSettingsOpen(false)
          refreshMcpServers()
        }}
        settings={settings}
        onUpdateSettings={handleUpdateSettings}
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
    </>
  )
}
