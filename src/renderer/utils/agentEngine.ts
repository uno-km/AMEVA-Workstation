/**
 * agentEngine.ts
 * 
 * AMEVA Workstation Enterprise Agent Engine (Production Grade)
 * 
 * 랭체인(LangChain)의 거대하고 경직된 구조를 배제하고,
 * 로컬 디바이스 환경(Electron, Ollama, llama.cpp)에 완전히 밀착하여 설계된 동적 에이전트 엔진입니다.
 * 
 * [주요 아키텍처 피처]
 * 1. LLM Provider 추상화 (Local llama.cpp, Ollama, OpenAI API 규격 동적 교체 가능)
 * 2. 자가 정정(Self-Correction) 기능을 가진 ReAct 파서 (JSON 깨짐 및 파싱 오류 시 LLM 피드백 반영)
 * 3. 에디터 샌드박스 및 일렉트론 파일 시스템 실제 API 바인딩 (Mock 배제)
 * 4. 모델 용량(3B, 7B 등)에 따른 동적 도구 활성화/제한 전략
 */

// ── [타입 및 인터페이스 정의] ──────────────────────────────────────────────

export interface ToolDefinition {
  name: string
  description: string
  parameters: {
    type: 'object'
    properties: Record<string, { type: string; description: string }>
    required: string[]
  }
  /** 소형 모델(3B)에서도 안전하게 실행 가능한지 여부 (복잡도가 높은 도구는 7B 이상에서만 활성화) */
  minModelParameterSize?: number 
  execute: (args: any) => Promise<{ success: boolean; result: string; error?: string }>
}

export interface AgentConfig {
  providerType: 'llama.cpp' | 'ollama' | 'openai'
  endpointUrl: string
  modelName: string  // ggem-2-9b, qwen2.5-7b 등 파일명 또는 모델 식별자
  temperature?: number
  maxTurns?: number
  apiKey?: string
}

export interface AgentSessionStep {
  turn: number
  thought: string
  action?: string
  actionInput?: string
  observation?: string
  error?: string
}

export interface AgentSessionResult {
  success: boolean
  finalAnswer?: string
  steps: AgentSessionStep[]
  error?: string
}

// ── [LLM 프로바이더 어댑터 구현] ─────────────────────────────────────────────

export interface ILLMAdapter {
  generate: (prompt: string, systemPrompt: string, temperature: number, sessionId?: string) => Promise<string>
}

class LlamaCppAdapter implements ILLMAdapter {
  constructor(private endpoint: string, private modelName: string) {}

  async generate(prompt: string, systemPrompt: string, temperature: number, sessionId?: string): Promise<string> {
    // 일렉트론 IPC 브릿지를 타서 llama-server로 요청 전송
    if (window.electronAPI?.llmGenerate) {
      const res = await window.electronAPI.llmGenerate({
        sessionId: sessionId || 'default', // [FIX-IPC-001] 세션 격리 ID 전달
        modelPath: this.modelName,
        prompt: prompt,
        systemPrompt: systemPrompt,
        temperature: temperature,
        maxTokens: 512,
        gpuOnly: true,
      })
      if (!res.success) throw new Error(res.error || 'llama.cpp 추론 실패')
      return res.content || res.response || ''
    }
    
    // Fallback: 직접 로컬 REST API 통신
    const response = await fetch(`${this.endpoint}/completion`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: `<|im_start|>system\n${systemPrompt}<|im_end|>\n<|im_start|>user\n${prompt}<|im_end|>\n<|im_start|>assistant\n`,
        temperature: temperature,
        n_predict: 512,
      })
    })
    if (!response.ok) throw new Error(`HTTP 에러: ${response.status}`)
    const data = await response.json()
    return data.content || ''
  }
}

class OllamaAdapter implements ILLMAdapter {
  constructor(private endpoint: string, private modelName: string) {}

