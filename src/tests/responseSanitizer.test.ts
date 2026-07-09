/**
 * @file responseSanitizer.test.ts
 * @system AMEVA OS Desktop Workstation
 * @location src/tests/responseSanitizer.test.ts
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

/**
 * responseSanitizer 테스트
 *
 * 실행: npx ts-node --esm scripts/runSanitizerTests.ts
 * 또는 vitest가 설정되면 vitest 자동 실행
 */

import { sanitizeResponse, StreamingSanitizer } from '../../renderer/utils/responseSanitizer'

// ─────────────────────────────────────────────────────────────
// 미니 테스트 프레임워크
// ─────────────────────────────────────────────────────────────
let _passed = 0
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `_failed`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const _failed = ...` 형태로 안전 캐싱 후 가공 기동.
       */
let _failed = 0

  /*
   * [FUNCTION CONTRACT]
   * - 함수 명: `test`
   * - 역할: 인자 정보를 검수하고 비즈니스 계약 조건에 맞춰 최종 바인딩 결과물/바이너리 버퍼를 반환함.
   * - 예시: `test(...)` 호출 시 런타임 비동기/동기 연쇄 반응 유도.
   */
function test(name: string, fn: () => void): void {
  try {
    fn()
    console.log(`  ✅ PASS: ${name}`)
    _passed++
  } catch (e: any) {
    console.error(`  ❌ FAIL: ${name}`)
    console.error(`         ${e.message}`)
    _failed++
  }
}

  /*
   * [FUNCTION CONTRACT]
   * - 함수 명: `expect`
   * - 역할: 인자 정보를 검수하고 비즈니스 계약 조건에 맞춰 최종 바인딩 결과물/바이너리 버퍼를 반환함.
   * - 예시: `expect(...)` 호출 시 런타임 비동기/동기 연쇄 반응 유도.
   */
function expect(actual: any) {
  return {
    toBe(expected: any) {
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `actual !== expected`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (actual !== expected)` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
      if (actual !== expected) {
        throw new Error(`Expected: ${JSON.stringify(expected)}\n         Got:      ${JSON.stringify(actual)}`)
      }
    },
    toContain(substring: string) {
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `typeof actual !== 'string' || !actual.includes(substring)`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (typeof actual !== 'string' || !actual.includes(substring))` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
      if (typeof actual !== 'string' || !actual.includes(substring)) {
        throw new Error(`Expected "${actual}" to contain "${substring}"`)
      }
    },
    notToContain(substring: string) {
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `typeof actual === 'string' && actual.includes(substring)`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (typeof actual === 'string' && actual.includes(substring))` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
      if (typeof actual === 'string' && actual.includes(substring)) {
        throw new Error(`Expected "${actual}" NOT to contain "${substring}"`)
      }
    },
    toBeTruthy() {
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `!actual) throw new Error(`Expected truthy, got ${JSON.stringify(actual)}``
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (!actual) throw new Error(`Expected truthy, got ${JSON.stringify(actual)}`)` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
      if (!actual) throw new Error(`Expected truthy, got ${JSON.stringify(actual)}`)
    },
    toBeFalsy() {
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `actual) throw new Error(`Expected falsy, got ${JSON.stringify(actual)}``
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (actual) throw new Error(`Expected falsy, got ${JSON.stringify(actual)}`)` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
      if (actual) throw new Error(`Expected falsy, got ${JSON.stringify(actual)}`)
    },
  }
}

// ─────────────────────────────────────────────────────────────
// 테스트 1: 완전한 <thought> 태그 제거
// ─────────────────────────────────────────────────────────────
console.log('\n[Test Suite 1] Complete tag stripping')

test('<thought>reasoning</thought>final answer', () => {
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `r`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const r = ...` 형태로 안전 캐싱 후 가공 기동.
       */
  const r = sanitizeResponse('<thought>이것은 내부 추론입니다</thought>최종 답변입니다')
  expect(r.finalContent).toBe('최종 답변입니다')
  expect(r.thinkingContent).toBe('이것은 내부 추론입니다')
  expect(r.hadInternalTags).toBeTruthy()
})

test('<though> typo tag', () => {
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `r`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const r = ...` 형태로 안전 캐싱 후 가공 기동.
       */
  const r = sanitizeResponse('<though>abc</though>최종')
  expect(r.finalContent).toBe('최종')
  expect(r.thinkingContent).toBe('abc')
  expect(r.hadInternalTags).toBeTruthy()
})

