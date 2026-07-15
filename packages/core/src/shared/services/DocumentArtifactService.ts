import * as path from 'path';
import * as fs from 'fs';
import * as crypto from 'crypto';
import * as docx from 'docx';
import * as mammoth from 'mammoth';
import { PdfParseAdapter } from './adapters/PdfParseAdapter';

import type { 
  DocumentArtifactGenerateRequest, 
  DocumentArtifactExtractRequest, 
  GenerationResult, 
  ExtractionResult 
} from '../ipc/documentHostIpcContract';

export class MainProcessDocumentHostService {
  public async generateArtifact(req: DocumentArtifactGenerateRequest, allowedWorkspaceRoot: string): Promise<GenerationResult> {
    if (req.artifactFormat === 'PDF') {
      return {
        success: false,
        format: 'PDF',
        generatorName: 'N/A',
        generatorVersion: 'N/A',
        generatorCapability: 'BLOCKED_BY_MISSING_GENERATOR',
        generatedByteLength: 0,
        artifactDigest: '',
        outputArtifactReference: '',
        warnings: [],
        errorCode: 'BLOCKED_BY_MISSING_GENERATOR',
        executionMode: 'BLOCKED_BY_MISSING_GENERATOR'
      };
    }

    if (req.artifactFormat === 'DOCX') {
      const p = path.resolve(allowedWorkspaceRoot, req.outputLogicalPath);
      if (!p.startsWith(path.resolve(allowedWorkspaceRoot))) {
        throw new Error('INVALID_PATH');
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
        format: 'DOCX',
        generatorName: 'docx',
        generatorVersion: '9.7.1',
        generatorCapability: 'REAL_GENERATION_SUPPORTED',
        generatedByteLength: buffer.length,
        artifactDigest: digest,
        outputArtifactReference: req.outputLogicalPath,
        warnings: [],
        executionMode: 'REAL_GENERATION_EXECUTED'
      };
    }

    throw new Error('Unsupported format for Main Process generation');
  }

  public async extractArtifact(req: DocumentArtifactExtractRequest, allowedWorkspaceRoot: string): Promise<ExtractionResult> {
    const p = path.resolve(allowedWorkspaceRoot, req.artifactReference);
    if (!p.startsWith(path.resolve(allowedWorkspaceRoot))) {
      throw new Error('INVALID_PATH');
    }

    const buffer = await fs.promises.readFile(p);

    if (req.artifactFormat === 'DOCX') {
      const result = await mammoth.extractRawText({ buffer });
      const text = result.value;
      const normalized = text.normalize('NFC').replace(/\r\n/g, '\n').trim();
      const digest = crypto.createHash('sha256').update(normalized).digest('hex');

      return {
        success: true,
        format: 'DOCX',
        extractorName: 'mammoth',
        extractorVersion: '1.12.0',
        executionMode: 'REAL_ARTIFACT_EXTRACTED',
        extractedTextLength: normalized.length,
        extractedText: text,
        normalizedText: normalized,
        normalizedTextDigest: digest,
        extractionDigest: crypto.createHash('sha256').update(buffer).digest('hex'),
        sectionCandidates: [],
        warnings: result.messages.map(m => m.message),
      };
    }

    if (req.artifactFormat === 'PDF') {
      let pdfParseFn;
      try {
        pdfParseFn = PdfParseAdapter.getPdfParse();
      } catch (e: any) {
        return {
          success: false, format: 'PDF', extractorName: 'pdf-parse', extractorVersion: '2.4.5', executionMode: 'BLOCKED_BY_ENVIRONMENT', extractedTextLength: 0, normalizedTextDigest: '', extractionDigest: '', sectionCandidates: [], warnings: [], errorCode: e.message
        };
      }

      const data = await pdfParseFn(buffer);
      const text = data.text;
      const normalized = text.normalize('NFC').replace(/\r\n/g, '\n').trim();
      const digest = crypto.createHash('sha256').update(normalized).digest('hex');

      return {
        success: true,
        format: 'PDF',
        extractorName: 'pdf-parse',
        extractorVersion: '2.4.5',
        executionMode: 'REAL_ARTIFACT_EXTRACTED',
        extractedTextLength: normalized.length,
        extractedText: text,
        normalizedText: normalized,
        normalizedTextDigest: digest,
        extractionDigest: crypto.createHash('sha256').update(buffer).digest('hex'),
        sectionCandidates: [],
        warnings: []
      };
    }

    throw new Error('Unsupported format for Main Process extraction');
  }
}
