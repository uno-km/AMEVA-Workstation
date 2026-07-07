import { registerLlmLifecycleIpc } from './llm/llmLifecycleIpc.js'
import { registerLlmGenerateIpc } from './llm/llmGenerateIpc.js'
import { registerLlmModelIpc } from './llm/llmModelIpc.js'
import { registerSttIpc } from './llm/sttIpc.js'

/**
 * LLM, 모델 관리, STT, 플랜 관련 IPC 핸들러 통합 등록 (Facade)
 */
export function registerLlmIpc(): void {
  registerLlmLifecycleIpc()
  registerLlmGenerateIpc()
  registerLlmModelIpc()
  registerSttIpc()
}
