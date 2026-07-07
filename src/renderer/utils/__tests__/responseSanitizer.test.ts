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

type TestFn = () => void | Promise<void>

const suites: Array<{ name: string; tests: Array<{ name: string; fn: TestFn }> }> = []
let currentSuite: { name: string; tests: Array<{ name: string; fn: TestFn }> } | null = null

// Vitest globals may or may not be available
declare const describe: ((name: string, fn: () => void) => void) | undefined
declare const it: ((name: string, fn: TestFn) => void) | undefined
declare const expect: ((val: unknown) => Matchers) | undefined

interface Matchers {
  toBe(expected: unknown): void
  toEqual(expected: unknown): void
  toContain(expected: unknown): void
  not: Matchers
  toBeTruthy(): void
  toBeFalsy(): void
  toStrictEqual(expected: unknown): void
}

// ---------------------------------------------------------------------------
// Test helpers — used in both vitest and standalone modes
// ---------------------------------------------------------------------------

function assertEq<T>(actual: T, expected: T, label: string): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      `FAIL [${label}]\n  Expected: ${JSON.stringify(expected)}\n  Actual:   ${JSON.stringify(actual)}`
    )
  }
}

function assertTrue(val: boolean, label: string): void {
  if (!val) throw new Error(`FAIL [${label}] Expected true, got false`)
}

function assertFalse(val: boolean, label: string): void {
  if (val) throw new Error(`FAIL [${label}] Expected false, got true`)
}

function assertContains(haystack: string, needle: string, label: string): void {
  if (!haystack.includes(needle)) {
    throw new Error(`FAIL [${label}]\n  Expected "${haystack}" to contain "${needle}"`)
  }
}

function assertNotContains(haystack: string, needle: string, label: string): void {
  if (haystack.includes(needle)) {
    throw new Error(`FAIL [${label}]\n  Expected "${haystack}" NOT to contain "${needle}"`)
  }
}

// ---------------------------------------------------------------------------
// Test definitions — runnable in both modes
// ---------------------------------------------------------------------------

// ── 1. Complete response with <thought>...</thought> ──────────────────────

function test1_thought_tag(): void {
  const result: SanitizeResult = sanitizeResponse('<thought>reasoning</thought>final answer')
  assertEq(result.finalContent, 'final answer', 'finalContent')
  assertEq(result.thinkingContent, 'reasoning', 'thinkingContent')
  assertTrue(result.hadInternalTags, 'hadInternalTags')
}

// ── 2. Typo variant <though>...</though> ─────────────────────────────────

function test2_though_typo(): void {
  const result = sanitizeResponse('<though>abc</though>final')
  assertEq(result.finalContent, 'final', 'finalContent')
  assertEq(result.thinkingContent, 'abc', 'thinkingContent')
  assertTrue(result.hadInternalTags, 'hadInternalTags')
}

// ── 3. <think>...</think> ────────────────────────────────────────────────

function test3_think_tag(): void {
  const result = sanitizeResponse('<think>secret</think>answer')
  assertEq(result.finalContent, 'answer', 'finalContent')
  assertEq(result.thinkingContent, 'secret', 'thinkingContent')
  assertTrue(result.hadInternalTags, 'hadInternalTags')
}

// ── 4. <thinking>...</thinking> ──────────────────────────────────────────

function test4_thinking_tag(): void {
  const result = sanitizeResponse('<thinking>step by step analysis</thinking>answer')
  assertEq(result.finalContent, 'answer', 'finalContent')
  assertEq(result.thinkingContent, 'step by step analysis', 'thinkingContent')
  assertTrue(result.hadInternalTags, 'hadInternalTags')
}

// ── 5. <reasoning>...</reasoning> ────────────────────────────────────────

