import { describe, it, expect } from 'vitest';
import { DocumentRepairCoordinator } from '../../workbench/document/DocumentRepairCoordinator';

describe('Phase63DocumentRepair', () => {
  it('should apply repair patch', () => {
    const coordinator = new DocumentRepairCoordinator();
    const rep = coordinator.repairSection({
      targetSection: { sectionId: '1', title: 'T', order: 0, required: true, expectedLength: 10, content: 'Bad', dependencies: [], revision: '1' },
      issues: [],
      proposedPatch: 'Good'
    });
    expect(rep.content).toBe('Good');
    expect(rep.revision).toBe('2');
  });
});
