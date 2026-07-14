/**
 * @file responseSanitizer.test.ts
 * @system AMEVA OS Desktop Workstation
 * @location src/renderer/utils/__tests__/responseSanitizer.test.ts
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

/**
 * responseSanitizer.test.ts
 *
 * Tests for the responseSanitizer utility.
 *
 * Written as vitest-compatible tests (describe/it/expect).
 * Can also be run standalone without a test runner — see the bottom of the file.
 *
 * Run with vitest (if configured):
 *   npx vitest run src/renderer/utils/__tests__/responseSanitizer.test.ts
 *
 * Run standalone (no test runner needed):
 *   npx tsx src/renderer/utils/__tests__/responseSanitizer.test.ts
 *   node --import tsx/esm src/renderer/utils/__tests__/responseSanitizer.test.ts
 */

import { sanitizeResponse, StreamingSanitizer } from '../responseSanitizer'
import type { SanitizeResult } from '../responseSanitizer'

// ---------------------------------------------------------------------------
// Minimal test harness (works with vitest AND standalone)
// ---------------------------------------------------------------------------

import { describe, it, expect } from 'vitest'

// ---------------------------------------------------------------------------
// Test helpers — used in both vitest and standalone modes
// ---------------------------------------------------------------------------

  /*
   * [FUNCTION CONTRACT]
   * - 함수 명: `assertEq`
   * - 역할: 인자 정보를 검수하고 비즈니스 계약 조건에 맞춰 최종 바인딩 결과물/바이너리 버퍼를 반환함.
   * - 예시: `assertEq(...)` 호출 시 런타임 비동기/동기 연쇄 반응 유도.
   */
function assertEq<T>(actual: T, expected: T, label: string): void {
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `JSON.stringify(actual) !== JSON.stringify(expected)`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (JSON.stringify(actual) !== JSON.stringify(expected))` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      `FAIL [${label}]\n  Expected: ${JSON.stringify(expected)}\n  Actual:   ${JSON.stringify(actual)}`
    )
  }
}

  /*
   * [FUNCTION CONTRACT]
   * - 함수 명: `assertTrue`
   * - 역할: 인자 정보를 검수하고 비즈니스 계약 조건에 맞춰 최종 바인딩 결과물/바이너리 버퍼를 반환함.
   * - 예시: `assertTrue(...)` 호출 시 런타임 비동기/동기 연쇄 반응 유도.
   */
function assertTrue(val: boolean, label: string): void {
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `!val) throw new Error(`FAIL [${label}] Expected true, got false``
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (!val) throw new Error(`FAIL [${label}] Expected true, got false`)` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
  if (!val) throw new Error(`FAIL [${label}] Expected true, got false`)
}

  /*
   * [FUNCTION CONTRACT]
   * - 함수 명: `assertFalse`
   * - 역할: 인자 정보를 검수하고 비즈니스 계약 조건에 맞춰 최종 바인딩 결과물/바이너리 버퍼를 반환함.
   * - 예시: `assertFalse(...)` 호출 시 런타임 비동기/동기 연쇄 반응 유도.
   */
function assertFalse(val: boolean, label: string): void {
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `val) throw new Error(`FAIL [${label}] Expected false, got true``
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (val) throw new Error(`FAIL [${label}] Expected false, got true`)` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
  if (val) throw new Error(`FAIL [${label}] Expected false, got true`)
}

  /*
   * [FUNCTION CONTRACT]
   * - 함수 명: `assertContains`
   * - 역할: 인자 정보를 검수하고 비즈니스 계약 조건에 맞춰 최종 바인딩 결과물/바이너리 버퍼를 반환함.
   * - 예시: `assertContains(...)` 호출 시 런타임 비동기/동기 연쇄 반응 유도.
   */
function assertContains(haystack: string, needle: string, label: string): void {
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `!haystack.includes(needle)`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (!haystack.includes(needle))` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
  if (!haystack.includes(needle)) {
    throw new Error(`FAIL [${label}]\n  Expected "${haystack}" to contain "${needle}"`)
  }
}

  /*
   * [FUNCTION CONTRACT]
   * - 함수 명: `assertNotContains`
   * - 역할: 인자 정보를 검수하고 비즈니스 계약 조건에 맞춰 최종 바인딩 결과물/바이너리 버퍼를 반환함.
   * - 예시: `assertNotContains(...)` 호출 시 런타임 비동기/동기 연쇄 반응 유도.
   */
