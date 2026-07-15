import { DocumentSection, DocumentIssue, DocumentArtifactState } from '../domain/WorkbenchTypes';

export interface DocumentTraceState {
  outlineGenerated: boolean;
  sections: DocumentSection[];
  issues: DocumentIssue[];
  artifactState: DocumentArtifactState | null;
  reopenPassed: boolean | null;
}

export class DocumentTraceViewModel {
  private state: DocumentTraceState = {
    outlineGenerated: false,
    sections: [],
    issues: [],
    artifactState: null,
    reopenPassed: null
  };

  public applyEvent(eventType: string, payload: any): void {
    switch (eventType) {
      case 'document_outline_created':
        this.state.outlineGenerated = true;
        break;
      case 'section_written':
      case 'section_verified':
        const existingIdx = this.state.sections.findIndex(s => s.sectionId === payload.section.sectionId);
        if (existingIdx >= 0) {
          this.state.sections[existingIdx] = payload.section;
        } else {
          this.state.sections.push(payload.section);
        }
        break;
      case 'document_issue_detected':
        this.state.issues.push(payload.issue);
        break;
      case 'document_output_generated':
        this.state.artifactState = payload.state;
        break;
      case 'document_reopen_verified':
        this.state.reopenPassed = payload.passed;
        break;
    }
  }

  public getView(): DocumentTraceState {
    return { ...this.state };
  }
}
