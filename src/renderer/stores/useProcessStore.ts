/**
 * useProcessStore.ts
 *
 * 앱 수준 프로세스 상태 전용 Zustand 스토어.
 * 다운로드 진행, 내보내기 진행, 플러그인, 요금제 상태, MCP 서버 목록을 관리한다.
 * App.tsx의 비즈니스 프로세스 관련 useState들을 이 스토어로 이전한다.
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
  // ── 모델 다운로드 상태 ─────────────────────────────────────────────────────
  downloadStatus: any
  setDownloadStatus: (status: any | ((prev: any) => any)) => void

  // ── 내보내기 진행 상태 ─────────────────────────────────────────────────────
  exportProgress: ExportProgress
  setExportProgress: (progress: ExportProgress | ((prev: ExportProgress) => ExportProgress)) => void
  resetExportProgress: () => void

  exportMinimized: boolean
  setExportMinimized: (val: boolean | ((prev: boolean) => boolean)) => void

  // ── 요금제/플랜 상태 ──────────────────────────────────────────────────────
  isProPlan: boolean
  setIsProPlan: (val: boolean | ((prev: boolean) => boolean)) => void

  isFreeModeLocked: boolean
  setIsFreeModeLocked: (val: boolean | ((prev: boolean) => boolean)) => void

  // ── MCP 서버 목록 ─────────────────────────────────────────────────────────
  mcpServersState: any[]
  setMcpServersState: (servers: any[] | ((prev: any[]) => any[])) => void

  // ── 플러그인 ──────────────────────────────────────────────────────────────
  /** 설치된 플러그인 ID 목록 (앱 설정과 별도 관리) */
  activePlugins: string[]
  setActivePlugins: (plugins: string[] | ((prev: string[]) => string[])) => void

  // ── Zoom 상태 ─────────────────────────────────────────────────────────────
  editorZoom: number
  setEditorZoom: (val: number | ((prev: number) => number)) => void

  browserZoom: number
  setBrowserZoom: (val: number | ((prev: number) => number)) => void
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
  setDownloadStatus: (updater) =>
    set((state) => ({
      downloadStatus:
        typeof updater === 'function' ? updater(state.downloadStatus) : updater
    })),

  exportProgress: IDLE_EXPORT_PROGRESS,
  setExportProgress: (updater) =>
    set((state) => ({
      exportProgress: typeof updater === 'function' ? updater(state.exportProgress) : updater
    })),
  resetExportProgress: () => set({ exportProgress: IDLE_EXPORT_PROGRESS }),

  exportMinimized: false,
  setExportMinimized: (val) =>
    set((state) => ({
      exportMinimized: typeof val === 'function' ? val(state.exportMinimized) : val
    })),

  isProPlan: loadIsProPlan(),
  setIsProPlan: (val) =>
    set((state) => ({
      isProPlan: typeof val === 'function' ? val(state.isProPlan) : val
    })),

  isFreeModeLocked: false,
  setIsFreeModeLocked: (val) =>
    set((state) => ({
      isFreeModeLocked: typeof val === 'function' ? val(state.isFreeModeLocked) : val
    })),

  mcpServersState: [],
  setMcpServersState: (updater) =>
    set((state) => ({
      mcpServersState: typeof updater === 'function' ? updater(state.mcpServersState) : updater
    })),

  activePlugins: [],
  setActivePlugins: (updater) =>
    set((state) => ({
      activePlugins: typeof updater === 'function' ? updater(state.activePlugins) : updater
    })),

  editorZoom: 1.0,
  setEditorZoom: (val) =>
    set((state) => ({
      editorZoom: typeof val === 'function' ? val(state.editorZoom) : val
    })),

  browserZoom: 1.0,
  setBrowserZoom: (val) =>
    set((state) => ({
      browserZoom: typeof val === 'function' ? val(state.browserZoom) : val
    }))
}))
