import { TestStructureAnalyzer, TestStructure } from '../ast/TestStructureAnalyzer';
import { TestWeakeningResult } from '../domain/WorkbenchTypes';

export class TestWeakeningDetector {
  constructor(private analyzer: TestStructureAnalyzer) {}

  public detectWeakening(before: TestStructure, after: TestStructure, justificationProvided: boolean): TestWeakeningResult {
    const result: TestWeakeningResult = {
      testFile: after.testFile,
      weakeningDetected: false,
      weakeningTypes: [],
      removedTests: [],
      skippedTestsAdded: [],
      todoTestsAdded: [],
      onlyMarkersAdded: [],
      assertionsBefore: before.assertions.length,
      assertionsAfter: after.assertions.length,
      swallowedErrorsAdded: [],
      snapshotUpdates: [],
      expectationChanges: {},
      justificationRequired: false,
      evidence: [],
      unsupportedFramework: false
    };

    // 1. Detect removed test blocks
    const beforeTestNames = before.tests.map(t => t.name);
    const afterTestNames = after.tests.map(t => t.name);
    
    for (const name of beforeTestNames) {
      if (!afterTestNames.includes(name)) {
        result.removedTests.push(name);
        result.weakeningDetected = true;
        result.weakeningTypes.push('TEST_REMOVED');
        result.evidence.push(`Test block removed: "${name}"`);
      }
    }

    // 2. Detect modifiers added
    const newModifiers = after.modifiers.filter(m => !before.modifiers.includes(m));
    if (newModifiers.includes('skip')) {
      result.skippedTestsAdded.push('Detected newly skipped tests or suites');
      result.weakeningDetected = true;
      result.weakeningTypes.push('SKIP_ADDED');
      result.evidence.push('Added .skip modifier to test or suite.');
    }
    if (newModifiers.includes('todo')) {
      result.todoTestsAdded.push('Detected newly todo tests');
      result.weakeningDetected = true;
      result.weakeningTypes.push('TODO_ADDED');
      result.evidence.push('Added .todo modifier to test or suite.');
    }
    if (newModifiers.includes('only')) {
      result.onlyMarkersAdded.push('Detected newly only tests');
      result.weakeningDetected = true;
      result.weakeningTypes.push('ONLY_ADDED');
      result.evidence.push('Added .only modifier to test or suite.');
    }

    // 3. Detect assertion count decrease
    if (after.assertions.length < before.assertions.length) {
      result.weakeningDetected = true;
      result.weakeningTypes.push('ASSERTIONS_REDUCED');
      result.evidence.push(`Assertion count reduced from ${before.assertions.length} to ${after.assertions.length}.`);
    }

    // 4. Detect matcher weakening (strong to weak)
    const beforeStrongMatchers = before.assertions.filter(a => ['toStrictEqual', 'toEqual', 'toMatchObject'].includes(a.matcher)).length;
    const afterStrongMatchers = after.assertions.filter(a => ['toStrictEqual', 'toEqual', 'toMatchObject'].includes(a.matcher)).length;
    
    if (afterStrongMatchers < beforeStrongMatchers) {
      result.weakeningDetected = true;
      result.weakeningTypes.push('MATCHER_WEAKENED');
      result.evidence.push('Strong matchers (e.g. toStrictEqual) were replaced or removed.');
    }

    const beforeRejects = before.assertions.filter(a => a.matcher.includes('rejects')).length;
    const afterRejects = after.assertions.filter(a => a.matcher.includes('rejects')).length;
    const afterResolves = after.assertions.filter(a => a.matcher.includes('resolves')).length;

    if (afterRejects < beforeRejects && afterResolves > 0) {
       result.weakeningDetected = true;
       result.weakeningTypes.push('REJECTS_TO_RESOLVES');
       result.evidence.push('Rejects expectation was removed or changed to resolves.');
    }

    const beforeToThrow = before.assertions.filter(a => a.matcher.includes('toThrow') || a.matcher === 'throws').length;
    const afterToThrow = after.assertions.filter(a => a.matcher.includes('toThrow') || a.matcher === 'throws').length;

    if (afterToThrow < beforeToThrow) {
       result.weakeningDetected = true;
       result.weakeningTypes.push('TOTHROW_REMOVED');
       result.evidence.push('toThrow expectation was removed.');
    }

    // 5. Detect swallowed errors
    if (after.swallowedErrors > before.swallowedErrors) {
      result.swallowedErrorsAdded.push(`Swallowed errors increased by ${after.swallowedErrors - before.swallowedErrors}`);
      result.weakeningDetected = true;
      result.weakeningTypes.push('ERROR_SWALLOWED');
      result.evidence.push('Detected empty catch block or catch block that swallows errors.');
    }

    if (after.promisesCatchReturningTrue > before.promisesCatchReturningTrue) {
      result.weakeningDetected = true;
      result.weakeningTypes.push('ERROR_SWALLOWED_RETURN_TRUE');
      result.evidence.push('Detected catch block returning true to swallow promise rejection.');
    }

    if (after.unreachableAssertions > before.unreachableAssertions) {
      result.weakeningDetected = true;
      result.weakeningTypes.push('UNREACHABLE_ASSERTION');
      result.evidence.push('Assertion placed inside an unreachable block or after an early return.');
    }

    if (after.missingAwait > before.missingAwait) {
      result.weakeningDetected = true;
      result.weakeningTypes.push('MISSING_AWAIT');
      result.evidence.push('Async assertion is missing await.');
    }

    if (after.tests.length === 0 && after.suites.length === 0 && before.tests.length > 0) {
       result.unsupportedFramework = true;
       result.weakeningDetected = true;
       result.weakeningTypes.push('UNSUPPORTED_FRAMEWORK');
       result.evidence.push('No tests detected. Framework may be unsupported or tests were removed entirely.');
    }

    if (result.weakeningDetected && !justificationProvided) {
      result.justificationRequired = true;
    }

    return result;
  }

