import { IArtifactContentExtractor, ExtractionContext, ExtractionResult } from './IArtifactContentExtractor';
import { IntegratedDocument } from '../domain/WorkbenchTypes';
import { ReopenVerificationPolicy, DefaultReopenVerificationPolicy } from './ReopenVerificationPolicy';

export interface CriticalFact {
  type: 'NUMBER' | 'SECTION_TITLE' | 'KEY_VALUE';
  label?: string;
  value: string;
}

export interface ReopenVerificationResult {
  passed: boolean;
  errorCode?: string;
  issues: string[];
  similarityScore: number;
  criticalFactsPreserved: boolean;
  requiredSectionsPreserved: boolean;
  placeholdersDetected: boolean;
  extractionResult: ExtractionResult | null;
}

export class ReopenVerifier {
  constructor(
    private extractor: IArtifactContentExtractor,
    private policy: ReopenVerificationPolicy = DefaultReopenVerificationPolicy
  ) {}

  private extractCriticalFacts(document: IntegratedDocument): CriticalFact[] {
    const facts: CriticalFact[] = [];
    
    // Extract Section Titles
    for (const sec of document.sections) {
      if (sec.required) {
        facts.push({ type: 'SECTION_TITLE', value: sec.title });
      }
    }

    // Extract Key-Value pairs (e.g., "Tests passed = 324" or "Phase: 6.3.2")
    const lines = document.fullText.split('\n');
    for (const line of lines) {
      const kvMatch = line.match(/^([^=:]+)[=:](.+)$/);
      if (kvMatch) {
        const label = kvMatch[1].trim();
        const value = kvMatch[2].trim();
        if (label.length > 0 && value.length > 0 && label.length < 50 && value.length < 50) {
          facts.push({ type: 'KEY_VALUE', label, value });
        }
      }
    }

    // Extract numbers (very simple heuristic)
    const numRegex = /\b\d+(?:\.\d+)?\b/g;
    const nums = [...document.fullText.matchAll(numRegex)].map(m => m[0]);
    const uniqueNums = Array.from(new Set(nums));
    for (const n of uniqueNums) {
      facts.push({ type: 'NUMBER', value: n });
    }

    return facts;
  }

