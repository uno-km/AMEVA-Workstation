import { describe, it, expect, beforeEach } from 'vitest';
import { RoutingBudgetManager } from '../../routing/budget/RoutingBudgetManager';
import { RoutingConfigManager } from '../../routing/domain/RoutingConfigManager';

describe('Phase 5.4: Routing Budget Manager', () => {
  let configManager: RoutingConfigManager;

  beforeEach(() => {
    configManager = RoutingConfigManager.getInstance();
    configManager.updateConfig({
      routingEnabled: true,
      maxRoutingDecisions: 5,
      maxModelEscalations: 3,
      maxModelSwitches: 3,
      maxTotalModelCalls: 100,
      maxEstimatedTokens: 50000,
      maxRoutingTimeMs: 5000
    });
  });

  it('1. should separate limit from usage in state', () => {
    const budgetManager = new RoutingBudgetManager(configManager.getConfig());
    const state = budgetManager.getState();
    
    expect(state).toHaveProperty('routingDecisionCount', 0);
    expect(state).not.toHaveProperty('maxRoutingDecisions');
  });

  it('2. should clamp remaining ratio to 0-1', () => {
    const budgetManager = new RoutingBudgetManager(configManager.getConfig());
    
    // Consume budget manually
    for(let i=0; i<3; i++) budgetManager.recordDecision();
    
    const ratio = budgetManager.getRemainingRatio();
    expect(ratio).toBeGreaterThan(0);
    expect(ratio).toBeLessThanOrEqual(1);
    expect(ratio).toBe(2/5);
  });

  it('3. isExhausted should check against config limits', () => {
    const budgetManager = new RoutingBudgetManager(configManager.getConfig());
    
    for(let i=0; i<5; i++) budgetManager.recordDecision();
    
    expect(budgetManager.isExhausted()).toBe(true);
  });

  it('4. should handle zero limits gracefully', () => {
    configManager.updateConfig({
      ...configManager.getConfig(),
      maxRoutingDecisions: 0
    });

    const budgetManager = new RoutingBudgetManager(configManager.getConfig());
    expect(budgetManager.isExhausted()).toBe(true);
    expect(budgetManager.getRemainingRatio()).toBe(0);
  });

  it('5. should restore from usage state correctly', () => {
    const restoredState = {
      routingDecisionCount: 2,
      modelEscalationCount: 1,
      modelSwitchCount: 0,
      totalModelCallCount: 10,
      estimatedTokensUsed: 1500,
      routingStartedAt: Date.now() - 1000
    };

    const budgetManager = new RoutingBudgetManager(configManager.getConfig(), restoredState);
    expect(budgetManager.getState().routingDecisionCount).toBe(2);
    
    budgetManager.recordDecision();
    expect(budgetManager.getState().routingDecisionCount).toBe(3);
  });
});
