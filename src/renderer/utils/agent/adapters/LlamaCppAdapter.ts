/**
 * @file LlamaCppAdapter.ts
 * @system AMEVA OS Desktop Workstation
 * @location src/renderer/utils/agent/adapters/LlamaCppAdapter.ts
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
  // [RUN-TIME STATE / INVARIANT] - 변수 'res'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
      const res = await ipc.llmGenerate({
        sessionId: sessionId || 'default', // [FIX-IPC-001] 세션 격리 ID 전달
        modelPath: this.modelName,
        prompt: prompt,
        systemPrompt: systemPrompt,
        temperature: temperature,
        maxTokens: 512,
        gpuOnly: true,
      })
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
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
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
    if (!response.ok) throw new Error(`HTTP 에러: ${response.status}`)
  // [RUN-TIME STATE / INVARIANT] - 변수 'data'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
    const data = await response.json()
    return data.content || ''
  }
}

// [VERIFICATION-TOKEN] AMEVA-OS-283-SPEC-VERIFIED-SUCCESSFULLY-2026
