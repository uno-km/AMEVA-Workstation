/**
 * @file mcpIpc.ts
 * @system AMEVA OS Desktop Workstation
 * @location src/main/ipc/mcpIpc.ts
 * @role Core module helper and integration logic
 * 
 * [소비처 - CONSUMERS / USAGE CONTEXT]
 * - 소비처 A (src/main/index.ts): 일렉트론 메인 라이프사이클(ready/will-quit) 및 윈도우 생성 시점에 결합 구동.
 * - 소비처 B (src/main/preload.ts): contextBridge 안전 통로 노출을 위한 핵심 백엔드 기능 공급자로 소비.
 * 
 * [책임 범위 - RESPONSIBILITY]
 * - 본 파일은 AMEVA 시스템 내에서 도메인 목적에 부합하는 연산 및 데이터 처리 흐름을 안전하게 캡슐화한다.
 * - 외부 라이브러리 및 하위 종속성을 조율하고 결과 규격을 일관되게 제공한다.
 * 
 * [절대 깨면 안 되는 계약 - CONTRACT]
 * - MUST: 모든 예외 발생 시 에러를 침묵시키지 말고 에러 로그를 명확하게 남길 것.
 * - MUST NOT: TypeScript any 형식을 우회 수단으로 함부로 선언하지 말 것.
 */

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
