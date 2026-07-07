export const AgentState = {
  Idle: "idle",
  Thinking: "thinking",
  Working: "working",
  Done: "done",
  Error: "error"
} as const;
export type AgentState = typeof AgentState[keyof typeof AgentState];

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

export interface ILLMAdapter {
  generate: (prompt: string, systemPrompt: string, temperature: number, sessionId?: string) => Promise<string>
}
