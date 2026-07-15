import { MainProcessDocumentHostService } from '../../../../../../../../shared/services/DocumentArtifactService';

export class TestDocumentHostHandler {
  private service = new MainProcessDocumentHostService();

  public async generateDocumentArtifact(request: any, allowedWorkspaceRoot: string) {
    const res = await this.service.generateArtifact(request, allowedWorkspaceRoot);
    if (!res.success) return { success: false, errorCode: res.errorCode, safeMessage: res.errorCode };
    
    return { success: true, result: { ...res, executionMode: 'REAL_GENERATION_EXECUTED' } };
  }

  public async extractDocumentArtifact(request: any, allowedWorkspaceRoot: string) {
    const res = await this.service.extractArtifact(request, allowedWorkspaceRoot);
    if (!res.success) return { success: false, errorCode: res.errorCode, safeMessage: res.errorCode };

    return { success: true, result: { ...res, executionMode: 'REAL_ARTIFACT_EXTRACTED' } };
  }
}