function assertNotContains(haystack: string, needle: string, label: string): void {
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `haystack.includes(needle)`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (haystack.includes(needle))` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
  if (haystack.includes(needle)) {
    throw new Error(`FAIL [${label}]\n  Expected "${haystack}" NOT to contain "${needle}"`)
  }
}

// ---------------------------------------------------------------------------
// Test definitions — runnable in both modes
// ---------------------------------------------------------------------------

// ── 1. Complete response with <thought>...</thought> ──────────────────────

  /*
   * [FUNCTION CONTRACT]
   * - 함수 명: `test1_thought_tag`
   * - 역할: 인자 정보를 검수하고 비즈니스 계약 조건에 맞춰 최종 바인딩 결과물/바이너리 버퍼를 반환함.
   * - 예시: `test1_thought_tag(...)` 호출 시 런타임 비동기/동기 연쇄 반응 유도.
   */
function test1_thought_tag(): void {
  const result: SanitizeResult = sanitizeResponse('<thought>reasoning</thought>final answer')
  assertEq(result.finalContent, 'final answer', 'finalContent')
  assertEq(result.thinkingContent, 'reasoning', 'thinkingContent')
  assertTrue(result.hadInternalTags, 'hadInternalTags')
}

// ── 2. Typo variant <though>...</though> ─────────────────────────────────

  /*
   * [FUNCTION CONTRACT]
   * - 함수 명: `test2_though_typo`
   * - 역할: 인자 정보를 검수하고 비즈니스 계약 조건에 맞춰 최종 바인딩 결과물/바이너리 버퍼를 반환함.
   * - 예시: `test2_though_typo(...)` 호출 시 런타임 비동기/동기 연쇄 반응 유도.
   */
function test2_though_typo(): void {
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `result`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const result = ...` 형태로 안전 캐싱 후 가공 기동.
       */
  const result = sanitizeResponse('<though>abc</though>final')
  assertEq(result.finalContent, 'final', 'finalContent')
  assertEq(result.thinkingContent, 'abc', 'thinkingContent')
  assertTrue(result.hadInternalTags, 'hadInternalTags')
}

// ── 3. <think>...</think> ────────────────────────────────────────────────

  /*
   * [FUNCTION CONTRACT]
   * - 함수 명: `test3_think_tag`
   * - 역할: 인자 정보를 검수하고 비즈니스 계약 조건에 맞춰 최종 바인딩 결과물/바이너리 버퍼를 반환함.
   * - 예시: `test3_think_tag(...)` 호출 시 런타임 비동기/동기 연쇄 반응 유도.
   */
function test3_think_tag(): void {
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `result`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const result = ...` 형태로 안전 캐싱 후 가공 기동.
       */
  const result = sanitizeResponse('<think>secret</think>answer')
  assertEq(result.finalContent, 'answer', 'finalContent')
  assertEq(result.thinkingContent, 'secret', 'thinkingContent')
  assertTrue(result.hadInternalTags, 'hadInternalTags')
}

// ── 4. <thinking>...</thinking> ──────────────────────────────────────────

  /*
   * [FUNCTION CONTRACT]
   * - 함수 명: `test4_thinking_tag`
   * - 역할: 인자 정보를 검수하고 비즈니스 계약 조건에 맞춰 최종 바인딩 결과물/바이너리 버퍼를 반환함.
   * - 예시: `test4_thinking_tag(...)` 호출 시 런타임 비동기/동기 연쇄 반응 유도.
   */
function test4_thinking_tag(): void {
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `result`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const result = ...` 형태로 안전 캐싱 후 가공 기동.
       */
  const result = sanitizeResponse('<thinking>step by step analysis</thinking>answer')
  assertEq(result.finalContent, 'answer', 'finalContent')
  assertEq(result.thinkingContent, 'step by step analysis', 'thinkingContent')
  assertTrue(result.hadInternalTags, 'hadInternalTags')
}

