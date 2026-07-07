import * as ipc from '../../../services/ipc/electronApiAdapter'
import { ILLMAdapter } from '../types'

export class LlamaCppAdapter implements ILLMAdapter {
  private endpoint: string;
  private modelName: string;
  constructor(endpoint: string, modelName: string) {
    this.endpoint = endpoint;
    this.modelName = modelName;
  }

  async generate(prompt: string, systemPrompt: string, temperature: number, sessionId?: string): Promise<string> {
    // 일렉트론 IPC 브릿지를 타서 llama-server로 요청 전송
    if (ipc.isElectronEnv()) {
      const res = await ipc.llmGenerate({
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
