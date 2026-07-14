/**
 * @file orchestrator/task-runtime/verification/verifiers/TaskVerifierCoordinator.ts
 * @system AMEVA OS Desktop Workstation
 * @role 여러 Verifier를 파이프라인으로 실행하고 결과를 취합
 */

import type { VerificationInput } from '../runtime/VerificationInputBuilder';
import type { CriterionResult } from '../domain/VerificationTypes';
import type { TaskVerifier } from './TaskVerifier';
import type { ILLMEngineAdapter } from '../../../types';
import type { IFileSystemAdapter } from '../../artifact/IFileSystemAdapter';

import { IdentityVerifier } from './IdentityVerifier';
import { DependencyConsistencyVerifier } from './DependencyConsistencyVerifier';
import { DeterministicVerifier } from './DeterministicVerifier';
import { ContractVerifier } from './ContractVerifier';
import { SemanticVerifier } from './SemanticVerifier';

export class TaskVerifierCoordinator {
  private deterministicVerifiers: TaskVerifier[] = [];
  private contractVerifiers: TaskVerifier[] = [];
  private semanticVerifiers: TaskVerifier[] = [];

  constructor(adapter?: ILLMEngineAdapter, fileAdapter?: IFileSystemAdapter) {
    // 1. Deterministic Layer
    this.deterministicVerifiers.push(new IdentityVerifier());
    this.deterministicVerifiers.push(new DependencyConsistencyVerifier());
    this.deterministicVerifiers.push(new DeterministicVerifier(fileAdapter));

    // 2. Contract Layer
    this.contractVerifiers.push(new ContractVerifier());

    // 3. Semantic Layer
    this.semanticVerifiers.push(new SemanticVerifier(adapter));
  }

  public setSemanticAdapter(adapter: ILLMEngineAdapter): void {
    for (const verifier of this.semanticVerifiers) {
      if (verifier instanceof SemanticVerifier) {
        verifier.setAdapter(adapter);
      }
    }
  }

  public setStrictBiasMode(enabled: boolean): void {
    for (const verifier of this.semanticVerifiers) {
      if (verifier instanceof SemanticVerifier) {
        verifier.setStrictBiasMode(enabled);
      }
    }
  }

  public async runVerificationPipeline(input: VerificationInput): Promise<CriterionResult[]> {
    const allResults: CriterionResult[] = [];

    // Phase 1: Deterministic
    const detFailed = await this.runLayer(this.deterministicVerifiers, input, allResults);
    if (detFailed) {
      console.log(`[TaskVerifierCoordinator] Deterministic checks failed. Skipping Contract and Semantic.`);
      return allResults;
    }

    // Phase 2: Contract
    const contractFailed = await this.runLayer(this.contractVerifiers, input, allResults);
    if (contractFailed) {
      console.log(`[TaskVerifierCoordinator] Contract checks failed. Skipping Semantic.`);
      return allResults;
    }

    // Phase 3: Semantic
    await this.runLayer(this.semanticVerifiers, input, allResults);

    return allResults;
  }

  private async runLayer(
    verifiers: TaskVerifier[], 
    input: VerificationInput, 
    allResults: CriterionResult[]
  ): Promise<boolean> {
    let layerFailed = false;

    for (const verifier of verifiers) {
      try {
        const results = await verifier.verify(input);
        allResults.push(...results);
        
        // Check if any required failure or defect occurred
        for (const res of results) {
          if (res.verdict === 'FAIL' || res.verdict === 'ERROR') {
            // Check if it's a required failure (defect.required)
            if (res.defect && res.defect.required) {
              layerFailed = true;
            } else if (!res.defect) {
              // If no defect provided but it failed, assume it's critical/required to be safe
              layerFailed = true;
            }
          }
        }
      } catch (e: unknown) {
        const errorMessage = e instanceof Error ? e.message : String(e);
        console.error(`[TaskVerifierCoordinator] Verifier ${verifier.verifierType} threw: ${errorMessage}`);
        allResults.push({
          criterionId: `verifier_error_${verifier.verifierType}`,
          verifierType: verifier.verifierType,
          verdict: 'ERROR',
          reason: `Verifier threw an exception: ${errorMessage}`
        });
        layerFailed = true; // Exception in verifier is considered a failure
      }
    }

    return layerFailed;
  }
}
