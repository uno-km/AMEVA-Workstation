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

  /*
   * [FUNCTION CONTRACT]
   * - 함수 명: `formatPromptForModel`
   * - 역할: 인자 정보를 검수하고 비즈니스 계약 조건에 맞춰 최종 바인딩 결과물/바이너리 버퍼를 반환함.
   * - 예시: `formatPromptForModel(...)` 호출 시 런타임 비동기/동기 연쇄 반응 유도.
   */
export function formatPromptForModel(
  modelPath: string,
  systemPrompt: string,
  payload: {
    prompt: string
    context?: string
    history?: { role: 'user' | 'assistant'; content: string }[]
  }
): PromptFormatResult {
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `modelNameLower`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const modelNameLower = ...` 형태로 안전 캐싱 후 가공 기동.
       */
  const modelNameLower = basename(modelPath).toLowerCase()
  let modelType: 'qwen' | 'llama' | 'gemma' | 'generic' = 'generic'
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `modelNameLower.includes('qwen')`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (modelNameLower.includes('qwen'))` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
  if (modelNameLower.includes('qwen')) {
    modelType = 'qwen'
  } else if (modelNameLower.includes('llama')) {
    modelType = 'llama'
  } else if (modelNameLower.includes('gemma')) {
    modelType = 'gemma'
  }

      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `fullPrompt`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const fullPrompt = ...` 형태로 안전 캐싱 후 가공 기동.
       */
  let fullPrompt = ''
  let stopTokens: string[] = []

      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `modelType === 'llama'`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (modelType === 'llama')` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
  if (modelType === 'llama') {
    fullPrompt = `<|begin_of_text|><|start_header_id|>system<|end_header_id|>\n\n${systemPrompt}<|eot_id|>`
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `payload.context`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (payload.context)` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
    if (payload.context) {
      fullPrompt += `<|start_header_id|>context<|end_header_id|>\n\n${payload.context.slice(0, 2000)}<|eot_id|>`
    }
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `payload.history && payload.history.length > 0`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (payload.history && payload.history.length > 0)` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
    if (payload.history && payload.history.length > 0) {
      /*
       * [LOOP CONTROL ITERATION]
       * - 루프 조건: `for (const h of payload.history) {`
       * - 예상 시나리오: 지정된 조건 한계 도달 시점까지 콜렉션 항목의 순차 매핑, 변환 및 동기 적재 처리를 수행함.
       * - 예시: `for (const item of list)` 루프 실행 시 모든 개별 블록의 html 포맷 정제 완료 후 스택 종결.
       */
      for (const h of payload.history) {
        fullPrompt += `<|start_header_id|>${h.role === 'assistant' ? 'assistant' : 'user'}<|end_header_id|>\n\n${h.content}<|eot_id|>`
      }
    }
    fullPrompt += `<|start_header_id|>user<|end_header_id|>\n\n${payload.prompt}<|eot_id|><|start_header_id|>assistant<|end_header_id|>\n\n`
    stopTokens = ['<|eot_id|>', '<|start_header_id|>', '<|end_of_text|>']
  } else if (modelType === 'gemma') {
    fullPrompt = `<start_of_turn>user\n${systemPrompt}\n\n`
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `payload.context`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (payload.context)` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
    if (payload.context) {
      fullPrompt += `[Context]\n${payload.context.slice(0, 2000)}\n\n`
    }
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `payload.history && payload.history.length > 0`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (payload.history && payload.history.length > 0)` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
    if (payload.history && payload.history.length > 0) {
      let currentTurn: 'user' | 'model' = 'user'
      /*
       * [LOOP CONTROL ITERATION]
       * - 루프 조건: `for (const h of payload.history) {`
       * - 예상 시나리오: 지정된 조건 한계 도달 시점까지 콜렉션 항목의 순차 매핑, 변환 및 동기 적재 처리를 수행함.
       * - 예시: `for (const item of list)` 루프 실행 시 모든 개별 블록의 html 포맷 정제 완료 후 스택 종결.
       */
      for (const h of payload.history) {
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `role`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const role = ...` 형태로 안전 캐싱 후 가공 기동.
       */
        const role = h.role === 'assistant' ? 'model' : 'user'
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `role !== currentTurn`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (role !== currentTurn)` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
        if (role !== currentTurn) {
          fullPrompt += `<end_of_turn>\n<start_of_turn>${role}\n`
          currentTurn = role
        }
        fullPrompt += `${h.content}\n`
      }
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `currentTurn !== 'user'`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (currentTurn !== 'user')` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
      if (currentTurn !== 'user') {
        fullPrompt += `<end_of_turn>\n<start_of_turn>user\n`
      }
    }
    fullPrompt += `${payload.prompt}<end_of_turn>\n<start_of_turn>model\n`
    stopTokens = ['<end_of_turn>', '<eos>', '<start_of_turn>']
  } else {
    fullPrompt = `<|im_start|>system\n${systemPrompt}<|im_end|>\n`
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `payload.context`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (payload.context)` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
    if (payload.context) {
      fullPrompt += `<|im_start|>context\n${payload.context.slice(0, 2000)}<|im_end|>\n`
    }
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `payload.history && payload.history.length > 0`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (payload.history && payload.history.length > 0)` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
    if (payload.history && payload.history.length > 0) {
      /*
       * [LOOP CONTROL ITERATION]
       * - 루프 조건: `for (const h of payload.history) {`
       * - 예상 시나리오: 지정된 조건 한계 도달 시점까지 콜렉션 항목의 순차 매핑, 변환 및 동기 적재 처리를 수행함.
       * - 예시: `for (const item of list)` 루프 실행 시 모든 개별 블록의 html 포맷 정제 완료 후 스택 종결.
       */
      for (const h of payload.history) {
        fullPrompt += `<|im_start|>${h.role}\n${h.content}<|im_end|>\n`
      }
    }
    fullPrompt += `<|im_start|>user\n${payload.prompt}<|im_end|>\n<|im_start|>assistant\n`
    stopTokens = ['<|im_end|>', '<|im_start|>', '<|endoftext|>']
  }

  return { fullPrompt, stopTokens }
}

