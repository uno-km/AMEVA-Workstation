/**
 * @file orchestrator/task-runtime/verification/services/OutputAttributionService.ts
 * @system AMEVA OS Desktop Workstation
 * @role 출력물(파일/Artifact)의 생성 출처(Attribution) 추적 및 귀속 검증
 *
 * [책임 범위 - RESPONSIBILITY]
 * - TaskResult evidence에서 파일/Artifact 생성 attribution 추출
 * - 중복 경로 감지 (동일 경로 → 여러 태스크 → 충돌 WARN)
 * - 미귀속 출력물(unattributed) 목록 반환
 * - MUTATING_TOOLS 집합 정의 (파일 변경을 일으키는 도구 목록)
 *
 * [절대 깨면 안 되는 계약 - CONTRACT]
 * - MUST NOT: Attribution 없는 파일을 VerifiedOutput으로 승격 금지
 * - MUST: 동일 경로 attributions 충돌 → conflict 필드에 기록
 */

import type { TaskResult, ToolResultEvidenceData } from '../../domain/types';

/**
 * 파일/Artifact를 변경(생성/수정/삭제)하는 도구 이름 집합.
 * 이 목록에 없는 도구는 MUTATING 작업을 수행하지 않은 것으로 간주.
 */
export const MUTATING_TOOLS = new Set<string>([
  'write_file',
  'write_to_file',
  'create_file',
  'append_file',
  'append_to_file',
  'replace_file_content',
  'multi_replace_file_content',
  'patch_file',
  'delete_file',
  'move_file',
  'rename_file',
  'apply_patch',
  'apply_diff',
  'save_artifact',
  'commit_artifact',
  'update_artifact',
  'write_artifact',
  'modify_file'
]);

export interface OutputAttribution {
  /** 논리적 경로 (UI 노출용) */
  path: string;
  /** 실제 파일 시스템 절대 경로 (INTERNAL 전용) */
  canonicalPath?: string;
  /** 생성/수정에 사용된 도구 이름 */
  sourceTool: string;
  /** 생성한 태스크 ID */
  producingTaskId: string;
  /** 생성한 미션 ID */
  producingMissionId: string;
  /** 작업 유형 */
  operationType: string;
  /** 생성 타임스탬프 */
  timestamp: number;
  /** Artifact Registry ID (있는 경우) */
  artifactId?: string;
  /** beforeHash/afterHash (변경 증거) */
  beforeHash?: string;
  afterHash?: string;
}

export interface AttributionConflict {
  path: string;
  attributions: OutputAttribution[];
  reason: string;
}

export interface AttributionAnalysisResult {
  attributions: OutputAttribution[];
  conflicts: AttributionConflict[];
  hasConflicts: boolean;
}

export class OutputAttributionService {
  /**
   * TaskResult 내의 evidence 배열을 분석하여
   * 생성/수정된 파일들의 Attribution(소유권) 목록을 반환합니다.
   *
   * [변경 이력]
   * - 2024: 초기 구현
   * - [P1-2 FIX]: canonicalPath, artifactId, beforeHash/afterHash 지원 추가
   *               동일 경로 중복 attribution 감지 추가
   */
  public static extractAttributions(taskResult: TaskResult): OutputAttribution[] {
    return OutputAttributionService.analyze(taskResult).attributions;
  }

  /**
   * 전체 분석 — attributions + conflicts 반환.
   */
  public static analyze(taskResult: TaskResult): AttributionAnalysisResult {
    const attributions: OutputAttribution[] = [];
    const pathMap = new Map<string, OutputAttribution[]>();
    
    if (!taskResult.evidence || taskResult.evidence.length === 0) {
      return { attributions, conflicts: [], hasConflicts: false };
    }

    for (const ev of taskResult.evidence) {
      if (ev.source === 'tool_result' && ev.data) {
        const data = ev.data as ToolResultEvidenceData;
        
        // SUCCESS 상태이고 mutating tool이며 출력 경로가 있는 경우만 attribution 생성
        if (
          (data.status === 'SUCCESS' || data.executionSuccess === true) &&
          data.expectedOutputPath &&
          MUTATING_TOOLS.has(data.toolName)
        ) {
          const attribution: OutputAttribution = {
            path: data.expectedOutputPath,
            canonicalPath: data.canonicalOutputPath,
            sourceTool: data.toolName,
            producingTaskId: data.taskId || 'unknown_task',
            producingMissionId: data.missionId || 'unknown_mission',
            operationType: data.operationType || 'UNKNOWN',
            timestamp: ev.timestamp,
            artifactId: data.artifactId,
            beforeHash: data.beforeHash,
            afterHash: data.afterHash
          };
          
          attributions.push(attribution);
          
          // 경로별 attribution 집계 (중복 감지용)
          const existing = pathMap.get(data.expectedOutputPath) || [];
          existing.push(attribution);
          pathMap.set(data.expectedOutputPath, existing);
        }
      }
    }

    // 충돌 감지: 동일 경로에 다른 태스크의 attribution이 있으면 충돌
    const conflicts: AttributionConflict[] = [];
    for (const [path, attrs] of pathMap) {
      const uniqueTaskIds = new Set(attrs.map(a => a.producingTaskId));
      if (uniqueTaskIds.size > 1) {
        conflicts.push({
          path,
          attributions: attrs,
          reason: `동일 경로 '${path}'에 ${uniqueTaskIds.size}개의 태스크가 attribution을 주장합니다: ${[...uniqueTaskIds].join(', ')}`
        });
      }
    }

    return {
      attributions,
      conflicts,
      hasConflicts: conflicts.length > 0
    };
  }

  /**
   * 출력물 배열에서 attribution이 없는 파일 경로를 반환합니다.
   * 귀속 없는 파일은 VerifiedOutput으로 승격할 수 없습니다.
   */
  public static findUnattributed(
    claimedPaths: string[],
    attributions: OutputAttribution[]
  ): string[] {
    const attributedSet = new Set(attributions.map(a => a.path));
    return claimedPaths.filter(p => !attributedSet.has(p));
  }

  /**
   * 도구 이름이 MUTATING_TOOLS 집합에 포함되는지 확인.
   */
  public static isMutatingTool(toolName: string): boolean {
    return MUTATING_TOOLS.has(toolName);
  }
}

