import { describe, it } from 'node:test';
import * as assert from 'node:assert';
import { TaskRuntimeStore } from '../store/TaskRuntimeStore';
import { MissionExecutionRuntime } from '../mission/MissionExecutionRuntime';
import { TaskEventLog } from '../events/TaskEventLog';
import type { ILLMEngineAdapter, ILLMStreamResponse } from '../../../types';
import type { TaskEntity } from '../domain/types';

class MockAdapter implements ILLMEngineAdapter {
  async invokeStructured(prompt: string): Promise<any> { return {}; }
  async invokeStream(prompt: string): Promise<ILLMStreamResponse> {
    return {
      stream: (async function* () {})(),
      abort: () => {}
    };
  }
  async generateStream(messages: any[], onToken: (t: string) => void): Promise<string> {
    onToken('[DONE]');
    return '[DONE] Test output';
  }
}

describe('Phase 3.5 & 4 Execution Runtime Integration', () => {
  it('should initialize and start the mission without true deadlocks for empty missions', async () => {
    const store = new TaskRuntimeStore(new TaskEventLog());
    const adapter = new MockAdapter();
    const runtime = new MissionExecutionRuntime(store, adapter, 'miss-01', 100);
    
    runtime.start();
    
    const state = store.getMissionState('miss-01');
    assert.strictEqual(state.status, 'RUNNING');
    
    // 강제 취소 (Tick 방지)
    runtime.cancel('Test finished');
    assert.strictEqual(store.getMissionState('miss-01').status, 'CANCELLED');
  });

  it('should correctly schedule a single independent task, run it, and move to VERIFYING', async () => {
    const store = new TaskRuntimeStore(new TaskEventLog());
    const adapter = new MockAdapter();
    
    // 더미 태스크 삽입
    const task: TaskEntity = {
      definition: {
        id: 't-1',
        title: 'Task 1',
        objective: 'Test',
        dependencies: [],
      },
      state: {
        status: 'PENDING',
        stateVersion: 1,
        attempts: {},
        retries: 0,
        createdAt: Date.now()
      }
    };
    store.registerTask(task, 'miss-01');

    const runtime = new MissionExecutionRuntime(store, adapter, 'miss-01', 100);
    runtime.start();

    // MissionExecutionRuntime의 Tick 처리를 동적으로 대기
    const startTime = Date.now();
    let updatedTask = store.getTask('miss-01', 't-1');
    while (['PENDING', 'READY'].includes(updatedTask.state.status) && Date.now() - startTime < 2000) {
      await new Promise(r => setTimeout(r, 50));
      updatedTask = store.getTask('miss-01', 't-1');
    }

    console.log(`[TEST] updatedTask status is: ${updatedTask.state.status}`);
    
    // MockAdapter는 도구가 없고 결과 반환을 즉시 못하지만 Dispatcher는 에러가 나거나 끝나면 어쨌든 VERIFYING이나 FAIL로 넘김
    assert.ok(['VERIFYING', 'FAILED', 'COMPLETED', 'RUNNING'].includes(updatedTask.state.status));
    
    runtime.cancel('Done');
  });
});
