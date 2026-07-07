/**
 * useAIAgent.ts (Refactored Facade)
 *
 * AI 에이전트 훅 파사드 (Facade Pattern).
 * 이 훅은 세부 구현 훅들을 조합하여 UI 컴포넌트에 단일 진입점을 제공한다.
 *
 * [아키텍처 위임 구조]
 * - 스트리밍 토큰 처리  → useAIStreamProcessor
 * - IPC 구독 생애주기  → useAIIpc
 * - 메시지 상태 관리   → useAIMessageState
 * - 요청 큐 관리       → useAIQueue
 * - 엔진 로그 관리     → useAIEngineLogs
 * - 의도 분류          → services/ai/determineIntent
 * - 시스템 프롬프트    → services/ai/buildSystemPrompt
 * - 응답 파싱          → services/ai/aiStreamParser
 * - 사용 한도          → services/ai/checkUsageLimit
 *
 * [복잡도 목표]
 * 이 파일의 Cyclomatic Complexity는 최대 25 이하를 목표로 한다.
 * 세부 복잡한 로직은 모두 위임된 서비스 계층에서 처리한다.
 */

import { useState, useRef, useCallback, useEffect } from 'react'
import { useAIState } from '../stores/useAIState'
import { useAILogStore } from '../stores/useAILogStore'
import { useAIIpc } from './ai/useAIIpc'
import { useAIStreamProcessor } from './ai/useAIStreamProcessor'
import { useAIMessageState } from './ai/useAIMessageState'
import { useAIQueue } from './ai/useAIQueue'
import { useAIEngineLogs } from './ai/useAIEngineLogs'
import { determineIntent } from '../services/ai/determineIntent'
import { detectCodingRequest, detectAgentRequest } from '../services/ai/detectCodingRequest'
import { checkUsageLimit, incrementUsageCount } from '../services/ai/checkUsageLimit'
import { buildSystemPrompt } from '../services/ai/buildSystemPrompt'
import { parseEditSuggestion, parseInsertSuggestions } from '../services/ai/aiStreamParser'
import * as ipc from '../services/ipc/electronApiAdapter'
import { AgentEngine } from '../utils/agentEngine'
import { MCPClientManager } from '../utils/mcpClient'
import type { AIMessage, AISettings, InsertSuggestion } from '../types/aiTypes'
import { DEFAULT_SETTINGS } from '../types/aiTypes'

/**
 * useAIAgent (Facade Hook)
 * 모든 AI 관련 서브훅과 서비스를 조합하여 UI에 단일 API를 제공한다.
 */