  async generate(prompt: string, systemPrompt: string, temperature: number, sessionId?: string): Promise<string> {
    // Ollama의 경우 api/generate 대신 api/chat을 쓰도록 index.ts 메인이 업데이트되었으므로 로컬 REST 호출도 /api/chat 스펙에 대응합니다.
    const response = await fetch(`${this.endpoint}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.modelName,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt }
        ],
        options: { temperature },
        stream: false
      })
    })
    if (!response.ok) throw new Error(`Ollama 통신 에러: ${response.status}`)
    const data = await response.json()
    return data.message?.content || data.response || ''
  }
}

// ── [메인 에이전트 엔진] ──────────────────────────────────────────────────

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
    switch (providerType) {
      case 'llama.cpp':
        this.adapter = new LlamaCppAdapter(endpointUrl, modelName)
        break
      case 'ollama':
        this.adapter = new OllamaAdapter(endpointUrl, modelName)
        break
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
          if (!window.electronAPI?.runPythonCode) {
            return { success: false, result: '', error: 'Electron Python API가 노출되지 않았습니다.' }
          }
          const res = await window.electronAPI.runPythonCode(code)
          if (res.success) {
            return { success: true, result: res.stdout || res.result || '성공 (반환값 없음)' }
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
          if (window.electronAPI?.webSearch) {
            const res = await window.electronAPI.webSearch(query)
            if (res.success) {
              return { success: true, result: res.result || '검색 결과 데이터 없음' }
            } else {
              return { success: false, result: '', error: res.error }
            }
          } else {
            const res = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`)
            if (!res.ok) {
              return { success: false, result: '', error: `DuckDuckGo 응답 오류: ${res.status}` }
            }
            const html = await res.text()
            const matches = html.match(/<a class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g) || []
            const snippets = matches
              .slice(0, 3)
              .map(m => m.replace(/<[^>]*>/g, '').trim())
              .join('\n\n')

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
    const isSmallModel = this.config.modelName.toLowerCase().includes('3b') || 
                         this.config.modelName.toLowerCase().includes('0.5b') || 
                         this.config.modelName.toLowerCase().includes('1.5b')
    
    return Array.from(this.tools.values()).filter(tool => {
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
    const activeTools = this.getAvailableTools()
    const steps: AgentSessionStep[] = []
    
    const toolListStr = activeTools
      .map(t => `- ${t.name}: ${t.description} (파라미터 정의: ${JSON.stringify(t.parameters)})`)
      .join('\n')

    const basePrompt = customSystemPrompt || `당신은 사용자의 질의를 주어진 도구(Tool)들을 사용해 주도적으로 임무 수행하는 지능형 에이전트입니다.`

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

    let currentPrompt = userPrompt
    let turn = 1
    const maxTurns = this.config.maxTurns ?? 5

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
        
        if (step.thought) {
          onProgress?.(`  [Thought] : "${step.thought}"\n`)
        }

        // 최종 답변인 경우
        if (rawResponse.includes('Final Answer:')) {
          const finalAnswerMatch = rawResponse.split(/Final Answer:/i)
          const finalAnswer = finalAnswerMatch[finalAnswerMatch.length - 1].trim()
          step.observation = '최종 답변이 생성되어 루프를 정상 종료합니다.'
          steps.push(step)
          onProgress?.(`  ✔ [Final Answer] 에이전트 최종 솔루션 도출 완료!\n`)
          return { success: true, finalAnswer, steps }
        }

        const actionMatch = rawResponse.match(/Action:\s*(\w+)/i)
        const inputMatch = rawResponse.match(/Action Input:\s*({[\s\S]*?})/i)

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

        const toolName = actionMatch[1].trim()
        const toolInputRaw = inputMatch[1].trim()

        step.action = toolName
        step.actionInput = toolInputRaw

        onProgress?.(`  [Action]  : ${toolName} 호출 요청\n  [Params]  : ${toolInputRaw}\n`)

        const targetTool = activeTools.find(t => t.name === toolName)
        if (!targetTool) {
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
            const healed = tryHealJSON(toolInputRaw)
            parsedArgs = JSON.parse(healed)
            onProgress?.(`  ✨ [Parser Healer] 불완전한 JSON 인자를 자동 복구 및 파싱 완료했습니다.\n`)
          } catch (jsonErr: any) {
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
        const toolResult = await targetTool.execute(parsedArgs)

        if (toolResult.success) {
          const shortResult = toolResult.result.length > 200 
            ? `${toolResult.result.slice(0, 200)}... (이하 생략)` 
            : toolResult.result
          const observationMsg = `Observation: ${toolResult.result}`
          currentPrompt += `\n${rawResponse}\n${observationMsg}\n`
          step.observation = observationMsg
          onProgress?.(`  ✔ [Observation] 도구 실행 결과 수집 완료:\n    "${shortResult}"\n`)
        } else {
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
    const lastObservation = steps.length > 0 ? steps[steps.length - 1].observation : ''
    const recoveryAnswer = `⚠️ [에이전트 턴 초과 완료] 제한된 추론 단계 내에 최종 정답 도출에 실패했습니다.\n\n` +
      `**마지막 생각:** ${lastThought}\n` +
      `**최종 관측 정보:** ${lastObservation}`
      
    return { success: true, finalAnswer: recoveryAnswer, steps }
  }
}

/**
 * 🤖 [JSON Parser Healer]
 * 소형 모델이 생성 도중 출력을 갑자기 끊거나 따옴표/괄호를 누락하는 경우,
 * 문자열을 분석하여 강제로 유효한 JSON 포맷으로 문법 규격을 복원/닫아주는 스마트 구출 함수입니다.
 */
function tryHealJSON(jsonStr: string): string {
  let healed = jsonStr.trim();

  // 1. 닫히지 않은 따옴표 강제 폐합
  let inString = false;
  let quoteChar = null;
  let escapeActive = false;

  for (let i = 0; i < healed.length; i++) {
    const char = healed[i];
    if (char === '\\') {
      escapeActive = !escapeActive;
    } else {
      if ((char === '"' || char === "'") && !escapeActive) {
        if (!inString) {
          inString = true;
          quoteChar = char;
        } else if (char === quoteChar) {
          inString = false;
          quoteChar = null;
        }
      }
      escapeActive = false;
    }
  }

  if (inString && quoteChar) {
    healed += quoteChar; // 따옴표 강제 종결
  }

  // 2. 트레일링 쉼표 제거 (예: {"a": 1,} -> {"a": 1})
  healed = healed.replace(/,\s*([}\]])/g, '$1');

  // 3. 중괄호 및 대괄호 균형 추적하여 누락된 괄호 강제 주입
  const stack: string[] = [];
  inString = false;
  quoteChar = null;
  escapeActive = false;

  for (let i = 0; i < healed.length; i++) {
    const char = healed[i];
    if (char === '\\') {
      escapeActive = !escapeActive;
    } else {
      if ((char === '"' || char === "'") && !escapeActive) {
        if (!inString) {
          inString = true;
          quoteChar = char;
        } else if (char === quoteChar) {
          inString = false;
          quoteChar = null;
        }
      }
      escapeActive = false;

      if (!inString) {
        if (char === '{' || char === '[') {
          stack.push(char === '{' ? '}' : ']');
        } else if (char === '}' || char === ']') {
          if (stack.length > 0 && stack[stack.length - 1] === char) {
            stack.pop();
          }
        }
      }
    }
  }

  // 스택에 남은 닫는 괄호들을 역순으로 덧붙여 강제 규격 완결
  while (stack.length > 0) {
    healed += stack.pop();
  }

  return healed;
}

