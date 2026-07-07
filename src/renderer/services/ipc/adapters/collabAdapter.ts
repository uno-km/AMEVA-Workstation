export interface CollabServerStatus {
  running: boolean
  port?: number
  ip?: string
  token?: string
  error?: string
  [key: string]: unknown
}

export interface CollabServerStartResult {
  running?: boolean
  port?: number
  error?: string
  [key: string]: unknown
}

export interface CollabServerStopResult {
  running?: boolean
  error?: string
  [key: string]: unknown
}

export function onServerStatus(callback: (status: CollabServerStatus) => void): () => void {
  if (!window.electronAPI?.onServerStatus) return () => {}
  return window.electronAPI.onServerStatus(callback)
}

export async function startCollaborationServer(port: number): Promise<CollabServerStartResult | null> {
  if (!window.electronAPI?.startCollaborationServer) return null
  return window.electronAPI.startCollaborationServer(port)
}

export async function stopCollaborationServer(): Promise<CollabServerStopResult | null> {
  if (!window.electronAPI?.stopCollaborationServer) return null
  return window.electronAPI.stopCollaborationServer()
}
