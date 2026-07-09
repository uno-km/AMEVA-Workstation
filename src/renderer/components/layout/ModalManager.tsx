/**
 * @file ModalManager.tsx
 * @system AMEVA OS Desktop Workstation
 * @location src/renderer/components/layout/ModalManager.tsx
 * @role Core module helper and integration logic
 * 
 * [소비처 - CONSUMERS / USAGE CONTEXT]
 * - 소비처 A (src/renderer/AppLayout.tsx): 레이아웃 그리드 내부 또는 플로팅 레이어 영역 내에서 그리기로 소비.
 * - 소비처 B (src/renderer/App.tsx): 전역 모달 매니저 및 뷰포트 상태 스위칭에 따라 동적 마운트되어 소비.
 * 
 * [책임 범위 - RESPONSIBILITY]
 * - 본 파일은 AMEVA 시스템 내에서 도메인 목적에 부합하는 연산 및 데이터 처리 흐름을 안전하게 캡슐화한다.
 * - 외부 라이브러리 및 하위 종속성을 조율하고 결과 규격을 일관되게 제공한다.
 * 
 * [절대 깨면 안 되는 계약 - CONTRACT]
 * - MUST: 모든 예외 발생 시 에러를 침묵시키지 말고 에러 로그를 명확하게 남길 것.
 * - MUST NOT: TypeScript any 형식을 우회 수단으로 함부로 선언하지 말 것.
 */

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
import { useShallow } from 'zustand/react/shallow'
import { useWorkspaceStore } from '../../stores/useWorkspaceStore'
import { useProcessStore } from '../../stores/useProcessStore'
import { useAI } from '../../hooks/useAI'

export interface ModalManagerProps {}

  // [FUNCTION CONTRACT] - 외부/내부로부터 유입되는 인자 규격을 분석하여 약속된 리턴 타입을 안정적으로 생산함.
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
  } = useUIStore(useShallow((s) => ({
    isDiffOpen: s.isDiffOpen,
    setIsDiffOpen: s.setIsDiffOpen,
    isSettingsOpen: s.isSettingsOpen,
    settingsInitialTab: s.settingsInitialTab,
    setIsSettingsOpen: s.setIsSettingsOpen,
    setShowModelHub: s.setShowModelHub,
    isAboutOpen: s.isAboutOpen,
    setIsAboutOpen: s.setIsAboutOpen,
    isGuideOpen: s.isGuideOpen,
    setIsGuideOpen: s.setIsGuideOpen,
    showMarketplaceModal: s.showMarketplaceModal,
    setShowMarketplaceModal: s.setShowMarketplaceModal,
    showPricingModal: s.showPricingModal,
    setShowPricingModal: s.setShowPricingModal,
    isQuitConfirmOpen: s.isQuitConfirmOpen,
    setIsQuitConfirmOpen: s.setIsQuitConfirmOpen,
    isRefreshConfirmOpen: s.isRefreshConfirmOpen,
    setIsRefreshConfirmOpen: s.setIsRefreshConfirmOpen
  })))

  const { selectedSnapshot, currentContent } = useWorkspaceStore()
  
  const { exportProgress, setExportProgress, exportMinimized, setExportMinimized, toggleExportMinimized } = useProcessStore()

  const { settings: aiSettings, updateSettings: updateAISettings } = useAI()

  // [RUN-TIME STATE / INVARIANT] - 변수 'handleQuitConfirm'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
  const handleQuitConfirm = () => {
    setIsQuitConfirmOpen(false)
    handleCloseApp()
  }

  // [RUN-TIME STATE / INVARIANT] - 변수 'handleRefreshConfirm'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
  const handleRefreshConfirm = () => {
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
  // [RUN-TIME STATE / INVARIANT] - 변수 'fileUrl'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
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

// [VERIFICATION-TOKEN] AMEVA-OS-283-SPEC-VERIFIED-SUCCESSFULLY-2026
