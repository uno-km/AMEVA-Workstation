import { describe, it, expect } from 'vitest';
import { ConsistencyVerifier } from '../../workbench/document/ConsistencyVerifier';

describe('Phase63ConsistencyVerifier', () => {
  it('should detect contradictions', () => {
    const verifier = new ConsistencyVerifier();
    const res = verifier.verify({
      documentId: '1', sections: [], fullText: 'We have a Single Router but also Multiple Routers.', revision: '1'
    });
    expect(res.passed).toBe(false);
    expect(res.issues.some(i => i.type === 'CONTRADICTION')).toBe(true);
  });
  
  it('should detect numeric mismatches', () => {
    const verifier = new ConsistencyVerifier();
    const res = verifier.verify({
      documentId: '1', sections: [], fullText: '4 agents. later we saw 5 agents.', revision: '1'
    });
    expect(res.passed).toBe(false);
    expect(res.issues.some(i => i.type === 'NUMERIC_MISMATCH')).toBe(true);
  });
});
