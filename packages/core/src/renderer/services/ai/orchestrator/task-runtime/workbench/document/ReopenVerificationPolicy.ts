export interface ReopenVerificationPolicy {
  markdownSimilarityThreshold: number;
  htmlSimilarityThreshold: number;
  docxSimilarityThreshold: number;
  pdfSimilarityThreshold: number;
  minimumRequiredSectionRecall: number;
  minimumRequiredHeadingRecall: number;
  minimumParagraphRecall: number;
  minimumExtractedContentRatio: number;
  minimumCriticalFactRecall: number;
  allowSyntheticFixturesForTestOnly: boolean;
}

export const DefaultReopenVerificationPolicy: ReopenVerificationPolicy = {
  markdownSimilarityThreshold: 0.9,
  htmlSimilarityThreshold: 0.85,
  docxSimilarityThreshold: 0.8,
  pdfSimilarityThreshold: 0.8,
  minimumRequiredSectionRecall: 1.0,
  minimumRequiredHeadingRecall: 1.0,
  minimumParagraphRecall: 0.9,
  minimumExtractedContentRatio: 0.9,
  minimumCriticalFactRecall: 1.0,
  allowSyntheticFixturesForTestOnly: false
};
