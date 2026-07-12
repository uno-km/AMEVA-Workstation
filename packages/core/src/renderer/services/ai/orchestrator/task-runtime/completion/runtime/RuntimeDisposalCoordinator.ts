/**
 * @file orchestrator/task-runtime/completion/runtime/RuntimeDisposalCoordinator.ts
 * @system AMEVA OS Desktop Workstation
 * @role 미션 종료 후 관련된 런타임 리소스(타이머, 핸들, 리스너)를 메모리 누수 없이 Idempotent하게 정리
 */

export interface DisposableResource {
  id: string;
  type: 'timer' | 'handle' | 'lease' | 'listener' | 'lock';
  dispose: () => void | Promise<void>;
}

export interface DisposalResult {
  missionId: string;
  disposedResources: string[];
  failedResources: string[];
  remainingResources: number;
  lateEventPolicy: 'REJECT';
  disposedAt: number;
  success: boolean;
}

export class RuntimeDisposalCoordinator {
  private disposedMissions: Set<string> = new Set();
  private resources: Map<string, DisposableResource[]> = new Map();

  /**
   * 정리해야 할 런타임 자원을 등록합니다.
   */
  public registerResource(missionId: string, resource: DisposableResource): void {
    if (this.disposedMissions.has(missionId)) {
      console.warn(`[RuntimeDisposalCoordinator] Mission ${missionId} is already disposed. Resource ${resource.id} rejected.`);
      // 이미 Dispose된 미션에 자원이 등록되는 것은 늦게 도착한 작업이므로 즉시 폐기
      try { resource.dispose(); } catch (e) {}
      return;
    }
    const list = this.resources.get(missionId) || [];
    list.push(resource);
    this.resources.set(missionId, list);
  }

  /**
   * 관련된 모든 런타임 자원을 해제합니다.
   * 여러 번 호출되어도 부작용이 없어야 합니다.
   * @param missionId 정리할 미션 ID
   */
  public async dispose(missionId: string): Promise<DisposalResult> {
    if (this.disposedMissions.has(missionId)) {
      return {
        missionId,
        disposedResources: [],
        failedResources: [],
        remainingResources: 0,
        lateEventPolicy: 'REJECT',
        disposedAt: Date.now(),
        success: true
      };
    }

    const list = this.resources.get(missionId) || [];
    const disposedResources: string[] = [];
    const failedResources: string[] = [];

    for (const res of list) {
      try {
        await res.dispose();
        disposedResources.push(res.id);
      } catch (err) {
        console.error(`[RuntimeDisposalCoordinator] Failed to dispose resource ${res.id}`, err);
        failedResources.push(res.id);
      }
    }

    // 성공적으로 처리된 자원 제거
    const remaining = list.filter(r => failedResources.includes(r.id));
    if (remaining.length > 0) {
      this.resources.set(missionId, remaining);
    } else {
      this.resources.delete(missionId);
    }

    this.disposedMissions.add(missionId);

    return {
      missionId,
      disposedResources,
      failedResources,
      remainingResources: remaining.length,
      lateEventPolicy: 'REJECT',
      disposedAt: Date.now(),
      success: remaining.length === 0
    };
  }

  /**
   * 해당 미션이 이미 정리되었는지 확인합니다.
   * 정리된 미션에 늦게 도착하는 Result나 Verification을 차단하기 위해 사용합니다.
   */
  public isDisposed(missionId: string): boolean {
    return this.disposedMissions.has(missionId);
  }
}
