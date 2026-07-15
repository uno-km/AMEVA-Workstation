import { describe, it, expect } from 'vitest';
import { DocumentWorkbenchPersistenceAdapter } from '../../workbench/persistence/DocumentWorkbenchPersistenceAdapter';

describe('Phase63Persistence', () => {
  it('should save and load job', async () => {
    let storage: any = {};
    const base: any = {
      saveCheckpointData: async (m: string, k: string, d: any) => { storage[k] = d; },
      loadCheckpointData: async (m: string, k: string) => storage[k]
    };
    const adapter = new DocumentWorkbenchPersistenceAdapter(base);
    await adapter.saveJob({ job: { missionId: 'm1', attemptId: 'a1', status: 'WRITING' } as any, sections: [], issues: [] });
    const loaded = await adapter.loadJob('m1', 'a1');
    expect(loaded?.job.status).toBe('WRITING');
  });
});
