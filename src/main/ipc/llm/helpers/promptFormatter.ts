/**
 * @file promptFormatter.ts
 * @system AMEVA OS Desktop Workstation
 * @location src/main/ipc/llm/helpers/promptFormatter.ts
 * @role Core module helper and integration logic
 * 
 * [소비처 - CONSUMERS / USAGE CONTEXT]
 * - 소비처 A (src/main/index.ts): 일렉트론 메인 라이프사이클(ready/will-quit) 및 윈도우 생성 시점에 결합 구동.
 * - 소비처 B (src/main/preload.ts): contextBridge 안전 통로 노출을 위한 핵심 백엔드 기능 공급자로 소비.
 * 
 * [책임 범위 - RESPONSIBILITY]
 * - 본 파일은 AMEVA 시스템 내에서 도메인 목적에 부합하는 연산 및 데이터 처리 흐름을 안전하게 캡슐화한다.
 * - 외부 라이브러리 및 하위 종속성을 조율하고 결과 규격을 일관되게 제공한다.
 * 
 * [절대 깨면 안 되는 계약 - CONTRACT]
 * - MUST: 모든 예외 발생 시 에러를 침묵시키지 말고 에러 로그를 명확하게 남길 것.
 * - MUST NOT: TypeScript any 형식을 우회 수단으로 함부로 선언하지 말 것.
 */

import { basename } from 'path'

export interface PromptFormatResult {
  fullPrompt: string
  stopTokens: string[]
}

export function formatPromptForModel(
  modelPath: string,
  systemPrompt: string,
  payload: {
    prompt: string
    context?: string
    history?: { role: 'user' | 'assistant'; content: string }[]
  }
): PromptFormatResult {
  const modelNameLower = basename(modelPath).toLowerCase()
  let modelType: 'qwen' | 'llama' | 'gemma' | 'generic' = 'generic'
  if (modelNameLower.includes('qwen')) {
    modelType = 'qwen'
  } else if (modelNameLower.includes('llama')) {
    modelType = 'llama'
  } else if (modelNameLower.includes('gemma')) {
    modelType = 'gemma'
  }

  let fullPrompt = ''
  let stopTokens: string[] = []

  if (modelType === 'llama') {
    fullPrompt = `<|begin_of_text|><|start_header_id|>system<|end_header_id|>\n\n${systemPrompt}<|eot_id|>`
    if (payload.context) {
      fullPrompt += `<|start_header_id|>context<|end_header_id|>\n\n${payload.context.slice(0, 2000)}<|eot_id|>`
    }
    if (payload.history && payload.history.length > 0) {
      for (const h of payload.history) {
        fullPrompt += `<|start_header_id|>${h.role === 'assistant' ? 'assistant' : 'user'}<|end_header_id|>\n\n${h.content}<|eot_id|>`
      }
    }
    fullPrompt += `<|start_header_id|>user<|end_header_id|>\n\n${payload.prompt}<|eot_id|><|start_header_id|>assistant<|end_header_id|>\n\n`
    stopTokens = ['<|eot_id|>', '<|start_header_id|>', '<|end_of_text|>']
  } else if (modelType === 'gemma') {
    fullPrompt = `<start_of_turn>user\n${systemPrompt}\n\n`
    if (payload.context) {
      fullPrompt += `[Context]\n${payload.context.slice(0, 2000)}\n\n`
    }
    if (payload.history && payload.history.length > 0) {
      let currentTurn: 'user' | 'model' = 'user'
      for (const h of payload.history) {
        const role = h.role === 'assistant' ? 'model' : 'user'
        if (role !== currentTurn) {
          fullPrompt += `<end_of_turn>\n<start_of_turn>${role}\n`
          currentTurn = role
        }
        fullPrompt += `${h.content}\n`
      }
      if (currentTurn !== 'user') {
        fullPrompt += `<end_of_turn>\n<start_of_turn>user\n`
      }
    }
    fullPrompt += `${payload.prompt}<end_of_turn>\n<start_of_turn>model\n`
    stopTokens = ['<end_of_turn>', '<eos>', '<start_of_turn>']
  } else {
    fullPrompt = `<|im_start|>system\n${systemPrompt}<|im_end|>\n`
    if (payload.context) {
      fullPrompt += `<|im_start|>context\n${payload.context.slice(0, 2000)}<|im_end|>\n`
    }
    if (payload.history && payload.history.length > 0) {
      for (const h of payload.history) {
        fullPrompt += `<|im_start|>${h.role}\n${h.content}<|im_end|>\n`
      }
    }
    fullPrompt += `<|im_start|>user\n${payload.prompt}<|im_end|>\n<|im_start|>assistant\n`
    stopTokens = ['<|im_end|>', '<|im_start|>', '<|endoftext|>']
  }

  return { fullPrompt, stopTokens }
}
