/**
 * useUIStore.ts
 *
 * UI 모달/패널 열림닫힘 상태 전용 Zustand 스토어.
 * App.tsx에 흩어져 있던 모달 및 패널 제어 상태를 단일 스토어로 집중한다.
 *
 * [포함 상태]
 * - 모달 열림/닫힘: Settings, About, Guide, Diff, Marketplace, Pricing
 * - 패널 상태: showAIPanel, activeRightTab, showSidebar, showStatusBar
 * - 알림: toastMessage
 * - 모델 허브: showModelHub
 * - FindReplace: showFindReplace, findReplaceMode
 */

import { create } from 'zustand'

export interface UIState {
  // ── 모달 열림/닫힘 ──────────────────────────────────────────────────────────
  isSettingsOpen: boolean
  setIsSettingsOpen: (val: boolean) => void

  isAboutOpen: boolean
  setIsAboutOpen: (val: boolean) => void

  isGuideOpen: boolean
  setIsGuideOpen: (val: boolean) => void

  isDiffOpen: boolean
  setIsDiffOpen: (val: boolean) => void

  showMarketplaceModal: boolean
  setShowMarketplaceModal: (val: boolean) => void

  showPricingModal: boolean
  setShowPricingModal: (val: boolean) => void

  showModelHub: boolean
  setShowModelHub: (val: boolean) => void

  // ── 패널 상태 ──────────────────────────────────────────────────────────────
  showAIPanel: boolean
  setShowAIPanel: (val: boolean) => void

  activeRightTab: string
  setActiveRightTab: (tab: string) => void

  showSidebar: boolean
  setShowSidebar: (val: boolean) => void

  showStatusBar: boolean
  setShowStatusBar: (val: boolean) => void

  // ── 알림/찾기바꾸기 ────────────────────────────────────────────────────────
  toastMessage: string | null
  setToastMessage: (msg: string | null) => void

  showFindReplace: boolean
  setShowFindReplace: (val: boolean) => void

  findReplaceMode: 'find' | 'replace'
  setFindReplaceMode: (mode: 'find' | 'replace') => void

  // ── 채팅 ────────────────────────────────────────────────────────────────────
  isChatFloating: boolean
  setIsChatFloating: (val: boolean) => void

  hasChatUnread: boolean
  setHasChatUnread: (val: boolean) => void

  // ── 복합 액션 ───────────────────────────────────────────────────────────────

  /**
   * handleToggleRightTab
   * 우측 탭을 토글한다. 동일 탭 클릭 시 패널 닫힘, 다른 탭 클릭 시 패널 열림 + 탭 전환.
   */
  toggleRightTab: (tab: string) => void
}

export const useUIStore = create<UIState>((set, get) => ({
  // 초기 상태
  isSettingsOpen: false,
  setIsSettingsOpen: (val) => set({ isSettingsOpen: val }),

  isAboutOpen: false,
  setIsAboutOpen: (val) => set({ isAboutOpen: val }),

  isGuideOpen: false,
  setIsGuideOpen: (val) => set({ isGuideOpen: val }),

  isDiffOpen: false,
  setIsDiffOpen: (val) => set({ isDiffOpen: val }),

  showMarketplaceModal: false,
  setShowMarketplaceModal: (val) => set({ showMarketplaceModal: val }),

  showPricingModal: false,
  setShowPricingModal: (val) => set({ showPricingModal: val }),

  showModelHub: false,
  setShowModelHub: (val) => set({ showModelHub: val }),

  showAIPanel: false,
  setShowAIPanel: (val) => set({ showAIPanel: val }),

  activeRightTab: 'ai',
  setActiveRightTab: (tab) => set({ activeRightTab: tab }),

  showSidebar: true,
  setShowSidebar: (val) => set({ showSidebar: val }),

  showStatusBar: true,
  setShowStatusBar: (val) => set({ showStatusBar: val }),

  toastMessage: null,
  setToastMessage: (msg) => set({ toastMessage: msg }),

  showFindReplace: false,
  setShowFindReplace: (val) => set({ showFindReplace: val }),

  findReplaceMode: 'find',
  setFindReplaceMode: (mode) => set({ findReplaceMode: mode }),

  isChatFloating: false,
  setIsChatFloating: (val) => set({ isChatFloating: val }),

  hasChatUnread: false,
  setHasChatUnread: (val) => set({ hasChatUnread: val }),

  toggleRightTab: (tab) => {
    const { showAIPanel, activeRightTab } = get()
    if (showAIPanel && activeRightTab === tab) {
      set({ showAIPanel: false })
    } else {
      set({ activeRightTab: tab, showAIPanel: true })
    }
  }
}))