function test5_reasoning_tag(): void {
  const result = sanitizeResponse('<reasoning>internal logic</reasoning>answer')
  assertEq(result.finalContent, 'answer', 'finalContent')
  assertEq(result.thinkingContent, 'internal logic', 'thinkingContent')
  assertTrue(result.hadInternalTags, 'hadInternalTags')
}

// ── 6. Unclosed tag ───────────────────────────────────────────────────────

function test6_unclosed_tag(): void {
  const result = sanitizeResponse('<think>partial answer')
  assertEq(result.thinkingContent, 'partial answer', 'thinkingContent (unclosed)')
  assertEq(result.finalContent, '', 'finalContent (unclosed tag → empty)')
  assertTrue(result.hadInternalTags, 'hadInternalTags')
}

// ── 7. No tags — passthrough ─────────────────────────────────────────────

function test7_no_tags(): void {
  const result = sanitizeResponse('normal answer without any tags')
  assertEq(result.finalContent, 'normal answer without any tags', 'finalContent')
  assertEq(result.thinkingContent, '', 'thinkingContent')
  assertFalse(result.hadInternalTags, 'hadInternalTags')
}

// ── 8. Code block preservation ───────────────────────────────────────────

function test8_code_block_preserved(): void {
  const input = "```js\nconst x = '<think>'\n```\nfinal"
  const result = sanitizeResponse(input)
  // The code block should be intact in finalContent
  assertContains(result.finalContent, "```js", 'code fence preserved')
  assertContains(result.finalContent, "<think>", 'tag inside code is NOT stripped')
  assertContains(result.finalContent, 'final', 'trailing text preserved')
  assertFalse(result.hadInternalTags, 'hadInternalTags (tag is in code block)')
}

// ── 9. Case-insensitive matching ──────────────────────────────────────────

function test9_case_insensitive(): void {
  const result = sanitizeResponse('<THOUGHT>upper case</THOUGHT>final')
  assertEq(result.finalContent, 'final', 'finalContent (case-insensitive)')
  assertEq(result.thinkingContent, 'upper case', 'thinkingContent')
  assertTrue(result.hadInternalTags, 'hadInternalTags')
}

function test9b_mixed_case(): void {
  const result = sanitizeResponse('<Think>mixed case</Think>answer')
  assertEq(result.finalContent, 'answer', 'finalContent (mixed case)')
  assertEq(result.thinkingContent, 'mixed case', 'thinkingContent')
}

// ── 10. Final content has no internal tags ────────────────────────────────

function test10_no_tags_in_final(): void {
  const input = '<thought>private reasoning</thought>public answer <b>bold</b>'
  const result = sanitizeResponse(input)
  assertNotContains(result.finalContent, '<thought>', 'no <thought> in final')
  assertNotContains(result.finalContent, '</thought>', 'no </thought> in final')
  assertContains(result.finalContent, 'public answer', 'final has user text')
  assertContains(result.finalContent, '<b>bold</b>', 'normal HTML preserved in final')
}

// ── 11. Streaming — no tag leakage across chunks ─────────────────────────

function test11_streaming_no_leakage(): void {
  // Simulate '<th' | 'ink>text</think>' arriving as two chunks
  const sanitizer = new StreamingSanitizer()

  sanitizer.appendChunk('<th')
  // Partial tag must NOT appear in safe output
  const afterChunk1 = sanitizer.getSafeOutput()
  assertNotContains(afterChunk1, '<', 'partial tag must not leak (<)')
  assertNotContains(afterChunk1, 'th', 'partial tag content must not leak')

  sanitizer.appendChunk('ink>hidden text</think>visible text')
  const afterChunk2 = sanitizer.getSafeOutput()
  assertNotContains(afterChunk2, '<think', 'complete tag must not appear in safe output')
  assertNotContains(afterChunk2, 'hidden text', 'thinking content must not appear in safe output')
  assertContains(afterChunk2, 'visible text', 'safe text after tag appears in output')

  const result = sanitizer.finalize()
  assertEq(result.finalContent, 'visible text', 'finalContent')
  assertEq(result.thinkingContent, 'hidden text', 'thinkingContent')
  assertTrue(result.hadInternalTags, 'hadInternalTags')
}

