/**
 * @file orchestrator/task-runtime/completion/evaluators/FinalArtifactValidator.ts
 * @system AMEVA OS Desktop Workstation
 * @role 통합 산출물 유효성 검증
 */

import type { MissionCompletionReviewInput } from '../../domain/types';
import type { DeliverableResult, FinalArtifactReference } from '../domain/MissionCompletionTypes';

export class FinalArtifactValidator {
  /**
   * 도출된 Deliverable 들을 검사하여 실제 사용할 수 있는 산출물 참조를 생성하고 유효성을 반환합니다.
   */
  public evaluate(
    input: MissionCompletionReviewInput, 
    deliverables: DeliverableResult[]
  ): {
    success: boolean;
    finalArtifactReferences: FinalArtifactReference[];
    warnings: string[];
  } {
    const warnings: string[] = [];
    const finalArtifactReferences: FinalArtifactReference[] = [];
    let success = true;

    // TODO: AMEVA OS VFS 연동 시 실제 파일 유무를 파일 시스템에서 조회하는 로직으로 대체
    deliverables.forEach(deliv => {
      if (!deliv.exists || !deliv.nonEmpty) {
        if (deliv.required) {
          success = false;
          warnings.push(`[FinalArtifactValidator] 필수 산출물 ${deliv.deliverableId} 유효하지 않음.`);
        }
        return;
      }

      // 모의 아티팩트 참조 생성
      finalArtifactReferences.push({
        artifactId: `art-${crypto.randomUUID()}`,
        referencePath: deliv.artifactReference || 'virtual_buffer',
        type: 'TEXT',
        taskId: deliv.producerTaskId,
        resultId: deliv.resultId,
        createdAt: Date.now()
      });
    });

    // 툴 런타임에 의한 생성 제한 감지
    if (input.toolRuntimeStatus === 'DISABLED_SAFELY' || input.toolRuntimeStatus === 'BROKEN') {
      const fileExpected = input.allTaskDefinitions.some(d => d.capabilityRequirements?.includes('file_system'));
      if (fileExpected) {
        success = false;
        warnings.push('[FinalArtifactValidator] 파일 시스템 도구가 오프라인 상태이므로 물리 파일 산출물 생성을 보장할 수 없습니다.');
      }
    }

    return {
      success,
      finalArtifactReferences,
      warnings
    };
  }
}
