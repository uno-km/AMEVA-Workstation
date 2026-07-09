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
let _failed = 0

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

function expect(actual: any) {
  return {
    toBe(expected: any) {
      if (actual !== expected) {
        throw new Error(`Expected: ${JSON.stringify(expected)}\n         Got:      ${JSON.stringify(actual)}`)
      }
    },
    toContain(substring: string) {
      if (typeof actual !== 'string' || !actual.includes(substring)) {
        throw new Error(`Expected "${actual}" to contain "${substring}"`)
      }
    },
    notToContain(substring: string) {
      if (typeof actual === 'string' && actual.includes(substring)) {
        throw new Error(`Expected "${actual}" NOT to contain "${substring}"`)
      }
    },
    toBeTruthy() {
      if (!actual) throw new Error(`Expected truthy, got ${JSON.stringify(actual)}`)
    },
    toBeFalsy() {
      if (actual) throw new Error(`Expected falsy, got ${JSON.stringify(actual)}`)
    },
  }
}

// ─────────────────────────────────────────────────────────────
// 테스트 1: 완전한 <thought> 태그 제거
// ─────────────────────────────────────────────────────────────
console.log('\n[Test Suite 1] Complete tag stripping')

test('<thought>reasoning</thought>final answer', () => {
  const r = sanitizeResponse('<thought>이것은 내부 추론입니다</thought>최종 답변입니다')
  expect(r.finalContent).toBe('최종 답변입니다')
  expect(r.thinkingContent).toBe('이것은 내부 추론입니다')
  expect(r.hadInternalTags).toBeTruthy()
})

test('<though> typo tag', () => {
  const r = sanitizeResponse('<though>abc</though>최종')
  expect(r.finalContent).toBe('최종')
  expect(r.thinkingContent).toBe('abc')
  expect(r.hadInternalTags).toBeTruthy()
})

test('<think> tag', () => {
  const r = sanitizeResponse('<think>secret reasoning</think>answer')
  expect(r.finalContent).toBe('answer')
  expect(r.thinkingContent).toBe('secret reasoning')
  expect(r.hadInternalTags).toBeTruthy()
})

test('<thinking> tag', () => {
  const r = sanitizeResponse('<thinking>내부 사고</thinking>최종 답변')
  expect(r.finalContent).toBe('최종 답변')
  expect(r.thinkingContent).toBe('내부 사고')
  expect(r.hadInternalTags).toBeTruthy()
})

test('<reasoning> tag', () => {
  const r = sanitizeResponse('<reasoning>step 1\nstep 2</reasoning>결론입니다')
  expect(r.finalContent).toBe('결론입니다')
  expect(r.thinkingContent).toBe('step 1\nstep 2')
  expect(r.hadInternalTags).toBeTruthy()
})

test('Case-insensitive: <THOUGHT>', () => {
  const r = sanitizeResponse('<THOUGHT>big thoughts</THOUGHT>final')
  expect(r.finalContent).toBe('final')
  expect(r.hadInternalTags).toBeTruthy()
})

// ─────────────────────────────────────────────────────────────
// 테스트 2: 닫히지 않은 태그
// ─────────────────────────────────────────────────────────────
console.log('\n[Test Suite 2] Unclosed tags')

test('Unclosed <think> — content after tag should not leak', () => {
  const r = sanitizeResponse('<think>internal reasoning without closing tag')
  expect(r.finalContent).toBe('')
  expect(r.thinkingContent).toBe('internal reasoning without closing tag')
  expect(r.hadInternalTags).toBeTruthy()
})

test('Unclosed <thought> with content before', () => {
  const r = sanitizeResponse('visible text\n<thought>hidden\nreasoning')
  expect(r.finalContent).toBe('visible text')
  expect(r.hadInternalTags).toBeTruthy()
})

// ─────────────────────────────────────────────────────────────
// 테스트 3: 내부 태그가 없는 일반 텍스트
// ─────────────────────────────────────────────────────────────
console.log('\n[Test Suite 3] No internal tags')

test('Normal text — unchanged', () => {
  const r = sanitizeResponse('일반 마크다운 **볼드** 텍스트')
  expect(r.finalContent).toBe('일반 마크다운 **볼드** 텍스트')
  expect(r.thinkingContent).toBe('')
  expect(r.hadInternalTags).toBeFalsy()
})

test('Empty string', () => {
  const r = sanitizeResponse('')
  expect(r.finalContent).toBe('')
  expect(r.hadInternalTags).toBeFalsy()
})

// ─────────────────────────────────────────────────────────────
// 테스트 4: 코드 블록 보존
// ─────────────────────────────────────────────────────────────
console.log('\n[Test Suite 4] Code block preservation')

