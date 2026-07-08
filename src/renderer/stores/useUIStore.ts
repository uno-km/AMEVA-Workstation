/**
 * useUIStore.ts
 *
 * UI 모달/패널 열림닫힘 상태 전용 Zustand 스토어.
 */

import { create } from 'zustand'

export interface UIState {
  // ── 모달 열림/닫힘 ──────────────────────────────────────────────────────────
  isSettingsOpen: boolean
  settingsInitialTab?: string
  setIsSettingsOpen: (val: boolean, tab?: string) => void
  toggleSettings: () => void

  isAboutOpen: boolean
  setIsAboutOpen: (val: boolean) => void
  toggleAbout: () => void

  isGuideOpen: boolean
  setIsGuideOpen: (val: boolean) => void
  toggleGuide: () => void

  isDiffOpen: boolean
  setIsDiffOpen: (val: boolean) => void
  toggleDiff: () => void

  showMarketplaceModal: boolean
  setShowMarketplaceModal: (val: boolean) => void
  toggleMarketplaceModal: () => void

  showPricingModal: boolean
  setShowPricingModal: (val: boolean) => void
  togglePricingModal: () => void

  showModelHub: boolean
  setShowModelHub: (val: boolean) => void
  toggleModelHub: () => void

  // ── 패널 상태 ──────────────────────────────────────────────────────────────
  showAIPanel: boolean
  setShowAIPanel: (val: boolean) => void
  toggleAIPanel: () => void

  activeRightTab: string
  setActiveRightTab: (tab: string) => void

  showSidebar: boolean
  setShowSidebar: (val: boolean) => void
  toggleSidebar: () => void

  showStatusBar: boolean
  setShowStatusBar: (val: boolean) => void
  toggleStatusBar: () => void

  // ── 알림/찾기바꾸기 ────────────────────────────────────────────────────────
  toastMessage: string | null
  setToastMessage: (msg: string | null) => void

  showFindReplace: boolean
  setShowFindReplace: (val: boolean) => void
  toggleFindReplace: () => void

  findReplaceMode: 'find' | 'replace'
  setFindReplaceMode: (mode: 'find' | 'replace') => void

  // ── 채팅 ────────────────────────────────────────────────────────────────────
  isChatFloating: boolean
  setIsChatFloating: (val: boolean) => void
  toggleChatFloating: () => void

  hasChatUnread: boolean
  setHasChatUnread: (val: boolean) => void

  // ── 종료 확인 모달 ──────────────────────────────────────────────────────────
  isQuitConfirmOpen: boolean
  setIsQuitConfirmOpen: (val: boolean) => void

  // ── 복합 액션 ───────────────────────────────────────────────────────────────
  toggleRightTab: (tab: string) => void

  // ── Z-Index 관리 ────────────────────────────────────────────────────────────
  baseZIndex: number
  bringToFront: () => number
}

export const useUIStore = create<UIState>((set, get) => ({
  isSettingsOpen: false,
  settingsInitialTab: undefined,
  setIsSettingsOpen: (val, tab) => set({ isSettingsOpen: val, settingsInitialTab: tab }),
  toggleSettings: () => set((state) => ({ isSettingsOpen: !state.isSettingsOpen, settingsInitialTab: undefined })),

  isAboutOpen: false,
  setIsAboutOpen: (val) => set({ isAboutOpen: val }),
  toggleAbout: () => set((state) => ({ isAboutOpen: !state.isAboutOpen })),

  isGuideOpen: false,
  setIsGuideOpen: (val) => set({ isGuideOpen: val }),
  toggleGuide: () => set((state) => ({ isGuideOpen: !state.isGuideOpen })),

  isDiffOpen: false,
  setIsDiffOpen: (val) => set({ isDiffOpen: val }),
  toggleDiff: () => set((state) => ({ isDiffOpen: !state.isDiffOpen })),

  showMarketplaceModal: false,
  setShowMarketplaceModal: (val) => set({ showMarketplaceModal: val }),
  toggleMarketplaceModal: () => set((state) => ({ showMarketplaceModal: !state.showMarketplaceModal })),

  showPricingModal: false,
  setShowPricingModal: (val) => set({ showPricingModal: val }),
  togglePricingModal: () => set((state) => ({ showPricingModal: !state.showPricingModal })),

  showModelHub: false,
  setShowModelHub: (val) => set({ showModelHub: val }),
  toggleModelHub: () => set((state) => ({ showModelHub: !state.showModelHub })),

  showAIPanel: false,
  setShowAIPanel: (val) => set({ showAIPanel: val }),
  toggleAIPanel: () => set((state) => ({ showAIPanel: !state.showAIPanel })),

  activeRightTab: 'ai',
  setActiveRightTab: (tab) => set({ activeRightTab: tab }),

  showSidebar: true,
  setShowSidebar: (val) => set({ showSidebar: val }),
  toggleSidebar: () => set((state) => ({ showSidebar: !state.showSidebar })),

  showStatusBar: true,
  setShowStatusBar: (val) => set({ showStatusBar: val }),
  toggleStatusBar: () => set((state) => ({ showStatusBar: !state.showStatusBar })),

  toastMessage: null,
  setToastMessage: (msg) => set({ toastMessage: msg }),

  showFindReplace: false,
  setShowFindReplace: (val) => set({ showFindReplace: val }),
  toggleFindReplace: () => set((state) => ({ showFindReplace: !state.showFindReplace })),

  findReplaceMode: 'find',
  setFindReplaceMode: (mode) => set({ findReplaceMode: mode }),

  isChatFloating: false,
  setIsChatFloating: (val) => set({ isChatFloating: val }),
  toggleChatFloating: () => set((state) => ({ isChatFloating: !state.isChatFloating })),

  hasChatUnread: false,
  setHasChatUnread: (val) => set({ hasChatUnread: val }),

  isQuitConfirmOpen: false,
  setIsQuitConfirmOpen: (val) => set({ isQuitConfirmOpen: val }),

  toggleRightTab: (tab) => {
    const { showAIPanel, activeRightTab } = get()
    if (showAIPanel && activeRightTab === tab) {
      set({ showAIPanel: false })
    } else {
      set({ activeRightTab: tab, showAIPanel: true })
    }
  },

  baseZIndex: 10000,
  bringToFront: () => {
    let newZ = 10000;
    set(state => {
      newZ = state.baseZIndex + 10;
      return { baseZIndex: newZ };
    });
    return newZ;
  }
}))
