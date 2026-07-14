/**
 * @file orchestrator/task-runtime/completion/evaluators/DeliverableCoverageEvaluator.ts
 * @system AMEVA OS Desktop Workstation
 * @role 최종 Deliverable(산출물) 유효성 및 존재 여부 검증
 */

import type { MissionCompletionReviewInput } from '../../domain/types';
import type { DeliverableResult } from '../domain/MissionCompletionTypes';
import type { IArtifactReader } from '../../artifact/IArtifactReader';

export class DeliverableCoverageEvaluator {
  private readonly artifactReader?: IArtifactReader;

  constructor(artifactReader?: IArtifactReader) {
    this.artifactReader = artifactReader;
  }

  /**
   * 예상되는 Deliverable 들이 실제 TaskResult의 output 또는 파일 시스템(가정) 상에 존재하는지 평가.
   */
  private isRequired(def: any): boolean {
    if (typeof def.required === 'boolean') return def.required;
    if (def.requirementIds && def.requirementIds.length > 0) return true;
    if (def.expectedOutputs && def.expectedOutputs.length > 0) return true;
    return def.priority === 1;
  }

  public async evaluateAsync(input: MissionCompletionReviewInput): Promise<{
    success: boolean;
    deliverableResults: DeliverableResult[];
    warnings: string[];
  }> {
    const warnings: string[] = [];
    const deliverableResults: DeliverableResult[] = [];
    
    let success = true;

    for (const def of input.allTaskDefinitions) {
      const isReqRequired = this.isRequired(def);
      const expectedOutputs = def.expectedOutputs || [];

      if (expectedOutputs.length === 0) continue;

      const stateIdx = input.allTaskDefinitions.findIndex(d => d.id === def.id);
      const state = input.allTaskRuntimeStates[stateIdx];
      const result = state?.taskResult;
      
      for (const outName of expectedOutputs) {
        let hasOutput = false;
        let valid = false;
        let artifactRef = '';
        let fileContent: string | null = null;
        let isFile = false;

        // Phase 2: 명시적 파일인지 판단. 기존에는 '/' 로 판단했지만, 일단 하위 호환성을 위해 유지하거나 expectedOutputs 설정을 따른다.
        const isExpectedFile = outName.startsWith('/');

        // 1. Check task result outputs for INLINE text/data
        if (!isExpectedFile && result?.outputs) {
          const matchedOut = result.outputs.find(o => o.type === outName || (typeof o.content === 'object' && o.content?.name === outName));
          if (matchedOut) {
            hasOutput = true;
            artifactRef = 'virtual_ref_in_memory';
            if (typeof matchedOut.content === 'string') {
              fileContent = matchedOut.content;
            } else if (typeof matchedOut.content === 'object') {
              if (typeof matchedOut.content.content === 'string') {
                fileContent = matchedOut.content.content;
              } else if (Object.keys(matchedOut.content).length > 0 && !matchedOut.content.name) {
                valid = true;
              }
            }
          }
        }

        // 2. Check VFS via ArtifactReader for FILE artifacts
        if (isExpectedFile) {
          isFile = true;
          if (!this.artifactReader) {
            console.error('[DeliverableCoverage] ArtifactReader is not injected!');
            valid = false;
          } else {
            try {
              const vfsContent = await this.artifactReader.read(outName);
              if (vfsContent !== null) {
                hasOutput = true;
                artifactRef = outName;
                fileContent = vfsContent;
              }
            } catch (e) {
              valid = false;
            }
          }
        }

        // 3. Validation
        if (fileContent !== null) {
          const text = fileContent.trim();
          if (text.length > 0) {
            const isJsonOrCsv = outName.endsWith('.json') || outName.endsWith('.csv') || (text.startsWith('{') && text.endsWith('}')) || (text.startsWith('[') && text.endsWith(']'));
            
            if (isJsonOrCsv) {
              try {
                if (outName.endsWith('.json') || text.startsWith('{') || text.startsWith('[')) {
                  JSON.parse(text);
                  valid = true;
                } else if (outName.endsWith('.csv')) {
                  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
                  if (lines.length >= 2) {
                    const headers = lines[0].split(',').map(c => c.trim());
                    if (headers.length > 1 && headers.some(h => h.length > 0)) {
                      const isValidCsv = lines.every(l => l.split(',').length === headers.length);
                      if (isValidCsv) valid = true;
                    }
                  }
                } else {
                  valid = true;
                }
              } catch {
                valid = false;
              }
            } else {
              const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 0);
              
              const rawLines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
              const nonHeaderLines = rawLines.filter(l => {
                if (l.startsWith('#')) return false;
                if (/^[-*+]\s*$/.test(l)) return false;
                const lower = l.toLowerCase();
                if (lower.includes('todo') || lower.includes('tbd') || lower.includes('placeholder') || lower.includes('작성 예정') || lower.includes('내용 추가') || lower.startsWith('에러')) return false;
                return true;
              });

              const contentStr = nonHeaderLines.join('\n');
              
              if (contentStr.length >= 200 && (paragraphs.length >= 2 || nonHeaderLines.length >= 3)) {
                valid = true;
              } else {
                console.warn(`[DeliverableCoverage] Skeleton detected for ${outName}: length=${contentStr.length}, lines=${nonHeaderLines.length}, paragraphs=${paragraphs.length}`);
              }
            }
          }
        }

        const exists = hasOutput;
        
        if (isReqRequired && (!exists || !valid)) {
          success = false;
          warnings.push(`[DeliverableCoverage] 필수 산출물 누락 혹은 무효함: Task ${def.id} 의 ${outName}`);
        }

        deliverableResults.push({
          deliverableId: outName,
          required: isReqRequired,
          producerTaskId: def.id,
          resultId: result?.attemptId || '',
          artifactReference: artifactRef,
          exists,
          accessible: valid,
          nonEmpty: valid,
          verified: valid && state?.status === 'COMPLETED' && state?.verification?.verdict === 'PASS',
          latestRevision: true,
          integrity: valid,
          warnings: valid ? [] : ['Deliverable output not found, empty, or placeholder (Skeleton)']
        });
      }
    }

    return {
      success,
      deliverableResults,
      warnings
    };
  }
}