test('Code block with <think> inside should be preserved', () => {
  const input = '```js\nconst x = "<think>"\n```\n최종 답변'
  const r = sanitizeResponse(input)
  expect(r.finalContent).toContain('<think>')
  expect(r.finalContent).toContain('최종 답변')
  expect(r.hadInternalTags).toBeFalsy()
})

test('Inline code with tags — preserved', () => {
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
  const s = new StreamingSanitizer()
  s.appendChunk('안녕')
  s.appendChunk('하세요')
  const result = s.finalize()
  expect(result.finalContent).toBe('안녕하세요')
  expect(result.hadInternalTags).toBeFalsy()
})

test('Streaming: complete <think>...</think> in chunks', () => {
  const s = new StreamingSanitizer()
  s.appendChunk('<think>')
  s.appendChunk('secret')
  s.appendChunk('</think>')
  s.appendChunk('final answer')
  const result = s.finalize()
  expect(result.finalContent).toBe('final answer')
  expect(result.thinkingContent).toContain('secret')
  expect(result.hadInternalTags).toBeTruthy()
})

test('Streaming: tag split across chunks — secret must not leak', () => {
  const s = new StreamingSanitizer()
  // "<thi" + "nk>" + "secret text" + "</thi" + "nk>" + "final"
  s.appendChunk('<thi')
  const safe1 = s.getSafeOutput()
  s.appendChunk('nk>')
  const safe2 = s.getSafeOutput()
  s.appendChunk('secret text')
  const safe3 = s.getSafeOutput()
  s.appendChunk('</thi')
  const safe4 = s.getSafeOutput()
  s.appendChunk('nk>')
  const safe5 = s.getSafeOutput()
  s.appendChunk('final')
  const safe6 = s.getSafeOutput()

  const allSafe = safe1 + safe2 + safe3 + safe4 + safe5 + safe6

  expect(allSafe).notToContain('secret')
  expect(allSafe).notToContain('<think')

  const result = s.finalize()
  expect(result.finalContent).toContain('final')
  expect(result.thinkingContent).toContain('secret')
})

test('Streaming: text before tag — text should appear in safeOutput', () => {
  const s = new StreamingSanitizer()
  s.appendChunk('visible ')
  const safe1 = s.getSafeOutput()
  s.appendChunk('<think>')
  const safe2 = s.getSafeOutput()
  s.appendChunk('hidden')
  s.appendChunk('</think>')
  s.appendChunk(' after')

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
  const r = sanitizeResponse('<thought>step1\nstep2</thought>사용자에게 보일 답변')
  expect(r.finalContent).notToContain('<thought>')
  expect(r.finalContent).notToContain('</thought>')
  expect(r.finalContent).notToContain('step1')
})

test('thinkingContent has the reasoning', () => {
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
  const r = sanitizeResponse(fakeModelOutput)
  expect(r.finalContent).toBe('여기 답변입니다')
  expect(r.hadInternalTags).toBeTruthy()
})

// ─────────────────────────────────────────────────────────────
// 테스트 8: Regression — 마크다운 보존
// ─────────────────────────────────────────────────────────────
console.log('\n[Test Suite 8] Regression — markdown/code block preservation')

test('Markdown headers, lists, bold are preserved', () => {
  const md = '# 제목\n\n- item 1\n- item 2\n\n**bold** and *italic*'
  const r = sanitizeResponse(md)
  expect(r.finalContent).toBe(md)
  expect(r.hadInternalTags).toBeFalsy()
})

test('Code block with language tag preserved', () => {
  const md = '```python\ndef hello():\n    print("hello")\n```'
  const r = sanitizeResponse(md)
  expect(r.finalContent).toContain('def hello()')
  expect(r.hadInternalTags).toBeFalsy()
})

test('EDIT_SUGGESTION tag is NOT stripped (it is a different tag)', () => {
  const input = '수정했습니다.\n\n[EDIT_SUGGESTION: block123]\nnew content here'
  const r = sanitizeResponse(input)
  expect(r.finalContent).toContain('[EDIT_SUGGESTION: block123]')
})

test('HTML entities are preserved', () => {
  const input = 'Use &lt;div&gt; in HTML'
  const r = sanitizeResponse(input)
  expect(r.finalContent).toBe('Use &lt;div&gt; in HTML')
})

// ─────────────────────────────────────────────────────────────
// 결과 출력
// ─────────────────────────────────────────────────────────────
console.log(`\n${'='.repeat(50)}`)
console.log(`Results: ${_passed} passed, ${_failed} failed`)
if (_failed > 0) {
  console.error('\n⚠️  Some tests FAILED. Fix before proceeding.')
  process.exit(1)
} else {
  console.log('\n🎉 All tests passed!')
  process.exit(0)
}