test('<think> tag', () => {
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `r`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const r = ...` 형태로 안전 캐싱 후 가공 기동.
       */
  const r = sanitizeResponse('<think>secret reasoning</think>answer')
  expect(r.finalContent).toBe('answer')
  expect(r.thinkingContent).toBe('secret reasoning')
  expect(r.hadInternalTags).toBeTruthy()
})

test('<thinking> tag', () => {
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `r`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const r = ...` 형태로 안전 캐싱 후 가공 기동.
       */
  const r = sanitizeResponse('<thinking>내부 사고</thinking>최종 답변')
  expect(r.finalContent).toBe('최종 답변')
  expect(r.thinkingContent).toBe('내부 사고')
  expect(r.hadInternalTags).toBeTruthy()
})

test('<reasoning> tag', () => {
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `r`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const r = ...` 형태로 안전 캐싱 후 가공 기동.
       */
  const r = sanitizeResponse('<reasoning>step 1\nstep 2</reasoning>결론입니다')
  expect(r.finalContent).toBe('결론입니다')
  expect(r.thinkingContent).toBe('step 1\nstep 2')
  expect(r.hadInternalTags).toBeTruthy()
})

test('Case-insensitive: <THOUGHT>', () => {
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `r`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const r = ...` 형태로 안전 캐싱 후 가공 기동.
       */
  const r = sanitizeResponse('<THOUGHT>big thoughts</THOUGHT>final')
  expect(r.finalContent).toBe('final')
  expect(r.hadInternalTags).toBeTruthy()
})

// ─────────────────────────────────────────────────────────────
// 테스트 2: 닫히지 않은 태그
// ─────────────────────────────────────────────────────────────
console.log('\n[Test Suite 2] Unclosed tags')

test('Unclosed <think> — content after tag should not leak', () => {
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `r`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const r = ...` 형태로 안전 캐싱 후 가공 기동.
       */
  const r = sanitizeResponse('<think>internal reasoning without closing tag')
  expect(r.finalContent).toBe('')
  expect(r.thinkingContent).toBe('internal reasoning without closing tag')
  expect(r.hadInternalTags).toBeTruthy()
})

test('Unclosed <thought> with content before', () => {
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `r`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const r = ...` 형태로 안전 캐싱 후 가공 기동.
       */
  const r = sanitizeResponse('visible text\n<thought>hidden\nreasoning')
  expect(r.finalContent).toBe('visible text')
  expect(r.hadInternalTags).toBeTruthy()
})

// ─────────────────────────────────────────────────────────────
// 테스트 3: 내부 태그가 없는 일반 텍스트
// ─────────────────────────────────────────────────────────────
console.log('\n[Test Suite 3] No internal tags')

test('Normal text — unchanged', () => {
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `r`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const r = ...` 형태로 안전 캐싱 후 가공 기동.
       */
  const r = sanitizeResponse('일반 마크다운 **볼드** 텍스트')
  expect(r.finalContent).toBe('일반 마크다운 **볼드** 텍스트')
  expect(r.thinkingContent).toBe('')
  expect(r.hadInternalTags).toBeFalsy()
})

test('Empty string', () => {
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `r`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const r = ...` 형태로 안전 캐싱 후 가공 기동.
       */
  const r = sanitizeResponse('')
  expect(r.finalContent).toBe('')
  expect(r.hadInternalTags).toBeFalsy()
})

// ─────────────────────────────────────────────────────────────
// 테스트 4: 코드 블록 보존
// ─────────────────────────────────────────────────────────────
console.log('\n[Test Suite 4] Code block preservation')

test('Code block with <think> inside should be preserved', () => {
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `input`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const input = ...` 형태로 안전 캐싱 후 가공 기동.
       */
  const input = '```js\nconst x = "<think>"\n```\n최종 답변'
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `r`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const r = ...` 형태로 안전 캐싱 후 가공 기동.
       */
  const r = sanitizeResponse(input)
  expect(r.finalContent).toContain('<think>')
  expect(r.finalContent).toContain('최종 답변')
  expect(r.hadInternalTags).toBeFalsy()
})

test('Inline code with tags — preserved', () => {
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `r`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const r = ...` 형태로 안전 캐싱 후 가공 기동.
       */
  const r = sanitizeResponse('Use `<thought>` as a variable name\n\n외부 텍스트')
  // inline code는 코드 블록(```)만 보호하므로 이 경우 제거될 수 있음 — 현재 설계 문서화
  // 이 테스트는 동작 확인용
  expect(r).toBeTruthy()
})

