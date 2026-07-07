/**
 * useWorkspaceStore.ts
 *
 * 워크스페이스(문서 편집) 관련 상태 전용 Zustand 스토어.
 * 파일 경로, 현재 문서 내용, 탭, 에디터 상태, 태그된 블록 등을 관리한다.
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
  setFilePath: (path: string | null) => void

  currentContent: string
  setCurrentContent: (content: string) => void
  appendContent: (text: string) => void

  originalContent: string
  setOriginalContent: (content: string) => void

  lastSavedTime: Date | null
  setLastSavedTime: (time: Date | null) => void

  // ── 다중 탭 상태 ───────────────────────────────────────────────────────────
  fileOpenMode: 'replace' | 'append' | 'tab'
  setFileOpenMode: (mode: 'replace' | 'append' | 'tab') => void

  tabs: WorkspaceTab[]
  setTabs: (tabs: WorkspaceTab[]) => void
  addTab: (tab: WorkspaceTab) => void
  removeTab: (tabId: string) => void
  updateActiveTab: (fields: Partial<WorkspaceTab>) => void
  updateTab: (tabId: string, fields: Partial<WorkspaceTab>) => void

  activeTabId: string | null
  setActiveTabId: (id: string | null) => void

  appendedFiles: { id: string; filePath: string; startBlockId: string }[]
  setAppendedFiles: (files: { id: string; filePath: string; startBlockId: string }[]) => void
  addAppendedFile: (file: { id: string; filePath: string; startBlockId: string }) => void

  // ── 에디터 선택 상태 ────────────────────────────────────────────────────────
  selectedText: string
  setSelectedText: (text: string) => void

  activeBlockId: string | null
  setActiveBlockId: (id: string | null) => void

  taggedBlocks: TaggedBlock[]
  setTaggedBlocks: (blocks: TaggedBlock[]) => void
  addTaggedBlock: (block: TaggedBlock) => void
  removeTaggedBlock: (id: string) => void

  // ── 스냅샷 ────────────────────────────────────────────────────────────────
  selectedSnapshot: any
  setSelectedSnapshot: (snapshot: any) => void
}

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  filePath: null,
  setFilePath: (path) => set({ filePath: path }),

  currentContent: '',
  setCurrentContent: (content) => set({ currentContent: content }),
  appendContent: (text) =>
    set((state) => ({
      currentContent: state.currentContent ? state.currentContent + '\n' + text : text
    })),

  originalContent: '',
  setOriginalContent: (content) => set({ originalContent: content }),

  lastSavedTime: null,
  setLastSavedTime: (time) => set({ lastSavedTime: time }),

  fileOpenMode: 'replace',
  setFileOpenMode: (mode) => set({ fileOpenMode: mode }),

  tabs: [{ id: 'default', filePath: null, content: '', blocks: [] }],
  setTabs: (tabs) => set({ tabs }),
  addTab: (tab) =>
    set((state) => ({
      tabs: [...state.tabs, tab]
    })),
  removeTab: (tabId) =>
    set((state) => ({
      tabs: state.tabs.filter((t) => t.id !== tabId)
    })),
  updateActiveTab: (fields) =>
    set((state) => ({
      tabs: state.tabs.map((t) => (t.id === state.activeTabId ? { ...t, ...fields } : t))
    })),
  updateTab: (tabId, fields) =>
    set((state) => ({
      tabs: state.tabs.map((t) => (t.id === tabId ? { ...t, ...fields } : t))
    })),

  activeTabId: 'default',
  setActiveTabId: (id) => set({ activeTabId: id }),

  appendedFiles: [],
  setAppendedFiles: (files) => set({ appendedFiles: files }),
  addAppendedFile: (file) =>
    set((state) => ({
      appendedFiles: [...state.appendedFiles, file]
    })),

  selectedText: '',
  setSelectedText: (text) => set({ selectedText: text }),

  activeBlockId: null,
  setActiveBlockId: (id) => set({ activeBlockId: id }),

  taggedBlocks: [],
  setTaggedBlocks: (taggedBlocks) => set({ taggedBlocks }),
  addTaggedBlock: (block) =>
    set((state) => {
      if (state.taggedBlocks.some((b) => b.id === block.id)) return {}
      return { taggedBlocks: [...state.taggedBlocks, block] }
    }),
  removeTaggedBlock: (id) =>
    set((state) => ({
      taggedBlocks: state.taggedBlocks.filter((b) => b.id !== id)
    })),

  selectedSnapshot: null,
  setSelectedSnapshot: (snapshot) => set({ selectedSnapshot: snapshot })
}))
