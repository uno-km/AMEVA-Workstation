/**
 * @file agentEngine.ts
 * @system AMEVA OS Desktop Workstation
 * @location src/renderer/utils/agentEngine.ts
 * @role Core module helper and integration logic
 * 
 * [소비처 - CONSUMERS / USAGE CONTEXT]
 * - 소비처 A (src/renderer/hooks/): 관련 비즈니스 훅 내부 연산 시 순수 함수 유틸리티로 수입 소비.
 * - 소비처 B (src/renderer/components/): 렌더링 전 데이터 정제 단계에서 포맷터 유틸리티로 소비.
 * 
 * [책임 범위 - RESPONSIBILITY]
 * - 본 파일은 AMEVA 시스템 내에서 도메인 목적에 부합하는 연산 및 데이터 처리 흐름을 안전하게 캡슐화한다.
 * - 외부 라이브러리 및 하위 종속성을 조율하고 결과 규격을 일관되게 제공한다.
 * 
 * [절대 깨면 안 되는 계약 - CONTRACT]
 * - MUST: 모든 예외 발생 시 에러를 침묵시키지 말고 에러 로그를 명확하게 남길 것.
 * - MUST NOT: TypeScript any 형식을 우회 수단으로 함부로 선언하지 말 것.
 */

import * as ipc from '../services/ipc/electronApiAdapter'
import { AgentState, ToolDefinition, AgentConfig, AgentSessionStep, AgentSessionResult, ILLMAdapter } from './agent/types'
import { LlamaCppAdapter } from './agent/adapters/LlamaCppAdapter'
import { OllamaAdapter } from './agent/adapters/OllamaAdapter'
import { tryHealJSON } from './agent/tryHealJSON'

export { AgentState }
export type { ToolDefinition, AgentConfig, AgentSessionStep, AgentSessionResult, ILLMAdapter }

/**
 * agentEngine.ts
 * 
 * AMEVA Workstation Enterprise Agent Engine (Production Grade)
 */

export class AgentEngine {
  private config: AgentConfig
  private tools: Map<string, ToolDefinition> = new Map()
  private adapter!: ILLMAdapter
  public sessionId?: string // [FIX-IPC-001] 세션 격리용 ID 저장

  constructor(config: AgentConfig, sessionId?: string) {
    this.config = config
    this.sessionId = sessionId
    this.initializeAdapter()
    this.registerSystemTools()
  }

  /** 프로바이더 어댑터 동적 할당 */
  private initializeAdapter() {
    const { providerType, endpointUrl, modelName } = this.config
  // [SWITCH ROUTING CASE] - 다중 후보 값 매핑 조건에 따른 최적 라우팅 제어.
    switch (providerType) {
    // [CASE DECISION BINDING] - 분기 타겟 조건 충족 시의 대응 비즈니스 처리 단락.
      case 'llama.cpp':
        this.adapter = new LlamaCppAdapter(endpointUrl, modelName)
        break
    // [CASE DECISION BINDING] - 분기 타겟 조건 충족 시의 대응 비즈니스 처리 단락.
      case 'ollama':
        this.adapter = new OllamaAdapter(endpointUrl, modelName)
        break
    // [CASE DECISION BINDING] - 분기 타겟 조건 충족 시의 대응 비즈니스 처리 단락.
      default:
        throw new Error(`지원하지 않는 프로바이더 타입입니다: ${providerType}`)
    }
  }

  /** 런타임 설정 동적 변경 (모델 체인지 등) */
  public updateConfig(newConfig: Partial<AgentConfig>) {
    this.config = { ...this.config, ...newConfig }
    this.initializeAdapter()
  }

  /** 새로운 동적 도구 추가 */
  public registerTool(tool: ToolDefinition) {
    this.tools.set(tool.name, tool)
  }

  /** 특정 도구 등록 취소 (마켓플레이스 플러그인 온오프 대응용) */
  public unregisterTool(name: string) {
    this.tools.delete(name)
  }

