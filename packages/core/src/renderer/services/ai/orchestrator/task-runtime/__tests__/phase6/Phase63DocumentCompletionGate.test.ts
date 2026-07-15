import { describe, it, expect } from 'vitest';
import { DocumentCompletionGate } from '../../workbench/document/DocumentCompletionGate';

describe('Phase63DocumentCompletionGate', () => {
  it('should fail if artifact not COMMITTED or ReopenVerification failed', () => {
    const gate = new DocumentCompletionGate();
    const res = gate.check({
      job: {} as any, contract: { requiredSections: [] } as any, outline: {} as any, sections: [{ title: 'A', status: 'WRITTEN' }] as any, integratedDocument: {} as any, consistencyIssues: [], artifactState: 'WRITTEN',
      reopenResult: { passed: false, errorCode: 'MISSING_REQUIRED_SECTION', issues: [], similarityScore: 0, criticalFactsPreserved: false, requiredSectionsPreserved: false, placeholdersDetected: false, extractionResult: null }
    });
    expect(res.passed).toBe(false);
    expect(res.reasons.some(r => r.includes('COMMITTED'))).toBe(true);
    expect(res.reasons.some(r => r.includes('Reopen verification failed: MISSING_REQUIRED_SECTION'))).toBe(true);
  });
  
  it('should fail if extraction Mode is not REAL_ARTIFACT_EXTRACTED', () => {
    const gate = new DocumentCompletionGate();
    const res = gate.check({
      job: {} as any, contract: { requiredSections: [] } as any, outline: {} as any, sections: [{ title: 'A', status: 'WRITTEN' }] as any, integratedDocument: {} as any, consistencyIssues: [], artifactState: 'COMMITTED',
      reopenResult: { passed: true, issues: [], similarityScore: 1, criticalFactsPreserved: true, requiredSectionsPreserved: true, placeholdersDetected: false, extractionResult: { executionMode: 'SYNTHETIC_FIXTURE_EXTRACTED', success: true, contentLength: 100 } as any }
    });
    expect(res.passed).toBe(false);
    expect(res.reasons.some(r => r.includes('Extraction mode was not REAL_ARTIFACT_EXTRACTED'))).toBe(true);
  });
});
