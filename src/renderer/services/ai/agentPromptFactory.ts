import type { AIMessage } from '../../types/aiTypes'

export function buildAgentQuery(
  userMessage: string,
  messages: AIMessage[],
  taggedBlocks?: { id: string; text: string }[]
): string {
  let agentQuery = userMessage

  const historyPayload = messages.slice(-10).map((m) => ({
    role: m.role === 'user' ? 'User' : 'Assistant',
    content: m.finalAnswer ?? m.content
  }))

  if (historyPayload.length > 0) {
    const formattedHistory = historyPayload.map((h) => `${h.role}: ${h.content}`).join('\n')
    agentQuery = `[이전 대화 내역]\n${formattedHistory}\n\n[현재 사용자 질의]: ${userMessage}`
  }

  if (taggedBlocks && taggedBlocks.length > 0) {
    const referencedContent = taggedBlocks.map((b, i) => `[참조 ${i + 1}] ID ${b.id}: "${b.text}"`).join('\n')
    agentQuery = `[참조 본문]\n${referencedContent}\n\n${agentQuery}`
  }

  return agentQuery
}

export function getAgentSystemPrompt(): string {
  return `당신은 사용자 대신 실시간 주가 정보를 획득하는 전문 MCP 에이전트입니다.
사용자가 주가 정보나 시세를 물어보면, 반드시 'query_stock_info' 도구를 최우선 호출하여 실시간 수치를 획득하십시오.
도구 호출이 완료되면 그 결과를 기반으로 최종 답변(Final Answer)을 한두 문장으로 정리하여 제공하십시오.`
}
