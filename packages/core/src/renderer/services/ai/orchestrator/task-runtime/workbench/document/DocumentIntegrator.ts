import { DocumentSection, IntegratedDocument } from '../domain/WorkbenchTypes';

export class DocumentIntegrator {
  public integrate(sections: DocumentSection[]): IntegratedDocument {
    const sortedSections = [...sections].sort((a, b) => a.order - b.order);
    
    let fullText = '';
    for (const section of sortedSections) {
      fullText += `# ${section.title}\n\n`;
      if (section.content) {
        fullText += `${section.content}\n\n`;
      }
    }

    return {
      documentId: crypto.randomUUID(),
      sections: sortedSections,
      fullText: fullText.trim(),
      revision: '1'
    };
  }
}
