import { describe, it, expect } from 'vitest';
import { DocumentTraceViewModel } from '../../workbench/trace/DocumentTraceViewModel';

describe('Phase63TraceViewModel', () => {
  it('should apply events', () => {
    const vm = new DocumentTraceViewModel();
    vm.applyEvent('document_outline_created', {});
    expect(vm.getView().outlineGenerated).toBe(true);
  });
});
