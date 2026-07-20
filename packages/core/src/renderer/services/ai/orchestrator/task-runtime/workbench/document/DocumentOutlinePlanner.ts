import { DocumentContract, DocumentOutline, DocumentSection } from '../domain/WorkbenchTypes';

export interface PlanOutlineRequest {
  contract: DocumentContract;
  proposedSections: Array<{
    title: string;
    required: boolean;
    expectedLength: number;
    dependencies?: string[];
  }>;
  hierarchy?: Record<string, string[]>;
}

export class DocumentOutlinePlanner {
  public planOutline(request: PlanOutlineRequest): DocumentOutline {
    const sections: DocumentSection[] = request.proposedSections.map((sec, index) => {
      const isRequiredByContract = request.contract.requiredSections.includes(sec.title);
      return {
        sectionId: crypto.randomUUID(),
        title: sec.title,
        order: index,
        required: sec.required || isRequiredByContract,
        expectedLength: sec.expectedLength,
        dependencies: sec.dependencies || []
      };
    });

    // Ensure all contract required sections exist
    for (const reqSec of request.contract.requiredSections) {
      if (!sections.find(s => s.title === reqSec)) {
        sections.push({
          sectionId: crypto.randomUUID(),
          title: reqSec,
          order: sections.length,
          required: true,
          expectedLength: 100,
          dependencies: []
        });
      }
    }

    const hierarchy = request.hierarchy || {};
    const dependencies: Record<string, string[]> = {};
    for (const sec of sections) {
      dependencies[sec.sectionId] = sec.dependencies;
    }

    const estimatedLength = sections.reduce((sum, sec) => sum + sec.expectedLength, 0);

    return {
      outlineId: crypto.randomUUID(),
      sections,
      hierarchy,
      dependencies,
      estimatedLength
    };
  }

  public validateOutline(outline: DocumentOutline, contract: DocumentContract): boolean {
    if (outline.sections.length === 0) {
      return false;
    }
    
    const sectionTitles = outline.sections.map(s => s.title);
    for (const requiredSection of contract.requiredSections) {
      if (!sectionTitles.includes(requiredSection)) {
        return false;
      }
    }

    return true;
  }
}
