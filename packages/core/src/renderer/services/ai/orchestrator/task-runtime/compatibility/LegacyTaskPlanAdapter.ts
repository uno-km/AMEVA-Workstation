/**
 * @file orchestrator/task-runtime/compatibility/LegacyTaskPlanAdapter.ts
 * @system AMEVA OS Desktop Workstation
 * @role 기존 Planner의 JSON 아웃풋과 신규 도메인 모델 간의 변환을 담당하는 어댑터
 */

import type { TaskEntity, TaskStatus } from '../domain/types';

// 기존 UI 및 Legacy Planner가 반환하던 타입 정의 (간략화)
export interface LegacyTaskPayload {
  id?: string;
  title?: string;
  objective?: string;
  description?: string;
  status?: string;
  dependencies?: string[];
}

export interface AdapterResult {
  importedTasks: TaskEntity[];
  warnings: string[];
  rejectedItems: any[];
  sourceVersion: string;
  targetVersion: string;
}

export class LegacyTaskPlanAdapter {
  
  /**
   * 레거시 JSON 또는 기존 객체 배열을 받아 신규 TaskEntity 리스트로 변환합니다.
   */
  public static importFromLegacy(payloads: LegacyTaskPayload[]): AdapterResult {
    const result: AdapterResult = {
      importedTasks: [],
      warnings: [],
      rejectedItems: [],
      sourceVersion: 'v1_legacy',
      targetVersion: 'v2_domain'
    };

    if (!Array.isArray(payloads)) {
      result.warnings.push('Input is not an array. Returning empty tasks.');
      return result;
    }

    const seenIds = new Set<string>();

    for (let i = 0; i < payloads.length; i++) {
      const item = payloads[i];
      
      // 1. 필수 필드 검증 방어
      if (!item || typeof item !== 'object') {
        result.rejectedItems.push(item);
        result.warnings.push(`Item at index ${i} is not a valid object.`);
        continue;
      }

      // 2. ID 생성 및 중복 처리
      let taskId = item.id || `task_auto_${crypto.randomUUID()}`;
      if (seenIds.has(taskId)) {
        result.warnings.push(`Duplicate ID found: ${taskId}. Generating a new one.`);
        taskId = `task_auto_dup_${crypto.randomUUID()}`;
      }
      seenIds.add(taskId);

      // 3. title/objective 매핑
      const title = item.title || `Untitled Task ${i + 1}`;
      const objective = item.objective || item.description || title;

      // 4. 상태 매핑 (보수적 변환)
      let initialStatus: TaskStatus = 'PENDING';
      const rawStatus = (item.status || 'pending').toLowerCase();
      
      switch (rawStatus) {
        case 'pending': initialStatus = 'PENDING'; break;
        case 'in_progress': initialStatus = 'RUNNING'; break;
        case 'failed': initialStatus = 'FAILED'; break;
        case 'done': 
        case 'completed':
          // Legacy done 은 곧바로 COMPLETED로 변환하지 않습니다. (검증 부재)
          initialStatus = 'VERIFYING'; 
          result.warnings.push(`Legacy 'done' status for Task ${taskId} mapped to 'VERIFYING' pending validation.`);
          break;
        case 'skipped': initialStatus = 'SKIPPED'; break;
        default:
          result.warnings.push(`Unknown status '${rawStatus}' for Task ${taskId}. Defaulting to PENDING.`);
          initialStatus = 'PENDING';
      }

      const dependencies = Array.isArray(item.dependencies) ? item.dependencies : [];

      // 5. Entity 생성
      const entity: TaskEntity = {
        definition: {
          id: taskId,
          title,
          objective,
          dependencies
        },
        state: {
          status: initialStatus,
          attempts: {},
          stateVersion: 1,
          retries: 0,
          createdAt: Date.now()
        }
      };

      result.importedTasks.push(entity);
    }

    return result;
  }

  /**
   * 신규 TaskEntity를 기존 React UI가 구독하는 4가지 상태('pending', 'in_progress', 'done', 'failed') 
   * 리터럴 객체 포맷으로 내보냅니다. (Read-only Projection)
   */
  public static projectToLegacyUI(entity: TaskEntity): { 
    id: string; 
    title: string; 
    description: string; 
    status: 'pending' | 'in_progress' | 'done' | 'failed';
    dependencies: string[];
  } {
    let uiStatus: 'pending' | 'in_progress' | 'done' | 'failed' = 'pending';
    
    switch (entity.state.status) {
      case 'PENDING':
      case 'READY':
      case 'BLOCKED':
      case 'WAITING_USER':
      case 'RETRY_WAIT':
        uiStatus = 'pending';
        break;
      case 'RUNNING':
      case 'VERIFYING':
        uiStatus = 'in_progress';
        break;
      case 'COMPLETED':
      case 'SKIPPED':
      case 'CANCELLED': // UI상으론 더 안 하는 것이니 done 취급 혹은 UI 재설계 필요
        uiStatus = 'done';
        break;
      case 'FAILED':
        uiStatus = 'failed';
        break;
    }

    return {
      id: entity.definition.id,
      title: entity.definition.title,
      description: entity.definition.objective,
      status: uiStatus,
      dependencies: entity.definition.dependencies
    };
  }
}
