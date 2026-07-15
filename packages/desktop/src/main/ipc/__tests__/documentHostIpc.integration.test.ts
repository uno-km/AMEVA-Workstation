import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as path from 'path';
import * as fs from 'fs';
import * as crypto from 'crypto';
import { MainProcessDocumentHostService } from '../../services/MainProcessDocumentHostService';

// Mock docx and mammoth exactly as they are used
vi.mock('docx', async (importOriginal) => {
  const actual = await importOriginal() as any;
  return {
    ...actual,
    Packer: {
      toBuffer: vi.fn().mockResolvedValue(Buffer.from('MOCKED_DOCX_OOXML_BYTES'))
    }
  };
});

vi.mock('mammoth', async () => {
  return {
    extractRawText: vi.fn().mockResolvedValue({
      value: '문서 제목 324',
      messages: []
    })
  };
});

describe('Main Process Document Host IPC Integration', () => {
  let service: MainProcessDocumentHostService;
  const tempDir = path.resolve(__dirname, 'temp_integration');
  const allowedWorkspaceRoot = tempDir;

  beforeEach(() => {
    service = new MainProcessDocumentHostService();
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
    fs.mkdirSync(tempDir, { recursive: true });
  });

  it('DOCX Generation flow - successful DOCX generation', async () => {
    const req = {
      missionId: 'm1',
      taskId: 't1',
      attemptId: 'a1',
      workbenchSessionId: 'session_doc1',
      sessionCapabilityToken: 'sec_token',
      documentJobId: 'job_1',
      documentId: 'doc_1',
      artifactId: 'art_1',
      artifactRevision: '1',
      artifactFormat: 'DOCX',
      idempotencyKey: 'idemp_key',
      integratedDocumentReference: '문서 제목 324',
      outputLogicalPath: 'test_doc.docx'
    };

    const res = await service.generateArtifact(req, allowedWorkspaceRoot);

    expect(res.success).toBe(true);
    expect(res.generatorCapability).toBe('REAL_GENERATION_SUPPORTED');
    expect(res.generationExecutionProvenance).toBe('MAIN_PROCESS_HOST_EXECUTED');
    expect(res.generatedByteLength).toBeGreaterThan(0);
    expect(res.artifactDigest).toBeTruthy();

    const actualPath = path.resolve(allowedWorkspaceRoot, req.outputLogicalPath);
    expect(fs.existsSync(actualPath)).toBe(true);
    const writtenBytes = fs.readFileSync(actualPath);
    expect(writtenBytes.toString()).toBe('MOCKED_DOCX_OOXML_BYTES');
  });

  it('DOCX Extraction flow - successful extraction', async () => {
    const fixturePath = path.join(allowedWorkspaceRoot, 'test_doc.docx');
    fs.writeFileSync(fixturePath, Buffer.from('MOCKED_DOCX_OOXML_BYTES'));

    const req = {
      missionId: 'm1',
      taskId: 't1',
      attemptId: 'a1',
      workbenchSessionId: 'session_doc1',
      sessionCapabilityToken: 'sec_token',
      documentJobId: 'job_1',
      documentId: 'doc_1',
      artifactId: 'art_1',
      artifactRevision: '1',
      artifactFormat: 'DOCX',
      idempotencyKey: 'idemp_key',
      artifactReference: 'test_doc.docx'
    };

    const res = await service.extractArtifact(req, allowedWorkspaceRoot);

    expect(res.success).toBe(true);
    expect(res.extractorCapability).toBe('REAL_REOPEN_SUPPORTED');
    expect(res.extractionExecutionProvenance).toBe('MAIN_PROCESS_HOST_EXECUTED');
    expect(res.extractedText).toContain('문서 제목 324');
    expect(res.extractedTextLength).toBeGreaterThan(0);
  });

  it('PDF Generation flow - blocked as missing generator', async () => {
    const req = {
      missionId: 'm1',
      taskId: 't1',
      attemptId: 'a1',
      workbenchSessionId: 'session_doc1',
      sessionCapabilityToken: 'sec_token',
      documentJobId: 'job_1',
      documentId: 'doc_1',
      artifactId: 'art_1',
      artifactRevision: '1',
      artifactFormat: 'PDF',
      idempotencyKey: 'idemp_key',
      integratedDocumentReference: 'some content',
      outputLogicalPath: 'test_doc.pdf'
    };

    const res = await service.generateArtifact(req, allowedWorkspaceRoot);

    expect(res.success).toBe(false);
    expect(res.errorCode).toBe('BLOCKED_BY_MISSING_GENERATOR');
    expect(res.generatorCapability).toBe('BLOCKED_BY_MISSING_GENERATOR');
    expect(res.generationExecutionProvenance).toBe('NOT_EXECUTED');
    expect(res.generatedByteLength).toBe(0);
    
    const actualPath = path.resolve(allowedWorkspaceRoot, req.outputLogicalPath);
    expect(fs.existsSync(actualPath)).toBe(false);
  });

  it('Path traversal attack should be blocked', async () => {
    const req = {
      missionId: 'm1',
      taskId: 't1',
      attemptId: 'a1',
      workbenchSessionId: 'session_doc1',
      sessionCapabilityToken: 'sec_token',
      documentJobId: 'job_1',
      documentId: 'doc_1',
      artifactId: 'art_1',
      artifactRevision: '1',
      artifactFormat: 'DOCX',
      idempotencyKey: 'idemp_key',
      integratedDocumentReference: 'some content',
      outputLogicalPath: '../../../etc/passwd.docx'
    };

    await expect(service.generateArtifact(req, allowedWorkspaceRoot)).rejects.toThrow('INVALID_PATH');
  });
});
