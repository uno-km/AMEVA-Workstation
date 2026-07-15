import { describe, it, expect } from 'vitest';
import { DocumentOutlinePlanner } from '../../workbench/document/DocumentOutlinePlanner';
import { DocumentContractService } from '../../workbench/document/DocumentContractService';

describe('Phase63OutlinePlanner', () => {
  it('should generate an outline satisfying the contract', () => {
    const service = new DocumentContractService();
    const contract = service.createContract({
      documentType: 'Report',
      objective: 'Write a report',
      requiredSections: ['Intro', 'Conclusion']
    });
    
    const planner = new DocumentOutlinePlanner();
    const outline = planner.planOutline({
      contract,
      proposedSections: [{ title: 'Intro', required: true, expectedLength: 100 }]
    });

    expect(outline.sections.some(s => s.title === 'Intro')).toBe(true);
    expect(outline.sections.some(s => s.title === 'Conclusion')).toBe(true);
    expect(planner.validateOutline(outline, contract)).toBe(true);
  });
});
