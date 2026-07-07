/**
 * useWorkspaceStore.ts
 *
 * 워크스페이스(문서 편집) 관련 상태 전용 Zustand 스토어.
 * 파일 경로, 현재 문서 내용, 탭, 에디터 상태, 태그된 블록 등을 관리한다.
 * 모든 상태 변경 세터들은 React의 useState처럼 함수형 업데이트(prev => next)를 지원하도록 확장되었다.
 */

import { create } from 'zustand'

/** 탭 항목 타입 */
export interface WorkspaceTab {
  id: string
  filePath: string | null
  content: string
  blocks: any[]
  originalContent?: string
  lastSavedTime?: Date | null
}

/** 태깅된 블록 타입 */
export interface TaggedBlock {
  id: string
  text: string
}

export interface WorkspaceState {
  // ── 파일 상태 ──────────────────────────────────────────────────────────────
  filePath: string | null
  setFilePath: (path: string | null | ((prev: string | null) => string | null)) => void

  currentContent: string
  setCurrentContent: (content: string | ((prev: string) => string)) => void

  originalContent: string
  setOriginalContent: (content: string | ((prev: string) => string)) => void

  lastSavedTime: Date | null
  setLastSavedTime: (time: Date | null | ((prev: Date | null) => Date | null)) => void

  // ── 다중 탭 상태 ───────────────────────────────────────────────────────────
  fileOpenMode: 'replace' | 'append' | 'tab'
  setFileOpenMode: (mode: 'replace' | 'append' | 'tab') => void

  tabs: WorkspaceTab[]
  setTabs: (tabs: WorkspaceTab[] | ((prev: WorkspaceTab[]) => WorkspaceTab[])) => void

  activeTabId: string | null
  setActiveTabId: (id: string | null) => void

  appendedFiles: { id: string; filePath: string; startBlockId: string }[]
  setAppendedFiles: (files: { id: string; filePath: string; startBlockId: string }[] | ((prev: any[]) => any[])) => void

  // ── 에디터 선택 상태 ────────────────────────────────────────────────────────
  selectedText: string
  setSelectedText: (text: string | ((prev: string) => string)) => void

  activeBlockId: string | null
  setActiveBlockId: (id: string | null | ((prev: string | null) => string | null)) => void

  taggedBlocks: TaggedBlock[]
  setTaggedBlocks: (blocks: TaggedBlock[] | ((prev: TaggedBlock[]) => TaggedBlock[])) => void

  // ── 스냅샷 ────────────────────────────────────────────────────────────────
  selectedSnapshot: any
  setSelectedSnapshot: (snapshot: any | ((prev: any) => any)) => void
}

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  filePath: null,
  setFilePath: (path) =>
    set((state) => ({
      filePath: typeof path === 'function' ? path(state.filePath) : path
    })),

  currentContent: '',
  setCurrentContent: (content) =>
    set((state) => ({
      currentContent: typeof content === 'function' ? content(state.currentContent) : content
    })),

  originalContent: '',
  setOriginalContent: (content) =>
    set((state) => ({
      originalContent: typeof content === 'function' ? content(state.originalContent) : content
    })),

  lastSavedTime: null,
  setLastSavedTime: (time) =>
    set((state) => ({
      lastSavedTime: typeof time === 'function' ? time(state.lastSavedTime) : time
    })),

  fileOpenMode: 'replace',
  setFileOpenMode: (mode) => set({ fileOpenMode: mode }),

  tabs: [{ id: 'default', filePath: null, content: '', blocks: [] }],
  setTabs: (updater) =>
    set((state) => ({
      tabs: typeof updater === 'function' ? updater(state.tabs) : updater
    })),

  activeTabId: 'default',
  setActiveTabId: (id) => set({ activeTabId: id }),

  appendedFiles: [],
  setAppendedFiles: (updater) =>
    set((state) => ({
      appendedFiles: typeof updater === 'function' ? updater(state.appendedFiles) : updater
    })),

  selectedText: '',
  setSelectedText: (text) =>
    set((state) => ({
      selectedText: typeof text === 'function' ? text(state.selectedText) : text
    })),

  activeBlockId: null,
  setActiveBlockId: (id) =>
    set((state) => ({
      activeBlockId: typeof id === 'function' ? id(state.activeBlockId) : id
    })),

  taggedBlocks: [],
  setTaggedBlocks: (updater) =>
    set((state) => ({
      taggedBlocks: typeof updater === 'function' ? updater(state.taggedBlocks) : updater
    })),

  selectedSnapshot: null,
  setSelectedSnapshot: (snapshot) =>
    set((state) => ({
      selectedSnapshot: typeof snapshot === 'function' ? snapshot(state.selectedSnapshot) : snapshot
    }))
}))
