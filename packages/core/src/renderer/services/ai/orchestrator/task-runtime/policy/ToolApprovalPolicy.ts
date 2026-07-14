/**
 * @file orchestrator/task-runtime/policy/ToolApprovalPolicy.ts
 * @system AMEVA OS Desktop Workstation
 * @role Tool 위험도(Risk Level) 분류 및 사용자 승인(Approval Policy) 체크/관리
 *
 * [소비처 - CONSUMERS / USAGE CONTEXT]
 * - DeepTaskExecutor: Tool 실행 직전에 위험도 평가 및 승인 여부 검사
 * - ExecutionTraceManager: Tool 선택/승인 TraceEvent 생성 시 위험도 판단
 * - ExecutionTraceViewModel: 승인 대기 카드 표시
 *
 * [Risk & Approval Policy 계약 - Phase 4]
 * - LOW: Workspace 내 read/list/status/static check → 자동 허용
 * - MEDIUM: Staging 파일 생성, apply_patch, build/test 실행 → 설정에 따라 자동/승인
 * - HIGH: 파일 삭제, Final 교체, 패키지 설치, 외부 네트워크 요청, 호스트 명령 요청 → 기본 사용자 승인 필요
 * - CRITICAL: 대량 삭제, Credential 변경, 시스템 권한 변경, 임의 Shell → 강한 승인 또는 차단
 */

import type { ToolRiskLevel, ApprovalStatus, ApprovalRequest } from '../trace/ExecutionTraceTypes';
import { SecretRedactor } from '../trace/SecretRedactor';

/**
 * 도메인 종속 지역 상수 (기본 Tool 위험도 맵핑)
 */
const LOW_RISK_TOOLS = new Set([
  'read_file',
  'list_dir',
  'sys_read_file',
  'sys_vfs_list',
  'view_file',
  'grep_search',
  'get_status'
]);

const MEDIUM_RISK_TOOLS = new Set([
  'write_file',
  'apply_patch',
  'run_test',
  'build',
  'stage_artifact'
]);

const HIGH_RISK_TOOLS = new Set([
  'delete_file',
  'sys_delete_file',
  'replace_final',
  'npm_install',
  'fetch_url',
  'sys_request_host',
  'run_command'
]);

const CRITICAL_RISK_TOOLS = new Set([
  'sys_format_vfs',
  'sudo',
  'format_disk',
  'change_permissions'
]);

/**
 * 승인 위반 또는 거부 시 발생하는 에러
 */
export class ToolApprovalViolationError extends Error {
  public readonly toolName: string;
  public readonly riskLevel: ToolRiskLevel;
  public readonly approvalStatus: ApprovalStatus;

  constructor(toolName: string, riskLevel: ToolRiskLevel, approvalStatus: ApprovalStatus, message: string) {
    super(message);
    this.name = 'ToolApprovalViolationError';
    this.toolName = toolName;
    this.riskLevel = riskLevel;
    this.approvalStatus = approvalStatus;
  }
}

export class ToolApprovalPolicy {
  private static approvals: Map<string, ApprovalRequest> = new Map();
  private static processedIdempotencyKeys: Set<string> = new Set();

  private static testRiskClassifier?: (
    toolName: string,
    args?: Record<string, any>,
    definition?: any
  ) => { riskLevel: ToolRiskLevel; approvalRequired: boolean; reason: string } | null;

  /**
   * 테스트 전용 Custom Risk Classifier 주입
   */
  public static injectTestRiskClassifier(
    classifier?: (
      toolName: string,
      args?: Record<string, any>,
      definition?: any
    ) => { riskLevel: ToolRiskLevel; approvalRequired: boolean; reason: string } | null
  ): void {
    this.testRiskClassifier = classifier;
  }

