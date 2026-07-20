import type { TaskVerifier } from './TaskVerifier';
import type { VerificationInput } from '../runtime/VerificationInputBuilder';
import type { CriterionResult } from '../domain/VerificationTypes';
import type { IFileSystemAdapter } from '../../artifact/IFileSystemAdapter';
import { OutputInferenceService } from '../services/OutputInferenceService';
import { OutputAttributionService } from '../services/OutputAttributionService';
import type { TaskOutputMode } from '../../domain/types';

export class DeterministicVerifier implements TaskVerifier {
  public readonly verifierType = 'DETERMINISTIC_VERIFIER';
  public readonly verifierVersion = '2.0.0';

  private fileAdapter?: IFileSystemAdapter;

  constructor(fileAdapter?: IFileSystemAdapter) {
    this.fileAdapter = fileAdapter;
  }

  public async verify(input: VerificationInput): Promise<CriterionResult[]> {
    const results: CriterionResult[] = [];
    
    // Identity checks
    if (input.taskState.status !== 'VERIFYING') {
      results.push(this.createFailure('deterministic_state', 'Task is not in VERIFYING state', 'FORMAT_INVALID', true));
      return results;
    }

    if (!input.targetAttempt.resultReference) {
      results.push(this.createFailure('deterministic_result_exists', 'No resultReference found in target attempt', 'FORMAT_INVALID', true));
      return results;
    }

    const resultRef = input.targetAttempt.resultReference;
    const outputs = resultRef.outputs || [];
    const outputMap = new Map(outputs.map(o => [o.artifactId || o.path || 'unknown', o]));
    const textContent = outputs.filter(o => o.type === 'text').map(o => o.content).join('').trim();
    
    // Output Attribution
    const attributions = OutputAttributionService.extractAttributions(resultRef);
    const declaredMode = input.taskDefinition.outputMode || 'NO_PERSISTED_OUTPUT';
    
    // Instead of using undefined executedTools, we map attributions to a format expected by inferFromToolCalls
    const executedToolsMock = attributions.map(attr => ({
      name: attr.sourceTool,
      args: { path: attr.path },
      success: true
    }));
    
    const inferred = OutputInferenceService.inferFromToolCalls(executedToolsMock, declaredMode);
    
    const finalMode = inferred.inferredOutputMode;
    const expectedFileOutputs = new Set([
      ...(input.taskDefinition.expectedFileOutputs || []),
      ...inferred.inferredFileOutputs
    ]);
    const expectedArtifactOutputs = new Set(input.taskDefinition.expectedArtifactOutputs || []);

    if (finalMode === 'FILE_OUTPUT_REQUIRED') {
      if (expectedFileOutputs.size === 0) {
         results.push(this.createFailure('expected_outputs_missing', 'FILE_OUTPUT_REQUIRED but expectedFileOutputs is empty', 'EXPECTED_OUTPUTS_MISSING', true));
      }

      for (const reqId of expectedFileOutputs) {
        // Cross Verification Layer 1: Evidence (Attribution)
        const attribution = attributions.find(a => a.path === reqId);
        if (!attribution) {
          results.push(this.createFailure(`attribution_missing_${reqId}`, `No tool writing evidence found for required output ${reqId}`, 'STRICT_VERIFICATION_FAILED', true, reqId));
          continue;
        }

        // Cross Verification Layer 2: Artifact Declaration
        let artifactDeclared = false;
        let artifactPath = reqId;
        for (const out of outputs) {
           if (out.artifactId === reqId || out.path === reqId || (out.content && out.content.includes(reqId))) {
             artifactDeclared = true;
             artifactPath = out.path || reqId;
             break;
           }
        }
        
        if (!artifactDeclared) {
           results.push(this.createFailure(`artifact_declaration_missing_${reqId}`, `Required output ${reqId} has no artifact declaration in outputs`, 'ARTIFACT_DECLARATION_MISSING', true, reqId));
           continue;
        }

        // Cross Verification Layer 3: File System
        if (this.fileAdapter) {
          try {
            const stats = await this.fileAdapter.stat(artifactPath);
            if (!stats.exists) {
              results.push(this.createFailure(`output_file_not_found_${reqId}`, `File not found at ${artifactPath}`, 'OUTPUT_FILE_NOT_FOUND', true, reqId));
              continue;
            }

            if (stats.size === 0) {
              results.push(this.createFailure(`output_file_empty_${reqId}`, `File ${artifactPath} is empty`, 'OUTPUT_FILE_EMPTY_OR_UNCHANGED', true, reqId));
            }
          } catch (e: unknown) {
            const errMsg = e instanceof Error ? e.message : String(e);
            results.push(this.createFailure(`file_error_${reqId}`, `Error accessing file ${artifactPath}: ${errMsg}`, 'TEST_FAILED', true, reqId));
          }
        } else {
          /*
           * [P2-2 FIX — fileAdapter 없을 때 명시적 경고]
           * 이전: fileAdapter가 없으면 파일 실존 검증을 조용히 스킵.
           *       파일이 실제로 없어도 Attribution + Declaration만으로 PASS 가능했음.
           * 수정: INCOMPLETE_VERIFICATION 경고를 결과에 추가하여
           *       상위 VerificationDecisionPolicy가 인지하고 대응할 수 있게 함.
           *       단, required=false (non-blocking) — fileAdapter 미주입은
           *       테스트 환경에서 일어날 수 있으므로 FAIL보다는 WARN 수준.
           */
          console.warn(`[DeterministicVerifier] fileAdapter가 주입되지 않아 ${artifactPath}의 파일 실존 검증을 스킵합니다. INCOMPLETE_VERIFICATION 경고 추가.`);
          results.push({
            criterionId: `file_adapter_missing_${reqId}`,
            verifierType: this.verifierType,
            verdict: 'WARN',
            reason: `fileAdapter가 주입되지 않아 파일 실존 검증 불가 (${artifactPath}). Attribution + Declaration 증거만으로 통과됨.`,
            defect: {
              defectId: `def-${crypto.randomUUID()}`,
              signature: `DETERMINISTIC:INCOMPLETE_VERIFICATION:${reqId}:no_fs_adapter`,
              stage: 'DETERMINISTIC',
              type: 'INCOMPLETE_VERIFICATION' as any,
              severity: 'MEDIUM',
              required: false, // non-blocking
              artifactId: reqId,
              message: `파일 시스템 어댑터 미주입으로 ${artifactPath} 실존 검증 불가.`,
              retryable: false,
              retryScope: 'NONE'
            }
          });
        }
      }
    } else if (finalMode === 'ARTIFACT_OUTPUT_REQUIRED') {
       if (expectedArtifactOutputs.size === 0) {
         results.push(this.createFailure('expected_artifacts_missing', 'ARTIFACT_OUTPUT_REQUIRED but expectedArtifactOutputs is empty', 'EXPECTED_OUTPUTS_MISSING', true));
       }
       for (const reqId of expectedArtifactOutputs) {
          if (!outputMap.has(reqId)) {
             results.push(this.createFailure(`artifact_missing_${reqId}`, `Required artifact ${reqId} is missing`, 'ARTIFACT_DECLARATION_MISSING', true, reqId));
          }
       }
    } else if (finalMode === 'NO_PERSISTED_OUTPUT') {
       if (textContent.length === 0) {
          results.push(this.createFailure('empty_response', 'NO_PERSISTED_OUTPUT but textual response is empty', 'STRICT_VERIFICATION_FAILED', true));
       }
    } else if (finalMode === 'EITHER_FILE_OR_ARTIFACT') {
       // 제한적 지원: 둘 다 비어있으면 FAIL
       if (expectedFileOutputs.size === 0 && expectedArtifactOutputs.size === 0 && textContent.length === 0) {
          results.push(this.createFailure('either_missing', 'EITHER_FILE_OR_ARTIFACT but neither file nor artifact is present', 'STRICT_VERIFICATION_FAILED', true));
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

  private createFailure(id: string, message: string, type: string, required: boolean, artifactId?: string): CriterionResult {
    return {
      criterionId: id,
      verifierType: this.verifierType,
      verdict: 'FAIL',
      reason: message,
      defect: {
        defectId: `def-${crypto.randomUUID()}`,
        signature: `DETERMINISTIC:${type}:${artifactId || 'task'}:invalid`,
        stage: 'DETERMINISTIC',
        type: type as any,
        severity: 'CRITICAL',
        required,
        artifactId,
        message,
        retryable: true,
        retryScope: 'FULL_TASK'
      }
    };
  }
}
