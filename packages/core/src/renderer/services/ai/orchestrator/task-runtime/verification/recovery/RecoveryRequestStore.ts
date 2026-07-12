/**
 * @file orchestrator/task-runtime/verification/recovery/RecoveryRequestStore.ts
 * @system AMEVA OS Desktop Workstation
 * @role 검증 실패나 의존성 문제로 생성된 Recovery Request를 보관 및 관리하는 메모리 스토어
 */

import type { TaskRecoveryRequest, RecoveryRequestStatus } from '../domain/RecoveryTypes';

export class RecoveryRequestStore {
  // Map<recoveryRequestId, TaskRecoveryRequest>
  private requests: Map<string, TaskRecoveryRequest> = new Map();
  // Map<missionId, Set<recoveryRequestId>>
  private missionIndex: Map<string, Set<string>> = new Map();
  // Map<taskId, Set<recoveryRequestId>>
  private taskIndex: Map<string, Set<string>> = new Map();

  /**
   * 새로운 Recovery Request 등록
   */
  public addRequest(request: TaskRecoveryRequest): void {
    if (this.requests.has(request.recoveryRequestId)) {
      throw new Error(`Recovery request ${request.recoveryRequestId} already exists.`);
    }
    
    this.requests.set(request.recoveryRequestId, request);
    
    if (!this.missionIndex.has(request.missionId)) {
      this.missionIndex.set(request.missionId, new Set());
    }
    this.missionIndex.get(request.missionId)!.add(request.recoveryRequestId);
    
    if (!this.taskIndex.has(request.taskId)) {
      this.taskIndex.set(request.taskId, new Set());
    }
    this.taskIndex.get(request.taskId)!.add(request.recoveryRequestId);
  }

  /**
   * Request ID로 조회
   */
  public getRequest(requestId: string): TaskRecoveryRequest | undefined {
    return this.requests.get(requestId);
  }

  /**
   * 상태 갱신
   */
  public updateRequestStatus(requestId: string, status: RecoveryRequestStatus, cancellationReason?: string): void {
    const request = this.requests.get(requestId);
    if (!request) {
      throw new Error(`Recovery request ${requestId} not found.`);
    }
    request.status = status;
    if (status === 'RESOLVED' || status === 'FAILED' || status === 'CANCELLED') {
      request.resolvedAt = Date.now();
    }
    if (cancellationReason) {
      request.cancellationReason = cancellationReason;
    }
  }

  /**
   * 특정 Task에 대해 현재 미해결(Pending/Processing) 상태인 Request 조회
   */
  public getActiveRequestsForTask(taskId: string): TaskRecoveryRequest[] {
    const activeStatus = new Set<RecoveryRequestStatus>(['PENDING', 'DIAGNOSING', 'REPAIRING', 'RETRYING', 'WAITING_USER']);
    const requestIds = this.taskIndex.get(taskId);
    if (!requestIds) return [];
    
    const result: TaskRecoveryRequest[] = [];
    for (const id of requestIds) {
      const req = this.requests.get(id);
      if (req && activeStatus.has(req.status)) {
        result.push(req);
      }
    }
    return result;
  }

  /**
   * Mission에 속한 모든 Request 조회
   */
  public getRequestsForMission(missionId: string): TaskRecoveryRequest[] {
    const requestIds = this.missionIndex.get(missionId);
    if (!requestIds) return [];
    
    const result: TaskRecoveryRequest[] = [];
    for (const id of requestIds) {
      const req = this.requests.get(id);
      if (req) result.push(req);
    }
    return result;
  }

  /**
   * 특정 Mission의 모든 Request 취소
   */
  public cancelAllForMission(missionId: string, reason: string): void {
    const requestIds = this.missionIndex.get(missionId);
    if (!requestIds) return;
    
    for (const id of requestIds) {
      const req = this.requests.get(id);
      if (req && req.status !== 'RESOLVED' && req.status !== 'FAILED' && req.status !== 'CANCELLED') {
        this.updateRequestStatus(id, 'CANCELLED', reason);
      }
    }
  }

  public clear(): void {
    this.requests.clear();
    this.missionIndex.clear();
    this.taskIndex.clear();
  }
}