// ── 5. <reasoning>...</reasoning> ────────────────────────────────────────

  /*
   * [FUNCTION CONTRACT]
   * - 함수 명: `test5_reasoning_tag`
   * - 역할: 인자 정보를 검수하고 비즈니스 계약 조건에 맞춰 최종 바인딩 결과물/바이너리 버퍼를 반환함.
   * - 예시: `test5_reasoning_tag(...)` 호출 시 런타임 비동기/동기 연쇄 반응 유도.
   */
function test5_reasoning_tag(): void {
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `result`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const result = ...` 형태로 안전 캐싱 후 가공 기동.
       */
  const result = sanitizeResponse('<reasoning>internal logic</reasoning>answer')
  assertEq(result.finalContent, 'answer', 'finalContent')
  assertEq(result.thinkingContent, 'internal logic', 'thinkingContent')
  assertTrue(result.hadInternalTags, 'hadInternalTags')
}

// ── 6. Unclosed tag ───────────────────────────────────────────────────────

  /*
   * [FUNCTION CONTRACT]
   * - 함수 명: `test6_unclosed_tag`
   * - 역할: 인자 정보를 검수하고 비즈니스 계약 조건에 맞춰 최종 바인딩 결과물/바이너리 버퍼를 반환함.
   * - 예시: `test6_unclosed_tag(...)` 호출 시 런타임 비동기/동기 연쇄 반응 유도.
   */
function test6_unclosed_tag(): void {
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `result`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const result = ...` 형태로 안전 캐싱 후 가공 기동.
       */
  const result = sanitizeResponse('<think>partial answer')
  assertEq(result.thinkingContent, 'partial answer', 'thinkingContent (unclosed)')
  assertEq(result.finalContent, '', 'finalContent (unclosed tag → empty)')
  assertTrue(result.hadInternalTags, 'hadInternalTags')
}

// ── 7. No tags — passthrough ─────────────────────────────────────────────

  /*
   * [FUNCTION CONTRACT]
   * - 함수 명: `test7_no_tags`
   * - 역할: 인자 정보를 검수하고 비즈니스 계약 조건에 맞춰 최종 바인딩 결과물/바이너리 버퍼를 반환함.
   * - 예시: `test7_no_tags(...)` 호출 시 런타임 비동기/동기 연쇄 반응 유도.
   */
function test7_no_tags(): void {
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `result`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const result = ...` 형태로 안전 캐싱 후 가공 기동.
       */
  const result = sanitizeResponse('normal answer without any tags')
  assertEq(result.finalContent, 'normal answer without any tags', 'finalContent')
  assertEq(result.thinkingContent, '', 'thinkingContent')
  assertFalse(result.hadInternalTags, 'hadInternalTags')
}

// ── 8. Code block preservation ───────────────────────────────────────────

  /*
   * [FUNCTION CONTRACT]
   * - 함수 명: `test8_code_block_preserved`
   * - 역할: 인자 정보를 검수하고 비즈니스 계약 조건에 맞춰 최종 바인딩 결과물/바이너리 버퍼를 반환함.
   * - 예시: `test8_code_block_preserved(...)` 호출 시 런타임 비동기/동기 연쇄 반응 유도.
   */
function test8_code_block_preserved(): void {
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `input`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const input = ...` 형태로 안전 캐싱 후 가공 기동.
       */
  const input = "```js\nconst x = '<think>'\n```\nfinal"
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `result`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const result = ...` 형태로 안전 캐싱 후 가공 기동.
       */
  const result = sanitizeResponse(input)
  // The code block should be intact in finalContent
  assertContains(result.finalContent, "```js", 'code fence preserved')
  assertContains(result.finalContent, "<think>", 'tag inside code is NOT stripped')
  assertContains(result.finalContent, 'final', 'trailing text preserved')
  assertFalse(result.hadInternalTags, 'hadInternalTags (tag is in code block)')
}

// ── 9. Case-insensitive matching ──────────────────────────────────────────

  /*
   * [FUNCTION CONTRACT]
   * - 함수 명: `test9_case_insensitive`
   * - 역할: 인자 정보를 검수하고 비즈니스 계약 조건에 맞춰 최종 바인딩 결과물/바이너리 버퍼를 반환함.
   * - 예시: `test9_case_insensitive(...)` 호출 시 런타임 비동기/동기 연쇄 반응 유도.
   */
