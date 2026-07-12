/**
 * @file orchestrator/task-runtime/completion/report/FinalReportGenerator.ts
 * @system AMEVA OS Desktop Workstation
 * @role Outcome에 따라 사용자에게 노출할 요약 리포트를 서식화
 */

import type { MissionCompletionDecision } from '../domain/MissionCompletionTypes';

export class FinalReportGenerator {
  /**
   * 미션 결과를 텍스트 기반의 사용자 친화적 리포트로 생성합니다.
   */
  public generate(decision: MissionCompletionDecision): string {
    let report = '';

    switch (decision.outcome) {
      case 'SUCCESS':
        report += `# Mission Successfully Completed\n\n`;
        report += `All required tasks and deliverables have been successfully verified.\n`;
        break;
      case 'SUCCESS_WITH_WARNINGS':
        report += `# Mission Completed with Warnings\n\n`;
        report += `The mission was completed, but some optional tasks failed or generated warnings.\n`;
        if (decision.warnings.length > 0) {
          report += `\n**Warnings:**\n`;
          decision.warnings.forEach(w => report += `- ${w}\n`);
        }
        break;
      case 'PARTIAL_SUCCESS':
        report += `# Mission Partially Completed\n\n`;
        report += `Some required tasks failed, but partial results are available.\n`;
        break;
      case 'WAITING_USER':
        report += `# Mission Paused: Waiting for User Input\n\n`;
        report += `The mission requires your input or verification to proceed.\n`;
        break;
      case 'BLOCKED':
        report += `# Mission Blocked\n\n`;
        report += `The mission cannot proceed due to external constraints or missing prerequisites.\n`;
        break;
      case 'FAILED':
        report += `# Mission Failed\n\n`;
        report += `The mission could not be completed successfully.\n`;
        break;
      case 'CANCELLED':
        report += `# Mission Cancelled\n\n`;
        report += `The mission was cancelled by the user or the system.\n`;
        break;
    }

    report += `\n## Mission Statistics\n`;
    report += `- **Completion Confidence:** ${decision.completionConfidence.overallConfidence}% (${decision.completionConfidence.confidenceBand})\n`;
    report += `- **Task Completion Rate:** ${decision.taskCompletionRate}%\n`;
    report += `- **Total Attempts:** ${decision.recoverySummary.totalAttempts}\n`;
    report += `- **Recoveries Performed:** ${decision.recoverySummary.totalRecoveries}\n`;
    
    if (decision.finalArtifactReferences.length > 0) {
      report += `\n## Final Artifacts\n`;
      decision.finalArtifactReferences.forEach(a => {
        report += `- [Artifact] Type: ${a.type}, Path: ${a.referencePath}\n`;
      });
    }

    if (decision.unresolvedIssues.length > 0 && decision.outcome !== 'SUCCESS') {
      report += `\n## Unresolved Issues\n`;
      decision.unresolvedIssues.forEach(iss => report += `- ${iss}\n`);
    }

    return report;
  }
}
