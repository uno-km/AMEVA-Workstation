import * as path from 'path';
import * as fs from 'fs';
import * as crypto from 'crypto';
import * as docx from 'docx';
import * as mammoth from 'mammoth';
import { PdfParseAdapter } from '../../../../../../../../shared/services/adapters/PdfParseAdapter';

import type { 
  DocumentArtifactGenerateRequest, 
  DocumentArtifactExtractRequest, 
  GenerationResult, 
  ExtractionResult 
} from '../../../../../../../../shared/ipc/documentHostIpcContract';

export class TestDocumentHostHandler {
  public async generateDocumentArtifact(req: DocumentArtifactGenerateRequest, allowedWorkspaceRoot: string): Promise<{ success: boolean, result?: GenerationResult, errorCode?: string, safeMessage?: string }> {
    if (req.artifactFormat === 'PDF') {
      return {
        success: false,
        errorCode: 'BLOCKED_BY_MISSING_GENERATOR',
        safeMessage: 'BLOCKED_BY_MISSING_GENERATOR'
      };
    }

    if (req.artifactFormat === 'DOCX') {
      const p = path.resolve(allowedWorkspaceRoot, req.outputLogicalPath);
      if (!p.startsWith(path.resolve(allowedWorkspaceRoot))) {
        return { success: false, errorCode: 'INVALID_PATH', safeMessage: 'INVALID_PATH' };
      }

      // Very simple DOCX generation based on the passed expected context
      const doc = new docx.Document({
        sections: [{
          properties: {},
          children: [
            new docx.Paragraph({
              children: [
                new docx.TextRun(req.integratedDocumentReference || 'Empty Document')
              ]
            })
          ]
        }]
      });

      const buffer = await docx.Packer.toBuffer(doc);
      await fs.promises.mkdir(path.dirname(p), { recursive: true });
      await fs.promises.writeFile(p, buffer);

      const digest = crypto.createHash('sha256').update(buffer).digest('hex');

      return {
        success: true,
        result: {
          success: true,
          format: 'DOCX',
          generatorName: 'docx',
          generatorVersion: '9.7.1',
          generatorCapability: 'REAL_GENERATION_SUPPORTED',
          generationExecutionProvenance: 'TEST_NODE_HOST_EXECUTED',
          generatedByteLength: buffer.length,
          artifactDigest: digest,
          outputArtifactReference: req.outputLogicalPath,
          warnings: []
        }
      };
    }

    return { success: false, errorCode: 'UNSUPPORTED_FORMAT', safeMessage: 'Unsupported format' };
  }

  public async extractDocumentArtifact(req: DocumentArtifactExtractRequest, allowedWorkspaceRoot: string): Promise<{ success: boolean, result?: ExtractionResult, errorCode?: string, safeMessage?: string }> {
    const p = path.resolve(allowedWorkspaceRoot, req.artifactReference);
    if (!p.startsWith(path.resolve(allowedWorkspaceRoot))) {
      return { success: false, errorCode: 'INVALID_PATH', safeMessage: 'INVALID_PATH' };
    }

    const buffer = await fs.promises.readFile(p);

    if (req.artifactFormat === 'DOCX') {
      const result = await mammoth.extractRawText({ buffer });
      const text = result.value;
      const normalized = text.normalize('NFC').replace(/\r\n/g, '\n').trim();
      const digest = crypto.createHash('sha256').update(normalized).digest('hex');

      return {
        success: true,
        result: {
          success: true,
          format: 'DOCX',
          extractorName: 'mammoth',
          extractorVersion: '1.12.0',
          extractorCapability: 'REAL_REOPEN_SUPPORTED',
          extractionExecutionProvenance: 'TEST_NODE_HOST_EXECUTED',
          extractedTextLength: normalized.length,
          extractedText: text,
          normalizedText: normalized,
          normalizedTextDigest: digest,
          extractionDigest: crypto.createHash('sha256').update(buffer).digest('hex'),
          sectionCandidates: [],
          warnings: result.messages.map(m => m.message),
        }
      };
    }

    if (req.artifactFormat === 'PDF') {
      let pdfParseFn;
      try {
        pdfParseFn = PdfParseAdapter.getPdfParse();
      } catch (e: any) {
        return { success: false, errorCode: e.message, safeMessage: e.message };
      }

      const data = await pdfParseFn(buffer);
      const text = data.text;
      const normalized = text.normalize('NFC').replace(/\r\n/g, '\n').trim();
      const digest = crypto.createHash('sha256').update(normalized).digest('hex');

      return {
        success: true,
        result: {
          success: true,
          format: 'PDF',
          extractorName: 'pdf-parse',
          extractorVersion: '2.4.5',
          extractorCapability: 'EXTRACTION_ONLY',
          extractionExecutionProvenance: 'TEST_NODE_HOST_EXECUTED',
          extractedTextLength: normalized.length,
          extractedText: text,
          normalizedText: normalized,
          normalizedTextDigest: digest,
          extractionDigest: crypto.createHash('sha256').update(buffer).digest('hex'),
          sectionCandidates: [],
          warnings: []
        }
      };
    }

    return { success: false, errorCode: 'UNSUPPORTED_FORMAT', safeMessage: 'Unsupported format' };
  }
}
