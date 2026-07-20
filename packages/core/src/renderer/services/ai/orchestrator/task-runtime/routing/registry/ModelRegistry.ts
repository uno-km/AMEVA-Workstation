/**
 * @file routing/registry/ModelRegistry.ts
 * @system AMEVA OS Desktop Workstation
 * @role Central Model Registry for Routing
 * 
 * [CONTRACT]
 * - Must NOT import useAIModels or depend on UI store as the source of truth.
 * - This is an independent domain service that holds the state of available models.
 */

import type { ModelDescriptor, ModelRole, Capability, PrivacyLevel } from '../domain/types';

export class ModelRegistry {
  private static instance: ModelRegistry;
  private models: Map<string, ModelDescriptor> = new Map();
  private roleMappings: Map<ModelRole, string[]> = new Map();

  private constructor() {}

  public static getInstance(): ModelRegistry {
    if (!ModelRegistry.instance) {
      ModelRegistry.instance = new ModelRegistry();
    }
    return ModelRegistry.instance;
  }

  /**
   * Sync the entire registry snapshot from a discovery adapter.
   */
  public syncSnapshot(snapshot: ModelDescriptor[]): void {
    this.models.clear();
    for (const model of snapshot) {
      this.models.set(model.modelId, model);
    }
  }

  public registerModel(descriptor: ModelDescriptor): void {
    this.models.set(descriptor.modelId, descriptor);
  }

  public unregisterModel(modelId: string): void {
    this.models.delete(modelId);
  }

  public getModel(modelId: string): ModelDescriptor | undefined {
    return this.models.get(modelId);
  }

  public getAllModels(): ModelDescriptor[] {
    return Array.from(this.models.values());
  }

  public getAvailableModels(): ModelDescriptor[] {
    return this.getAllModels().filter(m => m.availability === 'AVAILABLE' && m.enabled);
  }

  public getModelsByCapability(capability: Capability): ModelDescriptor[] {
    return this.getAvailableModels().filter(m => m.capabilities.includes(capability));
  }

  public getModelsByRole(role: ModelRole): ModelDescriptor[] {
    const roleModelIds = this.roleMappings.get(role) || [];
    const models = roleModelIds
      .map(id => this.models.get(id))
      .filter((m): m is ModelDescriptor => m !== undefined && m.availability === 'AVAILABLE' && m.enabled);
    
    // Fallback: If no strict mapping exists but there is a model, map it.
    // As per requirement: "하나의 실제 7B 모델만 설치된 경우에도 시스템은 동작해야 한다."
    if (models.length === 0) {
      return this.getAvailableModels(); 
    }
    return models;
  }

  public updateRoleMappings(mappings: Record<ModelRole, string[]>): void {
    for (const [role, ids] of Object.entries(mappings)) {
      this.roleMappings.set(role as ModelRole, ids);
    }
  }

  public updateHealth(modelId: string, health: ModelDescriptor['healthStatus']): void {
    const model = this.models.get(modelId);
    if (model) {
      model.healthStatus = health;
      if (health === 'UNAVAILABLE' || health === 'OOM') {
        model.availability = 'UNAVAILABLE';
      }
    }
  }

  public getRegistrySnapshot(): ModelDescriptor[] {
    return this.getAllModels();
  }
}
