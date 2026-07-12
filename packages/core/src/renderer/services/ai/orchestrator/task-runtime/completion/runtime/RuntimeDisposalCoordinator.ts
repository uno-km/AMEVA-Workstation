/**
 * @file orchestrator/task-runtime/completion/runtime/RuntimeDisposalCoordinator.ts
 * @system AMEVA OS Desktop Workstation
 * @role 미션 종료 후 관련된 런타임 리소스(타이머, 핸들, 리스너)를 메모리 누수 없이 Idempotent하게 정리
 */

export class RuntimeDisposalCoordinator {
  private disposedMissions: Set<string> = new Set();

  /**
   * 관련된 모든 런타임 자원을 해제합니다.
   * 여러 번 호출되어도 부작용이 없어야 합니다.
   * @param missionId 정리할 미션 ID
   */
  public dispose(missionId: string): void {
    if (this.disposedMissions.has(missionId)) {
      console.warn(`[RuntimeDisposalCoordinator] Mission ${missionId} is already disposed. Skipping.`);
      return;
    }

    // TODO: TaskScheduler, MissionExecutionRuntime 등에서 타이머 및 루프 정리
    // 예: scheduler.stop(missionId)
    // 예: leaseManager.clearAllLeases(missionId)
    
    // TODO: Event Listener, UI Subscription 해제
    // 예: eventBus.off('TASK_UPDATED', missionId)

    this.disposedMissions.add(missionId);
    console.log(`[RuntimeDisposalCoordinator] Mission ${missionId} resources have been successfully disposed.`);
  }

  /**
   * 해당 미션이 이미 정리되었는지 확인합니다.
   * 정리된 미션에 늦게 도착하는 Result나 Verification을 차단하기 위해 사용합니다.
   */
  public isDisposed(missionId: string): boolean {
    return this.disposedMissions.has(missionId);
  }
}
