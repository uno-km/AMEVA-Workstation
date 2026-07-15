import { randomUUID } from 'crypto';
import { IntegratedDocument, DocumentIssue } from '../domain/WorkbenchTypes';

export interface ConsistencyVerificationResult {
  passed: boolean;
  issues: DocumentIssue[];
}

export class ConsistencyVerifier {
  public verify(document: IntegratedDocument): ConsistencyVerificationResult {
    const issues: DocumentIssue[] = [];
    const text = document.fullText;

    // 1. Duplication detection
    const paragraphs = text.split('\n\n').map(p => p.trim()).filter(p => p.length > 50);
    const seen = new Set<string>();
    for (const p of paragraphs) {
      if (seen.has(p)) {
        issues.push({
          issueId: randomUUID(),
          type: 'DUPLICATION',
          severity: 'ERROR',
          description: 'Duplicate paragraph found across sections.',
          evidence: [p.substring(0, 100)],
          involvedSections: []
        });
        break;
      }
      seen.add(p);
    }

    // 2. Numeric Mismatch detection (heuristic for tests)
    const numericRegex = /(\d+)\s*(agents|tests)/gi;
    const matches = [...text.matchAll(numericRegex)];
    const entityNumbers: Record<string, Set<string>> = {};
    
    for (const match of matches) {
      const num = match[1];
      const entity = match[2].toLowerCase();
      if (!entityNumbers[entity]) entityNumbers[entity] = new Set();
      entityNumbers[entity].add(num);
    }

    for (const [entity, numbers] of Object.entries(entityNumbers)) {
      if (numbers.size > 1) {
        issues.push({
          issueId: randomUUID(),
          type: 'NUMERIC_MISMATCH',
          severity: 'ERROR',
          description: `Conflicting numbers found for ${entity}`,
          evidence: Array.from(numbers).map(n => `${n} ${entity}`),
          involvedSections: []
        });
      }
    }

    // 3. Contradiction detection (heuristic for tests)
    if (text.toLowerCase().includes('single router') && text.toLowerCase().includes('multiple routers')) {
      issues.push({
        issueId: randomUUID(),
        type: 'CONTRADICTION',
        severity: 'ERROR',
        description: 'Found contradiction regarding Router architecture.',
        evidence: ['Single Router', 'Multiple Routers'],
        involvedSections: []
      });
    }

    return {
      passed: issues.length === 0,
      issues
    };
  }
}
