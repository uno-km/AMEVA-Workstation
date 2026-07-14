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
    
    const callRatio = 1.0 - (this.state.totalModelCallCount / this.config.maxTotalModelCalls);
    const tokenRatio = 1.0 - (this.state.estimatedTokensUsed / this.config.maxEstimatedTokens);
    
    return Math.min(callRatio, tokenRatio);
  }

  public getState(): RoutingBudgetState {
    return { ...this.state };
  }
}
