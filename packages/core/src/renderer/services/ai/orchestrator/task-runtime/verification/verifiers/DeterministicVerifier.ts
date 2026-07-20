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
           * [P0-3 FIX — DeterministicVerifier fileAdapter fail-closed]
           * 이전: WARN + required=false(non-blocking) → VerificationDecisionPolicy가 PASS 허용.
           *
           * 수정: INCOMPLETE_VERIFICATION 반환.
           *   - required=true (blocking) → VerificationDecisionPolicy가 FAIL로 귀결.
           *   - errorCode = FILESYSTEM_VERIFIER_UNAVAILABLE
           *
           * 근거: FILE_OUTPUT_REQUIRED 작업에서 실제 파일 존재 여부를 확인할 수 없으면
           * 검증이 완료된 것이 아니다. 절대 PASS를 허용할 수 없다.
           * 테스트 환경에서 fileAdapter를 주입하지 않는다면
           * FILE_OUTPUT_REQUIRED 태스크를 테스트하지 않는 것과 같음.
           */
          console.error(
            `[DeterministicVerifier] CRITICAL: FILE_OUTPUT_REQUIRED 작업(${reqId})에 fileAdapter 미주입. ` +
            `INCOMPLETE_VERIFICATION — PASS 금지. errorCode=FILESYSTEM_VERIFIER_UNAVAILABLE`
          );
          results.push({
            criterionId: `filesystem_verifier_unavailable_${reqId}`,
            verifierType: this.verifierType,
            verdict: 'INCOMPLETE_VERIFICATION',
            reason: `FILE_OUTPUT_REQUIRED 작업이지만 fileAdapter가 주입되지 않아 파일 실존 검증 불가. (${artifactPath})`,
            incompleteReason: `fileAdapter가 null — FILESYSTEM_VERIFIER_UNAVAILABLE. 이 상태에서는 파일 유무를 알 수 없으므로 PASS 불가.`,
            defect: {
              defectId: `def-${crypto.randomUUID()}`,
              signature: `DETERMINISTIC:FILESYSTEM_VERIFIER_UNAVAILABLE:${reqId}`,
              stage: 'DETERMINISTIC',
              type: 'FILESYSTEM_VERIFIER_UNAVAILABLE',
              severity: 'CRITICAL',
              required: true, // BLOCKING — VerificationDecisionPolicy가 FAIL로 처리
              artifactId: reqId,
              message: `FILE_OUTPUT_REQUIRED 작업에 fileAdapter 미주입. 파일 실존 확인 불가. PASS 금지.`,
              retryable: false,
              retryScope: 'FULL_TASK'
            }
          });
          // fileAdapter 없으면 이 파일에 대한 나머지 검증 불가 — 다음 파일로 이동
          continue;
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
