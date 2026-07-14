import { describe, it, expect } from 'vitest';
import { RoutingBudgetManager } from '../../routing/budget/RoutingBudgetManager';
import { RoutingConfigManager } from '../../routing/domain/RoutingConfigManager';

describe('Phase 5: RoutingBudgetManager', () => {
  it('enforces maximum limits and returns correct remaining ratio', () => {
    const config = RoutingConfigManager.getInstance().getConfig();
    config.maxTotalModelCalls = 10;
    config.maxEstimatedTokens = 50000;

    const budget = new RoutingBudgetManager(config);
    expect(budget.isExhausted()).toBe(false);
    
    budget.recordCall(10000);
    expect(budget.getRemainingRatio()).toBeCloseTo(0.8); // 10000 / 50000 = 0.2 consumed -> 0.8 remain. 1 call out of 10 = 0.9 remain. min is 0.8
    
    // Exhaust by calls
    for (let i = 0; i < 9; i++) {
      budget.recordCall(1000);
    }
    expect(budget.isExhausted()).toBe(true);
    expect(budget.getRemainingRatio()).toBe(0.0);
  });

  it('preserves state when initialized with existing state', () => {
    const config = RoutingConfigManager.getInstance().getConfig();
    const budget = new RoutingBudgetManager(config, {
      routingDecisionCount: 5,
      modelEscalationCount: 2,
      modelSwitchCount: 1,
      totalModelCallCount: 3,
      estimatedTokensUsed: 15000,
      routingStartedAt: 12345
    });

    const state = budget.getState();
    expect(state.routingDecisionCount).toBe(5);
    expect(state.estimatedTokensUsed).toBe(15000);
  });
});
