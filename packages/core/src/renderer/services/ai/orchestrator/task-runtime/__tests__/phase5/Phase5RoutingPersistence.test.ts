import { describe, it, expect } from 'vitest';
import { RoutingBudgetManager } from '../../routing/budget/RoutingBudgetManager';
import { RoutingConfigManager } from '../../routing/domain/RoutingConfigManager';
import { EscalationManager } from '../../routing/escalation/EscalationManager';

describe('Phase 5: RoutingPersistence', () => {
  it('RoutingBudget and Escalation states can be serialized for persistence', () => {
    const config = RoutingConfigManager.getInstance().getConfig();
    const budget = new RoutingBudgetManager(config);
    budget.recordCall(500);

    const escalation = new EscalationManager();
    escalation.recordEscalation({
      previousModelId: 'a',
      previousRole: 'SMALL_MODEL',
      failureType: 'ParseError',
      defectSignatures: [],
      validationResult: null,
      toolObservationSummary: '',
      failedOutputReference: '',
      retryScope: 'FULL_TASK',
      newModelRole: 'MEDIUM_MODEL',
      protectedRanges: [],
      doNotRepeat: true,
      escalationReason: ''
    });

    // Check serializability
    const budgetState = budget.getState();
    const serializedBudget = JSON.stringify(budgetState);
    const parsedBudget = JSON.parse(serializedBudget);

    expect(parsedBudget.totalModelCallCount).toBe(1);

    const escalationHistory = escalation.getHistory();
    const serializedHistory = JSON.stringify(escalationHistory);
    const parsedHistory = JSON.parse(serializedHistory);

    expect(parsedHistory.length).toBe(1);
    expect(parsedHistory[0].newModelRole).toBe('MEDIUM_MODEL');
  });
});
