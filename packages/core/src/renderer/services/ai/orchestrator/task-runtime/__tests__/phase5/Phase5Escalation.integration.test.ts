import { describe, it, expect, beforeEach } from 'vitest';
import { EscalationManager } from '../../routing/escalation/EscalationManager';

describe('Phase 5: EscalationManager', () => {
  let manager: EscalationManager;

  beforeEach(() => {
    manager = new EscalationManager();
  });

  it('escalates roles step-by-step', () => {
    expect(manager.getNextRole('RULE_ENGINE')).toBe('SMALL_MODEL');
    expect(manager.getNextRole('SMALL_MODEL')).toBe('MEDIUM_MODEL');
    expect(manager.getNextRole('MEDIUM_MODEL')).toBe('PRIMARY_MODEL');
    expect(manager.getNextRole('PRIMARY_MODEL')).toBe('PRIMARY_MODEL'); // Caps at PRIMARY
    expect(manager.getNextRole(null)).toBe('PRIMARY_MODEL');
  });

  it('blocks exact duplicate combinations (Anti-loop)', () => {
    manager.recordEscalation({
      previousModelId: 'llama-7b',
      previousRole: 'SMALL_MODEL',
      failureType: 'ParseError',
      defectSignatures: ['err_json_parse', 'no_tool_call'],
      validationResult: null,
      toolObservationSummary: '',
      failedOutputReference: '',
      retryScope: 'FULL_TASK',
      newModelRole: 'MEDIUM_MODEL',
      protectedRanges: [],
      doNotRepeat: true,
      escalationReason: 'Repeated parse failures'
    });

    // Same model, same scope, exact same signatures
    expect(manager.isExactDuplicate('llama-7b', ['err_json_parse', 'no_tool_call'], 'FULL_TASK')).toBe(true);

    // Different signature
    expect(manager.isExactDuplicate('llama-7b', ['err_json_parse'], 'FULL_TASK')).toBe(false);

    // Different scope
    expect(manager.isExactDuplicate('llama-7b', ['err_json_parse', 'no_tool_call'], 'PARTIAL')).toBe(false);

    // Different model
    expect(manager.isExactDuplicate('qwen-32b', ['err_json_parse', 'no_tool_call'], 'FULL_TASK')).toBe(false);
  });
});
