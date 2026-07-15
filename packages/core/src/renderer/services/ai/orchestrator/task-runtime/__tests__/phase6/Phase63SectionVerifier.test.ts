import { describe, it, expect } from 'vitest';
import { SectionVerifier } from '../../workbench/document/SectionVerifier';

describe('Phase63SectionVerifier', () => {
  it('should fail on placeholders', () => {
    const verifier = new SectionVerifier();
    const res = verifier.verify({
      sectionId: '1', title: 'Test', order: 0, required: true, expectedLength: 10, content: 'This is a TODO item', dependencies: []
    });
    expect(res.passed).toBe(false);
    expect(res.issues.some(i => i.includes('TODO'))).toBe(true);
  });
});
