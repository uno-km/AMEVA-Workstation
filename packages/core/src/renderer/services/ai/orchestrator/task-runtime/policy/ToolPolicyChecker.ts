/**
 * @file orchestrator/task-runtime/policy/ToolPolicyChecker.ts
 * @system AMEVA OS Desktop Workstation
 * @role Shadow Mode Tool 실행 차단 정책 집행자
 *
 * [소비처 - CONSUMERS / USAGE CONTEXT]
 * - DeepTaskExecutor: Tool Call 실행 직전에 체크하여 금지된 Tool을 차단
 * - ToolRegistry.executeTool 호출 전에 반드시 ToolPolicyChecker.assertAllowed() 호출
 *
 * [Item 6 — Shadow Mode Tool 차단]
 *
 * [설계 원칙]
 * - Shadow Mode (V2_SHADOW)에서는 외부 상태를 변경하는 Tool의 실행을 전면 차단한다.
 * - ReadOnly Tool (read_file, list_dir, run_command의 읽기 전용 명령 등)은 Shadow Mode에서도 허용.
 * - WriteMutating Tool (write_file, run_command의 실행 명령 등)은 Shadow Mode에서 차단.
 * - 차단 정책은 Tool Name 기반으로 분류한다.
 * - 정책은 Allow-List 방식이 아닌 Deny-List 방식: 화이트리스트에 없으면 허용.
 *   단, Shadow Mode에서는 명시적 ALLOWED 목록만 허용 (화이트리스트).
 *
 * [Shadow Mode Tool 허용 정책]
 * Shadow Mode에서 허용되는 Tool:
 * - read_file: 파일 읽기 (읽기 전용)
 * - list_dir: 디렉토리 목록 (읽기 전용)
 *
 * Shadow Mode에서 차단되는 Tool:
 * - write_file: 파일 쓰기 (외부 상태 변경)
 * - run_command: 쉘 명령 실행 (외부 상태 변경 가능)
 * - 그 외 MCP 등록 Tool: 기본 차단 (UNKNOWN_BLOCKED)
 *
 * [AGENTS.md 3단계 상수화]
 * Tool 분류 상수는 이 파일에 도메인 종속 지역 상수로 정의한다.
 */

import { V2RuntimeFeatureFlag } from '../domain/V2RuntimeFeatureFlag';

/**
 * Shadow Mode에서 허용되는 기본 내장 Tool 이름 목록 (읽기 전용).
 * 화이트리스트: 이 목록에 없는 Tool은 Shadow Mode에서 차단된다.
 */
const SHADOW_MODE_ALLOWED_TOOLS = new Set([
  'read_file',
  'list_dir'
]);

/**
 * Tool 정책 위반 분류.
 */
export type ToolPolicyViolationType =
  | 'SHADOW_MODE_BLOCKED'    // Shadow Mode에서 실행 불가 Tool
  | 'UNKNOWN_TOOL_BLOCKED'   // 등록되지 않은 Tool
  | 'FORBIDDEN_IN_MODE';     // 현재 모드에서 금지된 Tool

/**
 * ToolPolicyChecker.assertAllowed() 실패 시 발생하는 예외.
 */
export class ToolPolicyViolationError extends Error {
  public readonly violationType: ToolPolicyViolationType;
  public readonly toolName: string;

  constructor(toolName: string, violationType: ToolPolicyViolationType, message: string) {
    super(message);
    this.name = 'ToolPolicyViolationError';
    this.violationType = violationType;
    this.toolName = toolName;
  }
}

/**
 * ToolPolicyChecker
 */
export class ToolPolicyChecker {
  /**
   * 주어진 Tool을 현재 실행 모드에서 실행할 수 있는지 확인한다.
   * 허용되면 아무것도 하지 않는다. 차단되면 ToolPolicyViolationError를 발생시킨다.
   *
   * @param toolName - 실행하려는 Tool 이름
   * @param knownToolNames - 현재 등록된 Tool 이름 집합
   * @throws ToolPolicyViolationError - 정책 위반 시
   */
  public static assertAllowed(toolName: string, knownToolNames: Set<string>): void {
    // 등록되지 않은 Tool 차단
    if (knownToolNames.size > 0 && !knownToolNames.has(toolName)) {
      throw new ToolPolicyViolationError(
        toolName,
        'UNKNOWN_TOOL_BLOCKED',
        `Tool '${toolName}' is not registered in the Tool Registry.`
      );
    }

    /*
     * [Shadow Mode 차단]
     * V2_SHADOW 모드에서는 SHADOW_MODE_ALLOWED_TOOLS에 없는 모든 Tool을 차단한다.
     * 이는 Shadow Mode가 "관찰 전용" 모드이기 때문에 외부 상태 변경을 허용하지 않는다.
     */
    if (V2RuntimeFeatureFlag.isShadowMode()) {
      if (!SHADOW_MODE_ALLOWED_TOOLS.has(toolName)) {
        throw new ToolPolicyViolationError(
          toolName,
          'SHADOW_MODE_BLOCKED',
          `Tool '${toolName}' is blocked in Shadow Mode. Only read-only tools are allowed: [${[...SHADOW_MODE_ALLOWED_TOOLS].join(', ')}].`
        );
      }
    }
  }

  /**
   * Tool이 Shadow Mode에서 허용되는지 조회한다 (예외 없는 버전).
   * UI 표시 목적으로 사용.
   */
  public static isAllowedInShadowMode(toolName: string): boolean {
    return SHADOW_MODE_ALLOWED_TOOLS.has(toolName);
  }

  /**
   * 현재 Shadow Mode에서 허용되는 Tool 목록을 반환한다.
   */
  public static getShadowModeAllowedTools(): ReadonlySet<string> {
    return SHADOW_MODE_ALLOWED_TOOLS;
  }
}
