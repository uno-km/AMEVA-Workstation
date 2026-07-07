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
