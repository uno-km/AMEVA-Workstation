/**
 * @file routing/domain/RoutingConfigManager.ts
 * @system AMEVA OS Desktop Workstation
 * @role Manages routing configurations
 */

import type { RoutingConfig } from './types';

export class RoutingConfigManager {
  private static instance: RoutingConfigManager;
  
  private config: RoutingConfig = {
    routingEnabled: true, // Feature flag for Phase 5 routing
    localFirst: true,
    allowRemoteForPublic: false,
    allowRemoteForInternal: false,
    approvalRequiredForRemoteConfidential: true,
    confidenceThresholdUse: 0.85,
    confidenceThresholdEscalate: 0.60,
    maxRoutingDecisions: 100,
    maxModelEscalations: 5,
    maxModelSwitches: 10,
    maxTotalModelCalls: 50,
    maxEstimatedTokens: 100000,
    maxRoutingTimeMs: 60000,
    rolePreferences: {
      RULE_ENGINE: [],
      SMALL_MODEL: [],
      MEDIUM_MODEL: [],
      PRIMARY_MODEL: []
    },
    disabledModelIds: [],
    forcedLocalTaskTypes: ['VERIFICATION'],
    forcedModelByCapability: {},
    maxRuleEngineContextTokens: 500,
    codingModelId: 'qwen-7b-code',
    codingModelPath: 'C:\\ameva\\models\\code'
  };

  private constructor() {}

  public static getInstance(): RoutingConfigManager {
    if (!RoutingConfigManager.instance) {
      RoutingConfigManager.instance = new RoutingConfigManager();
    }
    return RoutingConfigManager.instance;
  }

  public getConfig(): RoutingConfig {
    return this.config;
  }

  public updateConfig(newConfig: Partial<RoutingConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }
}