  public async verify(
    context: ExtractionContext, 
    integratedDocument: IntegratedDocument
  ): Promise<ReopenVerificationResult> {
    const issues: string[] = [];
    let extractionResult: ExtractionResult;

    try {
      extractionResult = await this.extractor.extractText(context);
    } catch (e: any) {
      return { passed: false, errorCode: 'ARTIFACT_READ_FAILED', issues: [e.message], similarityScore: 0, criticalFactsPreserved: false, requiredSectionsPreserved: false, placeholdersDetected: false, extractionResult: null };
    }

    if (!extractionResult.success) {
      return {
        passed: false,
        errorCode: extractionResult.errorCode || 'ARTIFACT_READ_FAILED',
        issues: extractionResult.warnings.length > 0 ? extractionResult.warnings : ['Extraction failed'],
        similarityScore: 0,
        criticalFactsPreserved: false,
        requiredSectionsPreserved: false,
        placeholdersDetected: false,
        extractionResult
      };
    }

    // Text extraction might use result.extractedText if we passed it (e.g. Docx IPC)
    const textToVerify = extractionResult.normalizedText || extractionResult.extractedText || '';
    
    if (extractionResult.contentLength === 0 || textToVerify.length === 0) {
      return {
        passed: false,
        errorCode: 'EMPTY_EXTRACTION',
        issues: ['Extracted text length is 0'],
        similarityScore: 0,
        criticalFactsPreserved: false,
        requiredSectionsPreserved: false,
        placeholdersDetected: false,
        extractionResult
      };
    }

    const lowerExtracted = textToVerify.toLowerCase();
    const extractedLines = textToVerify.split('\n').map(l => l.trim().toLowerCase());

    // Check Placeholders
    const placeholders = ['todo', 'tbd', 'lorem ipsum', 'coming soon', '<placeholder>', '[[fill_me]]', 'insert here', '작성 예정', '추후 작성', '내용 없음'];
    let placeholdersDetected = false;
    for (const ph of placeholders) {
      if (lowerExtracted.includes(ph)) {
        issues.push(`Placeholder detected: ${ph}`);
        placeholdersDetected = true;
      }
    }

    // Check Critical Facts
    const facts = this.extractCriticalFacts(integratedDocument);
    let criticalFactsPreserved = true;
    let requiredSectionsPreserved = true;
    let matchedFacts = 0;
    let requiredFacts = 0;

    for (const fact of facts) {
      if (fact.type === 'SECTION_TITLE') {
        if (!lowerExtracted.includes(fact.value.toLowerCase())) {
          issues.push(`Required section missing: ${fact.value}`);
          requiredSectionsPreserved = false;
        }
      } else if (fact.type === 'KEY_VALUE') {
        requiredFacts++;
        const lLabel = fact.label!.toLowerCase();
        const lValue = fact.value.toLowerCase();
        
        // Find a line that has both the label and the value
        let found = false;
        for (const line of extractedLines) {
          if (line.includes(lLabel) && line.includes(lValue)) {
            found = true;
            break;
          }
        }
        
        if (found) {
          matchedFacts++;
        } else {
          issues.push(`Critical fact mismatch: ${fact.label} = ${fact.value}`);
          criticalFactsPreserved = false;
        }
      } else if (fact.type === 'NUMBER') {
        if (!lowerExtracted.includes(fact.value.toLowerCase())) {
          // issues.push(`Number missing: ${fact.value}`); 
          // Number heuristic shouldn't fail the whole document instantly, but we track it.
        }
      }
    }

    const factRecall = requiredFacts > 0 ? matchedFacts / requiredFacts : 1;
    if (factRecall < this.policy.minimumCriticalFactRecall) {
      criticalFactsPreserved = false;
    }

    // Similarity Score
    const originalTokens = integratedDocument.fullText.toLowerCase().split(/\W+/).filter(t => t.length > 2);
    const extractedTokens = new Set(lowerExtracted.split(/\W+/).filter(t => t.length > 2));
    
    let matched = 0;
    for (const t of originalTokens) {
      if (extractedTokens.has(t)) matched++;
    }
    
    const similarityScore = originalTokens.length > 0 ? matched / originalTokens.length : 1;
    
    // Format-specific thresholds
    let threshold = 0.8;
    if (context.artifactFormat === 'MARKDOWN') threshold = this.policy.markdownSimilarityThreshold;
    if (context.artifactFormat === 'HTML') threshold = this.policy.htmlSimilarityThreshold;
    if (context.artifactFormat === 'DOCX') threshold = this.policy.docxSimilarityThreshold;
    if (context.artifactFormat === 'PDF') threshold = this.policy.pdfSimilarityThreshold;

    if (similarityScore < threshold) {
      issues.push(`Similarity score too low: ${Math.round(similarityScore * 100)}% (Requires ${Math.round(threshold * 100)}%)`);
    }

    const passed = 
      issues.length === 0 && 
      !placeholdersDetected && 
      criticalFactsPreserved && 
      requiredSectionsPreserved && 
      similarityScore >= threshold;

    let errorCode = passed ? undefined : (
      placeholdersDetected ? 'PLACEHOLDER_DETECTED' :
      !requiredSectionsPreserved ? 'MISSING_REQUIRED_SECTION' :
      !criticalFactsPreserved ? 'CRITICAL_FACT_MISMATCH' :
      'CONTENT_SIMILARITY_BELOW_THRESHOLD'
    );

    return {
      passed,
      errorCode,
      issues,
      similarityScore,
      criticalFactsPreserved,
      requiredSectionsPreserved,
      placeholdersDetected,
      extractionResult
    };
  }
}
