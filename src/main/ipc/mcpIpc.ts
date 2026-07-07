import { ipcMain } from 'electron'
import { existsSync, readFileSync } from 'fs'
import { MCPProcessManager } from '../services/mcpProcessManager.js'
import { getProPlanMemory } from '../services/planState.js'

/**
 * MCP 자식 프로세스 및 토큰 관리 IPC 핸들러를 등록합니다.
 */
export function registerMcpIpc(): void {
  // 🤖 MCP IPC 핸들러 등록
  ipcMain.handle('mcp:spawn', async (_event, serverId: string, command: string, args: string[]) => {
    if (!getProPlanMemory()) {
      return { success: false, error: '무료 요금제에서는 MCP 서버를 기동할 수 없습니다. Pro 요금제로 업그레이드하세요.' }
    }
    return await MCPProcessManager.spawnServer(serverId, command, args)
  })

  ipcMain.handle('mcp:call', async (_event, serverId: string, request: any) => {
    if (!getProPlanMemory()) {
      return { success: false, error: '무료 요금제에서는 MCP 도구를 호출할 수 없습니다. Pro 요금제로 업그레이드하세요.' }
    }
    return await MCPProcessManager.callServer(serverId, request)
  })

  ipcMain.handle('mcp:kill', async (_event, serverId: string) => {
    MCPProcessManager.killServer(serverId)
    return { success: true }
  })

  ipcMain.handle('mcp:getToken', async () => {
    try {
      if (process.env.AMEVA_TOKEN) {
        return process.env.AMEVA_TOKEN.trim()
      }
      const tokenPath = 'c:\\ameva\\AMEVA-MCP-Wasm-Toolkit\\.token'
      if (existsSync(tokenPath)) {
        return readFileSync(tokenPath, 'utf8').trim()
      }
    } catch (err) {
      console.error('mcp:getToken 실패:', err)
    }
    return null
  })
}
