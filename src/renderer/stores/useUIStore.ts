/**
 * useUIStore.ts
 *
 * UI 모달/패널 열림닫힘 상태 전용 Zustand 스토어.
 * App.tsx에 흩어져 있던 모달 및 패널 제어 상태를 단일 스토어로 집중한다.
 * 모든 boolean 형태의 세터들은 React의 useState처럼 함수형 업데이트(prev => next)를 지원하도록 확장되었다.
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
  setIsSettingsOpen: (val: boolean | ((prev: boolean) => boolean)) => void

  isAboutOpen: boolean
  setIsAboutOpen: (val: boolean | ((prev: boolean) => boolean)) => void

  isGuideOpen: boolean
  setIsGuideOpen: (val: boolean | ((prev: boolean) => boolean)) => void

  isDiffOpen: boolean
  setIsDiffOpen: (val: boolean | ((prev: boolean) => boolean)) => void

  showMarketplaceModal: boolean
  setShowMarketplaceModal: (val: boolean | ((prev: boolean) => boolean)) => void

  showPricingModal: boolean
  setShowPricingModal: (val: boolean | ((prev: boolean) => boolean)) => void

  showModelHub: boolean
  setShowModelHub: (val: boolean | ((prev: boolean) => boolean)) => void

  // ── 패널 상태 ──────────────────────────────────────────────────────────────
  showAIPanel: boolean
  setShowAIPanel: (val: boolean | ((prev: boolean) => boolean)) => void

  activeRightTab: string
  setActiveRightTab: (tab: string) => void

  showSidebar: boolean
  setShowSidebar: (val: boolean | ((prev: boolean) => boolean)) => void

  showStatusBar: boolean
  setShowStatusBar: (val: boolean | ((prev: boolean) => boolean)) => void

  // ── 알림/찾기바꾸기 ────────────────────────────────────────────────────────
  toastMessage: string | null
  setToastMessage: (msg: string | null | ((prev: string | null) => string | null)) => void

  showFindReplace: boolean
  setShowFindReplace: (val: boolean | ((prev: boolean) => boolean)) => void

  findReplaceMode: 'find' | 'replace'
  setFindReplaceMode: (mode: 'find' | 'replace') => void

  // ── 채팅 ────────────────────────────────────────────────────────────────────
  isChatFloating: boolean
  setIsChatFloating: (val: boolean | ((prev: boolean) => boolean)) => void

  hasChatUnread: boolean
  setHasChatUnread: (val: boolean | ((prev: boolean) => boolean)) => void

  // ── 복합 액션 ───────────────────────────────────────────────────────────────

  /**
   * handleToggleRightTab
   * 우측 탭을 토글한다. 동일 탭 클릭 시 패널 닫힘, 다른 탭 클릭 시 패널 열림 + 탭 전환.
   */
  toggleRightTab: (tab: string) => void
}

export const useUIStore = create<UIState>((set, get) => ({
  // 초기 상태 및 세터 구현 (함수형 업데이트 적용)
  isSettingsOpen: false,
  setIsSettingsOpen: (val) =>
    set((state) => ({
      isSettingsOpen: typeof val === 'function' ? val(state.isSettingsOpen) : val
    })),

  isAboutOpen: false,
  setIsAboutOpen: (val) =>
    set((state) => ({
      isAboutOpen: typeof val === 'function' ? val(state.isAboutOpen) : val
    })),

  isGuideOpen: false,
  setIsGuideOpen: (val) =>
    set((state) => ({
      isGuideOpen: typeof val === 'function' ? val(state.isGuideOpen) : val
    })),

  isDiffOpen: false,
  setIsDiffOpen: (val) =>
    set((state) => ({
      isDiffOpen: typeof val === 'function' ? val(state.isDiffOpen) : val
    })),

  showMarketplaceModal: false,
  setShowMarketplaceModal: (val) =>
    set((state) => ({
      showMarketplaceModal: typeof val === 'function' ? val(state.showMarketplaceModal) : val
    })),

  showPricingModal: false,
  setShowPricingModal: (val) =>
    set((state) => ({
      showPricingModal: typeof val === 'function' ? val(state.showPricingModal) : val
    })),

  showModelHub: false,
  setShowModelHub: (val) =>
    set((state) => ({
      showModelHub: typeof val === 'function' ? val(state.showModelHub) : val
    })),

  showAIPanel: false,
  setShowAIPanel: (val) =>
    set((state) => ({
      showAIPanel: typeof val === 'function' ? val(state.showAIPanel) : val
    })),

  activeRightTab: 'ai',
  setActiveRightTab: (tab) => set({ activeRightTab: tab }),

  showSidebar: true,
  setShowSidebar: (val) =>
    set((state) => ({
      showSidebar: typeof val === 'function' ? val(state.showSidebar) : val
    })),

  showStatusBar: true,
  setShowStatusBar: (val) =>
    set((state) => ({
      showStatusBar: typeof val === 'function' ? val(state.showStatusBar) : val
    })),

  toastMessage: null,
  setToastMessage: (msg) =>
    set((state) => ({
      toastMessage: typeof msg === 'function' ? msg(state.toastMessage) : msg
    })),

  showFindReplace: false,
  setShowFindReplace: (val) =>
    set((state) => ({
      showFindReplace: typeof val === 'function' ? val(state.showFindReplace) : val
    })),

  findReplaceMode: 'find',
  setFindReplaceMode: (mode) => set({ findReplaceMode: mode }),

  isChatFloating: false,
  setIsChatFloating: (val) =>
    set((state) => ({
      isChatFloating: typeof val === 'function' ? val(state.isChatFloating) : val
    })),

  hasChatUnread: false,
  setHasChatUnread: (val) =>
    set((state) => ({
      hasChatUnread: typeof val === 'function' ? val(state.hasChatUnread) : val
    })),

  toggleRightTab: (tab) => {
    const { showAIPanel, activeRightTab } = get()
    if (showAIPanel && activeRightTab === tab) {
      set({ showAIPanel: false })
    } else {
      set({ activeRightTab: tab, showAIPanel: true })
    }
  }
}))

