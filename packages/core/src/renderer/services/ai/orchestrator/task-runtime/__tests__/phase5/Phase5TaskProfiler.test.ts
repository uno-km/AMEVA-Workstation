import { describe, it, expect } from 'vitest';
import { TaskProfiler } from '../../routing/profiler/TaskProfiler';
import { Task } from '../../domain/types';

describe('Phase 5: TaskProfiler', () => {
  const baseTask: Task = {
    id: 't-1',
    missionId: 'm-1',
    definition: {
      id: 't-1',
      title: 'Analyze Data',
      goal: 'Parse the given JSON and summarize it.',
      description: 'You need to read the JSON file, extract keys, and write a summary.',
      expectedOutputs: [
        { id: 'o-1', kind: 'JSON', description: 'JSON summary' }
      ],
      requiredTools: ['read_file', 'write_file']
    },
    state: {
      status: 'PENDING',
      stateVersion: 1,
      attempts: {}
    },
    retries: 0,
    maxRetries: 3,
    startedAt: 0
  };

  it('profiles complexity and privacy correctly', () => {
    const profile = TaskProfiler.profileTask('m-1', baseTask, 'EXECUTION');
    
    // Tools are required
    expect(profile.toolRequired).toBe(true);
    expect(profile.requiredCapabilities).toContain('TOOL_SELECTION');
    expect(profile.requiredCapabilities).toContain('STRUCTURED_OUTPUT');
    
    // Default privacy is INTERNAL unless secret keywords exist
    expect(profile.privacyLevel).toBe('INTERNAL');
    expect(profile.riskLevel).toBe('MEDIUM'); // Medium because tools are required
  });

  it('detects high risk for code execution', () => {
    const codeTask: Task = { ...baseTask, definition: { ...baseTask.definition, expectedOutputs: [{ id: 'o-2', kind: 'CODE', description: 'Script' }] } };
    const profile = TaskProfiler.profileTask('m-1', codeTask, 'EXECUTION');
    expect(profile.codeExecutionRequired).toBe(true);
    expect(profile.requiredCapabilities).toContain('CODE_GENERATION');
    expect(profile.riskLevel).toBe('HIGH');
  });

  it('detects restricted privacy', () => {
    const restrictedTask: Task = { ...baseTask, definition: { ...baseTask.definition, goal: 'Access internal api sensitive data' } };
    const profile = TaskProfiler.profileTask('m-1', restrictedTask, 'EXECUTION');
    expect(profile.privacyLevel).toBe('RESTRICTED');
    expect(profile.riskLevel).toBe('CRITICAL');
  });
});
