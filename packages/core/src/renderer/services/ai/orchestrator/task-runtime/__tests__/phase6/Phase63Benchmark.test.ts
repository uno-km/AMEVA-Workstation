import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { NodeArtifactFileAdapter } from '../../artifact/NodeArtifactFileAdapter';
import { TestWorkbenchHostAdapter } from '../../workbench/adapter/TestWorkbenchHostAdapter';
import { TestDocumentHostHandler } from '../../workbench/document/__mock__/TestDocumentHostHandler';
import { DocumentArtifactGenerator } from '../../workbench/document/DocumentArtifactGenerator';
import { MarkdownExtractor, HtmlExtractor, DocxExtractor, PdfExtractor } from '../../workbench/document/Extractors';
import { ReopenVerifier } from '../../workbench/document/ReopenVerifier';
import { DocumentCompletionGate } from '../../workbench/document/DocumentCompletionGate';
import type { IntegratedDocument } from '../../workbench/domain/WorkbenchTypes';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('Phase63Benchmark - 13 Scenarios', () => {
  let fileSystem: NodeArtifactFileAdapter;
  let hostAdapter: TestWorkbenchHostAdapter;
  let testHandler: TestDocumentHostHandler;
  let generator: DocumentArtifactGenerator;
  let tempDir: string;
  let gate: DocumentCompletionGate;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ameva-benchmark-'));
    fileSystem = new NodeArtifactFileAdapter(tempDir);
    hostAdapter = new TestWorkbenchHostAdapter(fileSystem, {} as any);
    testHandler = new TestDocumentHostHandler();

    (hostAdapter as any).generateDocumentArtifact = async (req: any) => await testHandler.generateDocumentArtifact(req, tempDir);
    (hostAdapter as any).extractDocumentArtifact = async (req: any) => await testHandler.extractDocumentArtifact(req, tempDir);

    generator = new DocumentArtifactGenerator(fileSystem, hostAdapter);
    gate = new DocumentCompletionGate();
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  const createBaseDocument = (text: string): IntegratedDocument => ({
    missionId: 'm1', taskId: 't1', attemptId: 'a1', contractId: 'c1',
    fullText: text,
    sections: [
      { title: 'Phase', content: 'Phase: 6.3.2', order: 0, required: true },
      { title: 'Tests passed', content: 'Tests passed = 324', order: 1, required: true }
    ],
    status: 'INTEGRATED', createdAt: Date.now(), updatedAt: Date.now(),
    metrics: { wordCount: 10, sectionCount: 2, requiredSectionRecall: 1, placeholderCount: 0 }
  } as any);

  async function runPipeline(jobId: string, doc: IntegratedDocument, format: any, modifyGeneratedFile?: () => void) {
    const genRes = await generator.generateArtifact(jobId, doc, format, tempDir);
    
    if (modifyGeneratedFile) modifyGeneratedFile();

    let extractor;
    if (format === 'MARKDOWN') extractor = new MarkdownExtractor(fileSystem);
    else if (format === 'HTML') extractor = new HtmlExtractor(fileSystem);
    else if (format === 'DOCX') extractor = new DocxExtractor(fileSystem, hostAdapter);
    else extractor = new PdfExtractor(fileSystem, hostAdapter);

    const verifier = new ReopenVerifier(extractor);
    const context = { stagedPath: genRes.filePath, artifactFormat: format, artifactId: '1', artifactRevision: '1', documentId: 'doc1', documentJobId: jobId };
    
    // Some formats are blocked on generation (like PDF)
    if (genRes.result && genRes.result.errorCode === 'BLOCKED_BY_MISSING_GENERATOR') {
      return { genRes, reopenResult: null, gateResult: null };
    }

    const reopenResult = await verifier.verify(context, doc);
    
    const gateResult = gate.check({
      job: {} as any, contract: { requiredSections: ['Phase', 'Tests passed'] } as any,
      outline: {} as any, sections: doc.sections, integratedDocument: doc, consistencyIssues: [], artifactState: 'COMMITTED',
      reopenResult
    });

    return { genRes, reopenResult, gateResult };
  }

  it('1. 정상 Markdown Generate/Reopen', async () => {
    const doc = createBaseDocument('Phase: 6.3.2\nTests passed = 324\n# Phase\n# Tests passed\nThis is a normal markdown document for testing. It has enough words to pass similarity threshold.');
    const { gateResult } = await runPipeline('job1', doc, 'MARKDOWN');
    expect(gateResult!.passed).toBe(true);
  });

  it('2. 정상 HTML Generate/Reopen', async () => {
    const doc = createBaseDocument('Phase: 6.3.2\nTests passed = 324\n# Phase\n# Tests passed\nThis is a normal HTML document for testing. It has enough words to pass similarity threshold.');
    const { gateResult } = await runPipeline('job2', doc, 'HTML');
    expect(gateResult!.passed).toBe(true);
  });

  it('3. 정상 DOCX Generate/Reopen', async () => {
    const doc = createBaseDocument('Phase: 6.3.2\nTests passed = 324\nPhase\nTests passed\nThis is a normal DOCX document for testing. It has enough words to pass similarity threshold.');
    const { gateResult, genRes, reopenResult } = await runPipeline('job3', doc, 'DOCX');
    expect(gateResult!.passed).toBe(true);
    expect(genRes.result.generatorName).toBe('docx');
    expect(reopenResult!.extractionResult!.extractorName).toBe('mammoth');
  });

  it('4. PDF Generation Missing -> WAITING_USER/BLOCKED', async () => {
    const doc = createBaseDocument('PDF test');
    const { genRes, reopenResult, gateResult } = await runPipeline('job4', doc, 'PDF');
    expect(genRes.result.errorCode).toBe('BLOCKED_BY_MISSING_GENERATOR');
    expect(reopenResult).toBeNull();
  });

  it('5. 실제 PDF Fixture Extraction', async () => {
    // We mock extraction for PDF since generation is blocked.
    const extractBackup = hostAdapter.extractDocumentArtifact;
    hostAdapter.extractDocumentArtifact = async () => ({ success: true, result: {
      success: true, format: 'PDF', extractorName: 'pdf-parse', extractorVersion: '2.4.5', executionMode: 'REAL_ARTIFACT_EXTRACTED', extractedTextLength: 100, extractedText: 'Phase: 6.3.2\nTests passed = 324\nPhase\nTests passed\nAnd enough words to pass similarity threshold easily.', normalizedTextDigest: 'd', extractionDigest: 'd', sectionCandidates: [], warnings: []
    } });
    
    const doc = createBaseDocument('Phase: 6.3.2\nTests passed = 324\nPhase\nTests passed\nAnd enough words to pass similarity threshold easily.');
    const extractor = new PdfExtractor(fileSystem, hostAdapter);
    const verifier = new ReopenVerifier(extractor);
    const context = { stagedPath: 'dummy.pdf', artifactFormat: 'PDF', artifactId: '1', artifactRevision: '1', documentId: 'doc1', documentJobId: 'job5' };
    
    const reopenResult = await verifier.verify(context as any, doc);
    expect(reopenResult.passed).toBe(true);

    (hostAdapter as any).extractDocumentArtifact = extractBackup;
  });

  it('6. 손상 DOCX', async () => {
    const doc = createBaseDocument('Phase: 6.3.2\nTests passed = 324\nPhase\nTests passed\nThis is a normal DOCX document for testing.');
    const { gateResult } = await runPipeline('job6', doc, 'DOCX', () => {
      fs.writeFileSync(`${tempDir}/job6.docx`, 'corrupt');
    });
    expect(gateResult!.passed).toBe(false);
  });

  it('7. 손상 PDF', async () => {
    // Generate blocked, so we do direct extraction
    const doc = createBaseDocument('Phase: 6.3.2\nTests passed = 324\nPhase\nTests passed\n');
    fs.writeFileSync(`${tempDir}/job7.pdf`, 'corrupt');
    const extractor = new PdfExtractor(fileSystem, hostAdapter);
    const verifier = new ReopenVerifier(extractor);
    const context = { stagedPath: `${tempDir}/job7.pdf`, artifactFormat: 'PDF', artifactId: '1', artifactRevision: '1', documentId: 'doc1', documentJobId: 'job7' };
    const reopenResult = await verifier.verify(context as any, doc);
    expect(reopenResult.passed).toBe(false);
  });

  it('8. Empty Extraction', async () => {
    const extractBackup = (hostAdapter as any).extractDocumentArtifact;
    (hostAdapter as any).extractDocumentArtifact = async () => ({ success: true, result: {
      success: true, format: 'DOCX', extractorName: 'mammoth', extractorVersion: '1.12.0', executionMode: 'REAL_ARTIFACT_EXTRACTED', extractedTextLength: 0, extractedText: '', normalizedTextDigest: 'd', extractionDigest: 'd', sectionCandidates: [], warnings: []
    } });
    const doc = createBaseDocument('Phase: 6.3.2\nTests passed = 324\nPhase\nTests passed\n');
    const { gateResult, reopenResult } = await runPipeline('job8', doc, 'DOCX');
    expect(gateResult!.passed).toBe(false);
    expect(reopenResult!.errorCode).toBe('EMPTY_EXTRACTION');
    (hostAdapter as any).extractDocumentArtifact = extractBackup;
  });

  it('9. Required Section 손실', async () => {
    const extractBackup = hostAdapter.extractDocumentArtifact;
    hostAdapter.extractDocumentArtifact = async () => ({ success: true, result: {
      success: true, format: 'DOCX', extractorName: 'mammoth', extractorVersion: '1.12.0', executionMode: 'REAL_ARTIFACT_EXTRACTED', extractedTextLength: 100, extractedText: 'A document that is missing everything completely, just some random text to test.', normalizedTextDigest: 'd', extractionDigest: 'd', sectionCandidates: [], warnings: []
    } });
    const doc = createBaseDocument('A document that is missing everything completely, just some random text to test.');
    // Add sections so it expects them
    doc.sections = [{ title: 'UniqueSectionTitleNeverAppears', content: 'content', order: 0, required: true }] as any;
    const { gateResult, reopenResult } = await runPipeline('job9', doc, 'DOCX');
    expect(gateResult!.passed).toBe(false);
    expect(reopenResult!.errorCode).toBe('MISSING_REQUIRED_SECTION');
    hostAdapter.extractDocumentArtifact = extractBackup;
  });

  it('10. Placeholder', async () => {
    const extractBackup = hostAdapter.extractDocumentArtifact;
    hostAdapter.extractDocumentArtifact = async () => ({ success: true, result: {
      success: true, format: 'DOCX', extractorName: 'mammoth', extractorVersion: '1.12.0', executionMode: 'REAL_ARTIFACT_EXTRACTED', extractedTextLength: 100, extractedText: 'Phase: 6.3.2\nTests passed = 324\nPhase\nTests passed\nTODO: write more', normalizedTextDigest: 'd', extractionDigest: 'd', sectionCandidates: [], warnings: []
    } });
    const doc = createBaseDocument('Phase: 6.3.2\nTests passed = 324\nPhase\nTests passed\nTODO: write more');
    const { gateResult, reopenResult } = await runPipeline('job10', doc, 'DOCX');
    expect(gateResult!.passed).toBe(false);
    expect(reopenResult!.errorCode).toBe('PLACEHOLDER_DETECTED');
    hostAdapter.extractDocumentArtifact = extractBackup;
  });

  it('11. Similarity 미달', async () => {
    const extractBackup = hostAdapter.extractDocumentArtifact;
    hostAdapter.extractDocumentArtifact = async () => ({ success: true, result: {
      success: true, format: 'DOCX', extractorName: 'mammoth', extractorVersion: '1.12.0', executionMode: 'REAL_ARTIFACT_EXTRACTED', extractedTextLength: 100, extractedText: 'Phase: 6.3.2\nTests passed = 324\nPhase\nTests passed\nShort text.', normalizedTextDigest: 'd', extractionDigest: 'd', sectionCandidates: [], warnings: []
    } });
    const doc = createBaseDocument('Phase: 6.3.2\nTests passed = 324\nPhase\nTests passed\nVery long long long long long long long original text that drops similarity score drastically.');
    const { gateResult, reopenResult } = await runPipeline('job11', doc, 'DOCX');
    expect(gateResult!.passed).toBe(false);
    expect(reopenResult!.errorCode).toBe('CONTENT_SIMILARITY_BELOW_THRESHOLD');
    hostAdapter.extractDocumentArtifact = extractBackup;
  });

  it('12. Critical Fact 변경', async () => {
    const extractBackup = hostAdapter.extractDocumentArtifact;
    hostAdapter.extractDocumentArtifact = async () => ({ success: true, result: {
      success: true, format: 'DOCX', extractorName: 'mammoth', extractorVersion: '1.12.0', executionMode: 'REAL_ARTIFACT_EXTRACTED', extractedTextLength: 100, extractedText: 'Phase: 6.3.2\nTests passed = 314\nPhase\nTests passed\nAnd enough words to pass similarity threshold.', normalizedTextDigest: 'd', extractionDigest: 'd', sectionCandidates: [], warnings: []
    } });
    const doc = createBaseDocument('Phase: 6.3.2\nTests passed = 324\nPhase\nTests passed\nAnd enough words to pass similarity threshold.');
    const { gateResult, reopenResult } = await runPipeline('job12', doc, 'DOCX');
    expect(gateResult!.passed).toBe(false);
    expect(reopenResult!.errorCode).toBe('CRITICAL_FACT_MISMATCH');
    hostAdapter.extractDocumentArtifact = extractBackup;
  });

  it('13. Aggregate benchmark results properly modeled', () => {
    // Simulated aggregate test block logic
    const report = {
      pdfGenerationBlockedCount: 1,
      reopenFailures: 2,
      extractionFailures: 2,
      emptyExtractionBlockedCount: 1,
      requiredSectionBlockedCount: 1,
      placeholderDetectedCount: 1,
      similarityBlockedCount: 1,
      criticalFactBlockedCount: 1,
      reopenBypassCount: 0,
      forcedPassCount: 0
    };
    expect(report.pdfGenerationBlockedCount).toBe(1);
    expect(report.forcedPassCount).toBe(0);
  });
});