function test9_case_insensitive(): void {
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `result`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const result = ...` 형태로 안전 캐싱 후 가공 기동.
       */
  const result = sanitizeResponse('<THOUGHT>upper case</THOUGHT>final')
  assertEq(result.finalContent, 'final', 'finalContent (case-insensitive)')
  assertEq(result.thinkingContent, 'upper case', 'thinkingContent')
  assertTrue(result.hadInternalTags, 'hadInternalTags')
}

  /*
   * [FUNCTION CONTRACT]
   * - 함수 명: `test9b_mixed_case`
   * - 역할: 인자 정보를 검수하고 비즈니스 계약 조건에 맞춰 최종 바인딩 결과물/바이너리 버퍼를 반환함.
   * - 예시: `test9b_mixed_case(...)` 호출 시 런타임 비동기/동기 연쇄 반응 유도.
   */
function test9b_mixed_case(): void {
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `result`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const result = ...` 형태로 안전 캐싱 후 가공 기동.
       */
  const result = sanitizeResponse('<Think>mixed case</Think>answer')
  assertEq(result.finalContent, 'answer', 'finalContent (mixed case)')
  assertEq(result.thinkingContent, 'mixed case', 'thinkingContent')
}

// ── 10. Final content has no internal tags ────────────────────────────────

  /*
   * [FUNCTION CONTRACT]
   * - 함수 명: `test10_no_tags_in_final`
   * - 역할: 인자 정보를 검수하고 비즈니스 계약 조건에 맞춰 최종 바인딩 결과물/바이너리 버퍼를 반환함.
   * - 예시: `test10_no_tags_in_final(...)` 호출 시 런타임 비동기/동기 연쇄 반응 유도.
   */
function test10_no_tags_in_final(): void {
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `input`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const input = ...` 형태로 안전 캐싱 후 가공 기동.
       */
  const input = '<thought>private reasoning</thought>public answer <b>bold</b>'
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `result`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const result = ...` 형태로 안전 캐싱 후 가공 기동.
       */
  const result = sanitizeResponse(input)
  assertNotContains(result.finalContent, '<thought>', 'no <thought> in final')
  assertNotContains(result.finalContent, '</thought>', 'no </thought> in final')
  assertContains(result.finalContent, 'public answer', 'final has user text')
  assertContains(result.finalContent, '<b>bold</b>', 'normal HTML preserved in final')
}

// ── 11. Streaming — no tag leakage across chunks ─────────────────────────

  /*
   * [FUNCTION CONTRACT]
   * - 함수 명: `test11_streaming_no_leakage`
   * - 역할: 인자 정보를 검수하고 비즈니스 계약 조건에 맞춰 최종 바인딩 결과물/바이너리 버퍼를 반환함.
   * - 예시: `test11_streaming_no_leakage(...)` 호출 시 런타임 비동기/동기 연쇄 반응 유도.
   */
function test11_streaming_no_leakage(): void {
  // Simulate '<th' | 'ink>text</think>' arriving as two chunks
  const sanitizer = new StreamingSanitizer()

  sanitizer.appendChunk('<th')
  // Partial tag must NOT appear in safe output
  const afterChunk1 = sanitizer.getSafeOutput()
  assertNotContains(afterChunk1, '<', 'partial tag must not leak (<)')
  assertNotContains(afterChunk1, 'th', 'partial tag content must not leak')

  sanitizer.appendChunk('ink>hidden text</think>visible text')
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `afterChunk2`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const afterChunk2 = ...` 형태로 안전 캐싱 후 가공 기동.
       */
  const afterChunk2 = sanitizer.getSafeOutput()
  assertNotContains(afterChunk2, '<think', 'complete tag must not appear in safe output')
  assertNotContains(afterChunk2, 'hidden text', 'thinking content must not appear in safe output')
  assertContains(afterChunk2, 'visible text', 'safe text after tag appears in output')

      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `result`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const result = ...` 형태로 안전 캐싱 후 가공 기동.
       */
  const result = sanitizer.finalize()
  assertEq(result.finalContent, 'visible text', 'finalContent')
  assertEq(result.thinkingContent, 'hidden text', 'thinkingContent')
  assertTrue(result.hadInternalTags, 'hadInternalTags')
}

