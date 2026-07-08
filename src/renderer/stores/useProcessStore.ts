/**
 * useProcessStore.ts
 *
 * 앱 수준 프로세스 상태 전용 Zustand 스토어.
 */

import { create } from 'zustand'
import type { ExportProgress } from '../../shared/types'

/** 기본 내보내기 상태 (idle 상태) */
export const IDLE_EXPORT_PROGRESS: ExportProgress = {
  phase: 'idle',
  format: '',
  percent: 0,
  message: ''
}

export interface ProcessState {
  // ── 모델 다운로드 큐 상태 ─────────────────────────────────────────────────────
  downloadStatus: any
  setDownloadStatus: (status: any) => void

  downloadQueue: any[]
  addDownloadToQueue: (item: any) => void
  removeDownloadFromQueue: (id: string) => void
  updateDownloadInQueue: (id: string, updates: any) => void
  clearCompletedDownloads: () => void

  // ── 내보내기 진행 상태 ─────────────────────────────────────────────────────
  exportProgress: ExportProgress
  setExportProgress: (progress: ExportProgress) => void
  updateExportProgress: (progress: Partial<ExportProgress>) => void
  resetExportProgress: () => void

  exportMinimized: boolean
  setExportMinimized: (val: boolean) => void
  toggleExportMinimized: () => void

  // ── 요금제/플랜 상태 ──────────────────────────────────────────────────────
  isProPlan: boolean
  setIsProPlan: (val: boolean) => void

  isFreeModeLocked: boolean
  setIsFreeModeLocked: (val: boolean) => void

  // ── MCP 서버 목록 ─────────────────────────────────────────────────────────
  mcpServersState: any[]
  setMcpServersState: (servers: any[]) => void

  // ── 플러그인 ──────────────────────────────────────────────────────────────
  activePlugins: string[]
  setActivePlugins: (plugins: string[]) => void

  // ── Zoom 상태 ─────────────────────────────────────────────────────────────
  editorZoom: number
  setEditorZoom: (val: number) => void
  adjustEditorZoom: (delta: number) => void

  browserZoom: number
  setBrowserZoom: (val: number) => void
  adjustBrowserZoom: (delta: number) => void
}

/** 요금제 초기값: LocalStorage에서 복원 */
function loadIsProPlan(): boolean {
  try {
    return localStorage.getItem('is-pro-plan') === 'true'
  } catch {
    return false
  }
}

export const useProcessStore = create<ProcessState>((set) => ({
  downloadStatus: null,
  setDownloadStatus: (status) => set({ downloadStatus: status }),

  downloadQueue: [],
  addDownloadToQueue: (item) =>
    set((state) => ({ downloadQueue: [...state.downloadQueue, item] })),
  removeDownloadFromQueue: (id) =>
    set((state) => ({
      downloadQueue: state.downloadQueue.filter((q: any) => q.id !== id)
    })),
  updateDownloadInQueue: (id, updates) =>
    set((state) => ({
      downloadQueue: state.downloadQueue.map((q: any) =>
        q.id === id ? { ...q, ...updates } : q
      )
    })),
  clearCompletedDownloads: () =>
    set((state) => ({
      downloadQueue: state.downloadQueue.filter((q: any) => q.status !== 'completed' && q.status !== 'error')
    })),

  exportProgress: IDLE_EXPORT_PROGRESS,
  setExportProgress: (progress) => set({ exportProgress: progress }),
  updateExportProgress: (fields) =>
    set((state) => ({
      exportProgress: { ...state.exportProgress, ...fields }
    })),
  resetExportProgress: () => set({ exportProgress: IDLE_EXPORT_PROGRESS }),

  exportMinimized: false,
  setExportMinimized: (val) => set({ exportMinimized: val }),
  toggleExportMinimized: () => set((state) => ({ exportMinimized: !state.exportMinimized })),

  isProPlan: loadIsProPlan(),
  setIsProPlan: (val) => set({ isProPlan: val }),

  isFreeModeLocked: false,
  setIsFreeModeLocked: (val) => set({ isFreeModeLocked: val }),

  mcpServersState: [],
  setMcpServersState: (servers) => set({ mcpServersState: servers }),

  activePlugins: [],
  setActivePlugins: (plugins) => set({ activePlugins: plugins }),

  editorZoom: 1.0,
  setEditorZoom: (val) => set({ editorZoom: val }),
  adjustEditorZoom: (delta) =>
    set((state) => {
      const next = Math.min(2.5, Math.max(0.4, Math.round((state.editorZoom + delta) * 10) / 10))
      return { editorZoom: next }
    }),

  browserZoom: 1.0,
  setBrowserZoom: (val) => set({ browserZoom: val }),
  adjustBrowserZoom: (delta) =>
    set((state) => {
      const next = Math.min(2.5, Math.max(0.4, Math.round((state.browserZoom + delta) * 10) / 10))
      return { browserZoom: next }
    })
}))