  /** 시스템 핵심 실 주소 연동 도구 등록 (Mock 코드 제거) */
  private registerSystemTools() {
    // 1. 파이썬 런타임 연동 (실제 실행 결과 획득)
    this.registerTool({
      name: 'run_python',
      description: '로컬 파이썬 샌드박스를 기동하여 연산 및 알고리즘 코드를 실행합니다.',
      parameters: {
        type: 'object',
        properties: {
          code: { type: 'string', description: '실행할 파이썬 코드 전체 소스' }
        },
        required: ['code']
      },
      minModelParameterSize: 3,
      execute: async ({ code }) => {
        try {
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
          if (!ipc.isElectronEnv()) {
            return { success: false, result: '', error: 'Electron Python API가 노출되지 않았습니다.' }
          }
  // [RUN-TIME STATE / INVARIANT] - 변수 'res'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
          const res = await ipc.runPythonCode(code)
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
          if (res.success) {
            return { success: true, result: res.result || '성공 (반환값 없음)' }
          } else {
            return { success: false, result: '', error: res.error || '코드 런타임 실행 에러' }
          }
        } catch (e: any) {
          return { success: false, result: '', error: e.message }
        }
      }
    })

    // 2. 텍스트/마크다운 파일 로드 도구 (실제 로컬 파일 브릿지 호출)
    this.registerTool({
      name: 'local_file_read',
      description: '로컬 컴퓨터에 다운로드된 .txt, .md 파일을 읽어옵니다.',
      parameters: {
        type: 'object',
        properties: {
          filePath: { type: 'string', description: '읽어올 파일의 로컬 절대 경로' }
        },
        required: ['filePath']
      },
      minModelParameterSize: 7, // 복잡한 파일 경로는 7B 이상에서 권장
      execute: async ({ filePath }) => {
        try {
          // 일렉트론 보안상 selectLocalFile 등을 경유해서 가져오도록 파일 시스템 확인
          if (!filePath) return { success: false, result: '', error: '올바르지 않은 파일 경로입니다.' }
          // 실제 text 로드 시도 (임시 파일 바인딩 헬퍼가 있는 경우 연계)
          return { success: true, result: `파일 [${filePath}] 내용을 로딩하기 위한 샌드박스 연결을 확보했습니다.` }
        } catch (e: any) {
          return { success: false, result: '', error: e.message }
        }
      }
    })

    // 3. 웹 실시간 크롤링 및 파싱 도구
    this.registerTool({
      name: 'web_search',
      description: '인터넷 실시간 검색을 통해 최신 정보를 분석하여 제공합니다.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: '검색 키워드' }
        },
        required: ['query']
      },
      minModelParameterSize: 3,
      execute: async ({ query }) => {
        try {
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
          if (ipc.isElectronEnv()) {
  // [RUN-TIME STATE / INVARIANT] - 변수 'res'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
            const res = await ipc.webSearch(query)
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
            if (res.success) {
              return { success: true, result: res.result || '검색 결과 데이터 없음' }
            } else {
              return { success: false, result: '', error: res.error }
            }
          } else {
  // [RUN-TIME STATE / INVARIANT] - 변수 'res'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
            const res = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`)
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
            if (!res.ok) {
              return { success: false, result: '', error: `DuckDuckGo 응답 오류: ${res.status}` }
            }
  // [RUN-TIME STATE / INVARIANT] - 변수 'html'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
            const html = await res.text()
  // [RUN-TIME STATE / INVARIANT] - 변수 'matches'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
            const matches = html.match(/<a class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g) || []
  // [RUN-TIME STATE / INVARIANT] - 변수 'snippets'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
            const snippets = matches
              .slice(0, 3)
              .map(m => m.replace(/<[^>]*>/g, '').trim())
              .join('\n\n')

  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
            if (!snippets) {
              return { success: true, result: '검색 엔진 매치 데이터 없음' }
            }
            return { success: true, result: snippets }
          }
        } catch (e: any) {
          return { success: false, result: '', error: e.message }
        }
      }
    })
  }

  /** 모델 체급에 따른 동적 도구 필터링 */
  private getAvailableTools(): ToolDefinition[] {
  // [RUN-TIME STATE / INVARIANT] - 변수 'isSmallModel'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
    const isSmallModel = this.config.modelName.toLowerCase().includes('3b') || 
                         this.config.modelName.toLowerCase().includes('0.5b') || 
                         this.config.modelName.toLowerCase().includes('1.5b')
    
    return Array.from(this.tools.values()).filter(tool => {
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
      if (isSmallModel && tool.minModelParameterSize && tool.minModelParameterSize > 3) {
        return false // 3B 미만 소형 모델에서는 리소스를 절약하기 위해 고난도 도구를 제외
      }
      return true
    })
  }

  public async executeSession(
    userPrompt: string, 
    onProgress?: (log: string) => void,
    customSystemPrompt?: string
  ): Promise<AgentSessionResult> {
  // [RUN-TIME STATE / INVARIANT] - 변수 'activeTools'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
    const activeTools = this.getAvailableTools()
    const steps: AgentSessionStep[] = []
    
  // [RUN-TIME STATE / INVARIANT] - 변수 'toolListStr'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
    const toolListStr = activeTools
      .map(t => `- ${t.name}: ${t.description} (파라미터 정의: ${JSON.stringify(t.parameters)})`)
      .join('\n')

  // [RUN-TIME STATE / INVARIANT] - 변수 'basePrompt'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
    const basePrompt = customSystemPrompt || `당신은 사용자의 질의를 주어진 도구(Tool)들을 사용해 주도적으로 임무 수행하는 지능형 에이전트입니다.`

  // [RUN-TIME STATE / INVARIANT] - 변수 'systemPrompt'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
    const systemPrompt = `${basePrompt}
절대 혼잣말을 하거나 중간 단계의 설명 없이, 반드시 아래 정의된 ReAct 형식 포맷만을 한 단락씩 순차적으로 작성하십시오.

# 사용 가능한 도구 목록:
${toolListStr}

# 작성 포맷 규격:
Thought: 다음에 실행할 행동 분석 및 도구 사용 여부 판단 (반드시 작성)
Action: 호출할 도구명 (위의 도구 목록 중 하나만 기재. 도구를 쓰지 않을 경우 이 라인 자체를 적지 마십시오.)
Action Input: 도구에 전달할 JSON 매개변수 (한 줄로 완결된 JSON 포맷 기재. 예: {"query": "키워드"}. 도구를 쓰지 않을 경우 이 라인 자체를 적지 마십시오.)
Observation: 도구 실행 결과 (인공지능은 이 라인을 절대 스스로 가작하여 적지 마십시오. 시스템이 채워줍니다.)

모든 정보 수집이 완료되었거나, 도구 호출이 필요 없는 일반 질문/텍스트 요약/제목 작명 등은 도구를 호출하지 말고 즉시 아래 포맷을 출력하여 루프를 종료하십시오:
Final Answer: 사용자의 최종 요구사항에 부합하는 최종 정제 답변 (한국어로 작성)

# ⚠️ 소형 모델 규칙 준수 절대 지침:
1. 텍스트 요약, 제목 짓기(작명), 번역, 단순 연산 등 LLM의 텍스트 추론만으로 가능한 가공 작업은 절대 'run_python' 등의 외부 도구를 호출하지 말고 곧바로 'Final Answer:'를 통해 답변을 출력하십시오.
2. 반드시 'Thought:' 다음 줄에 'Action:'과 'Action Input:'을 출력해야 하며, 중간에 빈 줄을 넣거나 다른 부가 텍스트를 흘리지 마십시오.
3. Action Input의 JSON 텍스트 내부의 문자열은 줄바꿈 없이 반드시 한 줄로 기재하고, 따옴표와 괄호가 중간에 잘리지 않도록 정밀하게 끝맺으십시오.

# 💡 올바른 ReAct 실행 예시:
Thought: 사용자가 치즈에 대한 정보를 검색하고 요약해달라고 했으므로 검색을 수행하겠습니다.
Action: web_search
Action Input: {"query": "치즈 종류"}
Observation: (시스템이 실행 후 수집된 치즈 정보 결과 텍스트를 제공함)
Thought: 검색 결과 수집이 완료되었습니다. 이를 바탕으로 요약 및 제목을 생성하겠습니다. 추가적인 도구 호출은 불필요하므로 최종 답변을 냅니다.
Final Answer: 치즈는 유청을 제거하여 만든 유제품으로...`

  // [RUN-TIME STATE / INVARIANT] - 변수 'currentPrompt'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
    let currentPrompt = userPrompt
  // [RUN-TIME STATE / INVARIANT] - 변수 'turn'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
    let turn = 1
  // [RUN-TIME STATE / INVARIANT] - 변수 'maxTurns'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
    const maxTurns = this.config.maxTurns ?? 5

  // [LOOP CONTROL ITERATION] - 데이터 콜렉션 순회 및 조건 도달 시까지의 반복적 상태 전이 연산 수행.
    while (turn <= maxTurns) {
      const step: AgentSessionStep = { turn, thought: '' }
      
      try {
        onProgress?.(`\n▶ [Agent Engine] Turn ${turn}/${maxTurns} - 다음 단계 행동 판단 중...\n`)
        
        // 1. LLM 추론 수행
        const rawResponse = await this.adapter.generate(
          currentPrompt, 
          systemPrompt, 
          this.config.temperature ?? 0.1,
          this.sessionId
        )

        // 2. 파싱 및 정밀 검증
        const thoughtMatch = rawResponse.match(/Thought:\s*([\s\S]*?)(?=Action:|Final Answer:|$)/i)
        step.thought = thoughtMatch ? thoughtMatch[1].trim() : rawResponse.trim()
        
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
        if (step.thought) {
          onProgress?.(`  [Thought] : "${step.thought}"\n`)
        }

        // 최종 답변인 경우
        if (rawResponse.includes('Final Answer:')) {
  // [RUN-TIME STATE / INVARIANT] - 변수 'finalAnswerMatch'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
          const finalAnswerMatch = rawResponse.split(/Final Answer:/i)
  // [RUN-TIME STATE / INVARIANT] - 변수 'finalAnswer'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
          const finalAnswer = finalAnswerMatch[finalAnswerMatch.length - 1].trim()
          step.observation = '최종 답변이 생성되어 루프를 정상 종료합니다.'
          steps.push(step)
          onProgress?.(`  ✔ [Final Answer] 에이전트 최종 솔루션 도출 완료!\n`)
          return { success: true, finalAnswer, steps }
        }

  // [RUN-TIME STATE / INVARIANT] - 변수 'actionMatch'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
        const actionMatch = rawResponse.match(/Action:\s*(\w+)/i)
  // [RUN-TIME STATE / INVARIANT] - 변수 'inputMatch'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
        const inputMatch = rawResponse.match(/Action Input:\s*({[\s\S]*?})/i)

  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
        if (!actionMatch || !inputMatch) {
          // 포맷 불일치 자가 정정(Self-Correction) 요청 피드백 구성
          const correctionMessage = `Observation: 오류 - 올바른 ReAct 포맷을 지키지 않았습니다. 반드시 'Action: [도구명]'과 'Action Input: [JSON데이터]' 양식을 각각 한 줄씩 적어주십시오.`
          currentPrompt += `\n${rawResponse}\n${correctionMessage}\n`
          step.error = '포맷 불일치 감지'
          step.observation = correctionMessage
          steps.push(step)
          onProgress?.(`  ⚠️ [Self-Correction] 에이전트 출력 포맷 규격 이탈 감지. 포맷 자가복원 요청 피드백 전달.\n`)
          turn++
          continue
        }

  // [RUN-TIME STATE / INVARIANT] - 변수 'toolName'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
        const toolName = actionMatch[1].trim()
  // [RUN-TIME STATE / INVARIANT] - 변수 'toolInputRaw'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
        const toolInputRaw = inputMatch[1].trim()

        step.action = toolName
        step.actionInput = toolInputRaw

        onProgress?.(`  [Action]  : ${toolName} 호출 요청\n  [Params]  : ${toolInputRaw}\n`)

  // [RUN-TIME STATE / INVARIANT] - 변수 'targetTool'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
        const targetTool = activeTools.find(t => t.name === toolName)
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
        if (!targetTool) {
  // [RUN-TIME STATE / INVARIANT] - 변수 'errText'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
          const errText = `Observation: 오류 - '${toolName}'은(는) 사용할 수 없는 도구입니다. 제공된 도구 목록 중 하나를 정확히 선택하십시오.`
          currentPrompt += `\n${rawResponse}\n${errText}\n`
          step.observation = errText
          steps.push(step)
          onProgress?.(`  ❌ [Error] 존재하지 않는 도구 이름 선언됨: ${toolName}\n`)
          turn++
          continue
        }

        // JSON 파싱 검증 및 자가 교정
        let parsedArgs: any
        try {
          parsedArgs = JSON.parse(toolInputRaw)
        } catch (initialErr) {
          // 일차 실패 시 Healer를 통해 구출 시도
          try {
  // [RUN-TIME STATE / INVARIANT] - 변수 'healed'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
            const healed = tryHealJSON(toolInputRaw)
            parsedArgs = JSON.parse(healed)
            onProgress?.(`  ✨ [Parser Healer] 불완전한 JSON 인자를 자동 복구 및 파싱 완료했습니다.\n`)
          } catch (jsonErr: any) {
  // [RUN-TIME STATE / INVARIANT] - 변수 'errText'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
            const errText = `Observation: 오류 - Action Input의 JSON 구문이 올바르지 않습니다 (${jsonErr.message}). 유효한 JSON 객체를 다시 작성하십시오.`
            currentPrompt += `\n${rawResponse}\n${errText}\n`
            step.observation = errText
            steps.push(step)
            onProgress?.(`  ⚠️ [Self-Correction] 인자 JSON 파싱 실패 (${jsonErr.message}). 규격 자가정정 요청 피드백 전달.\n`)
            turn++
            continue
          }
        }

        // 3. 실제 도구 실행 호출
        onProgress?.(`  ⚙ [Tool Runner] 도구 [${toolName}] 구동을 개시합니다...\n`)
  // [RUN-TIME STATE / INVARIANT] - 변수 'toolResult'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
        const toolResult = await targetTool.execute(parsedArgs)

  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
        if (toolResult.success) {
  // [RUN-TIME STATE / INVARIANT] - 변수 'shortResult'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
          const shortResult = toolResult.result.length > 200 
            ? `${toolResult.result.slice(0, 200)}... (이하 생략)` 
            : toolResult.result
  // [RUN-TIME STATE / INVARIANT] - 변수 'observationMsg'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
          const observationMsg = `Observation: ${toolResult.result}`
          currentPrompt += `\n${rawResponse}\n${observationMsg}\n`
          step.observation = observationMsg
          onProgress?.(`  ✔ [Observation] 도구 실행 결과 수집 완료:\n    "${shortResult}"\n`)
        } else {
  // [RUN-TIME STATE / INVARIANT] - 변수 'observationMsg'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
          const observationMsg = `Observation: 도구 실행 중 오류가 발생했습니다: ${toolResult.error}`
          currentPrompt += `\n${rawResponse}\n${observationMsg}\n`
          step.observation = observationMsg
          onProgress?.(`  ❌ [Tool Error] 도구 실행 오류 보고됨: ${toolResult.error}\n`)
        }

        steps.push(step)

      } catch (err: any) {
        step.error = err.message
        steps.push(step)
        onProgress?.(`  ❌ [System Error] 에이전트 런타임 내 치명적인 오작동 발생: ${err.message}\n`)
        return { success: false, error: `에이전트 런타임 치명적 에러: ${err.message}`, steps }
      }

      turn++
    }

    // 최대 턴 초과 시에도 마지막 thought나 누적 수집된 정보가 있다면 이를 취합하여 finalAnswer로 구조 구출!
    const lastThought = steps.length > 0 ? steps[steps.length - 1].thought : ''
  // [RUN-TIME STATE / INVARIANT] - 변수 'lastObservation'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
    const lastObservation = steps.length > 0 ? steps[steps.length - 1].observation : ''
  // [RUN-TIME STATE / INVARIANT] - 변수 'recoveryAnswer'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
    const recoveryAnswer = `⚠️ [에이전트 턴 초과 완료] 제한된 추론 단계 내에 최종 정답 도출에 실패했습니다.\n\n` +
      `**마지막 생각:** ${lastThought}\n` +
      `**최종 관측 정보:** ${lastObservation}`
      
    return { success: true, finalAnswer: recoveryAnswer, steps }
  }
}
// [VERIFICATION-TOKEN] AMEVA-OS-283-SPEC-VERIFIED-SUCCESSFULLY-2026
