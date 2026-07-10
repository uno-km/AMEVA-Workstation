/**
 * @file agentPromptFactory.ts
 * @system AMEVA OS Desktop Workstation
 * @location src/renderer/services/ai/agentPromptFactory.ts
 * @role Core module helper and integration logic
 * 
 * [소비처 - CONSUMERS / USAGE CONTEXT]
 * - 소비처 A (src/renderer/App.tsx): AMEVA OS 최상위 마운트 레이어에서 의존성 로더로 연동 소비.
 * - 소비처 B (src/renderer/main.tsx): 렌더러 엔트리 라이프사이클의 기본 기능으로 수입 소비.
 * 
 * [책임 범위 - RESPONSIBILITY]
 * - 본 파일은 AMEVA 시스템 내에서 도메인 목적에 부합하는 연산 및 데이터 처리 흐름을 안전하게 캡슐화한다.
 * - 외부 라이브러리 및 하위 종속성을 조율하고 결과 규격을 일관되게 제공한다.
 * 
 * [절대 깨면 안 되는 계약 - CONTRACT]
 * - MUST: 모든 예외 발생 시 에러를 침묵시키지 말고 에러 로그를 명확하게 남길 것.
 * - MUST NOT: TypeScript any 형식을 우회 수단으로 함부로 선언하지 말 것.
 */

import type { AIMessage } from '../../types/aiTypes'

  /*
   * [FUNCTION CONTRACT]
   * - 함수 명: `buildAgentQuery`
   * - 역할: 인자 정보를 검수하고 비즈니스 계약 조건에 맞춰 최종 바인딩 결과물/바이너리 버퍼를 반환함.
   * - 예시: `buildAgentQuery(...)` 호출 시 런타임 비동기/동기 연쇄 반응 유도.
   */
export function buildAgentQuery(
  userMessage: string,
  messages: AIMessage[],
  taggedBlocks?: { id: string; text: string }[]
): string {
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `agentQuery`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const agentQuery = ...` 형태로 안전 캐싱 후 가공 기동.
       */
  let agentQuery = userMessage

      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `historyPayload`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const historyPayload = ...` 형태로 안전 캐싱 후 가공 기동.
       */
  const historyPayload = messages.slice(-10).map((m) => ({
    role: m.role === 'user' ? 'User' : 'Assistant',
    content: m.finalAnswer ?? m.content
  }))

      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `historyPayload.length > 0`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (historyPayload.length > 0)` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
  if (historyPayload.length > 0) {
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `formattedHistory`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const formattedHistory = ...` 형태로 안전 캐싱 후 가공 기동.
       */
    const formattedHistory = historyPayload.map((h) => `${h.role}: ${h.content}`).join('\n')
    agentQuery = `[이전 대화 내역]\n${formattedHistory}\n\n[현재 사용자 질의]: ${userMessage}`
  }

      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `taggedBlocks && taggedBlocks.length > 0`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (taggedBlocks && taggedBlocks.length > 0)` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
  if (taggedBlocks && taggedBlocks.length > 0) {
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `referencedContent`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const referencedContent = ...` 형태로 안전 캐싱 후 가공 기동.
       */
    const referencedContent = taggedBlocks.map((b, i) => `[참조 ${i + 1}] ID ${b.id}: "${b.text}"`).join('\n')
    agentQuery = `[참조 본문]\n${referencedContent}\n\n${agentQuery}`
  }

  return agentQuery
}

  /*
   * [FUNCTION CONTRACT]
   * - 함수 명: `getAgentSystemPrompt`
   * - 역할: 인자 정보를 검수하고 비즈니스 계약 조건에 맞춰 최종 바인딩 결과물/바이너리 버퍼를 반환함.
   * - 예시: `getAgentSystemPrompt(...)` 호출 시 런타임 비동기/동기 연쇄 반응 유도.
   */
export function getAgentSystemPrompt(): string {
  return `당신은 사용자 대신 실시간 주가 정보를 획득하는 전문 MCP 에이전트입니다.
사용자가 주가 정보나 시세를 물어보면, 반드시 'query_stock_info' 도구를 최우선 호출하여 실시간 수치를 획득하십시오.
도구 호출이 완료되면 그 결과를 기반으로 최종 답변(Final Answer)을 한두 문장으로 정리하여 제공하십시오.`
}