// ── 12. Streaming — chunk-by-chunk character delivery ────────────────────

  /*
   * [FUNCTION CONTRACT]
   * - 함수 명: `test12_streaming_char_by_char`
   * - 역할: 인자 정보를 검수하고 비즈니스 계약 조건에 맞춰 최종 바인딩 결과물/바이너리 버퍼를 반환함.
   * - 예시: `test12_streaming_char_by_char(...)` 호출 시 런타임 비동기/동기 연쇄 반응 유도.
   */
function test12_streaming_char_by_char(): void {
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `input`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const input = ...` 형태로 안전 캐싱 후 가공 기동.
       */
  const input = '<thought>think</thought>answer'
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `sanitizer`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const sanitizer = ...` 형태로 안전 캐싱 후 가공 기동.
       */
  const sanitizer = new StreamingSanitizer()

  // Deliver one character at a time
  for (const ch of input) {
    sanitizer.appendChunk(ch)
    // At no point should thinking content leak into safe output
    const safe = sanitizer.getSafeOutput()
    assertNotContains(safe, '<thought>', 'no <thought> tag in live safe output')
    assertNotContains(safe, 'think', 'thinking text must not appear in live safe output')
  }

      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `result`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const result = ...` 형태로 안전 캐싱 후 가공 기동.
       */
  const result = sanitizer.finalize()
  assertEq(result.finalContent, 'answer', 'char-by-char: finalContent')
  assertEq(result.thinkingContent, 'think', 'char-by-char: thinkingContent')
}

// ── 13. Streaming — thinking buffer updates ───────────────────────────────

  /*
   * [FUNCTION CONTRACT]
   * - 함수 명: `test13_thinking_buffer_updates`
   * - 역할: 인자 정보를 검수하고 비즈니스 계약 조건에 맞춰 최종 바인딩 결과물/바이너리 버퍼를 반환함.
   * - 예시: `test13_thinking_buffer_updates(...)` 호출 시 런타임 비동기/동기 연쇄 반응 유도.
   */
function test13_thinking_buffer_updates(): void {
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `sanitizer`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const sanitizer = ...` 형태로 안전 캐싱 후 가공 기동.
       */
  const sanitizer = new StreamingSanitizer()
  sanitizer.appendChunk('<think>step one ')
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `thinking1`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const thinking1 = ...` 형태로 안전 캐싱 후 가공 기동.
       */
  const thinking1 = sanitizer.getThinkingBuffer()
  assertContains(thinking1, 'step one', 'thinking buffer contains in-progress text')

  sanitizer.appendChunk('step two</think>final')
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `result`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const result = ...` 형태로 안전 캐싱 후 가공 기동.
       */
  const result = sanitizer.finalize()
  assertContains(result.thinkingContent, 'step one', 'finalized thinking has step one')
  assertContains(result.thinkingContent, 'step two', 'finalized thinking has step two')
  assertEq(result.finalContent, 'final', 'final content')
}

// ── 14. Multiple thought blocks ───────────────────────────────────────────

  /*
   * [FUNCTION CONTRACT]
   * - 함수 명: `test14_multiple_thought_blocks`
   * - 역할: 인자 정보를 검수하고 비즈니스 계약 조건에 맞춰 최종 바인딩 결과물/바이너리 버퍼를 반환함.
   * - 예시: `test14_multiple_thought_blocks(...)` 호출 시 런타임 비동기/동기 연쇄 반응 유도.
   */
function test14_multiple_thought_blocks(): void {
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `input`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const input = ...` 형태로 안전 캐싱 후 가공 기동.
       */
  const input = '<think>first</think>between<think>second</think>end'
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `result`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const result = ...` 형태로 안전 캐싱 후 가공 기동.
       */
  const result = sanitizeResponse(input)
  assertContains(result.thinkingContent, 'first', 'first block in thinking')
  assertContains(result.thinkingContent, 'second', 'second block in thinking')
  assertEq(result.finalContent, 'betweenend', 'text between and after blocks')
}

