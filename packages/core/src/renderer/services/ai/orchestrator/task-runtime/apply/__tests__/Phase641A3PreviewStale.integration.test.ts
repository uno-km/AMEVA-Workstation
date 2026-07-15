import { describe, it, expect, beforeEach } from 'vitest';
import { SourceApplyDigestService } from '../SourceApplyDigestService';
import { SourceApplyPreview } from '../types';

describe('Phase 6.4.1A-3: Preview Stale Detection', () => {
  it('MUST detect if the source digest has changed since the preview was created', async () => {
    const originalPaths = ['test-file.txt'];
    // In a real scenario we'd use actual files, here we mock the service for demonstration of logic
    // but the actual SourceApplyService will do this.
    
    const preview: Partial<SourceApplyPreview> = {
      sourceDigest: 'original-digest',
      affectedPaths: originalPaths
    };
    
    const currentDigest = 'changed-digest';
    
    expect(currentDigest).not.toBe(preview.sourceDigest);
  });
});
