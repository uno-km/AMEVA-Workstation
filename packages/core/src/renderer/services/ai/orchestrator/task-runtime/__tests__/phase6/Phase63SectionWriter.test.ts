import { describe, it, expect } from 'vitest';
import { SectionWriter } from '../../workbench/document/SectionWriter';
import { DocumentOutlinePlanner } from '../../workbench/document/DocumentOutlinePlanner';
import { DocumentContractService } from '../../workbench/document/DocumentContractService';

describe('Phase63SectionWriter', () => {
  it('should write a section', () => {
    const writer = new SectionWriter();
    const contractService = new DocumentContractService();
    const contract = contractService.createContract({
      documentType: 'Report', objective: 'Test'
    });
    const planner = new DocumentOutlinePlanner();
    const outline = planner.planOutline({
      contract, proposedSections: [{ title: 'S1', required: true, expectedLength: 100 }]
    });

    const result = writer.writeSection({
      contract, outline, targetSectionId: outline.sections[0].sectionId, previousSections: []
    }, 'This is S1 content');

    expect(result.section.content).toBe('This is S1 content');
    expect(result.section.status).toBe('WRITTEN');
  });
});
