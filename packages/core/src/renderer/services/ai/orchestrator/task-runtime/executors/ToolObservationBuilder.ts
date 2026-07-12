/**
 * @file orchestrator/task-runtime/executors/ToolObservationBuilder.ts
 * @system AMEVA OS Desktop Workstation
 * @role Tool 실행 결과를 다음 Reasoning Turn에 주입할 Observation으로 변환
 *
 * [소비처 - CONSUMERS / USAGE CONTEXT]
 * - DeepTaskExecutor: Tool 실행 후 Observation 생성
 *
 * [STAGE D — Tool Runtime 실제 ReAct 연결]
 *
 * [False Success 방지 계약]
 * - Tool 실패 결과를 성공 Observation으로 포장하는 행위 절대 금지
 * - 취소된 Tool 결과를 성공 Observation으로 변환 절대 금지
 * - 원본 전체 오류 Stack은 Observation에 포함하지 않음 (민감 정보 최소화)
 * - 다른 Attempt의 결과를 현재 Observation으로 제공 절대 금지
 */

import type { ToolCallResult } from '../../types';
import type { ToolCallCandidate } from './ToolCallParser';

/**
 * Tool Observation — 다음 Reasoning Turn에 주입되는 구조체.
 */
export interface ToolObservation {
  /** 원본 Tool Call ID */
  toolCallId: string;
  /** Tool 이름 */
  toolName: string;
  /**
   * Observation 상태:
   * - SUCCESS: Tool 정상 실행
   * - FAILED: Tool 실행 실패
   * - TIMED_OUT: Tool Timeout
   * - CANCELLED: Tool 중단
   * - REJECTED: Policy 거부
   * - ERROR: 내부 오류
   */
  status: 'SUCCESS' | 'FAILED' | 'TIMED_OUT' | 'CANCELLED' | 'REJECTED' | 'ERROR';
  /** LLM이 다음 Turn에서 읽을 요약 텍스트 */
  summary: string;
  /** 실제 결과 데이터 (크기 제한 적용, 민감 정보 최소화) */
  output?: string;
  /** 실패 이유 (원본 Stack 제외) */
  failureReason?: string;
  /** 생성 시각 */
  createdAt: number;
}

/*
 * [도메인 종속 지역 상수]
 * Observation output 최대 크기 (LLM Context 보호)
 */
const MAX_OUTPUT_SIZE_CHARS = 8_000;

export class ToolObservationBuilder {
  /**
   * 성공 Tool 결과로부터 Observation을 빌드한다.
   *
   * @param candidate - 원본 Tool Call 후보
   * @param result - ToolRegistry가 반환한 ToolCallResult
   * @returns 다음 Reasoning Turn에 주입할 Observation
   */
  public buildSuccess(candidate: ToolCallCandidate, result: ToolCallResult): ToolObservation {
    /*
     * [False Success 방지] result.success가 false이면 절대 SUCCESS로 포장하지 않는다.
     * ToolCallResult.success는 ToolRegistry에서 Tool 내부 오류 시 false로 설정됨.
     */
    if (!result.success) {
      return this.buildFailure(candidate, result.error ?? 'Unknown tool error', 'FAILED');
    }

    const rawOutput = result.result ?? '(결과 없음)';

    // 크기 제한 적용 (LLM Context 보호)
    const truncatedOutput = rawOutput.length > MAX_OUTPUT_SIZE_CHARS
      ? rawOutput.slice(0, MAX_OUTPUT_SIZE_CHARS) + `\n[... 출력 크기 초과로 ${rawOutput.length - MAX_OUTPUT_SIZE_CHARS}자 잘림]`
      : rawOutput;

    return {
      toolCallId: candidate.toolCallId,
      toolName: candidate.toolName,
      status: 'SUCCESS',
      summary: `Tool '${candidate.toolName}' 실행 성공.`,
      output: truncatedOutput,
      createdAt: Date.now()
    };
  }


  /**
   * Tool 실패 결과로부터 Observation을 빌드한다.
   * 성공 Observation으로 포장하지 않는다.
   *
   * @param candidate - 원본 Tool Call 후보
   * @param reason - 실패 이유 (원본 Stack 제외)
   * @param status - 실패 상태 (FAILED | TIMED_OUT | CANCELLED | REJECTED | ERROR)
   */
  public buildFailure(
    candidate: ToolCallCandidate,
    reason: string,
    status: 'FAILED' | 'TIMED_OUT' | 'CANCELLED' | 'REJECTED' | 'ERROR'
  ): ToolObservation {
    return {
      toolCallId: candidate.toolCallId,
      toolName: candidate.toolName,
      status,
      summary: `Tool '${candidate.toolName}' 실행 실패 (${status}): ${reason.slice(0, 200)}`,
      failureReason: reason.slice(0, 500), // Stack은 잘림
      createdAt: Date.now()
    };
  }

  /**
   * Policy 거부 Observation을 빌드한다.
   *
   * @param candidate - 원본 Tool Call 후보
   * @param policyReason - 거부 이유
   */
  public buildRejected(candidate: ToolCallCandidate, policyReason: string): ToolObservation {
    return {
      toolCallId: candidate.toolCallId,
      toolName: candidate.toolName,
      status: 'REJECTED',
      summary: `Tool '${candidate.toolName}' 실행 정책 거부: ${policyReason}`,
      failureReason: policyReason,
      createdAt: Date.now()
    };
  }

  /**
   * Observation을 LLM Context에 주입할 문자열로 변환한다.
   * 다음 Reasoning Turn의 user 또는 tool 메시지로 사용된다.
   */
  public toContextMessage(observation: ToolObservation): string {
    const lines: string[] = [
      `[Tool Observation]`,
      `Tool: ${observation.toolName}`,
      `Status: ${observation.status}`,
      `Summary: ${observation.summary}`
    ];

    if (observation.output) {
      lines.push(`Output:\n${observation.output}`);
    }
    if (observation.failureReason) {
      lines.push(`Failure: ${observation.failureReason}`);
    }

    return lines.join('\n');
  }
}
