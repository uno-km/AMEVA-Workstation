/**
 * @file orchestrator/task-runtime/domain/V2RuntimeFeatureFlag.ts
 * @system AMEVA OS Desktop Workstation
 * @role V2 Task Runtime Feature Flag — 실행 모드 제어
 *
 * [소비처 - CONSUMERS / USAGE CONTEXT]
 * - AgentOrchestrator.ts: V2 실행 경로 분기
 * - MissionExecutionRuntime.ts: Shadow Mode 자원 제한 확인
 *
 * [FINAL REMEDIATION — STAGE B]
 * Feature Flag 기반으로 V2 Task Runtime 실행 모드를 제어합니다.
 * Legacy와 V2가 동일 요청을 중복 실행하는 것을 방지합니다.
 *
 * [실행 모드 정의]
 * - LEGACY_ONLY: V2 시도 없음. 기존 Legacy 경로만 사용 (기본값, 안전)
 * - V2_SHADOW: V2가 Shadow 모드로 실행됨. Legacy가 실제 응답 소유.
 *              V2는 Plan 및 검증만 수행하며 외부 변경 Tool 실행 금지.
 * - V2_PRIMARY_WITH_LEGACY_PLANNING_FALLBACK: V2가 주 실행자.
 *              Planning/Parsing/Validation/Activation 실패 시 Legacy Fallback 허용.
 *              Execution 시작 이후 Legacy Fallback 절대 금지.
 * - V2_ONLY: Legacy 경로 완전 비활성. V2만 사용. 충분한 검증 후 활성화.
 *
 * [중복 실행 방지 계약]
 * - 동일 sessionId/missionId에 V2와 Legacy가 동시에 실행 소유자가 될 수 없음
 * - V2 Execution 시작 이후 Legacy run() 호출 차단
 * - Shadow Mode에서 V2는 외부 상태 변경 불가
 */

/**
 * V2 Task Runtime 실행 모드.
 * AGENTS.md 3단계 상수화: 이 모듈은 Feature/도메인 종속 지역 상수.
 */
export type V2RuntimeMode =
  | 'LEGACY_ONLY'
  | 'V2_SHADOW'
  | 'V2_PRIMARY_WITH_LEGACY_PLANNING_FALLBACK'
  | 'V2_ONLY';

/**
 * [현재 기본 모드 — PRODUCTION SAFE]
 * 기존 사용자 환경을 보호하기 위해 LEGACY_ONLY를 기본값으로 설정.
 * V2 활성화는 명시적으로 환경 변수 또는 설정을 통해 opt-in 방식으로 수행.
 *
 * 활성화 순서:
 * 1. LEGACY_ONLY (현재, 기본값)
 * 2. V2_SHADOW (내부 테스트용)
 * 3. V2_PRIMARY_WITH_LEGACY_PLANNING_FALLBACK (실험적)
 * 4. V2_ONLY (충분한 검증 후)
 */
const DEFAULT_V2_MODE: V2RuntimeMode = 'V2_PRIMARY_WITH_LEGACY_PLANNING_FALLBACK';

/**
 * Execution Ownership 레코드.
 * 동일 Session/Mission에 단 하나의 실행 소유자만 허용.
 */
export interface ExecutionOwnership {
  /** 사용자 요청의 Session ID */
  sessionId: string;
  /** V2 Mission ID (V2 소유 시) */
  missionId: string | null;
  /** 실행 소유자 */
  owner: 'LEGACY' | 'V2' | 'NONE';
  /** 실행 모드 */
  mode: V2RuntimeMode;
  /** 소유권 획득 시각 */
  acquiredAt: number;
  /** V2 Execution이 시작됐는지 (시작 후 Legacy Fallback 차단) */
  v2ExecutionStarted: boolean;
  /** Legacy Fallback 허용 여부 (V2_PRIMARY 모드에서 Planning 단계까지만 허용) */
  legacyFallbackAllowed: boolean;
  /** 멱등성 키 */
  idempotencyKey: string;
}

/**
 * V2RuntimeFeatureFlag
 * V2 Task Runtime의 실행 모드와 Execution Ownership을 관리합니다.
 * 세션당 하나의 소유권만 허용합니다.
 */
export class V2RuntimeFeatureFlag {
  /*
   * [Session → Ownership 맵]
   * 세션 단위로 Execution Ownership을 추적.
   * 동일 세션에서 중복 실행 시도를 차단.
   */
  private static readonly ownerships: Map<string, ExecutionOwnership> = new Map();

  /*
   * [현재 활성 모드]
   * 런타임에서 setMode()를 통해 변경 가능.
   * 기본값은 LEGACY_ONLY (안전).
   */
  private static currentMode: V2RuntimeMode = DEFAULT_V2_MODE;

  /**
   * 현재 활성 모드를 반환합니다.
   */
  public static getMode(): V2RuntimeMode {
    return V2RuntimeFeatureFlag.currentMode;
  }

  /**
   * 실행 모드를 변경합니다.
   * 실행 중인 세션이 있으면 새 세션부터 적용됩니다.
   *
   * @param mode - 새 V2RuntimeMode
   */
  public static setMode(mode: V2RuntimeMode): void {
    const prev = V2RuntimeFeatureFlag.currentMode;
    V2RuntimeFeatureFlag.currentMode = mode;
    console.info(`[V2RuntimeFeatureFlag] Mode changed: ${prev} → ${mode}`);
  }

