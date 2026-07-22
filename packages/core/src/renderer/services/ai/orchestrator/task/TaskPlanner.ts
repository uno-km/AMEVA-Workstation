/**
 * @file orchestrator/task/TaskPlanner.ts
 * @system AMEVA OS Desktop Workstation
 * @location src/renderer/services/ai/orchestrator/task/TaskPlanner.ts
 * @role 사용자의 전체 목표(Goal)를 분석하여 DAG 형식의 실행 가능한 Task 목록을 구성하는 기획자
 *
 * [소비처 - CONSUMERS / USAGE CONTEXT]
 * - AgentOrchestrator.ts: 세션 시작 시 사용자 입력을 가로채 plan()을 가동해 초기 Task[] 구성.
 */

import type { ILLMEngineAdapter } from '../types';
import type { Task, TaskStatus } from './types';

/**
 * TaskPlanner
 * 사용자의 자연어 목표를 받아서 세부 행동 단계와 의존 관계가 정의된
 * 태스크 리스트를 LLM을 활용해 자율 분해 및 출력 파싱하는 계획기.
 */
export class TaskPlanner {
  private readonly llmAdapter: ILLMEngineAdapter;

  /**
   * 생성자
   *
   * @param llmAdapter - 오케스트레이터 세션이 사용하는 통일된 LLM 어댑터
   */
  constructor(llmAdapter: ILLMEngineAdapter) {
    this.llmAdapter = llmAdapter;
  }

  /**
   * 사용자의 최종 Goal을 분석하여 Task 리스트를 빌드합니다.
   *
   * [ADR - Real-time Token Propagation]
   * - Rationale: 로컬 모델 구동 시 계획 수립에 수십 초 이상이 소요될 수 있으므로,
   *   실시간 생성 토큰을 onToken 콜백으로 중계하여 UI 상의 멈춤 현상(Stall) 및 감시견의 정체 판단 오작동을 차단한다.
   *
   * @param goal - 사용자의 목표 텍스트 (예: '치즈 산업 보고서 작성')
   * @param onToken - 실시간 토큰 수신 콜백 (선택적)
   * @returns 파싱 완료된 Task 배열 (오류 시 안전한 폴백 목록 반환)
   */
  public async plan(goal: string, onToken?: (token: string) => void): Promise<Task[]> {
    console.info(`[TaskPlanner] 태스크 계획 수립 시작: "${goal}"`);

    const systemPrompt = `당신은 AMEVA OS의 Task Planning Architect입니다.
사용자의 최종 목표(Goal)를 분석하여, 실행 가능하고 서로 의존 관계를 가진 5~8개의 명시적인 세부 태스크(Task) 목록으로 분해하십시오.
답변은 반드시 아래 명시된 JSON 배열 포맷만 출력해야 하며, 어떠한 설명, 인사말, 마크다운 외곽 장식도 붙이지 마십시오.

[JSON 출력 포맷 규격]
[
  {
    "id": "task-1",
    "title": "태스크 제목",
    "objective": "구체적인 작업 목표 설명",
    "dependencies": [], // 선행되어야 하는 태스크의 id 목록 (의존성이 없으면 빈 배열)
    "priority": 1, // 우선순위 정수 (1: 기본, 2: 높음, 3: 긴급)
    "expectedOutput": "완료 검정을 위해 생성되어야 하는 구체적 산출물 설명 (예: 'cheese_report.md 파일 생성')"
  }
]

[규칙]
1. 순환 의존성(예: task-1 -> task-2 -> task-1)이 발생하지 않도록 의존성을 철저히 설계하십시오.
2. 각 태스크의 expectedOutput은 실질적으로 검증이 가능한 정량적/물리적인 내용이어야 합니다.
3. 절대 JSON 이외의 임의 잡설을 출력물에 섞지 마십시오.`;

    const userMessage = `최종 목표: "${goal}"
위 목표를 달성하기 위한 DAG 태스크 목록을 JSON으로 출력하십시오.`;

    const messages = [
      { role: 'system' as const, content: systemPrompt },
      { role: 'user' as const, content: userMessage }
    ];

    try {
      // 실시간 토큰 콜백 연결로 UI 및 감시경 락 타임아웃 갱신
      const rawOutput = await this.llmAdapter.generateStream(messages, (token) => {
        if (onToken) {
          onToken(token);
        }
      });
      console.debug(`[TaskPlanner] LLM 원본 계획 데이터:\n`, rawOutput);

      return this.parsePlanOutput(rawOutput, goal);
    } catch (err: unknown) {
      console.error(`[TaskPlanner] LLM 추론 실패로 인한 폴백 목록 발동:`, err);
      return this.buildFallbackPlan(goal);
    }
  }

