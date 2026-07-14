import { describe, it, expect } from 'vitest';
import { WorkbenchRouterProfileFactory } from '../../workbench/routing/WorkbenchRouterProfile';

describe('Phase6.1 ModelRouting', () => {
  it('should map CODE workbench type to REASONING task', () => {
    const profile = WorkbenchRouterProfileFactory.createProfile('CODE', 2000);
    expect(profile.taskType).toBe('REASONING');
    expect(profile.codeExecutionRequired).toBe(true);
    expect(profile.toolRequired).toBe(true);
  });

  it('should map DOCUMENT workbench type to SUMMARIZATION task', () => {
    const profile = WorkbenchRouterProfileFactory.createProfile('DOCUMENT', 2000);
    expect(profile.taskType).toBe('SUMMARIZATION');
    expect(profile.codeExecutionRequired).toBe(false);
  });

  it('should use RULE_ENGINE bypass for simple format checks', () => {
    const profile = WorkbenchRouterProfileFactory.createProfile('MIXED', 1000, true);
    // isSimpleFormatCheck = true limits the context and removes tool/code requirements, setting reasoning to very low
    expect(profile.taskType).toBe('SUMMARIZATION');
    expect(profile.reasoningComplexity).toBe(0.1);
    expect(profile.toolRequired).toBe(false);
  });
});
