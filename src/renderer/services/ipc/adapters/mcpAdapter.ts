export interface MCPSpawnResult {
  success: boolean
  error?: string
  pid?: number
  [key: string]: unknown
}

export interface MCPCallResponse {
  result?: {
    tools?: Record<string, unknown>[]
    content?: unknown[]
    [key: string]: unknown
  }
  error?: {
    code?: number
    message?: string
    [key: string]: unknown
  }
  [key: string]: unknown
}

export interface MCPKillResult {
  success: boolean
  error?: string
  [key: string]: unknown
}

export async function mcpSpawn(serverId: string, command: string, args: string[]): Promise<MCPSpawnResult | null> {
  if (!window.electronAPI?.mcpSpawn) return null
  return window.electronAPI.mcpSpawn(serverId, command, args)
}

export async function mcpCall(serverId: string, request: Record<string, unknown>): Promise<MCPCallResponse | null> {
  if (!window.electronAPI?.mcpCall) return null
  return window.electronAPI.mcpCall(serverId, request)
}

export async function mcpKill(serverId: string): Promise<MCPKillResult | null> {
  if (!window.electronAPI?.mcpKill) return null
  return window.electronAPI.mcpKill(serverId)
}

export async function mcpGetToken(): Promise<string | null> {
  if (!window.electronAPI?.mcpGetToken) return null
  return window.electronAPI.mcpGetToken()
}
