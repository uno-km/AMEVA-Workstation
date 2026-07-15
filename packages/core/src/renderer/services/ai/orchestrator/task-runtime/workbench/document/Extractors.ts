import { IArtifactContentExtractor, ExtractionContext, ExtractionResult } from './IArtifactContentExtractor';
import { IFileSystemAdapter } from '../../artifact/IFileSystemAdapter';
import { IWorkbenchHostAdapter } from '../adapter/IWorkbenchHostAdapter';
import { DocumentArtifactExtractRequest } from '../../../../../../../shared/ipc/documentHostIpcContract';

export class MarkdownExtractor implements IArtifactContentExtractor {
  constructor(private fs: IFileSystemAdapter) {}

  private normalizeText(text: string): string {
    return text.normalize('NFC').replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  }

  async extractText(context: ExtractionContext): Promise<ExtractionResult> {
    try {
      const text = await this.fs.read(context.stagedPath);
      if (text === null) return this.fail(context, 'ARTIFACT_NOT_FOUND');
      
      const normalized = this.normalizeText(text);
      const lines = normalized.split('\n');
      const sectionCandidates = lines.filter(l => l.startsWith('#')).map(l => l.replace(/^#+\s*/, '').trim());

      return {
        success: true,
        format: 'MARKDOWN',
        extractedText: text,
        normalizedText: normalized,
        contentLength: normalized.length,
        extractionDigest: '',
        sectionCandidates,
        warnings: [],
        extractorName: 'MarkdownExtractor',
        extractorVersion: '1.0.0',
        extractorCapability: 'REAL_REOPEN_SUPPORTED',
        extractionExecutionProvenance: 'RENDERER_SAFE_EXECUTED'
      };
    } catch (e: any) {
      return this.fail(context, 'MARKDOWN_REOPEN_FAILED', [e.message]);
    }
  }

  private fail(context: ExtractionContext, errorCode: string, warnings: string[] = []): ExtractionResult {
    return {
        success: false, format: context.artifactFormat, extractedText: '', normalizedText: '', contentLength: 0,
        extractionDigest: '', sectionCandidates: [], warnings, errorCode, extractorName: 'MarkdownExtractor',
        extractorVersion: '1.0.0', extractorCapability: 'UNSUPPORTED', extractionExecutionProvenance: 'NOT_EXECUTED'
    };
  }
}

export class HtmlExtractor implements IArtifactContentExtractor {
  constructor(private fs: IFileSystemAdapter) {}

  private normalizeText(text: string): string {
    return text.normalize('NFC').replace(/\r\n/g, '\n').replace(/\s+/g, ' ').trim();
  }

  async extractText(context: ExtractionContext): Promise<ExtractionResult> {
    try {
      const html = await this.fs.read(context.stagedPath);
      if (html === null) return this.fail(context, 'ARTIFACT_NOT_FOUND');

      let bodyHtml = html;
      const bodyMatch = /<body[^>]*>([\s\S]*?)<\/body>/i.exec(html);
      if (bodyMatch) {
        bodyHtml = bodyMatch[1];
      }

      // Very simple extraction using regex if DOMParser isn't available
      const noScripts = bodyHtml.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
      const noStyles = noScripts.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');
      const textOnly = noStyles.replace(/<[^>]*>?/gm, ' ');
      
      const normalized = this.normalizeText(textOnly);
      const headings = [...html.matchAll(/<h[1-6][^>]*>(.*?)<\/h[1-6]>/gi)].map(m => m[1].replace(/<[^>]*>?/gm, '').trim());

      return {
        success: true,
        format: 'HTML',
        extractedText: textOnly,
        normalizedText: normalized,
        contentLength: normalized.length,
        extractionDigest: '',
        sectionCandidates: headings,
        warnings: [],
        extractorName: 'HtmlExtractor',
        extractorVersion: '1.0.0',
        extractorCapability: 'REAL_REOPEN_SUPPORTED',
        extractionExecutionProvenance: 'RENDERER_SAFE_EXECUTED'
      };
    } catch (e: any) {
      return this.fail(context, 'HTML_PARSE_FAILED', [e.message]);
    }
  }

  private fail(context: ExtractionContext, errorCode: string, warnings: string[] = []): ExtractionResult {
    return {
        success: false, format: context.artifactFormat, extractedText: '', normalizedText: '', contentLength: 0,
        extractionDigest: '', sectionCandidates: [], warnings, errorCode, extractorName: 'HtmlExtractor',
        extractorVersion: '1.0.0', extractorCapability: 'UNSUPPORTED', extractionExecutionProvenance: 'NOT_EXECUTED'
    };
  }
}

export class DocxExtractor implements IArtifactContentExtractor {
  constructor(private fs: IFileSystemAdapter, private hostAdapter: IWorkbenchHostAdapter) {}

  async extractText(context: ExtractionContext): Promise<ExtractionResult> {
    try {
      if (!this.hostAdapter.extractDocumentArtifact) {
        throw new Error('Host adapter does not support extractDocumentArtifact');
      }

      const req: DocumentArtifactExtractRequest = {
        missionId: 'system',
        taskId: 'system',
        attemptId: 'system',
        workbenchSessionId: 'system',
        sessionCapabilityToken: 'token',
        documentJobId: context.documentJobId,
        documentId: context.documentId,
        artifactId: context.artifactId,
        artifactRevision: context.artifactRevision,
        artifactFormat: 'DOCX',
        idempotencyKey: `extract-${context.documentJobId}-${Date.now()}`,
        artifactReference: context.stagedPath
      };

      const res = await this.hostAdapter.extractDocumentArtifact(req);
      if (!res.success) {
        return this.fail(context, res.errorCode, [res.safeMessage]);
      }

      const result = res.result;

      return {
        success: true,
        format: 'DOCX',
        extractedText: result.extractedText || '',
        normalizedText: result.normalizedText || '', 
        contentLength: result.extractedTextLength,
        extractionDigest: result.extractionDigest,
        sectionCandidates: result.sectionCandidates,
        warnings: result.warnings,
        extractorName: result.extractorName,
        extractorVersion: result.extractorVersion,
        extractorCapability: result.extractorCapability,
        extractionExecutionProvenance: result.extractionExecutionProvenance
      };
    } catch (e: any) {
      return this.fail(context, 'DOCX_TEXT_EXTRACTION_FAILED', [e.message]);
    }
  }

  private fail(context: ExtractionContext, errorCode: string, warnings: string[] = []): ExtractionResult {
    return {
        success: false, format: context.artifactFormat, extractedText: '', normalizedText: '', contentLength: 0,
        extractionDigest: '', sectionCandidates: [], warnings, errorCode, extractorName: 'DocxExtractor',
        extractorVersion: 'mammoth', extractorCapability: 'UNSUPPORTED', extractionExecutionProvenance: 'NOT_EXECUTED'
    };
  }
}

export class PdfExtractor implements IArtifactContentExtractor {
  constructor(private fs: IFileSystemAdapter, private hostAdapter: IWorkbenchHostAdapter) {}

  async extractText(context: ExtractionContext): Promise<ExtractionResult> {
    try {
      if (!this.hostAdapter.extractDocumentArtifact) {
        throw new Error('Host adapter does not support extractDocumentArtifact');
      }

      const req: DocumentArtifactExtractRequest = {
        missionId: 'system',
        taskId: 'system',
        attemptId: 'system',
        workbenchSessionId: 'system',
        sessionCapabilityToken: 'token',
        documentJobId: context.documentJobId,
        documentId: context.documentId,
        artifactId: context.artifactId,
        artifactRevision: context.artifactRevision,
        artifactFormat: 'PDF',
        idempotencyKey: `extract-${context.documentJobId}-${Date.now()}`,
        artifactReference: context.stagedPath
      };

      const res = await this.hostAdapter.extractDocumentArtifact(req);
      if (!res.success) {
        return this.fail(context, res.errorCode, [res.safeMessage]);
      }

      const result = res.result;

      return {
        success: true,
        format: 'PDF',
        extractedText: result.extractedText || '',
        normalizedText: result.normalizedText || '',
        contentLength: result.extractedTextLength,
        extractionDigest: result.extractionDigest,
        sectionCandidates: result.sectionCandidates,
        warnings: result.warnings,
        extractorName: result.extractorName,
        extractorVersion: result.extractorVersion,
        extractorCapability: result.extractorCapability,
        extractionExecutionProvenance: result.extractionExecutionProvenance
      };
    } catch (e: any) {
      return this.fail(context, 'PDF_TEXT_EXTRACTION_FAILED', [e.message]);
    }
  }

  private fail(context: ExtractionContext, errorCode: string, warnings: string[] = []): ExtractionResult {
    return {
        success: false, format: context.artifactFormat, extractedText: '', normalizedText: '', contentLength: 0,
        extractionDigest: '', sectionCandidates: [], warnings, errorCode, extractorName: 'PdfExtractor',
        extractorVersion: 'pdf-parse', extractorCapability: 'UNSUPPORTED', extractionExecutionProvenance: 'NOT_EXECUTED'
    };
  }
}
