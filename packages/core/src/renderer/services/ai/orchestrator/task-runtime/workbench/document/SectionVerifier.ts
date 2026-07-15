import { DocumentSection } from '../domain/WorkbenchTypes';

export interface SectionVerificationResult {
  passed: boolean;
  issues: string[];
}

export class SectionVerifier {
  public verify(section: DocumentSection): SectionVerificationResult {
    const issues: string[] = [];

    if (!section.content || section.content.trim() === '') {
      issues.push('Section is empty');
      return { passed: false, issues };
    }

    // Expected length could be treated as a strict requirement or soft. The requirements state "Length 부족" is FAIL.
    if (section.content.length < section.expectedLength) {
      issues.push(`Section length is shorter than expected minimum (${section.content.length} < ${section.expectedLength})`);
    }

    const placeholders = ['TODO', 'TBD', 'Lorem Ipsum', 'Coming Soon', '<placeholder>', '[[FILL_ME]]'];
    const lowerContent = section.content.toLowerCase();
    
    for (const ph of placeholders) {
      if (lowerContent.includes(ph.toLowerCase())) {
        issues.push(`Placeholder found: ${ph}`);
      }
    }

    const paragraphs = section.content.split('\n\n').map(p => p.trim()).filter(p => p.length > 50);
    const seen = new Set<string>();
    for (const p of paragraphs) {
      if (seen.has(p)) {
        issues.push('Duplicate block found within section');
        break;
      }
      seen.add(p);
    }

    return {
      passed: issues.length === 0,
      issues
    };
  }
}
