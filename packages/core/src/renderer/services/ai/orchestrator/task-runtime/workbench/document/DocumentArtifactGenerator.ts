import { IFileSystemAdapter } from '../../artifact/IFileSystemAdapter';
import { IntegratedDocument, DocumentArtifactState } from '../domain/WorkbenchTypes';
import { IWorkbenchHostAdapter } from '../adapter/IWorkbenchHostAdapter';
import { DocumentArtifactGenerateRequest, GenerationResult } from '../../../../../../../shared/ipc/documentHostIpcContract';

export class DocumentArtifactGenerator {
  constructor(private fs: IFileSystemAdapter, private hostAdapter: IWorkbenchHostAdapter) {}

  public async generateArtifact(
    jobId: string, 
    document: IntegratedDocument, 
    format: 'MARKDOWN' | 'DOCX' | 'PDF' | 'HTML',
    outDir: string
  ): Promise<{ filePath: string; state: DocumentArtifactState; result: GenerationResult }> {
    const ext = format.toLowerCase();
    const separator = outDir.endsWith('/') || outDir.endsWith('\\') ? '' : '/';
    const filePath = `${outDir}${separator}${jobId}.${ext}`;
    
    if (format === 'MARKDOWN' || format === 'HTML') {
      let content = '';
      if (format === 'MARKDOWN') {
        content = document.fullText;
      } else if (format === 'HTML') {
        content = `<html><body>\n${document.fullText.replace(/# (.*)/g, '<h1>$1</h1>').replace(/\n\n/g, '<br/>')}\n</body></html>`;
      }
      await this.fs.write(filePath, content);
      
      const encoder = new TextEncoder();
      const length = encoder.encode(content).length;

      return { 
        filePath, 
        state: 'WRITTEN',
        result: {
          success: true,
          format,
          generatorName: 'RendererGenerator',
          generatorVersion: '1.0.0',
          generatorCapability: 'REAL_GENERATION_SUPPORTED',
          generatedByteLength: length,
          artifactDigest: 'TODO_DIGEST',
          outputArtifactReference: filePath,
          warnings: [],
          executionMode: 'REAL_GENERATION_EXECUTED'
        }
      };
    } else {
      if (!this.hostAdapter.generateDocumentArtifact) {
        throw new Error('Host adapter does not support generateDocumentArtifact');
      }

      const req: DocumentArtifactGenerateRequest = {
        missionId: 'system',
        taskId: 'system',
        attemptId: 'system',
        workbenchSessionId: 'system',
        sessionCapabilityToken: 'token',
        documentJobId: jobId,
        documentId: document.id,
        artifactId: 'tmp',
        artifactRevision: '1',
        artifactFormat: format,
        idempotencyKey: `${jobId}-${Date.now()}`,
        integratedDocumentReference: document.fullText,
        outputLogicalPath: filePath
      };

      const res = await this.hostAdapter.generateDocumentArtifact(req);
      
      return { 
        filePath, 
        state: res.success ? 'WRITTEN' : 'STAGED',
        result: res.success ? res.result : res
      };
    }
  }
}