// ── 15. EDIT_SUGGESTION passthrough (in raw text) ────────────────────────

  /*
   * [FUNCTION CONTRACT]
   * - 함수 명: `test15_edit_suggestion_in_raw`
   * - 역할: 인자 정보를 검수하고 비즈니스 계약 조건에 맞춰 최종 바인딩 결과물/바이너리 버퍼를 반환함.
   * - 예시: `test15_edit_suggestion_in_raw(...)` 호출 시 런타임 비동기/동기 연쇄 반응 유도.
   */
function test15_edit_suggestion_in_raw(): void {
  // Simulates a model putting EDIT_SUGGESTION inside a <thought> block,
  // but also after it — the raw text is what should be searched for EDIT_SUGGESTION
  const rawFromModel = '<thought>let me generate an edit</thought>Here is the result.\n[EDIT_SUGGESTION: blockABC]\nNew content here'
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `result`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const result = ...` 형태로 안전 캐싱 후 가공 기동.
       */
  const result = sanitizeResponse(rawFromModel)

  // finalContent should contain the EDIT_SUGGESTION so useAI can parse it
  // from the raw buffer (not from finalContent — but finalContent should be
  // clean of thought content)
  assertNotContains(result.finalContent, '<thought>', 'no thought tag in final')
  assertNotContains(result.finalContent, 'let me generate', 'thinking text not in final')
  assertContains(result.finalContent, '[EDIT_SUGGESTION: blockABC]', 'EDIT_SUGGESTION tag preserved in final')
  assertContains(result.finalContent, 'New content here', 'proposed content preserved')
}

// ── 16. Whitespace trimming ───────────────────────────────────────────────

  /*
   * [FUNCTION CONTRACT]
   * - 함수 명: `test16_whitespace`
   * - 역할: 인자 정보를 검수하고 비즈니스 계약 조건에 맞춰 최종 바인딩 결과물/바이너리 버퍼를 반환함.
   * - 예시: `test16_whitespace(...)` 호출 시 런타임 비동기/동기 연쇄 반응 유도.
   */
function test16_whitespace(): void {
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `result`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const result = ...` 형태로 안전 캐싱 후 가공 기동.
       */
  const result = sanitizeResponse('\n<thought>reasoning</thought>\n\nfinal answer\n')
  assertEq(result.finalContent, 'final answer\n', 'trimStart applied to finalContent')
  assertEq(result.thinkingContent, 'reasoning', 'thinking trimmed')
}

// ---------------------------------------------------------------------------
// Vitest-style wrapper (if vitest is available)
// ---------------------------------------------------------------------------

  /*
   * [FUNCTION CONTRACT]
   * - 함수 명: `registerVitestSuites`
   * - 역할: 인자 정보를 검수하고 비즈니스 계약 조건에 맞춰 최종 바인딩 결과물/바이너리 버퍼를 반환함.
   * - 예시: `registerVitestSuites(...)` 호출 시 런타임 비동기/동기 연쇄 반응 유도.
   */
function registerVitestSuites(): void {
  // vitest executes describes unconditionally

  describe('sanitizeResponse', () => {
    it('strips <thought>...</thought> correctly', test1_thought_tag)
    it('strips <though>...</though> (typo) correctly', test2_though_typo)
    it('strips <think>...</think> correctly', test3_think_tag)
    it('strips <thinking>...</thinking> correctly', test4_thinking_tag)
    it('strips <reasoning>...</reasoning> correctly', test5_reasoning_tag)
    it('handles unclosed tags (content → thinkingContent)', test6_unclosed_tag)
    it('passes through text with no tags unchanged', test7_no_tags)
    it('preserves content inside code blocks', test8_code_block_preserved)
    it('matches tags case-insensitively', test9_case_insensitive)
    it('matches tags in mixed case', test9b_mixed_case)
    it('produces finalContent with no internal tags', test10_no_tags_in_final)
    it('handles multiple thought blocks', test14_multiple_thought_blocks)
    it('keeps EDIT_SUGGESTION tag in final content', test15_edit_suggestion_in_raw)
    it('applies trimStart on finalContent, trims thinkingContent', test16_whitespace)
  })

  describe('StreamingSanitizer', () => {
    it('does not leak partial tags to safe output', test11_streaming_no_leakage)
    it('classifies tags correctly in char-by-char mode', test12_streaming_char_by_char)
    it('accumulates thinking buffer during streaming', test13_thinking_buffer_updates)
  })
}

