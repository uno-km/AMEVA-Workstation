/**
 * @file orchestrator/task-runtime/completion/composer/FinalArtifactComposer.ts
 * @system AMEVA OS Desktop Workstation
 * @role 검증된 TaskResult들을 조립해 하나의 통일된 Final Artifact 후보를 생성
 */

import type { MissionCompletionReviewInput } from '../../domain/types';
import type { DeliverableResult } from '../domain/MissionCompletionTypes';

export class FinalArtifactComposer {
  /**
   * 성공한 산출물들을 모아 최종 리포트 초안이나 아티팩트 본문을 작성합니다.
   * (텍스트 기반의 Deliverable들을 조합하는 용도)
   */
  public compose(
    input: MissionCompletionReviewInput,
    deliverables: DeliverableResult[]
  ): string {
    let composition = `# Mission Final Artifact\n\n`;

    const successfulTasks = input.successfulTaskResults;

    if (successfulTasks.length === 0) {
      return composition + 'No verified task results found.';
    }

    deliverables.forEach(deliv => {
      composition += `## Deliverable: ${deliv.deliverableId}\n`;
      
      if (!deliv.exists || !deliv.accessible || !deliv.verified) {
        composition += `> Not generated, invalid, or missing verification.\n\n`;
        return;
      }

      // 산출물을 만들어낸 taskResult 찾기
      const result = successfulTasks.find(r => r.attemptId === deliv.resultId);
      if (result) {
        // Output 매칭 시 이전 단계에서 통과된 로직(타입이나 객체 content.name 일치)을 씀
        const output = result.outputs.find(o => o.type === deliv.deliverableId || (typeof o.content === 'object' && o.content?.name === deliv.deliverableId));
        if (output) {
          const textContent = typeof output.content === 'string' ? output.content : JSON.stringify(output.content, null, 2);
          composition += `${textContent}\n\n`;
        } else {
          composition += `> Artifact reference found, but content is empty.\n\n`;
        }
      } else {
        composition += `> Reference result not found or has been invalidated.\n\n`;
      }
    });

    return composition;
  }
}
