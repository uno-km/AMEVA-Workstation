import * as ipc from '../ipc/electronApiAdapter'
import { MCPClientManager } from '../../utils/mcpClient'
import { AgentEngine } from '../../utils/agentEngine'

export async function registerAgentTools(agent: AgentEngine, enabledPlugins: Record<string, boolean>) {
  // 플러그인 비활성화 처리
  if (!enabledPlugins.webSearch) {
    agent.unregisterTool('web_search')
    ipc.llmAddLog({ text: '웹검색 도구 OFF (마켓플레이스 플러그인 제한)', prefix: 'ReAct' })
  }
  if (!enabledPlugins.pythonConsole) {
    agent.unregisterTool('run_python')
    ipc.llmAddLog({ text: '파이썬 콘솔 도구 OFF (마켓플레이스 플러그인 제한)', prefix: 'ReAct' })
  }

  // 주식 MCP 도구 바인딩
  try {
    agent.registerTool({
      name: 'query_stock_info',
      description: '회사명 또는 주식 기호로 실시간 주가를 조회합니다.',
      parameters: {
        type: 'object',
        properties: { stockCode: { type: 'string', description: '회사명 또는 종목코드' } },
        required: ['stockCode']
      },
      execute: async (args: unknown) => {
        const res = await MCPClientManager.callTool('mcp-wasm-gateway', 'query_stock_info', args)
        return { success: res.success, result: res.result, error: res.error }
      }
    })
  } catch (stErr) {
    console.warn('[agentTools] 주식 MCP 바인딩 실패:', stErr)
  }

  // 외부 MCP 도구 동적 주입
  try {
    const mcpTools = await MCPClientManager.fetchAllTools()
    for (const tool of mcpTools) {
      agent.registerTool({
        name: tool.name,
        description: tool.description,
        parameters: tool.inputSchema as any,
        execute: async (args: unknown) => {
          const res = await MCPClientManager.callTool(tool.serverId, tool.name, args)
          return { success: res.success, result: res.result, error: res.error }
        }
      })
    }
    if (mcpTools.length > 0) {
      ipc.llmAddLog({ text: `MCP 도구 ${mcpTools.length}개 연동 완료.`, prefix: 'ReAct' })
    }
  } catch (e) {
    console.warn('[agentTools] MCP 도구 바인딩 실패:', e)
  }
}