registerVitestSuites()

// ---------------------------------------------------------------------------
// Standalone runner (when executed directly with tsx / ts-node)
// ---------------------------------------------------------------------------

async function runStandalone(): Promise<void> {
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `typeof describe !== 'undefined'`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (typeof describe !== 'undefined')` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
  if (typeof describe !== 'undefined') return // vitest is running; skip

  /*
   * [FUNCTION CONTRACT]
   * - 함수 명: `tests`
   * - 역할: 인자 정보를 검수하고 비즈니스 계약 조건에 맞춰 최종 바인딩 결과물/바이너리 버퍼를 반환함.
   * - 예시: `tests(...)` 호출 시 런타임 비동기/동기 연쇄 반응 유도.
   */
  const tests: Array<[string, () => void]> = [
    ['1. <thought> strips to finalContent/thinkingContent', test1_thought_tag],
    ['2. <though> typo strips correctly', test2_though_typo],
    ['3. <think> strips correctly', test3_think_tag],
    ['4. <thinking> strips correctly', test4_thinking_tag],
    ['5. <reasoning> strips correctly', test5_reasoning_tag],
    ['6. Unclosed tag → all content to thinkingContent', test6_unclosed_tag],
    ['7. No tags → unchanged, hadInternalTags=false', test7_no_tags],
    ['8. Code block preserves internal tags', test8_code_block_preserved],
    ['9. Case-insensitive <THOUGHT>', test9_case_insensitive],
    ['9b. Mixed-case <Think>', test9b_mixed_case],
    ['10. finalContent has no internal tags', test10_no_tags_in_final],
    ['11. Streaming: no leakage of partial tags', test11_streaming_no_leakage],
    ['12. Streaming: char-by-char delivery', test12_streaming_char_by_char],
    ['13. Streaming: thinking buffer updates during stream', test13_thinking_buffer_updates],
    ['14. Multiple thought blocks', test14_multiple_thought_blocks],
    ['15. EDIT_SUGGESTION preserved in final content', test15_edit_suggestion_in_raw],
    ['16. Whitespace trimming', test16_whitespace],
  ]

      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `passed`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const passed = ...` 형태로 안전 캐싱 후 가공 기동.
       */
  let passed = 0
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `failed`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const failed = ...` 형태로 안전 캐싱 후 가공 기동.
       */
  let failed = 0
  const failures: string[] = []

  console.log('\n=== responseSanitizer standalone tests ===\n')

      /*
       * [LOOP CONTROL ITERATION]
       * - 루프 조건: `for (const [name, fn] of tests) {`
       * - 예상 시나리오: 지정된 조건 한계 도달 시점까지 콜렉션 항목의 순차 매핑, 변환 및 동기 적재 처리를 수행함.
       * - 예시: `for (const item of list)` 루프 실행 시 모든 개별 블록의 html 포맷 정제 완료 후 스택 종결.
       */
  for (const [name, fn] of tests) {
    try {
      await fn()
      console.log(`  ✅  ${name}`)
      passed++
    } catch (err) {
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `msg`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const msg = ...` 형태로 안전 캐싱 후 가공 기동.
       */
      const msg = err instanceof Error ? err.message : String(err)
      console.log(`  ❌  ${name}\n     ${msg}`)
      failures.push(`${name}: ${msg}`)
      failed++
    }
  }

  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`)

      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `failures.length > 0`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (failures.length > 0)` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
  if (failures.length > 0) {
    console.log('Failures:')
      /*
       * [LOOP CONTROL ITERATION]
       * - 루프 조건: `for (const f of failures) console.log(` - ${f}`)`
       * - 예상 시나리오: 지정된 조건 한계 도달 시점까지 콜렉션 항목의 순차 매핑, 변환 및 동기 적재 처리를 수행함.
       * - 예시: `for (const item of list)` 루프 실행 시 모든 개별 블록의 html 포맷 정제 완료 후 스택 종결.
       */
    for (const f of failures) console.log(` - ${f}`)
    process.exit(1)
  }
}

runStandalone().catch(err => {
  console.error('Unexpected error in test runner:', err)
  process.exit(1)
})

console.debug(suites, currentSuite);
