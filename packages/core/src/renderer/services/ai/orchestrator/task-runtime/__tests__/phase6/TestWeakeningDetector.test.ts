import { describe, it, expect, beforeEach } from 'vitest';
import { TestStructure } from '../../workbench/ast/TestStructureAnalyzer';
import { TestWeakeningDetector } from '../../workbench/execution/TestWeakeningDetector';

describe('Phase 6.2.2: TestWeakeningDetector Extended Tests', () => {
  let detector: TestWeakeningDetector;

  const createBaseStructure = (): TestStructure => ({
    testFile: 'test.ts',
    suites: [],
    tests: [],
    hooks: [],
    assertions: [],
    modifiers: [],
    swallowedErrors: 0,
    unreachableAssertions: 0,
    missingAwait: 0,
    promisesCatchReturningTrue: 0
  });

  beforeEach(() => {
    detector = new TestWeakeningDetector({} as any);
  });

  it('1. Detects test.each block deletion', () => {
    const before = createBaseStructure();
    before.tests = [{ name: 'test %i', type: 'TEST', framework: 'detected', line: 1 }];
    before.modifiers = ['each'];
    const after = createBaseStructure();

    const result = detector.detectWeakening(before, after, false);
    expect(result.weakeningDetected).toBe(true);
    expect(result.removedTests).toContain('test %i');
  });

  it('2. Detects test.each.skip addition', () => {
    const before = createBaseStructure();
    const after = createBaseStructure();
    after.modifiers = ['skip'];

    const result = detector.detectWeakening(before, after, false);
    expect(result.weakeningDetected).toBe(true);
    expect(result.weakeningTypes).toContain('SKIP_ADDED');
  });

  it('3. Detects expect.rejects replaced with resolves', () => {
    const before = createBaseStructure();
    before.assertions = [{ matcher: 'rejects.toThrow', line: 1 }];
    const after = createBaseStructure();
    after.assertions = [{ matcher: 'resolves.toBeDefined', line: 1 }];

    const result = detector.detectWeakening(before, after, false);
    expect(result.weakeningDetected).toBe(true);
    expect(result.weakeningTypes).toContain('REJECTS_TO_RESOLVES');
  });

  it('4. Detects toThrow removed', () => {
    const before = createBaseStructure();
    before.assertions = [{ matcher: 'rejects.toThrow', line: 1 }];
    const after = createBaseStructure();
    after.assertions = [{ matcher: 'rejects.toBeDefined', line: 1 }]; // Or any non-toThrow matcher

    const result = detector.detectWeakening(before, after, false);
    expect(result.weakeningDetected).toBe(true);
    expect(result.weakeningTypes).toContain('TOTHROW_REMOVED');
  });

  it('5. Detects toStrictEqual weakened to toBeDefined', () => {
    const before = createBaseStructure();
    before.assertions = [{ matcher: 'toStrictEqual', line: 1 }];
    const after = createBaseStructure();
    after.assertions = [{ matcher: 'toBeDefined', line: 1 }];

    const result = detector.detectWeakening(before, after, false);
    expect(result.weakeningDetected).toBe(true);
    expect(result.weakeningTypes).toContain('MATCHER_WEAKENED');
  });

  it('6. Detects Assertion placed in unreachable condition', () => {
    const before = createBaseStructure();
    const after = createBaseStructure();
    after.unreachableAssertions = 1;

    const result = detector.detectWeakening(before, after, false);
    expect(result.weakeningDetected).toBe(true);
    expect(result.weakeningTypes).toContain('UNREACHABLE_ASSERTION');
  });

  it('7. Detects Assertion missing await', () => {
    const before = createBaseStructure();
    const after = createBaseStructure();
    after.missingAwait = 1;

    const result = detector.detectWeakening(before, after, false);
    expect(result.weakeningDetected).toBe(true);
    expect(result.weakeningTypes).toContain('MISSING_AWAIT');
  });

  it('8. Detects Promise catch returning true', () => {
    const before = createBaseStructure();
    const after = createBaseStructure();
    after.promisesCatchReturningTrue = 1;

    const result = detector.detectWeakening(before, after, false);
    expect(result.weakeningDetected).toBe(true);
    expect(result.weakeningTypes).toContain('ERROR_SWALLOWED_RETURN_TRUE');
  });

  it('9. Detects unsupported framework (tests completely gone)', () => {
    const before = createBaseStructure();
    before.tests = [{ name: 'test A', type: 'TEST', framework: 'detected', line: 1 }];
    const after = createBaseStructure(); // 0 tests, 0 suites

    const result = detector.detectWeakening(before, after, false);
    expect(result.weakeningDetected).toBe(true);
    expect(result.weakeningTypes).toContain('UNSUPPORTED_FRAMEWORK');
  });
  
  it('10. Detects Config Weakening (package.json --passWithNoTests)', () => {
    const detector = new TestWeakeningDetector(null as any);
    const before = `"test": "vitest run"`;
    const after = `"test": "vitest run --passWithNoTests"`;
    const res = detector.detectConfigWeakening('package.json', before, after);
    expect(res.weakeningDetected).toBe(true);
    expect(res.weakeningTypes).toContain('TEST_SCRIPT_WEAKENED');
  });

  it('11. Detects Config Weakening (vitest.config.ts exclude added)', () => {
    const detector = new TestWeakeningDetector(null as any);
    const before = `export default { test: {} }`;
    const after = `export default { test: { exclude: ['**/secret.test.ts'] } }`;
    const res = detector.detectConfigWeakening('vitest.config.ts', before, after);
    expect(res.weakeningDetected).toBe(true);
    expect(res.weakeningTypes).toContain('CONFIG_EXCLUDE_ADDED');
  });

  it('12. Detects File Extension Weakening', () => {
    const detector = new TestWeakeningDetector(null as any);
    const res = detector.detectFileExtensionWeakening('src/app.test.ts', 'src/app.ts');
    expect(res.weakeningDetected).toBe(true);
    expect(res.weakeningTypes).toContain('TEST_EXTENSION_CHANGED');
  });
});
