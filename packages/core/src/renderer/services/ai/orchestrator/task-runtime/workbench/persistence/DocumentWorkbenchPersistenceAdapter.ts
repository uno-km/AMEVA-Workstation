import { IRuntimePersistenceAdapter } from '../../persistence/RuntimePersistenceAdapter';
import { DocumentWorkbenchJob, DocumentContract, DocumentOutline, DocumentSection, DocumentIssue, DocumentArtifactState } from '../domain/WorkbenchTypes';

export interface DocumentWorkbenchPersistenceData {
  job: DocumentWorkbenchJob;
  contract?: DocumentContract;
  outline?: DocumentOutline;
  sections: DocumentSection[];
  issues: DocumentIssue[];
  artifactState?: DocumentArtifactState;
}

export class DocumentWorkbenchPersistenceAdapter {
  constructor(private readonly baseAdapter: IRuntimePersistenceAdapter) {}

  private getPersistenceKey(attemptId: string): string {
    return `document_workbench_v1_${attemptId}`;
  }

  public async saveJob(data: DocumentWorkbenchPersistenceData): Promise<void> {
    await this.baseAdapter.saveCheckpointData(
      data.job.missionId,
      this.getPersistenceKey(data.job.attemptId),
      data
    );
  }

  public async loadJob(missionId: string, attemptId: string): Promise<DocumentWorkbenchPersistenceData | null> {
    const data = await this.baseAdapter.loadCheckpointData(missionId, this.getPersistenceKey(attemptId));
    if (!data) return null;
    return data as DocumentWorkbenchPersistenceData;
  }
}
