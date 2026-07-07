import { ILLMAdapter } from '../types'

export class OllamaAdapter implements ILLMAdapter {
  private endpoint: string;
  private modelName: string;
  constructor(endpoint: string, modelName: string) {
    this.endpoint = endpoint;
    this.modelName = modelName;
  }

  async generate(prompt: string, systemPrompt: string, temperature: number, _sessionId?: string): Promise<string> {
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
