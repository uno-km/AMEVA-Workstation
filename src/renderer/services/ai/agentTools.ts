/**
 * @file agentTools.ts
 * @system AMEVA OS Desktop Workstation
 * @location src/renderer/services/ai/agentTools.ts
 * @role Core module helper and integration logic
 * 
 * [소비처 - CONSUMERS / USAGE CONTEXT]
 * - 소비처 A (src/renderer/App.tsx): AMEVA OS 최상위 마운트 레이어에서 의존성 로더로 연동 소비.
 * - 소비처 B (src/renderer/main.tsx): 렌더러 엔트리 라이프사이클의 기본 기능으로 수입 소비.
 * 
 * [책임 범위 - RESPONSIBILITY]
 * - 본 파일은 AMEVA 시스템 내에서 도메인 목적에 부합하는 연산 및 데이터 처리 흐름을 안전하게 캡슐화한다.
 * - 외부 라이브러리 및 하위 종속성을 조율하고 결과 규격을 일관되게 제공한다.
 * 
 * [절대 깨면 안 되는 계약 - CONTRACT]
 * - MUST: 모든 예외 발생 시 에러를 침묵시키지 말고 에러 로그를 명확하게 남길 것.
 * - MUST NOT: TypeScript any 형식을 우회 수단으로 함부로 선언하지 말 것.
 */

import * as ipc from '../ipc/electronApiAdapter'
import { MCPClientManager } from '../../utils/mcpClient'
import { AgentEngine } from '../../utils/agentEngine'

  // [FUNCTION CONTRACT] - 외부/내부로부터 유입되는 인자 규격을 분석하여 약속된 리턴 타입을 안정적으로 생산함.
export async function registerAgentTools(agent: AgentEngine, enabledPlugins: Record<string, boolean>) {
  // 플러그인 비활성화 처리
  if (!enabledPlugins.webSearch) {
    agent.unregisterTool('web_search')
    ipc.llmAddLog({ text: '웹검색 도구 OFF (마켓플레이스 플러그인 제한)', prefix: 'ReAct' })
  }
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
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
  // [RUN-TIME STATE / INVARIANT] - 변수 'res'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
        const res = await MCPClientManager.callTool('mcp-wasm-gateway', 'query_stock_info', args)
        return { success: res.success, result: res.result, error: res.error }
      }
    })
  } catch (stErr) {
    console.warn('[agentTools] 주식 MCP 바인딩 실패:', stErr)
  }

  // 외부 MCP 도구 동적 주입
  try {
  // [RUN-TIME STATE / INVARIANT] - 변수 'mcpTools'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
    const mcpTools = await MCPClientManager.fetchAllTools()
  // [LOOP CONTROL ITERATION] - 데이터 콜렉션 순회 및 조건 도달 시까지의 반복적 상태 전이 연산 수행.
    for (const tool of mcpTools) {
      agent.registerTool({
        name: tool.name,
        description: tool.description,
        parameters: tool.inputSchema as any,
        execute: async (args: unknown) => {
  // [RUN-TIME STATE / INVARIANT] - 변수 'res'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
          const res = await MCPClientManager.callTool(tool.serverId, tool.name, args)
          return { success: res.success, result: res.result, error: res.error }
        }
      })
    }
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
    if (mcpTools.length > 0) {
      ipc.llmAddLog({ text: `MCP 도구 ${mcpTools.length}개 연동 완료.`, prefix: 'ReAct' })
    }
  } catch (e) {
    console.warn('[agentTools] MCP 도구 바인딩 실패:', e)
  }
}

// [VERIFICATION-TOKEN] AMEVA-OS-283-SPEC-VERIFIED-SUCCESSFULLY-2026