// ── 12. Streaming — chunk-by-chunk character delivery ────────────────────

function test12_streaming_char_by_char(): void {
  const input = '<thought>think</thought>answer'
  const sanitizer = new StreamingSanitizer()

  // Deliver one character at a time
  for (const ch of input) {
    sanitizer.appendChunk(ch)
    // At no point should thinking content leak into safe output
    const safe = sanitizer.getSafeOutput()
    assertNotContains(safe, '<thought>', 'no <thought> tag in live safe output')
    assertNotContains(safe, 'think', 'thinking text must not appear in live safe output')
  }

  const result = sanitizer.finalize()
  assertEq(result.finalContent, 'answer', 'char-by-char: finalContent')
  assertEq(result.thinkingContent, 'think', 'char-by-char: thinkingContent')
}

// ── 13. Streaming — thinking buffer updates ───────────────────────────────

function test13_thinking_buffer_updates(): void {
  const sanitizer = new StreamingSanitizer()
  sanitizer.appendChunk('<think>step one ')
  const thinking1 = sanitizer.getThinkingBuffer()
  assertContains(thinking1, 'step one', 'thinking buffer contains in-progress text')

  sanitizer.appendChunk('step two</think>final')
  const result = sanitizer.finalize()
  assertContains(result.thinkingContent, 'step one', 'finalized thinking has step one')
  assertContains(result.thinkingContent, 'step two', 'finalized thinking has step two')
  assertEq(result.finalContent, 'final', 'final content')
}

// ── 14. Multiple thought blocks ───────────────────────────────────────────

function test14_multiple_thought_blocks(): void {
  const input = '<think>first</think>between<think>second</think>end'
  const result = sanitizeResponse(input)
  assertContains(result.thinkingContent, 'first', 'first block in thinking')
  assertContains(result.thinkingContent, 'second', 'second block in thinking')
  assertEq(result.finalContent, 'betweenend', 'text between and after blocks')
}

// ── 15. EDIT_SUGGESTION passthrough (in raw text) ────────────────────────

function test15_edit_suggestion_in_raw(): void {
  // Simulates a model putting EDIT_SUGGESTION inside a <thought> block,
  // but also after it — the raw text is what should be searched for EDIT_SUGGESTION
  const rawFromModel = '<thought>let me generate an edit</thought>Here is the result.\n[EDIT_SUGGESTION: blockABC]\nNew content here'
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

function test16_whitespace(): void {
  const result = sanitizeResponse('\n<thought>reasoning</thought>\n\nfinal answer\n')
  assertEq(result.finalContent, 'final answer\n', 'trimStart applied to finalContent')
  assertEq(result.thinkingContent, 'reasoning', 'thinking trimmed')
}

// ---------------------------------------------------------------------------
// Vitest-style wrapper (if vitest is available)
// ---------------------------------------------------------------------------

function registerVitestSuites(): void {
  if (typeof describe === 'undefined' || typeof it === 'undefined') return

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
  if (typeof describe !== 'undefined') return // vitest is running; skip

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

  let passed = 0
  let failed = 0
  const failures: string[] = []

  console.log('\n=== responseSanitizer standalone tests ===\n')

  for (const [name, fn] of tests) {
    try {
      await fn()
      console.log(`  ✅  ${name}`)
      passed++
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.log(`  ❌  ${name}\n     ${msg}`)
      failures.push(`${name}: ${msg}`)
      failed++
    }
  }

  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`)

  if (failures.length > 0) {
    console.log('Failures:')
    for (const f of failures) console.log(` - ${f}`)
    process.exit(1)
  }
}

runStandalone().catch(err => {
  console.error('Unexpected error in test runner:', err)
  process.exit(1)
})

console.debug(suites, currentSuite);