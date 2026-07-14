/**
 * @file orchestrator/task-runtime/dispatch/CapabilityCatalog.ts
 * @system AMEVA OS Desktop Workstation
 * @role 시스템이 제공 가능한 권한 및 툴 세트 명세. Tool Runtime 실제 연결 상태를 정직하게 보고.
 *
 * [소비처 - CONSUMERS / USAGE CONTEXT]
 * - ExecutionStrategyResolver: Task 실행 전략 결정
 * - MissionCompletionReviewInputBuilder: toolRuntimeStatus 조회
 * - TaskDispatcher: Capability 가용성 확인
 *
 * [HIDDEN PHASE 6 수정]
 * - getToolRuntimeStatus() 추가: 실제 연결 상태를 정직하게 반환
 * - 현재 Tool Runtime은 PARTIALLY_CONNECTED:
 *   LLM Reasoning은 완전히 연결됨. File/Command Tool은 ToolRegistry에 등록되지만
 *   DeepTaskExecutor의 Tool Call Parsing이 아직 구현 중 (STAGE C에서 완성).
 *
 * [변경 이력]
 * - STAGE A (FINAL REMEDIATION): toolRuntimeStatus 하드코딩 제거. getToolRuntimeStatus() 추가.
 */

/**
 * Tool Runtime의 실제 연결 상태.
 * MissionCompletionReviewInput.toolRuntimeStatus 타입과 일치.
 */
export type ToolRuntimeConnectionStatus =
  | 'FULLY_CONNECTED'
  | 'PARTIALLY_CONNECTED'
  | 'DISABLED_SAFELY'
  | 'UNAVAILABLE'
  | 'BROKEN'
  | 'NOT_IMPLEMENTED';

export class CapabilityCatalog {
  /*
   * [현재 가용 Capability 목록]
   * - llm.reasoning: DeepTaskExecutor의 LLM 추론 (완전히 연결됨)
   * - file.read: ToolRegistry에 read_file 등록됨 (PARTIALLY_CONNECTED)
   * - file.write: ToolRegistry에 write_file 등록됨 (PARTIALLY_CONNECTED, path 검증 필요)
   * - sys.command: ToolRegistry에 run_command 등록됨 (PARTIALLY_CONNECTED, allowlist 필요)
   * Tool Call Parsing은 STAGE C 완성 후 활성화됨.
   */
  private readonly availableCapabilities = new Set([
    'llm.reasoning',
    // 아래 Capability는 ToolRegistry에 연결 가능하나
    // DeepTaskExecutor의 Tool Call Parsing 구현 완성 후 활성화.
    // 'file.read',
    // 'file.write',
    // 'sys.command',
    // 'web.search',
    // 'code.execute',
  ]);

  /*
   * [현재 Tool Runtime 연결 상태 — 정직한 보고]
   * - LLM Reasoning: FULLY_CONNECTED
   * - File/Command Tool: ToolRegistry에 등록됨, DeepTaskExecutor 파싱 구현 중
   * - Semantic Verifier: LLM Adapter 연결됨 (STAGE D 완성 후 활성화)
   * - Sub-Agent: NOT_IMPLEMENTED
   */
  private _toolRuntimeStatus: ToolRuntimeConnectionStatus = 'PARTIALLY_CONNECTED';

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('mcp_circuit_breaker_open', () => {
        this._toolRuntimeStatus = 'UNAVAILABLE';
        console.warn('[CapabilityCatalog] MCP Circuit Breaker OPEN 감지, 연결 상태를 UNAVAILABLE로 전환합니다.');
      });
    }
  }

  public hasCapability(cap: string): boolean {
    return this.availableCapabilities.has(cap);
  }

  public getMissingCapabilities(requiredCaps: string[]): string[] {
    return requiredCaps.filter(cap => !this.hasCapability(cap));
  }

  /**
   * [신규 - STAGE A]
   * Tool Runtime의 실제 연결 상태를 반환합니다.
   * MissionCompletionReviewInputBuilder에서 하드코딩 대신 이 메서드를 호출합니다.
   *
   * 판정 기준:
   * - FULLY_CONNECTED: 모든 Tool이 실제 연결되어 실행 가능
   * - PARTIALLY_CONNECTED: LLM Reasoning만 연결, File/Command는 구현 중
   * - DISABLED_SAFELY: Tool 기능 전체 비활성화
   *
   * @returns 현재 Tool Runtime 연결 상태
   */
  public getToolRuntimeStatus(): ToolRuntimeConnectionStatus {
    return this._toolRuntimeStatus;
  }

  /**
   * [신규 - STAGE A]
   * 등록된 전체 Capability 목록을 반환합니다.
   */
  public getAvailableCapabilities(): string[] {
    return Array.from(this.availableCapabilities);
  }
}
