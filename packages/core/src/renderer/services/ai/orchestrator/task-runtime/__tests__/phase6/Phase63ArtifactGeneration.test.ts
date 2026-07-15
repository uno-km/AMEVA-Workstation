import { describe, it, expect } from 'vitest';
import { DocumentArtifactGenerator } from '../../workbench/document/DocumentArtifactGenerator';

describe('Phase63ArtifactGeneration', () => {
  it('should generate artifact', async () => {
    const fakeFs: any = {
      write: async () => {}
    };
    const gen = new DocumentArtifactGenerator(fakeFs, {} as any);
    const res = await gen.generateArtifact('job1', { id: '1', documentId: '1', sections: [], fullText: 'Hello', revision: '1' } as any, 'MARKDOWN', '/out');
    expect(res.state).toBe('WRITTEN');
    expect(res.filePath.endsWith('job1.markdown')).toBe(true);
  });
});