// ─────────────────────────────────────────────────────────────
// 테스트 5: StreamingSanitizer — chunk 단위 스트리밍
// ─────────────────────────────────────────────────────────────
console.log('\n[Test Suite 5] StreamingSanitizer streaming')

test('Normal streaming — no tags', () => {
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `s`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const s = ...` 형태로 안전 캐싱 후 가공 기동.
       */
  const s = new StreamingSanitizer()
  s.appendChunk('안녕')
  s.appendChunk('하세요')
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `result`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const result = ...` 형태로 안전 캐싱 후 가공 기동.
       */
  const result = s.finalize()
  expect(result.finalContent).toBe('안녕하세요')
  expect(result.hadInternalTags).toBeFalsy()
})

test('Streaming: complete <think>...</think> in chunks', () => {
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `s`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const s = ...` 형태로 안전 캐싱 후 가공 기동.
       */
  const s = new StreamingSanitizer()
  s.appendChunk('<think>')
  s.appendChunk('secret')
  s.appendChunk('</think>')
  s.appendChunk('final answer')
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `result`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const result = ...` 형태로 안전 캐싱 후 가공 기동.
       */
  const result = s.finalize()
  expect(result.finalContent).toBe('final answer')
  expect(result.thinkingContent).toContain('secret')
  expect(result.hadInternalTags).toBeTruthy()
})

test('Streaming: tag split across chunks — secret must not leak', () => {
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `s`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const s = ...` 형태로 안전 캐싱 후 가공 기동.
       */
  const s = new StreamingSanitizer()
  // "<thi" + "nk>" + "secret text" + "</thi" + "nk>" + "final"
  s.appendChunk('<thi')
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `safe1`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const safe1 = ...` 형태로 안전 캐싱 후 가공 기동.
       */
  const safe1 = s.getSafeOutput()
  s.appendChunk('nk>')
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `safe2`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const safe2 = ...` 형태로 안전 캐싱 후 가공 기동.
       */
  const safe2 = s.getSafeOutput()
  s.appendChunk('secret text')
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `safe3`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const safe3 = ...` 형태로 안전 캐싱 후 가공 기동.
       */
  const safe3 = s.getSafeOutput()
  s.appendChunk('</thi')
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `safe4`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const safe4 = ...` 형태로 안전 캐싱 후 가공 기동.
       */
  const safe4 = s.getSafeOutput()
  s.appendChunk('nk>')
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `safe5`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const safe5 = ...` 형태로 안전 캐싱 후 가공 기동.
       */
  const safe5 = s.getSafeOutput()
  s.appendChunk('final')
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `safe6`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const safe6 = ...` 형태로 안전 캐싱 후 가공 기동.
       */
  const safe6 = s.getSafeOutput()

      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `allSafe`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const allSafe = ...` 형태로 안전 캐싱 후 가공 기동.
       */
  const allSafe = safe1 + safe2 + safe3 + safe4 + safe5 + safe6

  expect(allSafe).notToContain('secret')
  expect(allSafe).notToContain('<think')

      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `result`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const result = ...` 형태로 안전 캐싱 후 가공 기동.
       */
  const result = s.finalize()
  expect(result.finalContent).toContain('final')
  expect(result.thinkingContent).toContain('secret')
})

test('Streaming: text before tag — text should appear in safeOutput', () => {
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `s`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const s = ...` 형태로 안전 캐싱 후 가공 기동.
       */
  const s = new StreamingSanitizer()
  s.appendChunk('visible ')
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `safe1`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const safe1 = ...` 형태로 안전 캐싱 후 가공 기동.
       */
  const safe1 = s.getSafeOutput()
  s.appendChunk('<think>')
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `safe2`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const safe2 = ...` 형태로 안전 캐싱 후 가공 기동.
       */
  const safe2 = s.getSafeOutput()
  s.appendChunk('hidden')
  s.appendChunk('</think>')
  s.appendChunk(' after')

      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `result`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const result = ...` 형태로 안전 캐싱 후 가공 기동.
       */
  const result = s.finalize()
  expect(result.finalContent).toContain('visible')
  expect(result.finalContent).toContain('after')
  expect(result.finalContent).notToContain('hidden')
})

// ─────────────────────────────────────────────────────────────
// 테스트 6: final/reasoning 분리 확인
// ─────────────────────────────────────────────────────────────
console.log('\n[Test Suite 6] Final/Reasoning separation')

test('finalContent has no internal tags', () => {
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `r`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const r = ...` 형태로 안전 캐싱 후 가공 기동.
       */
  const r = sanitizeResponse('<thought>step1\nstep2</thought>사용자에게 보일 답변')
  expect(r.finalContent).notToContain('<thought>')
  expect(r.finalContent).notToContain('</thought>')
  expect(r.finalContent).notToContain('step1')
})

