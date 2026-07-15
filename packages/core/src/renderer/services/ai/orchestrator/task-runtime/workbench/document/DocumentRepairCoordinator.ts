import { DocumentSection } from '../domain/WorkbenchTypes';

export interface DocumentRepairRequest {
  targetSection: DocumentSection;
  issues: string[];
  proposedPatch: string;
}

export class DocumentRepairCoordinator {
  private attemptMap = new Map<string, number>();

  public repairSection(request: DocumentRepairRequest): DocumentSection {
    return {
      ...request.targetSection,
      content: request.proposedPatch,
      revision: String(Number(request.targetSection.revision || '1') + 1),
      status: 'REPAIRED'
    };
  }

  public canAttemptRepair(sectionId: string, maxAttempts: number = 3): boolean {
    const attempts = this.attemptMap.get(sectionId) || 0;
    return attempts < maxAttempts;
  }

  public recordRepairAttempt(sectionId: string): void {
    const attempts = this.attemptMap.get(sectionId) || 0;
    this.attemptMap.set(sectionId, attempts + 1);
  }
  
  public resetAttempts(sectionId: string): void {
    this.attemptMap.delete(sectionId);
  }
}
