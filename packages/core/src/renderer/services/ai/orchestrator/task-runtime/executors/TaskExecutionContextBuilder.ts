/**
 * @file orchestrator/task-runtime/executors/TaskExecutionContextBuilder.ts
 * @system AMEVA OS Desktop Workstation
 * @role 실행할 태스크의 LLM 프롬프트에 제공할 컨텍스트(선행 결과, 시스템 정보 등)를 조립합니다.
 */

import { TaskRuntimeStore } from '../store/TaskRuntimeStore';
import type { TaskEntity } from '../domain/types';
import type { ToolRegistry } from '../../ToolRegistry';

export class TaskExecutionContextBuilder {
  private store: TaskRuntimeStore;
  constructor(store: TaskRuntimeStore) {
    this.store = store;
  }

  /**
   * 해당 Task의 실행을 위한 LLM 프롬프트(시스템/유저 메시지)를 생성합니다.
   * PHASE 3 원칙: 전체 Thought 로그가 아닌, PASS 받은 선행 결과(Summary 및 Output)만 주입합니다.
   */
  public buildContextMessages(missionId: string, task: TaskEntity, registry?: ToolRegistry): Array<{ role: 'system' | 'user' | 'assistant', content: string }> {
    const messages: Array<{ role: 'system' | 'user' | 'assistant', content: string }> = [];

    const toolList = registry ? registry.serializeForPrompt() : '';

    // 1. System Prompt (역할 및 제약사항)
    messages.push({
      role: 'system',
      content: `당신은 AMEVA OS의 자율 태스크 실행 에이전트입니다.
현재 수행해야 할 태스크 목표: "${task.definition.objective}"
기대 산출물: ${task.definition.expectedOutputs?.join(', ') || 'None'}
검수 통과 조건: ${task.definition.acceptanceCriteria?.join(', ') || 'None'}

${toolList}

## 필수 출력 및 도구 호출 규칙 (반드시 준수)
1. 도구를 호출할 때는 반드시 아래의 XML/JSON 태그 형식을 사용하여 호출하세요.

[도구 호출 모범 예시]
<thought>
현재 부여된 태스크 목표와 요구사항을 바탕으로 write_file 도구를 호출하여 마크다운 파일로 저장합니다.
</thought>
<tool_call>
{"name": "write_file", "args": {"path": "산출물.md", "content": "# [요청받은 주제/태스크 제목]\\n\\n1. 개요\\n본 문서에서는 부여된 태스크 요구사항에 맞춰 풍부하고 정교한 본문을 구성합니다..."}}
</tool_call>

2. 파일 작성('write_file') 시, 보고서나 글 작성 목표라면 반드시 내용('content')을 풍부하고 완결성 있게 작성해야 합니다.
3. 모든 작업(도구 실행 등)이 완료되어 태스크 목표를 완전히 달성했고 최종 보고서/산출물이 준비되었을 때만 아래 포맷으로 최종 답변을 제출하세요:
Final Answer: [완료된 보고서 요약 및 작성 결과물 설명]
[DONE]`
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

    // 3. 이전 실패에 대한 Feedback Injection (Phase 3 Partial Repair 대응)
    if (task.state.previousFailures && task.state.previousFailures.length > 0) {
      const lastFailure = task.state.previousFailures[task.state.previousFailures.length - 1];
      let feedback = `The previous execution failed verification. You are now in a RETRY/REPAIR attempt.\n`;
      feedback += `Failure Reason: ${lastFailure.message}\n`;
      
      if (lastFailure.defectSignatures && lastFailure.defectSignatures.length > 0) {
        feedback += `Defects to fix:\n${lastFailure.defectSignatures.map(d => `- ${d}`).join('\n')}\n`;
        feedback += `\nCRITICAL RULE: DO NOT regenerate the entire artifact if only a SECTION or FIELD is defective. Only repair the defective parts mentioned. Use tools to append or edit if possible, rather than overwriting the entire artifact.`;
      }
      
      messages.push({
        role: 'user',
        content: feedback
      });
    } else {
      // 4. User Prompt (Task 시작 알림) - 첫 실행일 경우
      messages.push({
        role: 'user',
        content: 'Begin your execution. Use tools if necessary, or provide the final text output if you can achieve the goal directly.'
      });
    }

    return messages;
  }
}
