/**
 * @file routing/budget/RoutingBudgetManager.ts
 * @system AMEVA OS Desktop Workstation
 * @role Tracks model routing metrics and limits
 */

import { RoutingConfig } from '../domain/types';

export interface RoutingBudgetState {
  routingDecisionCount: number;
  modelEscalationCount: number;
  modelSwitchCount: number;
  totalModelCallCount: number;
  estimatedTokensUsed: number;
  routingStartedAt: number;
}

export class RoutingBudgetManager {
  private state: RoutingBudgetState;
  private config: RoutingConfig;

  constructor(config: RoutingConfig, initialState?: RoutingBudgetState) {
    this.config = config;
    this.state = initialState || {
      routingDecisionCount: 0,
      modelEscalationCount: 0,
      modelSwitchCount: 0,
      totalModelCallCount: 0,
      estimatedTokensUsed: 0,
      routingStartedAt: Date.now()
    };
  }

  public recordDecision(): boolean {
    this.state.routingDecisionCount++;
    return this.state.routingDecisionCount <= this.config.maxRoutingDecisions;
  }

  public recordEscalation(): boolean {
    this.state.modelEscalationCount++;
    return this.state.modelEscalationCount <= this.config.maxModelEscalations;
  }

  public recordSwitch(): boolean {
    this.state.modelSwitchCount++;
    return this.state.modelSwitchCount <= this.config.maxModelSwitches;
  }

  public recordCall(tokens: number): boolean {
    this.state.totalModelCallCount++;
    this.state.estimatedTokensUsed += tokens;
    
    return (this.state.totalModelCallCount <= this.config.maxTotalModelCalls) &&
           (this.state.estimatedTokensUsed <= this.config.maxEstimatedTokens);
  }

  public isExhausted(): boolean {
    if (this.config.maxRoutingDecisions <= 0 ||
        this.config.maxModelEscalations <= 0 ||
        this.config.maxModelSwitches <= 0 ||
        this.config.maxTotalModelCalls <= 0 ||
        this.config.maxEstimatedTokens <= 0) {
      return true; // Limit is 0 or negative -> exhausted
    }

    // Time budget check if maxRoutingTimeMs is provided
    if (this.config.maxRoutingTimeMs && this.config.maxRoutingTimeMs > 0) {
      if (Date.now() - this.state.routingStartedAt >= this.config.maxRoutingTimeMs) {
        return true;
      }
    }

    return (
      this.state.routingDecisionCount >= this.config.maxRoutingDecisions ||
      this.state.modelEscalationCount >= this.config.maxModelEscalations ||
      this.state.modelSwitchCount >= this.config.maxModelSwitches ||
      this.state.totalModelCallCount >= this.config.maxTotalModelCalls ||
      this.state.estimatedTokensUsed >= this.config.maxEstimatedTokens
    );
  }

  public getRemainingRatio(): number {
    if (this.isExhausted()) return 0.0;
    
    let callRatio = 0;
    if (this.config.maxTotalModelCalls > 0 && isFinite(this.config.maxTotalModelCalls)) {
      callRatio = 1.0 - (this.state.totalModelCallCount / this.config.maxTotalModelCalls);
    }
    
    let tokenRatio = 0;
    if (this.config.maxEstimatedTokens > 0 && isFinite(this.config.maxEstimatedTokens)) {
      tokenRatio = 1.0 - (this.state.estimatedTokensUsed / this.config.maxEstimatedTokens);
    }

    let timeRatio = 1.0;
    if (this.config.maxRoutingTimeMs && this.config.maxRoutingTimeMs > 0 && isFinite(this.config.maxRoutingTimeMs)) {
      timeRatio = 1.0 - ((Date.now() - this.state.routingStartedAt) / this.config.maxRoutingTimeMs);
    }
    
    let decisionRatio = 1.0;
    if (this.config.maxRoutingDecisions > 0 && isFinite(this.config.maxRoutingDecisions)) {
      decisionRatio = 1.0 - (this.state.routingDecisionCount / this.config.maxRoutingDecisions);
    }
    
    let escalationRatio = 1.0;
    if (this.config.maxModelEscalations > 0 && isFinite(this.config.maxModelEscalations)) {
      escalationRatio = 1.0 - (this.state.modelEscalationCount / this.config.maxModelEscalations);
    }

    let switchRatio = 1.0;
    if (this.config.maxModelSwitches > 0 && isFinite(this.config.maxModelSwitches)) {
      switchRatio = 1.0 - (this.state.modelSwitchCount / this.config.maxModelSwitches);
    }

    // clamp all ratios to [0, 1]
    const clamp = (val: number) => {
      if (isNaN(val)) return 0;
      return Math.max(0, Math.min(1, val));
    };

    return Math.min(clamp(callRatio), clamp(tokenRatio), clamp(timeRatio), clamp(decisionRatio), clamp(escalationRatio), clamp(switchRatio));
  }

  public getState(): RoutingBudgetState {
    return { ...this.state };
  }
}