  /**
   * Tool 및 인자를 기반으로 위험도(Risk Level)를 평가한다.
   */
  public static evaluateRisk(
    toolName: string,
    args?: Record<string, any>,
    definition?: any
  ): { riskLevel: ToolRiskLevel; approvalRequired: boolean; reason: string } {
    // 1. TestRiskClassifier가 주입된 경우 우선 평가 (테스트 환경 전용)
    if (this.testRiskClassifier) {
      const custom = this.testRiskClassifier(toolName, args, definition);
      if (custom) {
        if (typeof custom === 'string') {
          return {
            riskLevel: custom as ToolRiskLevel,
            approvalRequired: custom === 'HIGH' || custom === 'CRITICAL',
            reason: `Risk evaluated from injected test classifier (${custom}).`
          };
        }
        return custom;
      }
    }

    // 2. Definition에 명시된 고정 riskLevel 또는 capability metadata 확인
    if (definition?.riskLevel) {
      const riskLevel: ToolRiskLevel = definition.riskLevel;
      const approvalRequired = definition.approvalRequired ?? (riskLevel === 'HIGH' || riskLevel === 'CRITICAL');
      return {
        riskLevel,
        approvalRequired,
        reason: `Risk evaluated from ToolDefinition metadata (${riskLevel}).`
      };
    }

    if (CRITICAL_RISK_TOOLS.has(toolName)) {
      return {
        riskLevel: 'CRITICAL',
        approvalRequired: true,
        reason: `Tool '${toolName}' is classified as CRITICAL risk (System modification/mass deletion).`
      };
    }

    if (HIGH_RISK_TOOLS.has(toolName)) {
      return {
        riskLevel: 'HIGH',
        approvalRequired: true,
        reason: `Tool '${toolName}' is classified as HIGH risk (External network/host command/file deletion).`
      };
    }

    if (MEDIUM_RISK_TOOLS.has(toolName)) {
      // 만약 args에 workspace 외부 경로나 민감 조작이 있다면 HIGH로 격상 가능
      return {
        riskLevel: 'MEDIUM',
        approvalRequired: false, // 기본 정책상 MEDIUM은 Staging 단계이므로 자동 진행 허용 (필요시 커스텀 가능)
        reason: `Tool '${toolName}' is classified as MEDIUM risk (Staging workspace modification).`
      };
    }

    if (LOW_RISK_TOOLS.has(toolName)) {
      return {
        riskLevel: 'LOW',
        approvalRequired: false,
        reason: `Tool '${toolName}' is classified as LOW risk (Read-only/status query).`
      };
    }

    // 알 수 없는 Tool은 안전을 위해 HIGH로 분류하고 승인을 요구한다.
    return {
      riskLevel: 'HIGH',
      approvalRequired: true,
      reason: `Tool '${toolName}' is not recognized in default risk profiles. Defaulting to HIGH risk.`
    };
  }

  /**
   * 승인 요청을 생성하고 메모리에 등록한다.
   */
  public static createApprovalRequest(
    traceId: string,
    missionId: string,
    taskId: string,
    toolCallId: string,
    toolName: string,
    riskLevel: ToolRiskLevel,
    args: Record<string, any>,
    affectedResources: string[],
    reason: string
  ): ApprovalRequest {
    const approvalId = `appr-${crypto.randomUUID()}`;
    const { redactedArguments } = SecretRedactor.redactArguments(args);

    const req: ApprovalRequest = {
      approvalId,
      traceId,
      missionId,
      taskId,
      toolCallId,
      toolName,
      reason,
      riskLevel,
      normalizedArguments: redactedArguments,
      affectedResources,
      requestedAt: Date.now(),
      expiresAt: Date.now() + 24 * 60 * 60 * 1000, // 24시간 만료
      status: 'PENDING',
      idempotencyKey: `idemp-appr-${traceId}-${toolCallId}`
    };

    ToolApprovalPolicy.approvals.set(approvalId, req);
    return req;
  }

  /**
   * 승인 상태를 조회한다.
   */
  public static getApprovalRequest(approvalId: string): ApprovalRequest | undefined {
    return ToolApprovalPolicy.approvals.get(approvalId);
  }

  /**
   * 승인 응답을 처리한다 (사용자 승인/거절).
   * 중복 클릭/재전송 방지를 위해 idempotencyKey를 검증한다.
   */
  public static resolveApproval(
    approvalId: string,
    status: 'APPROVED' | 'REJECTED' | 'CANCELLED',
    idempotencyKey?: string
  ): ApprovalRequest {
    const req = ToolApprovalPolicy.approvals.get(approvalId);
    if (!req) {
      throw new Error(`ApprovalRequest '${approvalId}' not found.`);
    }

    // Idempotency 체크: 이미 처리된 응답 키이거나 동일 요청이 승인 완료된 경우
    const keyToUse = idempotencyKey || req.idempotencyKey || approvalId;
    if (ToolApprovalPolicy.processedIdempotencyKeys.has(keyToUse)) {
      console.warn(`[ToolApprovalPolicy] Duplicate resolveApproval attempt for key '${keyToUse}'. Returning existing status: ${req.status}`);
      return req;
    }

    if (req.status !== 'PENDING') {
      return req;
    }

    req.status = status;
    if (keyToUse) {
      ToolApprovalPolicy.processedIdempotencyKeys.add(keyToUse);
    }
    return req;
  }

