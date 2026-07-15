import { DocumentWorkbenchJob, DocumentContract, DocumentOutline, DocumentSection, IntegratedDocument, DocumentIssue, DocumentArtifactState } from '../domain/WorkbenchTypes';
import { ReopenVerificationResult } from './ReopenVerifier';

export interface CompletionGateContext {
  job: DocumentWorkbenchJob;
  contract: DocumentContract;
  outline: DocumentOutline;
  sections: DocumentSection[];
  integratedDocument: IntegratedDocument;
  consistencyIssues: DocumentIssue[];
  artifactState: DocumentArtifactState;
  reopenResult?: ReopenVerificationResult;
}

export class DocumentCompletionGate {
  public check(context: CompletionGateContext): { passed: boolean; reasons: string[] } {
    const reasons: string[] = [];

    if (!context.contract) reasons.push('Contract is missing');
    if (!context.outline) reasons.push('Outline is missing');
    if (!context.sections || context.sections.length === 0) reasons.push('Sections are missing');
    
    if (context.contract && context.sections) {
      const currentTitles = context.sections.map(s => s.title);
      for (const req of context.contract.requiredSections) {
        if (!currentTitles.includes(req)) {
          reasons.push(`Required section missing: ${req}`);
        }
      }
    }

    if (context.consistencyIssues && context.consistencyIssues.length > 0) {
      reasons.push('Consistency issues found');
    }

    if (context.artifactState !== 'COMMITTED') {
      reasons.push(`Artifact is not COMMITTED (State: ${context.artifactState})`);
    }

    if (!context.reopenResult) {
      reasons.push('Reopen verification result is missing');
    } else {
      const rr = context.reopenResult;
      if (!rr.passed) {
        reasons.push(`Reopen verification failed: ${rr.errorCode || 'UNKNOWN_ERROR'}`);
      }
      const execProv = rr.extractionResult?.extractionExecutionProvenance;
      if (execProv === 'SYNTHETIC_FIXTURE_EXECUTED' || execProv === 'NOT_EXECUTED') {
        reasons.push(`Extraction provenance was not valid for operational completion: ${execProv}`);
      }
      if (!rr.extractionResult || rr.extractionResult.contentLength <= 0) {
        reasons.push('Extracted text length is 0');
      }
      if (rr.placeholdersDetected) {
        reasons.push('Placeholders detected in final extraction');
      }
      if (!rr.criticalFactsPreserved) {
        reasons.push('Critical facts lost in extraction');
      }
      if (!rr.requiredSectionsPreserved) {
        reasons.push('Required sections lost in extraction');
      }
      if (rr.extractionResult && !rr.extractionResult.success) {
        reasons.push(`Extractor error: ${rr.extractionResult.errorCode}`);
      }
    }

    return {
      passed: reasons.length === 0,
      reasons
    };
  }
}