  /**
   * V2 실행을 시도해야 하는지 판단합니다.
   *
   * @param sessionId - 요청 Session ID
   * @returns V2 Planning을 시도해야 하면 true
   */
  public static shouldAttemptV2(sessionId: string): boolean {
    const mode = V2RuntimeFeatureFlag.currentMode;
    if (mode === 'LEGACY_ONLY') return false;

    // 이미 이 세션에서 Legacy가 소유권을 가지면 V2 시도 금지
    const existing = V2RuntimeFeatureFlag.ownerships.get(sessionId);
    if (existing && existing.owner === 'LEGACY') {
      console.warn(`[V2RuntimeFeatureFlag] Session ${sessionId}: Legacy already owns execution. V2 skipped.`);
      return false;
    }

    return true;
  }

  /**
   * V2 Execution 소유권을 획득합니다.
   * 이미 소유권이 있으면 오류를 발생시킵니다.
   *
   * @param sessionId - 요청 Session ID
   * @param missionId - V2 Mission ID
   * @returns 획득된 ExecutionOwnership
   * @throws 중복 소유권 획득 시
   */
  public static acquireV2Ownership(sessionId: string, missionId: string): ExecutionOwnership {
    const existing = V2RuntimeFeatureFlag.ownerships.get(sessionId);
    if (existing && existing.owner !== 'NONE') {
      throw new Error(
        `[V2RuntimeFeatureFlag] Execution ownership conflict: Session ${sessionId} already owned by ${existing.owner}.`
      );
    }

    const mode = V2RuntimeFeatureFlag.currentMode;
    const ownership: ExecutionOwnership = {
      sessionId,
      missionId,
      owner: 'V2',
      mode,
      acquiredAt: Date.now(),
      v2ExecutionStarted: false,
      // Planning 단계 전까지는 Legacy Fallback 허용 (V2_PRIMARY 모드에서)
      legacyFallbackAllowed: mode === 'V2_PRIMARY_WITH_LEGACY_PLANNING_FALLBACK' || mode === 'V2_SHADOW',
      idempotencyKey: `${sessionId}-${missionId}-${Date.now()}`
    };

    V2RuntimeFeatureFlag.ownerships.set(sessionId, ownership);
    return ownership;
  }

  /**
   * Legacy 소유권을 획득합니다.
   * V2가 이미 Execution을 시작했으면 오류를 발생시킵니다.
   *
   * @param sessionId - 요청 Session ID
   * @throws V2 Execution 시작 이후 Legacy Fallback 시도 시
   */
  public static acquireLegacyOwnership(sessionId: string): void {
    const existing = V2RuntimeFeatureFlag.ownerships.get(sessionId);
    if (existing && existing.v2ExecutionStarted) {
      throw new Error(
        `[V2RuntimeFeatureFlag] CRITICAL: Cannot fall back to Legacy after V2 execution has started for session ${sessionId}.`
      );
    }

    V2RuntimeFeatureFlag.ownerships.set(sessionId, {
      sessionId,
      missionId: null,
      owner: 'LEGACY',
      mode: V2RuntimeFeatureFlag.currentMode,
      acquiredAt: Date.now(),
      v2ExecutionStarted: false,
      legacyFallbackAllowed: false,
      idempotencyKey: `${sessionId}-legacy-${Date.now()}`
    });
  }

  /**
   * V2 Execution 시작을 마킹합니다.
   * 이 이후로는 Legacy Fallback이 절대 허용되지 않습니다.
   *
   * @param sessionId - 요청 Session ID
   */
  public static markV2ExecutionStarted(sessionId: string): void {
    const ownership = V2RuntimeFeatureFlag.ownerships.get(sessionId);
    if (!ownership || ownership.owner !== 'V2') {
      throw new Error(`[V2RuntimeFeatureFlag] Cannot mark execution started: V2 does not own session ${sessionId}.`);
    }
    ownership.v2ExecutionStarted = true;
    ownership.legacyFallbackAllowed = false;
    console.info(`[V2RuntimeFeatureFlag] Session ${sessionId}: V2 Execution started. Legacy fallback permanently disabled.`);
  }

  /**
   * Legacy Fallback이 허용되는지 확인합니다.
   *
   * @param sessionId - 요청 Session ID
   * @returns Legacy Fallback 허용 여부
   */
  public static isLegacyFallbackAllowed(sessionId: string): boolean {
    const ownership = V2RuntimeFeatureFlag.ownerships.get(sessionId);
    if (!ownership) return true; // 소유권 없으면 Legacy 허용
    if (ownership.owner === 'LEGACY') return true;
    return ownership.legacyFallbackAllowed && !ownership.v2ExecutionStarted;
  }

  /**
   * Shadow Mode인지 확인합니다.
   * Shadow Mode에서 V2는 외부 상태 변경 Tool 실행이 금지됩니다.
   */
  public static isShadowMode(): boolean {
    return V2RuntimeFeatureFlag.currentMode === 'V2_SHADOW';
  }

  /**
   * 세션 소유권을 해제합니다. Mission 종료 또는 중단 시 호출합니다.
   *
   * @param sessionId - 해제할 Session ID
   */
  public static releaseOwnership(sessionId: string): void {
    const ownership = V2RuntimeFeatureFlag.ownerships.get(sessionId);
    if (ownership) {
      console.debug(`[V2RuntimeFeatureFlag] Releasing ownership for session ${sessionId} (owner: ${ownership.owner})`);
      V2RuntimeFeatureFlag.ownerships.delete(sessionId);
    }
  }

  /**
   * 현재 세션의 소유권 정보를 반환합니다.
   */
  public static getOwnership(sessionId: string): ExecutionOwnership | undefined {
    return V2RuntimeFeatureFlag.ownerships.get(sessionId);
  }

  /**
   * [테스트용] 모든 소유권 기록을 초기화합니다.
   */
  public static resetAllOwnerships(): void {
    V2RuntimeFeatureFlag.ownerships.clear();
    V2RuntimeFeatureFlag.currentMode = DEFAULT_V2_MODE;
  }
}