  /**
   * PENDING 상태의 승인 요청이 처리될 때까지 대기한다. (Timeout 기본 10분)
   */
  public static async waitForApproval(approvalId: string, timeoutMs: number = 600000): Promise<ApprovalRequest> {
    const req = this.approvals.get(approvalId);
    if (!req) throw new Error(`ApprovalRequest not found: ${approvalId}`);
    
    if (req.status !== 'PENDING') return req;

    return new Promise((resolve, reject) => {
      const start = Date.now();
      const interval = setInterval(() => {
        const currentReq = this.approvals.get(approvalId);
        if (!currentReq) {
          clearInterval(interval);
          reject(new Error(`ApprovalRequest removed: ${approvalId}`));
          return;
        }
        if (currentReq.status !== 'PENDING') {
          clearInterval(interval);
          resolve(currentReq);
          return;
        }
        if (Date.now() - start > timeoutMs) {
          clearInterval(interval);
          currentReq.status = 'CANCELLED';
          resolve(currentReq);
        }
      }, 500);
    });
  }

  /**
   * Tool 실행 직전에 승인 여부를 엄격히 검증한다.
   * 승인이 필요한 위험도(HIGH/CRITICAL)임에도 APPROVED 상태가 아니라면 예외를 발생시켜 Tool 실행을 0회로 차단한다.
   * 또한 REJECTED, EXPIRED, CANCELLED 상태는 모든 위험도에 대해 차단한다.
   */
  public static assertApproved(toolName: string, approvalStatus?: ApprovalStatus, riskLevel?: ToolRiskLevel): void {
    const risk = riskLevel ?? ToolApprovalPolicy.evaluateRisk(toolName).riskLevel;

    if (approvalStatus === 'REJECTED') {
      throw new ToolApprovalViolationError(
        toolName,
        risk,
        approvalStatus,
        `Tool '${toolName}' execution blocked: Approval request was explicitly REJECTED.`
      );
    }

    if (approvalStatus === 'EXPIRED') {
      throw new ToolApprovalViolationError(
        toolName,
        risk,
        approvalStatus,
        `Tool '${toolName}' execution blocked: Approval request has EXPIRED.`
      );
    }

    if (approvalStatus === 'CANCELLED') {
      throw new ToolApprovalViolationError(
        toolName,
        risk,
        approvalStatus,
        `Tool '${toolName}' execution blocked: Approval request was CANCELLED.`
      );
    }

    const isRequired = risk === 'HIGH' || risk === 'CRITICAL';

    if (isRequired && approvalStatus !== 'APPROVED') {
      throw new ToolApprovalViolationError(
        toolName,
        risk,
        approvalStatus ?? 'PENDING',
        `Tool '${toolName}' (${risk} risk) cannot be executed without explicit user approval. Current status: ${approvalStatus ?? 'PENDING'}.`
      );
    }
  }

  private static executedToolKeys: Set<string> = new Set();

  /**
   * 특정 idempotencyKey를 가진 도구가 이미 실행되었는지 확인한다.
   */
  public static isToolExecuted(idempotencyKey?: string): boolean {
    if (!idempotencyKey) return false;
    return ToolApprovalPolicy.executedToolKeys.has(idempotencyKey);
  }

  /**
   * 특정 idempotencyKey를 가진 도구가 실행되었음을 기록한다.
   */
  public static markToolExecuted(idempotencyKey?: string): void {
    if (!idempotencyKey) return;
    ToolApprovalPolicy.executedToolKeys.add(idempotencyKey);
  }

  /**
   * 복원된 승인 요청 및 실행 키를 정책 런타임에 복원한다.
   */
  public static restoreApprovals(approvals: ApprovalRequest[], executedKeys?: string[]): void {
    for (const req of approvals) {
      if (req && req.approvalId) {
        ToolApprovalPolicy.approvals.set(req.approvalId, req);
        if (req.idempotencyKey && req.status !== 'PENDING') {
          ToolApprovalPolicy.processedIdempotencyKeys.add(req.idempotencyKey);
        }
      }
    }
    if (executedKeys && Array.isArray(executedKeys)) {
      for (const key of executedKeys) {
        ToolApprovalPolicy.executedToolKeys.add(key);
      }
    }
  }

  /**
   * (테스트용) 저장소 초기화
   */
  public static clear(): void {
    ToolApprovalPolicy.approvals.clear();
    ToolApprovalPolicy.processedIdempotencyKeys.clear();
    ToolApprovalPolicy.executedToolKeys.clear();
    ToolApprovalPolicy.testRiskClassifier = undefined;
  }
}
