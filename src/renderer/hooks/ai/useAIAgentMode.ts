import { useCallback, useRef } from 'react'
import * as ipc from '../../services/ipc/electronApiAdapter'
import { AgentEngine } from '../../utils/agentEngine'
import type { AIMessage, AISettings } from '../../types/aiTypes'
import { registerAgentTools } from '../../services/ai/agentTools'
import { buildAgentQuery, getAgentSystemPrompt } from '../../services/ai/agentPromptFactory'
import { parseStockDataAndGenerateCard } from '../../services/ai/agentStockCard'

export interface AgentModeParams {
  assistantId: string
  sessId: string
  finalSettings: AISettings
  userMessage: string
  context?: string
  taggedBlocks?: { id: string; text: string }[]
  intent: string
  enabledPlugins: Record<string, boolean>
  isPro: boolean
  editorRef: React.RefObject<any>
  messages: AIMessage[]
  setMessages: React.Dispatch<React.SetStateAction<AIMessage[]>>
  setIsGenerating: React.Dispatch<React.SetStateAction<boolean>>
  currentAssistantIdRef: React.MutableRefObject<string | null>
  processNextQueueRef: React.MutableRefObject<(() => void) | null>
}

export interface AgentModeResult {
  success: boolean
  hasPendingDecision: boolean
  error?: string
}

export function useAIAgentMode() {
  const isAgentRunningRef = useRef(false)

  const runAgentMode = useCallback(async (params: AgentModeParams): Promise<AgentModeResult> => {
    const {
      assistantId,
      sessId,
      finalSettings,
      userMessage,
      taggedBlocks,
      enabledPlugins,
      messages,
      setMessages,
      setIsGenerating,
      currentAssistantIdRef,
      processNextQueueRef
    } = params

    isAgentRunningRef.current = true
    ipc.llmAddLog({ text: '에이전트 모드 활성화. ReAct 루프 기동 중...', prefix: 'ReAct' })

    let agentHasPendingDecision = false

    try {
      const agent = new AgentEngine({
        providerType: finalSettings.apiType === 'ollama' ? 'ollama' : 'llama.cpp',
        endpointUrl: finalSettings.apiType === 'ollama' ? 'http://localhost:11434' : 'http://localhost:12345',
        modelName: finalSettings.modelPath,
        temperature: 0.1,
        maxTurns: 5
      }, sessId)

      await registerAgentTools(agent, enabledPlugins)

      let accumulatedLogs = ''
      const agentQuery = buildAgentQuery(userMessage, messages, taggedBlocks)
      const agentSystemPrompt = getAgentSystemPrompt()

      const agentResult = await agent.executeSession(agentQuery, (log: string) => {
        ipc.llmAddLog({ text: log, prefix: 'ReAct' })
        accumulatedLogs += log

        setMessages((prev) => prev.map((m) => {
          if (m.id !== assistantId) return m

          let statusText = '🤖 에이전트 추론 루프 기동 중...'
          if (accumulatedLogs.includes('Action:')) {
            const lines = accumulatedLogs.split('\n')
            const actionLine = lines.find((l) => l.includes('Action:'))
            if (actionLine) {
              const actName = actionLine.replace(/Action:\s*/i, '').trim()
              statusText = `⚙️ [도구 실행] '${actName}' 도구를 기동하고 있습니다...`
            }
          }

          return {
            ...m,
            content: '',
            isStreaming: true,
            reasoningTrace: [{
              id: `trace_agent_${m.id}_realtime`,
              source: 'model',
              type: 'thinking',
              text: statusText,
              model: finalSettings.modelPath || 'unknown',
              timestamp: new Date().toISOString()
            }]
          }
        }))
      }, agentSystemPrompt)

      if (agentResult.success && agentResult.finalAnswer) {
        const { cleanContent, insertSuggestions } = parseStockDataAndGenerateCard(
          accumulatedLogs,
          agentResult.finalAnswer,
          taggedBlocks
        )

        agentHasPendingDecision = insertSuggestions.length > 0

        setMessages((prev) => prev.map((m) =>
          m.id === assistantId
            ? {
                ...m,
                content: cleanContent,
                isStreaming: false,
                finalAnswer: cleanContent,
                insertSuggestion: insertSuggestions[0],
                insertSuggestions: insertSuggestions,
                reasoningTrace: agentResult.steps.flatMap((s: { thought: string; action?: string; actionInput?: string; observation?: string }, sIdx: number) => {
                  const traces = [{
                    id: `trace_agent_${m.id}_${sIdx}_thought`,
                    source: 'model' as const,
                    type: 'thinking' as const,
                    text: `[사고 단계 ${sIdx + 1}] ${s.thought}`,
                    model: finalSettings.modelPath || 'unknown',
                    timestamp: new Date().toISOString()
                  }]
                  if (s.action) {
                    let actionText = `🎯 도구 실행: ${s.action}\n인자: ${s.actionInput}`
                    if (s.observation) {
                      actionText += `\n\n🔍 결과:\n${s.observation.replace(/^Observation:\s*/i, '').trim()}`
                    }
                    traces.push({
                      id: `trace_agent_${m.id}_${sIdx}_action`,
                      source: 'model' as const,
                      type: 'thinking' as const,
                      text: actionText,
                      model: finalSettings.modelPath || 'unknown',
                      timestamp: new Date().toISOString()
                    })
                  }
                  return traces
                })
              }
            : m
        ))
      } else {
        throw new Error(agentResult.error || '에이전트가 솔루션을 도출하지 못했습니다.')
      }

      return { success: true, hasPendingDecision: agentHasPendingDecision }
    } catch (err: any) {
      console.error('[useAIAgentMode] 에이전트 구동 실패:', err)
      setMessages((prev) => prev.map((m) =>
        m.id === assistantId
          ? { ...m, content: `❌ 에이전트 실행 실패: ${err.message}`, isStreaming: false, error: true }
          : m
      ))
      return { success: false, hasPendingDecision: false, error: err.message }
    } finally {
      isAgentRunningRef.current = false
      setIsGenerating(false)
      currentAssistantIdRef.current = null
      if (!agentHasPendingDecision) {
        setTimeout(() => processNextQueueRef.current?.(), 80)
      }
    }
  }, [])

  return { runAgentMode, isAgentRunningRef }
}
