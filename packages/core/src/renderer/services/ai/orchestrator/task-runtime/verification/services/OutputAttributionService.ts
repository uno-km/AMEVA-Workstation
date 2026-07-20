/**
 * @file orchestrator/task-runtime/verification/services/OutputAttributionService.ts
 * @system AMEVA OS Desktop Workstation
 */

import type { TaskResult, ToolResultEvidenceData } from '../../domain/types';

export interface OutputAttribution {
  path: string;
  sourceTool: string;
  producingTaskId: string;
  producingMissionId: string;
  operationType: string;
  timestamp: number;
}

export class OutputAttributionService {
  /**
   * TaskResult 내의 evidence 배열을 분석하여 생성/수정된 파일들의 Attribution(소유권) 목록을 반환합니다.
   */
  public static extractAttributions(taskResult: TaskResult): OutputAttribution[] {
    const attributions: OutputAttribution[] = [];
    
    if (!taskResult.evidence || taskResult.evidence.length === 0) return attributions;

    for (const ev of taskResult.evidence) {
      if (ev.source === 'tool_result' && ev.data) {
        const data = ev.data as ToolResultEvidenceData;
        if (data.status === 'SUCCESS' && data.expectedOutputPath) {
          attributions.push({
            path: data.expectedOutputPath,
            sourceTool: data.toolName,
            producingTaskId: data.taskId || 'unknown_task',
            producingMissionId: data.missionId || 'unknown_mission',
            operationType: data.operationType || 'UNKNOWN',
            timestamp: ev.timestamp
          });
        }
      }
    }

    return attributions;
  }
}
