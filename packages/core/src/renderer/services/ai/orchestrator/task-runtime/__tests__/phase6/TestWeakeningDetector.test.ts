import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestStructureAnalyzer, TestStructure } from '../../workbench/ast/TestStructureAnalyzer';
import { TestWeakeningDetector } from '../../workbench/execution/TestWeakeningDetector';

describe('Phase 6.2.2: TestWeakeningDetector', () => {
  let detector: TestWeakeningDetector;

  beforeEach(() => {
    detector = new TestWeakeningDetector({} as any);
  });

  it('1. Detects removed tests', () => {
    const before: TestStructure = {
      testFile: 'test.ts',
      suites: [],
      tests: [{ name: 'test A', type: 'TEST', framework: 'detected', line: 1 }, { name: 'test B', type: 'TEST', framework: 'detected', line: 2 }],
      hooks: [],
      assertions: [{ matcher: 'expect', line: 1 }, { matcher: 'expect', line: 2 }],
      modifiers: [],
      swallowedErrors: 0
    };

    const after: TestStructure = {
       ...before,
       tests: [{ name: 'test A', type: 'TEST', framework: 'detected', line: 1 }],
       assertions: [{ matcher: 'expect', line: 1 }]
    };

    const result = detector.detectWeakening(before, after, false);
    expect(result.weakeningDetected).toBe(true);
    expect(result.weakeningTypes).toContain('TEST_REMOVED');
    expect(result.removedTests).toContain('test B');
  });

  it('2. Detects added skip modifiers', () => {
    const before: TestStructure = { testFile: 'test.ts', suites: [], tests: [], hooks: [], assertions: [], modifiers: [], swallowedErrors: 0 };
    const after: TestStructure = { ...before, modifiers: ['skip'] };

    const result = detector.detectWeakening(before, after, false);
    expect(result.weakeningDetected).toBe(true);
    expect(result.weakeningTypes).toContain('SKIP_ADDED');
  });

  it('3. Detects assertion reduction', () => {
    const before: TestStructure = { testFile: 'test.ts', suites: [], tests: [], hooks: [], assertions: [ {matcher: 'expect', line:1}, {matcher: 'expect', line:2} ], modifiers: [], swallowedErrors: 0 };
    const after: TestStructure = { ...before, assertions: [ {matcher: 'expect', line:1} ] };

    const result = detector.detectWeakening(before, after, false);
    expect(result.weakeningDetected).toBe(true);
    expect(result.weakeningTypes).toContain('ASSERTIONS_REDUCED');
  });

  it('4. Detects swallowed errors increase', () => {
    const before: TestStructure = { testFile: 'test.ts', suites: [], tests: [], hooks: [], assertions: [], modifiers: [], swallowedErrors: 0 };
    const after: TestStructure = { ...before, swallowedErrors: 1 };

    const result = detector.detectWeakening(before, after, false);
    expect(result.weakeningDetected).toBe(true);
    expect(result.weakeningTypes).toContain('ERROR_SWALLOWED');
  });

  it('5. Allows weakening if justification is provided but requires approval', () => {
    const before: TestStructure = { testFile: 'test.ts', suites: [], tests: [], hooks: [], assertions: [ {matcher: 'expect', line:1} ], modifiers: [], swallowedErrors: 0 };
    const after: TestStructure = { ...before, assertions: [] };

    // Justification provided = true
    const result = detector.detectWeakening(before, after, true);
    expect(result.weakeningDetected).toBe(true);
    expect(result.justificationRequired).toBe(false); // We provided it
  });
});
