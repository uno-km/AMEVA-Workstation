import { describe, it, expect } from 'vitest';
import { DocumentCompletionGate } from '../../workbench/document/DocumentCompletionGate';
import { ReopenVerifier } from '../../workbench/document/ReopenVerifier';
import { MarkdownExtractor, DocxExtractor } from '../../workbench/document/Extractors';
import { IFileSystemAdapter } from '../../artifact/IFileSystemAdapter';
import { TestWorkbenchHostAdapter } from '../../workbench/adapter/TestWorkbenchHostAdapter';
import { TestDocumentHostHandler } from '../../workbench/document/__mock__/TestDocumentHostHandler';
import { DocumentArtifactGenerator } from '../../workbench/document/DocumentArtifactGenerator';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('Phase 6.3 Document Workbench E2E', () => {
  it('E2E Flow - Artifact Generate -> Actual Reopen -> Actual Extraction -> VALIDATED -> COMMITTED -> COMPLETED', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ameva-e2e-'));
    const fakeFs: IFileSystemAdapter = {
      read: async (p) => fs.readFileSync(p, 'utf-8'),
      readBytes: async (p) => new Uint8Array(fs.readFileSync(p)),
      write: async (p, c) => fs.writeFileSync(p, c),
      writeFile: async (p, c) => fs.writeFileSync(p, c),
      stat: async () => ({ exists: true, size: 10, isDirectory: false }),
      copy: async () => {}, move: async () => {}, hash: async () => 'hash', remove: async () => {}, list: async () => '', exists: async () => true, realpath: async () => '', isSymlink: async () => false
    };

    const hostAdapter = new TestWorkbenchHostAdapter(fakeFs, {} as any);
    const testHandler = new TestDocumentHostHandler();

    hostAdapter.generateDocumentArtifact = async (req: any) => await testHandler.generateDocumentArtifact(req, tempDir);
    hostAdapter.extractDocumentArtifact = async (req: any) => await testHandler.extractDocumentArtifact(req, tempDir);

    const doc = { 
      id: 'doc_kor_1', documentId: '1', 
      fullText: 'Phase: 6.3.2\nTests passed = 324\n문서 유형: 기술 보고서\n\n# Phase 6.3 문서 워크벤치\n검증 결과 총 324개 테스트 통과.\nAnd adding extra long text to satisfy the similarity threshold and ensure it is definitely over the required number of tokens.', 
      revision: '1', 
      sections: [{ sectionId: '1', title: 'Phase 6.3 문서 워크벤치', required: true, order: 0, expectedLength: 10, dependencies: [] }] 
    } as any;

    const generator = new DocumentArtifactGenerator(fakeFs, hostAdapter);
    const genRes = await generator.generateArtifact('job_kor_1', doc, 'DOCX', tempDir);

    expect(genRes.result.success).toBe(true);
    expect(genRes.result.generatorName).toBe('docx');

    const extractor = new DocxExtractor(fakeFs, hostAdapter);
    const verifier = new ReopenVerifier(extractor);
    const context = { stagedPath: genRes.filePath, artifactFormat: 'DOCX', artifactId: '1', artifactRevision: '1', documentJobId: 'job_kor_1', documentId: doc.id };
    
    const reopenResult = await verifier.verify(context, doc);
    console.log('REOPEN RESULT:', JSON.stringify(reopenResult, null, 2));
    expect(reopenResult.passed).toBe(true);

    const gate = new DocumentCompletionGate();
    const res = gate.check({
      job: {} as any, contract: { requiredSections: ['Phase 6.3 문서 워크벤치'] } as any, outline: {} as any, sections: [{ title: 'Phase 6.3 문서 워크벤치', status: 'WRITTEN' }] as any, integratedDocument: doc, consistencyIssues: [], artifactState: 'COMMITTED',
      reopenResult, generatorResult: genRes.result
    });
    
    console.log('GATE RESULT:', JSON.stringify(res, null, 2));
    expect(res.passed).toBe(true);

    fs.rmSync(tempDir, { recursive: true, force: true });
  });
  
  it('E2E Flow - Artifact Generate -> Invalid DOCX Reopen -> Fail Completion Gate', async () => {
    const fakeFs: IFileSystemAdapter = {
      read: async () => '',
      readBytes: async () => new Uint8Array([0,1,2]),
      write: async () => {}, writeFile: async () => {},
      stat: async () => ({ exists: true, size: 10, isDirectory: false }),
      copy: async () => {}, move: async () => {}, hash: async () => 'hash', remove: async () => {}, list: async () => '', exists: async () => true, realpath: async () => '', isSymlink: async () => false
    };

    const hostAdapter = new TestWorkbenchHostAdapter(fakeFs, {} as any);
    const extractor = new DocxExtractor(fakeFs, hostAdapter);
    const verifier = new ReopenVerifier(extractor);
    const context = { stagedPath: '/out.docx', artifactFormat: 'DOCX', artifactId: '1', artifactRevision: '1', documentJobId: '1', documentId: '1' };
    const doc = { documentId: '1', fullText: 'Valid body', revision: '1', sections: [] } as any;
    
    hostAdapter.extractDocumentArtifact = async () => ({
      success: false, format: 'DOCX', errorCode: 'EXTRACTION_FAILED', extractorName: 'mammoth', extractorVersion: '1.12', extractorCapability: 'UNSUPPORTED', extractionExecutionProvenance: 'TEST_NODE_HOST_EXECUTED', extractedTextLength: 0, normalizedTextDigest: '', extractionDigest: '', sectionCandidates: [], warnings: []
    });

    const reopenResult = await verifier.verify(context, doc);
    expect(reopenResult.passed).toBe(false);

    const gate = new DocumentCompletionGate();
    const res = gate.check({
      job: {} as any, contract: { requiredSections: [] } as any, outline: {} as any, sections: [] as any, integratedDocument: doc, consistencyIssues: [], artifactState: 'COMMITTED',
      reopenResult, generatorResult: { generatorName: 'docx', generatorCapability: 'REAL_GENERATION_SUPPORTED' } as any
    });
    
    expect(res.passed).toBe(false);
  });
});