  public detectConfigWeakening(filename: string, beforeContent: string, afterContent: string): { weakeningDetected: boolean, weakeningTypes: string[], evidence: string[] } {
    const result = { weakeningDetected: false, weakeningTypes: [] as string[], evidence: [] as string[] };
    
    if (filename.includes('package.json')) {
       // Check if test script was weakened
       const beforeHasStrictTest = beforeContent.includes('"test": "vitest run"') || beforeContent.includes('--passWithNoTests') === false;
       const afterIsWeaker = afterContent.includes('exit 0') || afterContent.includes('--passWithNoTests');
       if (beforeHasStrictTest && afterIsWeaker && !beforeContent.includes('--passWithNoTests')) {
           result.weakeningDetected = true;
           result.weakeningTypes.push('TEST_SCRIPT_WEAKENED');
           result.evidence.push('package.json test script was weakened (e.g., added --passWithNoTests or replaced with exit 0).');
       }
    }
    
    if (filename.includes('vitest.config') || filename.includes('jest.config')) {
       if (afterContent.includes('passWithNoTests: true') && !beforeContent.includes('passWithNoTests: true')) {
           result.weakeningDetected = true;
           result.weakeningTypes.push('CONFIG_PASS_WITH_NO_TESTS');
           result.evidence.push('passWithNoTests was enabled in test config.');
       }
       if (afterContent.includes('exclude:') || afterContent.includes('testMatch:')) {
           // Basic heuristic for exclude changes
           if (afterContent.length > beforeContent.length && afterContent.includes('exclude')) {
               result.weakeningDetected = true;
               result.weakeningTypes.push('CONFIG_EXCLUDE_ADDED');
               result.evidence.push('Test exclude pattern was added or changed in config.');
           }
       }
    }
    
    return result;
  }
  
  public detectFileExtensionWeakening(beforePath: string, afterPath: string): { weakeningDetected: boolean, weakeningTypes: string[], evidence: string[] } {
    const result = { weakeningDetected: false, weakeningTypes: [] as string[], evidence: [] as string[] };
    if (beforePath.endsWith('.test.ts') && !afterPath.endsWith('.test.ts')) {
        result.weakeningDetected = true;
        result.weakeningTypes.push('TEST_EXTENSION_CHANGED');
        result.evidence.push(`Test file extension changed from ${beforePath} to ${afterPath}, potentially excluding it from test runs.`);
    }
    return result;
  }
}
