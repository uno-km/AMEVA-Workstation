export interface ExtractionResult {
  success: boolean;
  format: string;
  extractedText: string;
  normalizedText: string;
  contentLength: number;
  extractionDigest: string;
  sectionCandidates: string[];
  warnings: string[];
  errorCode?: string;
  retryable?: boolean;
  extractorName: string;
  extractorVersion: string;
  executionMode: 'REAL_ARTIFACT_EXTRACTED' | 'SYNTHETIC_FIXTURE_EXTRACTED' | 'BLOCKED_BY_ENVIRONMENT' | 'EXTRACTION_FAILED';
}

export interface ExtractionContext {
  artifactId: string;
  artifactFormat: string;
  artifactRevision: string;
  stagedPath: string;
  expectedContentDigest?: string;
  expectedDocumentId?: string;
}

export interface IArtifactContentExtractor {
  extractText(context: ExtractionContext): Promise<ExtractionResult>;
}
