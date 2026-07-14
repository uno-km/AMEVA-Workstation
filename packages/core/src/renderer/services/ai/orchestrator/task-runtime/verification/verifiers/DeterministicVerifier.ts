import type { TaskVerifier } from './TaskVerifier';
import type { VerificationInput } from '../runtime/VerificationInputBuilder';
import type { CriterionResult } from '../domain/VerificationTypes';
import type { IFileSystemAdapter } from '../../artifact/IFileSystemAdapter';

export class DeterministicVerifier implements TaskVerifier {
  public readonly verifierType = 'DETERMINISTIC_VERIFIER';
  public readonly verifierVersion = '1.0.0';

  private fileAdapter?: IFileSystemAdapter;

  constructor(fileAdapter?: IFileSystemAdapter) {
    this.fileAdapter = fileAdapter;
  }

  public async verify(input: VerificationInput): Promise<CriterionResult[]> {
    const results: CriterionResult[] = [];
    
    // Identity checks
    if (input.taskState.status !== 'VERIFYING') {
      results.push({
        criterionId: 'deterministic_state',
        verifierType: this.verifierType,
        verdict: 'FAIL',
        reason: `Task is not in VERIFYING state. Current: ${input.taskState.status}`,
        defect: {
          defectId: `def-${crypto.randomUUID()}`,
          signature: `DETERMINISTIC:FORMAT_INVALID:task:state:invalid`,
          stage: 'DETERMINISTIC',
          type: 'FORMAT_INVALID',
          severity: 'HIGH',
          required: true,
          message: `Task is not in VERIFYING state`,
          retryable: false,
          retryScope: 'FULL_TASK'
        }
      });
      return results; // Fast fail
    }

    if (!input.targetAttempt.resultReference) {
      results.push({
        criterionId: 'deterministic_result_exists',
        verifierType: this.verifierType,
        verdict: 'FAIL',
        reason: 'No resultReference found in target attempt.',
        defect: {
          defectId: `def-${crypto.randomUUID()}`,
          signature: `DETERMINISTIC:FORMAT_INVALID:result:missing`,
          stage: 'DETERMINISTIC',
          type: 'FORMAT_INVALID',
          severity: 'HIGH',
          required: true,
          message: `No resultReference found`,
          retryable: true,
          retryScope: 'FULL_TASK'
        }
      });
      return results;
    }

    const outputs = input.targetAttempt.resultReference.outputs || [];
    const requiredOutputs = input.taskDefinition.expectedOutputs?.filter(o => o.required) || [];
    const outputMap = new Map(outputs.map(o => [o.artifactId, o]));
    
    // 1. Missing required artifacts
    for (const req of requiredOutputs) {
      if (!outputMap.has(req.id)) {
        results.push({
          criterionId: `deterministic_req_missing_${req.id}`,
          verifierType: this.verifierType,
          verdict: 'FAIL',
          reason: `Required artifact ${req.id} is missing.`,
          defect: {
            defectId: `def-${crypto.randomUUID()}`,
            signature: `DETERMINISTIC:ARTIFACT_MISSING:${req.id}:output:missing`,
            stage: 'DETERMINISTIC',
            type: 'ARTIFACT_MISSING',
            severity: 'HIGH',
            required: true,
            artifactId: req.id,
            message: `Required artifact ${req.id} was not produced.`,
            retryable: true,
            retryScope: 'FULL_TASK'
          }
        });
      }
    }

    // 2. Validate outputs
    for (const artifact of outputs) {
      const isRequired = requiredOutputs.some(o => o.id === artifact.artifactId);
      
      if (artifact.status !== 'COMMITTED') {
        results.push({
          criterionId: `deterministic_status_${artifact.artifactId}`,
          verifierType: this.verifierType,
          verdict: 'FAIL',
          reason: `Artifact ${artifact.artifactId} status is ${artifact.status}, expected COMMITTED.`,
          defect: {
            defectId: `def-${crypto.randomUUID()}`,
            signature: `DETERMINISTIC:ARTIFACT_NOT_COMMITTED:${artifact.artifactId}:status:not_committed`,
            stage: 'DETERMINISTIC',
            type: 'ARTIFACT_NOT_COMMITTED',
            severity: 'CRITICAL',
            required: isRequired,
            artifactId: artifact.artifactId,
            message: `Artifact is not COMMITTED. Status: ${artifact.status}`,
            retryable: true,
            retryScope: 'ARTIFACT'
          }
        });
      }

      if (this.fileAdapter && artifact.type === 'FILE') {
        try {
          const exists = await this.fileAdapter.exists(artifact.path);
          if (!exists) {
            results.push({
              criterionId: `deterministic_file_missing_${artifact.artifactId}`,
              verifierType: this.verifierType,
              verdict: 'FAIL',
              reason: `File for artifact ${artifact.artifactId} does not exist at ${artifact.path}.`,
              defect: {
                defectId: `def-${crypto.randomUUID()}`,
                signature: `DETERMINISTIC:ARTIFACT_MISSING:${artifact.artifactId}:file:not_found`,
                stage: 'DETERMINISTIC',
                type: 'ARTIFACT_MISSING',
                severity: 'CRITICAL',
                required: isRequired,
                artifactId: artifact.artifactId,
                message: `File not found at ${artifact.path}`,
                retryable: true,
                retryScope: 'ARTIFACT'
              }
            });
            continue;
          }

          const stats = await this.fileAdapter.stat(artifact.path);
          if (stats.size !== artifact.size) {
            results.push({
              criterionId: `deterministic_size_mismatch_${artifact.artifactId}`,
              verifierType: this.verifierType,
              verdict: 'FAIL',
              reason: `Size mismatch for ${artifact.artifactId}. Expected ${artifact.size}, got ${stats.size}.`,
              defect: {
                defectId: `def-${crypto.randomUUID()}`,
                signature: `DETERMINISTIC:HASH_MISMATCH:${artifact.artifactId}:size:mismatch`,
                stage: 'DETERMINISTIC',
                type: 'HASH_MISMATCH',
                severity: 'HIGH',
                required: isRequired,
                artifactId: artifact.artifactId,
                message: `Size mismatch: expected ${artifact.size}, got ${stats.size}`,
                retryable: true,
                retryScope: 'ARTIFACT'
              }
            });
          }
          
          const hash = await this.fileAdapter.hash(artifact.path);
          if (hash !== artifact.hash) {
            results.push({
              criterionId: `deterministic_hash_mismatch_${artifact.artifactId}`,
              verifierType: this.verifierType,
              verdict: 'FAIL',
              reason: `Hash mismatch for ${artifact.artifactId}. Expected ${artifact.hash}, got ${hash}.`,
              defect: {
                defectId: `def-${crypto.randomUUID()}`,
                signature: `DETERMINISTIC:HASH_MISMATCH:${artifact.artifactId}:hash:mismatch`,
                stage: 'DETERMINISTIC',
                type: 'HASH_MISMATCH',
                severity: 'HIGH',
                required: isRequired,
                artifactId: artifact.artifactId,
                message: `Hash mismatch: expected ${artifact.hash}, got ${hash}`,
                retryable: true,
                retryScope: 'ARTIFACT'
              }
            });
          }
        } catch (e: any) {
          results.push({
            criterionId: `deterministic_file_error_${artifact.artifactId}`,
            verifierType: this.verifierType,
            verdict: 'FAIL',
            reason: `Error accessing file for ${artifact.artifactId}: ${e.message}`,
            defect: {
              defectId: `def-${crypto.randomUUID()}`,
              signature: `DETERMINISTIC:TEST_FAILED:${artifact.artifactId}:file:access_error`,
              stage: 'DETERMINISTIC',
              type: 'TEST_FAILED',
              severity: 'CRITICAL',
              required: isRequired,
              artifactId: artifact.artifactId,
              message: `File access error: ${e.message}`,
              retryable: true,
              retryScope: 'ARTIFACT'
            }
          });
        }
      }
      
      if (artifact.attemptId !== input.attemptId) {
        results.push({
          criterionId: `deterministic_attempt_mismatch_${artifact.artifactId}`,
          verifierType: this.verifierType,
          verdict: 'FAIL',
          reason: `Artifact attemptId ${artifact.attemptId} does not match current attempt ${input.attemptId}.`,
          defect: {
            defectId: `def-${crypto.randomUUID()}`,
            signature: `DETERMINISTIC:FORMAT_INVALID:${artifact.artifactId}:attempt:mismatch`,
            stage: 'DETERMINISTIC',
            type: 'FORMAT_INVALID',
            severity: 'MEDIUM',
            required: isRequired,
            artifactId: artifact.artifactId,
            message: `Attempt ID mismatch`,
            retryable: true,
            retryScope: 'ARTIFACT'
          }
        });
      }
    }

    if (results.length === 0) {
      results.push({
        criterionId: 'deterministic_all_pass',
        verifierType: this.verifierType,
        verdict: 'PASS',
        reason: 'All deterministic checks passed.'
      });
    }

    return results;
  }
}
