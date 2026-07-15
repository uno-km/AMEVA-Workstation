import { describe, it, expect } from 'vitest';
import { DocumentContractService } from '../../workbench/document/DocumentContractService';

describe('Phase63DocumentContract', () => {
  it('should create and validate a contract', () => {
    const service = new DocumentContractService();
    const contract = service.createContract({
      documentType: 'Report',
      objective: 'Write a report',
      requiredSections: ['Intro', 'Body']
    });
    expect(contract.documentType).toBe('Report');
    expect(service.validateContract(contract)).toBe(true);
  });
});
