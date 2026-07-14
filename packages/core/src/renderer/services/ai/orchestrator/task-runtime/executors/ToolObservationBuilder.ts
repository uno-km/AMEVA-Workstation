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
import { SecretRedactor } from '../trace/SecretRedactor';

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
  /** 핵심 발견 사항 */
  keyFindings?: string[];
  /** 종료 코드 */
  exitCode?: number;
  /** 소요 시간 (ms) */
  durationMs?: number;
  /** 표준 출력 프리뷰 */
  stdoutPreview?: string;
  /** 표준 에러 프리뷰 */
  stderrPreview?: string;
  /** 출력 잘림 여부 */
  outputTruncated?: boolean;
  /** 원본 출력 크기 */
  originalOutputSize?: number;
  /** 영향 받은 파일 경로 */
  affectedPaths?: string[];
  /** 생성된 Artifact 목록 */
  createdArtifacts?: string[];
  /** 수정된 Artifact 목록 */
  updatedArtifacts?: string[];
  /** 감지된 오류 목록 */
  detectedErrors?: string[];
  /** 제안되는 다음 행동 */
  suggestedNextActions?: Array<{ actionType: string; description: string; targetId?: string }>;
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
const MAX_PREVIEW_CHARS = 1_000;

export class ToolObservationBuilder {
  /**
   * ANSI 이스케이프 코드 및 제어 문자를 제거하고 Secret Redaction을 적용한다.
   */
  private cleanText(str?: string | null): string {
    if (!str || typeof str !== 'string') return '';
    const stripped = str
      .replace(/\x1B\[[0-?]*[ -/]*[@-~]/g, '')
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
    return SecretRedactor.redactText(stripped);
  }

  /**
   * 성공 Tool 결과로부터 Observation을 빌드한다.
   *
   * @param candidate - 원본 Tool Call 후보
   * @param result - ToolRegistry가 반환한 ToolCallResult
   * @param extra - 추가 실행 메타데이터 (durationMs, affectedPaths 등)
   * @returns 다음 Reasoning Turn에 주입할 Observation
   */
  public buildSuccess(
    candidate: ToolCallCandidate,
    result: ToolCallResult,
    extra?: {
      durationMs?: number;
      exitCode?: number;
      affectedPaths?: string[];
      createdArtifacts?: string[];
      updatedArtifacts?: string[];
      keyFindings?: string[];
      suggestedNextActions?: Array<{ actionType: string; description: string; targetId?: string }>;
    }
  ): ToolObservation {
    /*
     * [False Success 방지] result.success가 false이면 절대 SUCCESS로 포장하지 않는다.
     * ToolCallResult.success는 ToolRegistry에서 Tool 내부 오류 시 false로 설정됨.
     */
    if (!result.success) {
      return this.buildFailure(candidate, result.error ?? 'Unknown tool error', 'FAILED', extra);
    }

    const rawOutput = this.cleanText(result.result ?? '(결과 없음)');
    const originalOutputSize = rawOutput.length;
    const outputTruncated = originalOutputSize > MAX_OUTPUT_SIZE_CHARS;

    // 크기 제한 적용 (LLM Context 보호)
    const truncatedOutput = outputTruncated
      ? rawOutput.slice(0, MAX_OUTPUT_SIZE_CHARS) + `\n[... 출력 크기 초과로 ${originalOutputSize - MAX_OUTPUT_SIZE_CHARS}자 잘림]`
      : rawOutput;

    const stdoutPreview = rawOutput.slice(0, MAX_PREVIEW_CHARS);

    return {
      toolCallId: candidate.toolCallId,
      toolName: candidate.toolName,
      status: 'SUCCESS',
      summary: `Tool '${candidate.toolName}' 실행 성공.`,
      output: truncatedOutput,
      stdoutPreview,
      outputTruncated,
      originalOutputSize,
      durationMs: extra?.durationMs,
      exitCode: extra?.exitCode ?? 0,
      affectedPaths: extra?.affectedPaths ?? [],
      createdArtifacts: extra?.createdArtifacts ?? [],
      updatedArtifacts: extra?.updatedArtifacts ?? [],
      keyFindings: extra?.keyFindings,
      suggestedNextActions: extra?.suggestedNextActions,
      createdAt: Date.now()
    };
  }

  /**
   * Tool 실패 결과로부터 Observation을 빌드한다.
   * 성공 Observation으로 포장하지 않는다.
   */
  public buildFailure(
    candidate: ToolCallCandidate,
    reason: string,
    status: 'FAILED' | 'TIMED_OUT' | 'CANCELLED' | 'REJECTED' | 'ERROR',
    extra?: {
      durationMs?: number;
      exitCode?: number;
      affectedPaths?: string[];
      stderrPreview?: string;
    }
  ): ToolObservation {
    const cleanedReason = this.cleanText(reason);
    const shortSummary = cleanedReason.slice(0, 200);
    const failureReason = cleanedReason.slice(0, 500); // Stack은 잘림

    return {
      toolCallId: candidate.toolCallId,
      toolName: candidate.toolName,
      status,
      summary: `Tool '${candidate.toolName}' 실행 실패 (${status}): ${shortSummary}`,
      failureReason,
      stderrPreview: extra?.stderrPreview ? this.cleanText(extra.stderrPreview).slice(0, MAX_PREVIEW_CHARS) : failureReason,
      durationMs: extra?.durationMs,
      exitCode: extra?.exitCode ?? 1,
      affectedPaths: extra?.affectedPaths ?? [],
      detectedErrors: [shortSummary],
      createdAt: Date.now()
    };
  }

  /**
   * Policy 거부 Observation을 빌드한다.
   */
  public buildRejected(candidate: ToolCallCandidate, policyReason: string): ToolObservation {
    const cleanedReason = this.cleanText(policyReason);
    return {
      toolCallId: candidate.toolCallId,
      toolName: candidate.toolName,
      status: 'REJECTED',
      summary: `Tool '${candidate.toolName}' 실행 정책 거부: ${cleanedReason}`,
      failureReason: cleanedReason,
      exitCode: -1,
      detectedErrors: [cleanedReason],
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

    if (observation.exitCode !== undefined) {
      lines.push(`ExitCode: ${observation.exitCode}`);
    }
    if (observation.durationMs !== undefined) {
      lines.push(`Duration: ${observation.durationMs}ms`);
    }
    if (observation.output) {
      lines.push(`Output:\n${observation.output}`);
    }
    if (observation.failureReason) {
      lines.push(`Failure: ${observation.failureReason}`);
    }
    if (observation.detectedErrors && observation.detectedErrors.length > 0) {
      lines.push(`DetectedErrors: ${observation.detectedErrors.join('; ')}`);
    }

    return lines.join('\n');
  }
}
