import React, { createContext, useContext } from 'react'
import type { EditorMode, ExportFormat, DocumentSnapshot, PeerState } from '../../shared/types'
import type { AmevaEditor as AppEditor } from '../editor/amevaBlockSchema'
import type { ChatMessage } from '../hooks/useChat'
import type { AppSettings } from '../components/SettingsModal'

export interface AppContextType {
  // App UI/Environment
  settings: AppSettings
  handleUpdateSettings: (newSettings: Partial<AppSettings>) => void
  handleInstallPlugin: (id: string, scriptUrl: string) => Promise<void>
  handleUninstallPlugin: (id: string) => void
  handleOpenGithub: () => void
  handleCloseApp: () => void
  handleToggleFullscreen: () => void
  handleZoomIn: () => void
  handleZoomOut: () => void
  handleZoomReset: () => void
  isProPlan: boolean

  // Editor instance & state
  editor: AppEditor | null
  editorMode: EditorMode
  setEditorMode: (mode: EditorMode) => void
  handleSwitchMode: (mode: EditorMode) => void
  handleStartWelcomeEdit: () => void
  handleStartNewDocument: () => void

  // File Operations
  handleOpenFile: () => void
  handleSaveFile: () => void
  handleSaveAsFile: () => void
  handleExport: (format: ExportFormat) => void

  // History & Snapshots
  snapshots: DocumentSnapshot[]
  createSnapshot: (title: string, content?: string) => void
  deleteSnapshot: (id: string) => void
  handleSelectSnapshotForDiff: (snap: DocumentSnapshot) => void
  handleRollback: (content: string) => void
  getLineDiff: any

  // Collaboration
  peers: PeerState[]
  serverRunning: boolean
  serverPort: number
  setServerPort: (port: number) => void
  serverHost: string
  setServerHost: (host: string) => void
  useLocalServer: boolean
  setUseLocalServer: (use: boolean) => void
  toggleLocalServer: (port: number) => void
  collaborationLink: string
  isConnected: boolean
  username: string
  setUsername: (name: string) => void
  userColor: string
  setUserColor: (color: string) => void

  // Chat
  chatMessages: ChatMessage[]
  sendChatMessage: (msg: string) => void
  clearChatMessages: () => void

  // MCP
  mcpServers: any[]
  refreshMcpServers: () => void
}

export const AppContext = createContext<AppContextType | null>(null)

export function AppProvider({ children, value }: { children: React.ReactNode, value: AppContextType }) {
  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  )
}

export function useAppContext(): AppContextType {
  const context = useContext(AppContext)
  if (!context) {
    throw new Error('useAppContext must be used within an AppProvider')
  }
  return context
}