export function useAIAgent() {
  // ── 상태 구독 ────────────────────────────────────────────────────────────────
  const { isGenerating, setIsGenerating: _setIsGenerating } = useAIState()
  const isGeneratingRef = useRef(false)
  const setIsGenerating = useCallback((val: boolean) => {
    _setIsGenerating(val)
    isGeneratingRef.current = val
  }, [_setIsGenerating])

  const { isAvailable, setIsAvailable, models, setModels, codeModels, setCodeModels } = useAIState()

  // AI 설정 (LocalStorage 초기화 포함)
  const [settings, setSettings] = useState<AISettings>(() => {
    try {
      const stored = localStorage.getItem('ai-settings')
      if (stored) {
        const parsed = JSON.parse(stored)
        // 구버전 시스템 프롬프트 마이그레이션: fake thought 지침이 있거나 CoT 지침 누락 시 교체
        if (parsed.systemPrompt && (
          parsed.systemPrompt.includes('간결하고 명확하게 답하세요') ||
          parsed.systemPrompt.includes('친근하고 유연하게') ||
          parsed.systemPrompt.includes('AMEVA AI입니다.') ||
          !parsed.systemPrompt.includes('한국어 답변') ||
          !parsed.systemPrompt.includes('INSERT_SUGGESTION') ||
          !parsed.systemPrompt.includes('CoT 사고 과정 지침') ||
          parsed.systemPrompt.includes('<thought>')
        )) {
          parsed.systemPrompt = DEFAULT_SETTINGS.systemPrompt
          localStorage.setItem('ai-settings', JSON.stringify(parsed))
        }
        return { ...DEFAULT_SETTINGS, ...parsed }
      }
    } catch (e) {
      console.error('[useAIAgent] 설정 로드 실패:', e)
    }
    return DEFAULT_SETTINGS
  })

  // ── 서브훅 초기화 ──────────────────────────────────────────────────────────
  const { engineLogs, setEngineLogs } = useAIEngineLogs()
  const { subscribeSession, unsubscribeSession } = useAIIpc()
  const {
    sanitizerRef,
    rawAccumRef,
    currentAssistantIdRef,
    currentSessionIdRef,
    isAgentRunningRef,
    resetSession,
    processToken,
    finalize
  } = useAIStreamProcessor()

  const {
    messages,
    addUserAndAssistantMessages,
    finalizeAssistantMessage,
    updateMessageDiffState,
    updateInsertSuggestionStatus
  } = useAIMessageState()

  const {
    pendingQueue,
    pendingQueueRef,
    removeFromQueue,
    enqueue,
    checkAndProcessNextQueue,
    clearQueue
  } = useAIQueue(isGeneratingRef)

  const { setMessages, setStreamingText } = useAILogStore()

  // 에디터 인스턴스 레프 (자동 적용용)
  const editorRef = useRef<any>(null)

  // ── 모델 목록 갱신 ──────────────────────────────────────────────────────────
  const refreshModels = useCallback(async () => {
    if (!ipc.isElectronEnv()) return
    try {
      const type = settings.apiType === 'ollama' ? 'ollama' : 'llm'
      const list = await ipc.llmListModels(type)
      setModels(list)

      if (list.length > 0) {
        setSettings((prev) => {
          const exists = list.some((m) => m.path === prev.modelPath)
          if (exists) return prev
          const preferred =
            type === 'ollama'
              ? list[0]
              : list.find((m) => m.filename.includes('3b')) || list[list.length - 1]
          return { ...prev, modelPath: preferred.path }
        })
      }

      const codeList = await ipc.llmListModels('code')
      setCodeModels(codeList)
      if (codeList.length > 0) {
        setSettings((prev) => {
          const exists = codeList.some((m) => m.path === prev.codeModelPath)
          if (exists) return prev
          return { ...prev, codeModelPath: codeList[0].path }
        })
      }
    } catch (e) {
      console.warn('[useAIAgent] 모델 목록 갱신 실패:', e)
    }
  }, [settings.apiType, setModels, setCodeModels])

  // 초기 모델 목록 로드
  useEffect(() => {
    if (!ipc.isElectronEnv()) {
      // 브라우저 환경: WebGPU/클라우드 API/Ollama 모드 가동을 위해 available 처리
      setIsAvailable(true)
      return
    }
    refreshModels()
  }, [settings.apiType, refreshModels, setIsAvailable])

  // API 타입별 헬스 체크 폴링 (4초 간격)
  useEffect(() => {
    if (!ipc.isElectronEnv()) return

    const checkHealth = async () => {
      const type = settings.apiType || 'local'

      if (type === 'api') {
        setIsAvailable(true)
        return
      }

      if (type === 'ollama') {
        try {
          const res = await fetch('http://localhost:11434/api/tags', {
            method: 'GET',
            signal: AbortSignal.timeout(1500)
          })
          setIsAvailable(res.ok)
        } catch {
          setIsAvailable(false)
        }
        return
      }

      // 'local' 또는 'wasm' 모드: llama-server 헬스 체크
      const result = await ipc.llmCheckHealth()
      setIsAvailable(result.status === 'ok' || result.status === 'loading model')
    }

    checkHealth()
    const timer = setInterval(checkHealth, 4000)
    return () => clearInterval(timer)
  }, [settings.apiType, setIsAvailable])

  // ── 큐 checkAndProcess 바인딩 (순환 참조 방지) ───────────────────────────
  const processNextQueueRef = useRef<(() => void) | null>(null)

  // ── generateResponse (핵심 생성 함수) ───────────────────────────────────
  const generateResponse = useCallback(async (
    userMessage: string,
    context?: string,
    originalText?: string,
    blockId?: string,
    runtimeSettings?: Partial<AISettings>,
    editorInstance?: any,
    taggedBlocks?: { id: string; text: string }[]
  ) => {
    if (editorInstance) {
      editorRef.current = editorInstance
    }

    if (!ipc.isElectronEnv()) return

    // 플러그인/플랜 상태 파싱
    let isPro = false
    let enabledPlugins: Record<string, boolean> = { webSearch: true, pythonConsole: true }
    try {
      isPro = localStorage.getItem('is-pro-plan') === 'true'
      const storedPlugins = localStorage.getItem('enabled-plugins')
      if (storedPlugins) enabledPlugins = JSON.parse(storedPlugins)
    } catch (e) {
      console.error('[useAIAgent] 플러그인 상태 로드 실패:', e)
    }

    // 생성 중이면 큐에 추가
    if (isGeneratingRef.current) {
      enqueue({ userMessage, context, originalText, blockId, runtimeSettings, editorInstance, taggedBlocks })
      return
    }

    console.log('[useAI] generateResponse 호출됨. 런타임 세팅:', runtimeSettings)

    // 의도 분류 및 설정 병합
    const intent = determineIntent(userMessage, taggedBlocks, (runtimeSettings as any)?.resolvedMode)
    const finalSettings = { ...settings, ...runtimeSettings }

    // 코딩 요청 감지 및 코딩 특화 모델 교체
    const isCodingRequest = detectCodingRequest(userMessage)
    let codeModelUsed = false
    if (isCodingRequest && finalSettings.codeModelPath && finalSettings.codeModelPath !== '') {
      finalSettings.modelPath = finalSettings.codeModelPath
      codeModelUsed = true
    }

    // 사용 한도 체크 (무료 플랜)
    const limitResult = checkUsageLimit(isPro, finalSettings)
    if (limitResult.isLimitExceeded) {
      const limitMessageId = `msg_limit_${Date.now()}`
      setMessages((prev) => [
        ...prev,
        {
          id: limitMessageId,
          role: 'assistant' as const,
          content: limitResult.limitMessage || '일일 한도를 초과했습니다.',
          timestamp: Date.now()
        }
      ])
      return
    }

    // 새 assistant 메시지 ID 및 세션 ID 생성
    const assistantId = `msg_${Date.now()}_assistant`
    const sessId = crypto.randomUUID()

    // 스트리밍 프로세서 세션 초기화
    resetSession(sessId, assistantId)

    // 사용자/assistant 메시지 추가
    const userMsg: AIMessage = {
      id: `msg_${Date.now()}_user`,
      role: 'user',
      content: userMessage,
      timestamp: Date.now(),
      taggedBlocks: taggedBlocks && taggedBlocks.length > 0 ? [...taggedBlocks] : undefined
    }

    addUserAndAssistantMessages(userMsg, assistantId, originalText, blockId)

    if (codeModelUsed) {
      const modelNameOnly = finalSettings.modelPath.split(/[/\\]/).pop()
      setEngineLogs(`[System] 코딩 요청이 감지되었습니다. 코딩 특화 모델(${modelNameOnly})로 전환하여 응답을 생성합니다.\n`)
    }

    setIsGenerating(true)
    setStreamingText('')

    // 에이전트 모드 감지
    const needsAgent = detectAgentRequest(userMessage)

    if (needsAgent) {
      // 에이전트 실행 경로
      await runAgentMode({
        assistantId, sessId, finalSettings, userMessage, context,
        taggedBlocks, intent, enabledPlugins, isPro
      })
      return
    }

    // 시스템 프롬프트 조립
    const dynamicSystemPrompt = buildSystemPrompt({
      baseSystemPrompt: finalSettings.systemPrompt,
      intent,
      context,
      taggedBlocks,
      isCodingRequest
    })

    // 최근 대화 히스토리 페이로드 생성
    const historyPayload = messages.slice(-10).map((m) => ({
      role: m.role === 'user' ? 'user' : 'assistant' as const,
      content: m.finalAnswer ?? m.content
    }))

    // IPC 구독 등록
    subscribeSession(
      sessId,
      (token) => processToken(token, sessId),
      (data) => handleDone(data, sessId, assistantId, taggedBlocks, intent)
    )

    // LLM 생성 요청
    const result = await ipc.llmGenerate({
      sessionId: sessId,
      modelPath: finalSettings.modelPath,
      prompt: userMessage,
      context: (taggedBlocks && taggedBlocks.length > 0) ? undefined : (context || undefined),
      systemPrompt: dynamicSystemPrompt,
      maxTokens: finalSettings.maxTokens,
      temperature: finalSettings.temperature,
      apiType: finalSettings.apiType === 'wasm' ? 'local' : finalSettings.apiType,
      apiKey: finalSettings.apiKey,
      apiEndpoint: finalSettings.apiEndpoint,
      apiModel: finalSettings.apiModel,
      gpuOnly: finalSettings.gpuOnly,
      history: historyPayload
    })

    // 즉각 에러 처리 (리스너가 받기 전에 llmGenerate 자체가 실패한 경우)
    if (!result.success && result.error) {
      console.error('[useAI] LLM 구동 실패:', result.error)
      setIsGenerating(false)
      setMessages((prev) => prev.map((m) =>
        m.id === assistantId
          ? { ...m, content: `❌ ${result.error}`, isStreaming: false, error: true }
          : m
      ))
      currentAssistantIdRef.current = null
      setTimeout(() => processNextQueueRef.current?.(), 80)
    }

    // 사용량 카운트 증가 (무료 플랜 + 클라우드 API 사용자)
    const isLocalModel = finalSettings.apiType === 'local' || finalSettings.apiType === 'wasm' || finalSettings.apiType === 'ollama'
    const isPersonalApiKey = finalSettings.apiType === 'api' && !!finalSettings.apiKey && finalSettings.apiKey.trim() !== ''
    if (!isPro && !isLocalModel && !isPersonalApiKey) {
      incrementUsageCount()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings, messages, isGeneratingRef, enqueue, setIsGenerating, setMessages, setStreamingText,
      resetSession, addUserAndAssistantMessages, processToken, subscribeSession, setEngineLogs])

  /**
   * handleDone
   * LLM Done 이벤트 수신 시 호출되는 내부 핸들러.
   * 파싱, 자동 반영, 큐 처리를 수행한다.
   */
  const handleDone = useCallback((
    data: { success: boolean; error?: string },
    sessId: string,
    assistantId: string,
    taggedBlocks?: { id: string; text: string }[],
    intent?: string
  ) => {
    if (sessId !== currentSessionIdRef.current) return

    const sanitizeResult = finalize()
    const rawForEdit = rawAccumRef.current
    const targetId = currentAssistantIdRef.current

    // EDIT_SUGGESTION 파싱
    const editSuggestionResult = data.success ? parseEditSuggestion(rawForEdit) : null

    // INSERT_SUGGESTION 파싱
    let siblingBlockIds: string[] = []
    if (editorRef.current) {
      try {
        const flatBlocks = (function flatten(blocks: any[]): any[] {
          return blocks.flatMap((b: any) => [b, ...flatten(b.children || [])])
        })(editorRef.current.document || [])
        siblingBlockIds = flatBlocks.map((b: any) => b.id)
      } catch (e) {
        console.warn('[useAIAgent] 에디터 블록 목록 조회 실패:', e)
      }
    }

    const insertResult = (!editSuggestionResult && data.success)
      ? parseInsertSuggestions(rawForEdit, sanitizeResult.finalContent, siblingBlockIds)
      : null

    const insertSuggestions: InsertSuggestion[] = insertResult?.suggestions ?? []

    // EDIT_SUGGESTION 자동 반영 (에디터 직접 업데이트)
    if (editSuggestionResult && data.success && editorRef.current) {
      try {
        const { blockId: editBlockId, proposedText } = editSuggestionResult
        const block = editorRef.current.getBlock(editBlockId)
        if (block) {
          if (block.type === 'jupyter') {
            editorRef.current.updateBlock(editBlockId, {
              type: 'jupyter',
              props: { ...block.props, code: proposedText }
            })
          } else {
            editorRef.current.updateBlock(editBlockId, {
              content: [{ type: 'text', text: proposedText, styles: {} }]
            })
          }
        }
      } catch (e) {
        console.error('[useAIAgent] EDIT_SUGGESTION 자동 반영 실패:', e)
      }
    }

    // INSERT_SUGGESTION 자동 반영
    if (insertSuggestions.length > 0 && data.success && editorRef.current) {
      insertSuggestions.forEach((s) => {
        if (s.afterBlockId && s.afterBlockId !== 'undefined') {
          try {
            editorRef.current.insertBlocks(
              [{
                type: s.blockType === 'heading' ? 'heading' : 'paragraph',
                props: s.level ? { level: s.level } : undefined,
                content: [{ type: 'text', text: s.content, styles: {} }]
              }],
              s.afterBlockId,
              'after'
            )
          } catch (insErr) {
            console.warn('[useAIAgent] INSERT_SUGGESTION 자동 반영 실패:', insErr)
          }
        }
      })
    }

    // taggedBlocks 폴백 자동 반영
    if (!editSuggestionResult && insertSuggestions.length === 0 && data.success && editorRef.current) {
      if (taggedBlocks && taggedBlocks.length > 0 && (intent === 'EDIT' || intent === 'WRITE')) {
        try {
          const firstBlock = taggedBlocks[0]
          const block = editorRef.current.getBlock(firstBlock.id)
          if (block) {
            const finalClean = sanitizeResult.finalContent
              .replace(/^\[(WRITE|EDIT|CHAT|SUMMARY)\]\s*/i, '')
              .trim()
            if (block.type === 'jupyter') {
              editorRef.current.updateBlock(firstBlock.id, {
                type: 'jupyter',
                props: { ...block.props, code: finalClean }
              })
            } else {
              editorRef.current.updateBlock(firstBlock.id, {
                content: [{ type: 'text', text: finalClean, styles: {} }]
              })
            }
          }
        } catch (e) {
          console.error('[useAIAgent] 태그블록 자동 반영 실패:', e)
        }
      }
    }

    // 메시지 상태 최종 업데이트
    finalizeAssistantMessage({
      targetId,
      sanitizeResult,
      rawForEdit,
      success: data.success,
      error: data.error,
      editSuggestion: editSuggestionResult,
      insertSuggestions
    })

    // 리스너 해제
    unsubscribeSession()

    // 수정/삽입 대기 결정이 있으면 큐 실행 보류
    const hasPendingDecision = data.success && (!!editSuggestionResult || insertSuggestions.length > 0)
    if (!hasPendingDecision) {
      setTimeout(() => processNextQueueRef.current?.(), 80)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSessionIdRef, currentAssistantIdRef, rawAccumRef, finalize, finalizeAssistantMessage,
      unsubscribeSession, editorRef])

  /**
   * runAgentMode
   * 에이전트(ReAct Loop) 모드를 실행한다.
   * AgentEngine을 초기화하고 MCP 도구를 바인딩하여 다단계 추론을 수행한다.
   */
  const runAgentMode = useCallback(async (params: {
    assistantId: string
    sessId: string
    finalSettings: AISettings
    userMessage: string
    context?: string
    taggedBlocks?: { id: string; text: string }[]
    intent: string
    enabledPlugins: Record<string, boolean>
    isPro: boolean
  }) => {
    const { assistantId, sessId, finalSettings, userMessage, taggedBlocks, intent, enabledPlugins } = params

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

      // 플러그인 비활성화
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
          execute: async (args) => {
            const res = await MCPClientManager.callTool('mcp-wasm-gateway', 'query_stock_info', args)
            return { success: res.success, result: res.result, error: res.error }
          }
        })
      } catch (stErr) {
        console.warn('[useAIAgent] 주식 MCP 바인딩 실패:', stErr)
      }

      // 외부 MCP 도구 동적 주입
      try {
        const mcpTools = await MCPClientManager.fetchAllTools()
        for (const tool of mcpTools) {
          agent.registerTool({
            name: tool.name,
            description: tool.description,
            parameters: tool.inputSchema as any,
            execute: async (args) => {
              const res = await MCPClientManager.callTool(tool.serverId, tool.name, args)
              return { success: res.success, result: res.result, error: res.error }
            }
          })
        }
        if (mcpTools.length > 0) {
          ipc.llmAddLog({ text: `MCP 도구 ${mcpTools.length}개 연동 완료.`, prefix: 'ReAct' })
        }
      } catch (e) {
        console.warn('[useAIAgent] MCP 도구 바인딩 실패:', e)
      }

      // 에이전트 실행 (멀티턴 맥락 포함)
      let accumulatedLogs = ''
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

      const agentSystemPrompt = `당신은 사용자 대신 실시간 주가 정보를 획득하는 전문 MCP 에이전트입니다.
사용자가 주가 정보나 시세를 물어보면, 반드시 'query_stock_info' 도구를 최우선 호출하여 실시간 수치를 획득하십시오.
도구 호출이 완료되면 그 결과를 기반으로 최종 답변(Final Answer)을 한두 문장으로 정리하여 제공하십시오.`

      const agentResult = await agent.executeSession(agentQuery, (log) => {
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
              source: 'model' as const,
              type: 'thinking' as const,
              text: statusText,
              model: finalSettings.modelPath || 'unknown',
              timestamp: new Date().toISOString()
            }]
          }
        }))
      }, agentSystemPrompt)

      if (agentResult.success && agentResult.finalAnswer) {
        const finalAnswer = agentResult.finalAnswer
        const insertSuggestions: InsertSuggestion[] = []
        let cleanContent = finalAnswer

        // 주식 JSON 파싱 및 HTML 카드 생성
        const stockLog = `${accumulatedLogs} ${finalAnswer}`
        let stockData: any = null
        const jsonRegex = /({[\s\S]*?})/g
        let match: RegExpExecArray | null
        while ((match = jsonRegex.exec(stockLog)) !== null) {
          try {
            const parsed = JSON.parse(match[1].trim())
            if (parsed && parsed.name && parsed.price) {
              stockData = parsed
              break
            }
          } catch {
            // 유효하지 않은 JSON 스킵
          }
        }

        if (stockData) {
          cleanContent = `✔ **MCP 데이터 연동 완료**\n${stockData.name}(${stockData.code})의 실시간 주가 데이터 수집을 성공했습니다.`
          const targetId = (taggedBlocks && taggedBlocks.length > 0) ? taggedBlocks[0].id : 'START'

          const isUp = !String(stockData.change || '').includes('▼') && !String(stockData.pct || '').includes('-')
          const themeBg = isUp ? '#f0fdf4' : '#fef2f2'
          const themeBorder = isUp ? '#bbf7d0' : '#fecaca'
          const themeText = isUp ? '#15803d' : '#b91c1c'
          const themeAccent = isUp ? '#22c55e' : '#ef4444'

          const htmlCard = `//# [AMEVA_LANG:html]\n` +
            `<div style="background: ${themeBg}; border: 1.5px solid ${themeBorder}; border-radius: 12px; padding: 20px; color: #1e293b; font-family: sans-serif; box-shadow: 0 4px 12px rgba(0,0,0,0.05); position: relative; max-width: 580px; box-sizing: border-box;">\n` +
            `  <div style="position: absolute; top: 16px; right: 16px; background: ${themeAccent}; color: white; font-size: 10px; font-weight: bold; padding: 3px 8px; border-radius: 20px;">⚡ MCP Live</div>\n` +
            `  <div style="font-size: 14px; font-weight: bold; color: ${themeText}; margin-bottom: 12px;">📈 ${stockData.name} (${stockData.code}) 시세 정보</div>\n` +
            `  <div style="font-size: 28px; font-weight: 800; color: #0f172a; margin-bottom: 16px;">${stockData.price} <span style="font-size: 14px; color: ${themeAccent};">${stockData.change} (${stockData.pct})</span></div>\n` +
            `  <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; font-size: 12px; color: #475569;">\n` +
            `    <div>전일가: <strong>${stockData.yesterday}</strong></div>\n` +
            `    <div>고가: <strong>${stockData.high}</strong></div>\n` +
            `    <div>거래량: <strong>${stockData.volume}</strong></div>\n` +
            `    <div>외인비중: <strong>${stockData.foreign}</strong></div>\n` +
            `  </div>\n</div>`

          insertSuggestions.push({
            afterBlockId: targetId,
            blockType: 'paragraph',
            content: htmlCard,
            reasonText: cleanContent,
            status: 'pending',
            siblingBlockIds: [targetId],
            siblingIndex: 0
          })
        } else {
          // INSERT/EDIT 제안 파싱
          const editSug = parseEditSuggestion(finalAnswer)
          if (editSug) {
            cleanContent = editSug.cleanContent
          } else {
            const insertResult = parseInsertSuggestions(finalAnswer, finalAnswer, [])
            if (insertResult) {
              insertSuggestions.push(...insertResult.suggestions)
              cleanContent = insertResult.cleanContent
            }
          }
        }

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
                reasoningTrace: agentResult.steps.flatMap((s, sIdx) => {
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
    } catch (err: any) {
      console.error('[useAIAgent] 에이전트 구동 실패:', err)
      setMessages((prev) => prev.map((m) =>
        m.id === assistantId
          ? { ...m, content: `❌ 에이전트 실행 실패: ${err.message}`, isStreaming: false, error: true }
          : m
      ))
    } finally {
      isAgentRunningRef.current = false
      setIsGenerating(false)
      currentAssistantIdRef.current = null
      if (!agentHasPendingDecision) {
        setTimeout(() => processNextQueueRef.current?.(), 80)
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, setMessages, setIsGenerating, isAgentRunningRef, currentAssistantIdRef])

  // processNextQueueRef에 실제 함수 바인딩 (순환 참조 방지)
  useEffect(() => {
    processNextQueueRef.current = () => checkAndProcessNextQueue(generateResponse)
  }, [checkAndProcessNextQueue, generateResponse])

  // ── abortGeneration ───────────────────────────────────────────────────────
  const abortGeneration = useCallback(() => {
    clearQueue()
    setMessages((prev) => prev.filter((m) => !m.id.startsWith('msg_queue_')))
    if (!ipc.isElectronEnv() || !isGenerating) return
    const currentSessionId = currentSessionIdRef.current || 'default'
    ipc.llmAbort(currentSessionId)
  }, [isGenerating, clearQueue, setMessages, currentSessionIdRef])

  // ── clearHistory ──────────────────────────────────────────────────────────
  const clearHistory = useCallback(() => {
    setMessages([])
    setStreamingText('')
  }, [setMessages, setStreamingText])

  // ── updateSettings ────────────────────────────────────────────────────────
  const updateSettings = useCallback((newSettings: Partial<AISettings>) => {
    setSettings((prev) => {
      const updated = { ...prev, ...newSettings }
      try {
        // API Key는 LocalStorage에 저장하지 않음 (보안: 메모리 전용)
        const { apiKey: _apiKey, ...safeSettings } = updated
        localStorage.setItem('ai-settings', JSON.stringify(safeSettings))
      } catch (e) {
        console.error('[useAIAgent] 설정 저장 실패:', e)
      }
      return updated
    })
  }, [])

  // ── processBlock (단발성 블록 텍스트 반환) ────────────────────────────────
  const processBlock = useCallback(async (
    action: 'summarize' | 'translate' | 'improve' | 'expand' | 'explain',
    content: string,
    targetLang?: string
  ): Promise<string> => {
    if (!ipc.isElectronEnv()) return ''

    const prompts: Record<string, string> = {
      summarize: `다음 텍스트를 3줄 이내로 핵심만 요약하세요:\n\n${content}`,
      translate: `다음 텍스트를 ${targetLang || '영어'}로 번역하세요. 번역문만 출력하세요:\n\n${content}`,
      improve: `다음 텍스트의 문체와 표현을 개선하세요. 개선된 텍스트만 출력하세요:\n\n${content}`,
      expand: `다음 텍스트를 더 자세하고 풍부하게 확장하세요:\n\n${content}`,
      explain: `다음 내용을 쉽게 설명하세요:\n\n${content}`
    }

    return new Promise<string>((resolve) => {
      let result = ''
      let settled = false
      const sessId = `quick-${Date.now()}`

      const cleanup = (unsubToken: () => void, unsubDone: () => void) => {
        if (!settled) {
          settled = true
          unsubToken()
          unsubDone()
        }
      }

      // 리스너를 먼저 등록 후 요청 (레이스 컨디션 방지)
      const unsubToken = ipc.onLLMToken(sessId, (token) => {
        if (!settled) result += token
      })
      const unsubDone = ipc.onLLMDone(sessId, (data) => {
        if (settled) return
        cleanup(unsubToken, unsubDone)
        resolve(data.success ? result.trim() : (data.error || ''))
      })

      // 60초 타임아웃 안전망
      const timeoutId = setTimeout(() => {
        if (!settled) {
          cleanup(unsubToken, unsubDone)
          resolve(result.trim() || '')
        }
      }, 60_000)

      ipc.llmGenerate({
        sessionId: sessId,
        modelPath: settings.modelPath,
        prompt: prompts[action] || content,
        systemPrompt: 'You are a document editing assistant. Output only the requested content without any explanation or preamble.',
        maxTokens: 512,
        temperature: 0.5,
        apiType: settings.apiType === 'wasm' ? 'local' : settings.apiType,
        apiKey: settings.apiKey,
        apiEndpoint: settings.apiEndpoint,
        apiModel: settings.apiModel,
        gpuOnly: settings.gpuOnly
      }).catch(() => {
        clearTimeout(timeoutId)
        cleanup(unsubToken, unsubDone)
        resolve('')
      })
    })
  }, [settings.modelPath, settings.apiType, settings.apiKey, settings.apiEndpoint, settings.apiModel, settings.gpuOnly])

  // ── updateMessageDiffState 래퍼 (큐 연동 포함) ────────────────────────────
  const handleUpdateMessageDiffState = useCallback((msgId: string, state: 'accepted' | 'rejected') => {
    updateMessageDiffState(msgId, state, () => processNextQueueRef.current?.())
  }, [updateMessageDiffState])

  // ── updateInsertSuggestionStatus 래퍼 (큐 연동 포함) ─────────────────────
  const handleUpdateInsertSuggestionStatus = useCallback((
    msgId: string,
    status: 'pending' | 'accepted' | 'rejected',
    newAfterBlockId?: string,
    newSiblingIndex?: number,
    suggestionIndex?: number
  ) => {
    updateInsertSuggestionStatus(
      msgId, status, newAfterBlockId, newSiblingIndex, suggestionIndex,
      () => processNextQueueRef.current?.()
    )
  }, [updateInsertSuggestionStatus])

  return {
    messages,
    isGenerating,
    isAvailable,
    models,
    codeModels,
    settings,
    streamingText: useAILogStore((s) => s.streamingText),
    engineLogs,
    setEngineLogs,
    generateResponse,
    processBlock,
    abortGeneration,
    clearHistory,
    updateSettings,
    updateMessageDiffState: handleUpdateMessageDiffState,
    updateInsertSuggestionStatus: handleUpdateInsertSuggestionStatus,
    pendingQueue,
    removeFromQueue,
    refreshModels
  }
}
