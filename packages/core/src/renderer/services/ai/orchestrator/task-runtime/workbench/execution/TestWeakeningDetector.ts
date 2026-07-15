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
      evidence: []
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
    // Here we can use heuristic matching based on expectation matcher frequency
    const beforeStrongMatchers = before.assertions.filter(a => ['toStrictEqual', 'toEqual', 'toMatchObject'].includes(a.matcher)).length;
    const afterStrongMatchers = after.assertions.filter(a => ['toStrictEqual', 'toEqual', 'toMatchObject'].includes(a.matcher)).length;
    
    if (afterStrongMatchers < beforeStrongMatchers) {
      result.weakeningDetected = true;
      result.weakeningTypes.push('MATCHER_WEAKENED');
      result.evidence.push('Strong matchers (e.g. toStrictEqual) were replaced or removed.');
    }

    // 5. Detect swallowed errors
    if (after.swallowedErrors > before.swallowedErrors) {
      result.swallowedErrorsAdded.push(`Swallowed errors increased by ${after.swallowedErrors - before.swallowedErrors}`);
      result.weakeningDetected = true;
      result.weakeningTypes.push('ERROR_SWALLOWED');
      result.evidence.push('Detected empty catch block or catch block that swallows errors.');
    }

    if (result.weakeningDetected && !justificationProvided) {
      result.justificationRequired = true;
    }

    return result;
  }
}
