/**
 * @file orchestrator/task-runtime/executors/TaskExecutionContextBuilder.ts
 * @system AMEVA OS Desktop Workstation
 * @role 실행할 태스크의 LLM 프롬프트에 제공할 컨텍스트(선행 결과, 시스템 정보 등)를 조립합니다.
 */

import { TaskRuntimeStore } from '../store/TaskRuntimeStore';
import type { TaskEntity } from '../domain/types';

export class TaskExecutionContextBuilder {
  constructor(private store: TaskRuntimeStore) {}

  /**
   * 해당 Task의 실행을 위한 LLM 프롬프트(시스템/유저 메시지)를 생성합니다.
   * PHASE 3 원칙: 전체 Thought 로그가 아닌, PASS 받은 선행 결과(Summary 및 Output)만 주입합니다.
   */
  public buildContextMessages(missionId: string, task: TaskEntity): Array<{ role: 'system' | 'user' | 'assistant', content: string }> {
    const messages: Array<{ role: 'system' | 'user' | 'assistant', content: string }> = [];

    // 1. System Prompt (역할 및 제약사항)
    messages.push({
      role: 'system',
      content: `You are an Autonomous Task Executor.
Your task is to achieve the following objective: "${task.definition.objective}"
Expected Outputs: ${task.definition.expectedOutputs?.join(', ') || 'None'}
Acceptance Criteria: ${task.definition.acceptanceCriteria?.join(', ') || 'None'}

You can use available tools. If you have achieved the goal, output [DONE] at the end of your message.`
    });

    // 2. 선행 태스크(Dependencies) 결과 수집
    const deps = task.definition.dependencies || [];
    let depContext = '';
    
    for (const depId of deps) {
      try {
        const depTask = this.store.getTask(missionId, depId);
        if (depTask.state.status === 'COMPLETED' && depTask.state.taskResult) {
          const result = depTask.state.taskResult;
          depContext += `\n[Dependency: ${depTask.definition.title}]\n`;
          depContext += `Summary: ${result.summary}\n`;
          
          if (result.outputs && result.outputs.length > 0) {
            depContext += `Outputs:\n`;
            for (const out of result.outputs) {
              depContext += `- Type: ${out.type}, Content: ${typeof out.content === 'object' ? JSON.stringify(out.content) : out.content}\n`;
            }
          }
        }
      } catch (e) {
        console.warn(`[TaskExecutionContextBuilder] Failed to get dependency ${depId} context.`);
      }
    }

    if (depContext) {
      messages.push({
        role: 'user',
        content: `Previous Context (Verified Results):\n${depContext}`
      });
    }

    // 3. User Prompt (Task 시작 알림)
    messages.push({
      role: 'user',
      content: 'Begin your execution. Use tools if necessary, or provide the final text output if you can achieve the goal directly.'
    });

    return messages;
  }
}