  /**
   * LLM 문자열 출력물 내에서 JSON 세그먼트를 추출하고 역직렬화합니다.
   */
  private parsePlanOutput(output: string, originalGoal: string = ''): Task[] {
    const cleanText = output.trim();
    
    // 마크다운 JSON 블록 감지 및 추출
    let jsonStr = cleanText;
    const blockMatch = cleanText.match(/```(?:json)?([\s\S]*?)```/i);
    if (blockMatch && blockMatch[1]) {
      jsonStr = blockMatch[1].trim();
    } else {
      const firstBracket = cleanText.indexOf('[');
      const lastBracket = cleanText.lastIndexOf(']');
      if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
        jsonStr = cleanText.substring(firstBracket, lastBracket + 1).trim();
      }
    }

    try {
      const rawList = JSON.parse(jsonStr);
      if (!Array.isArray(rawList)) {
        throw new Error('파싱된 결과가 배열이 아닙니다.');
      }

      const tasks: Task[] = rawList.map((item: any, idx: number) => {
        const id = String(item.id || `task-${idx + 1}`);
        const title = String(item.title || `작업 단계 ${idx + 1}`);
        const objective = String(item.objective || title);
        const dependencies = Array.isArray(item.dependencies) ? item.dependencies.map(String) : [];
        const priority = typeof item.priority === 'number' ? item.priority : 1;
        const expectedOutput = String(item.expectedOutput || '산출물 확인');

        return {
          id,
          title,
          objective,
          dependencies,
          priority,
          status: 'PENDING' as TaskStatus,
          expectedOutput,
          retries: 0,
          maxRetries: 3,
          required: true,
          createdAt: Date.now()
        };
      });

      if (tasks.length === 0) {
        throw new Error('배열이 비어 있습니다.');
      }

      return tasks;
    } catch (err: unknown) {
      console.warn(`[TaskPlanner] JSON 파싱 오류. fallback 리스트 가동. 원인:`, err);
      const fallbackGoal = originalGoal.trim() || jsonStr.trim() || '목표 작업';
      return this.buildFallbackPlan(fallbackGoal);
    }
  }

  /**
   * 플래닝 오류 또는 네트워크/추론 에러 발생 시 발동하는 복구용 폴백 플랜 빌더.
   */
  private buildFallbackPlan(goal: string): Task[] {
    console.warn(`[TaskPlanner] "${goal}"에 대한 폴백 3단계 태스크 목록 구성.`);
    return [
      {
        id: 'task-1',
        title: '대상 기초 조사 및 자료 탐색',
        objective: `${goal} 관련 핵심 데이터와 내용을 내부 지식 및 가용 도구(write_file 등)를 활용하여 탐색하고 기초 조사 문서를 마크다운으로 작성합니다.`,
        dependencies: [],
        priority: 2,
        status: 'PENDING',
        expectedOutput: '기초 데이터 수집 완료 및 요약문 확보',
        retries: 0,
        maxRetries: 3,
        required: true,
        createdAt: Date.now()
      },
      {
        id: 'task-2',
        title: '수집 자료 분석 및 초안 기획',
        objective: '확보된 기초 조사 결과를 바탕으로 본문 내용 초안을 마크다운 포맷으로 작성합니다.',
        dependencies: ['task-1'],
        priority: 1,
        status: 'PENDING',
        expectedOutput: '마크다운 분석 결과 초안 작성 완료',
        retries: 0,
        maxRetries: 3,
        required: true,
        createdAt: Date.now()
      },
      {
        id: 'task-3',
        title: '최종 보고서 편집 및 검토',
        objective: '초안 문서의 문장 오류, 데이터 출처, 충족 여부를 확인해 최종 문안으로 완결합니다.',
        dependencies: ['task-2'],
        priority: 3,
        status: 'PENDING',
        expectedOutput: '최종 보고서 검토 및 Mission 완수',
        retries: 0,
        maxRetries: 3,
        required: true,
        createdAt: Date.now()
      }
    ];
  }
}