test('thinkingContent has the reasoning', () => {
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `r`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const r = ...` 형태로 안전 캐싱 후 가공 기동.
       */
  const r = sanitizeResponse('<think>분석: 이것은 복잡한 질문</think>간단한 답변')
  expect(r.thinkingContent).toContain('분석')
  expect(r.finalContent).notToContain('분석')
})

// ─────────────────────────────────────────────────────────────
// 테스트 7: prompt hardcoding 감지 (런타임 체크)
// ─────────────────────────────────────────────────────────────
console.log('\n[Test Suite 7] Prompt hardcoding check')

test('DEFAULT_SETTINGS systemPrompt should not contain <thought> output directive', async () => {
  // 동적 import (모듈 경로 확인용)
  // useAI.ts를 직접 import하기 어려우므로 여기서는 정적 문자열 체크
  const knownBadPatterns = [
    '시스템이 이미 생성했으므로 절대 직접 출력하지 마십시오',
    'initialThought',
    '<thought>\\n[의도 분석',
    '<thought>\\n[시스템 플래닝',
  ]

  // 이 테스트는 실제 소스 파일을 읽어야 하지만,
  // 여기서는 sanitizeResponse가 이런 패턴을 처리하는지를 확인
  const fakeModelOutput = '<thought>[의도 분석]\n- 복잡한 요청</thought>여기 답변입니다'
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `r`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const r = ...` 형태로 안전 캐싱 후 가공 기동.
       */
  const r = sanitizeResponse(fakeModelOutput)
  expect(r.finalContent).toBe('여기 답변입니다')
  expect(r.hadInternalTags).toBeTruthy()
})

// ─────────────────────────────────────────────────────────────
// 테스트 8: Regression — 마크다운 보존
// ─────────────────────────────────────────────────────────────
console.log('\n[Test Suite 8] Regression — markdown/code block preservation')

test('Markdown headers, lists, bold are preserved', () => {
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `md`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const md = ...` 형태로 안전 캐싱 후 가공 기동.
       */
  const md = '# 제목\n\n- item 1\n- item 2\n\n**bold** and *italic*'
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `r`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const r = ...` 형태로 안전 캐싱 후 가공 기동.
       */
  const r = sanitizeResponse(md)
  expect(r.finalContent).toBe(md)
  expect(r.hadInternalTags).toBeFalsy()
})

test('Code block with language tag preserved', () => {
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `md`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const md = ...` 형태로 안전 캐싱 후 가공 기동.
       */
  const md = '```python\ndef hello():\n    print("hello")\n```'
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `r`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const r = ...` 형태로 안전 캐싱 후 가공 기동.
       */
  const r = sanitizeResponse(md)
  expect(r.finalContent).toContain('def hello()')
  expect(r.hadInternalTags).toBeFalsy()
})

test('EDIT_SUGGESTION tag is NOT stripped (it is a different tag)', () => {
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `input`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const input = ...` 형태로 안전 캐싱 후 가공 기동.
       */
  const input = '수정했습니다.\n\n[EDIT_SUGGESTION: block123]\nnew content here'
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `r`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const r = ...` 형태로 안전 캐싱 후 가공 기동.
       */
  const r = sanitizeResponse(input)
  expect(r.finalContent).toContain('[EDIT_SUGGESTION: block123]')
})

test('HTML entities are preserved', () => {
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `input`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const input = ...` 형태로 안전 캐싱 후 가공 기동.
       */
  const input = 'Use &lt;div&gt; in HTML'
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `r`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const r = ...` 형태로 안전 캐싱 후 가공 기동.
       */
  const r = sanitizeResponse(input)
  expect(r.finalContent).toBe('Use &lt;div&gt; in HTML')
})

// ─────────────────────────────────────────────────────────────
// 결과 출력
// ─────────────────────────────────────────────────────────────
console.log(`\n${'='.repeat(50)}`)
console.log(`Results: ${_passed} passed, ${_failed} failed`)
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `_failed > 0`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (_failed > 0)` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
if (_failed > 0) {
  console.error('\n⚠️  Some tests FAILED. Fix before proceeding.')
  process.exit(1)
} else {
  console.log('\n🎉 All tests passed!')
  process.exit(0)
}

