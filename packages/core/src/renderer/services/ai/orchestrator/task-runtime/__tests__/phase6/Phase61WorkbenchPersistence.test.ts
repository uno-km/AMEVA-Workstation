import { describe, it, expect } from 'vitest';
import { WorkbenchPersistenceAdapter, WorkbenchPersistenceData } from '../../workbench/persistence/WorkbenchPersistenceAdapter';
import { InMemoryRuntimePersistenceAdapter } from '../../persistence/RuntimePersistenceAdapter';

describe('Phase6.1 WorkbenchPersistence', () => {
  it('should restore RUNNING commands as INTERRUPTED', async () => {
    const baseAdapter = new InMemoryRuntimePersistenceAdapter();
    const adapter = new WorkbenchPersistenceAdapter(baseAdapter);

    const dummyData: WorkbenchPersistenceData = {
      session: { status: 'RUNNING' } as any,
      contract: {} as any,
      commandState: {
        'cmd1': 'RUNNING',
        'cmd2': 'COMPLETED'
      },
      diff: null,
      approvalWaitingState: null,
      idempotencyKeys: []
    };

    // Save
    await adapter.saveSession({ ...dummyData, session: { ...dummyData.session, missionId: 'm1', attemptId: 'a1' } });

    // Load
    const loaded = await adapter.loadSession('m1', 'a1');
    expect(loaded).toBeDefined();
    expect(loaded?.commandState['cmd1']).toBe('INTERRUPTED');
    expect(loaded?.commandState['cmd2']).toBe('COMPLETED');
  });

  it('should prevent duplicate command execution', async () => {
    const baseAdapter = new InMemoryRuntimePersistenceAdapter();
    const adapter = new WorkbenchPersistenceAdapter(baseAdapter);

    const isDuplicateFirst = await adapter.preventDuplicateCommandExecution('m1', 'cmd1', 'idem1');
    expect(isDuplicateFirst).toBe(false);

    const isDuplicateSecond = await adapter.preventDuplicateCommandExecution('m1', 'cmd1', 'idem1');
    expect(isDuplicateSecond).toBe(true);
  });
});
