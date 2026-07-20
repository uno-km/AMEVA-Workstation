/**
 * @file orchestrator/task-runtime/verification/services/OutputInferenceService.ts
 * @system AMEVA OS Desktop Workstation
 */

import type { TaskOutputMode, MutatingOperationType } from '../../domain/types';

export interface InferredOutputs {
  inferredOutputMode: TaskOutputMode;
  inferredFileOutputs: string[];
}

export class OutputInferenceService {
  /**
   * 파일 변이(Mutating) 작업을 수행하는 도구명 목록.
   */
  private static readonly MUTATING_TOOLS = new Set([
    'write_file',
    'append_file',
    'apply_patch',
    'create_file',
    'modify_file',
    'rename_file',
    'move_file',
    'delete_file'
  ]);

  public static isMutatingTool(toolName: string, toolDefinition?: any): boolean {
    if (toolDefinition) {
      if (typeof toolDefinition.mutatesFilesystem === 'boolean') {
        return toolDefinition.mutatesFilesystem;
      }
      if (toolDefinition.operationType && toolDefinition.operationType !== 'READ' && toolDefinition.operationType !== 'UNKNOWN') {
        return true;
      }
      // 메타데이터가 제공되었으나 mutatesFilesystem가 지정되지 않은 경우, 자동 인정 금지
      if (toolDefinition.name && !this.MUTATING_TOOLS.has(toolName)) {
        return false;
      }
    }
    return this.MUTATING_TOOLS.has(toolName);
  }

  public static inferOperationType(toolName: string): MutatingOperationType {
    if (!this.isMutatingTool(toolName)) return 'UNKNOWN';
    switch (toolName) {
      case 'write_file':
      case 'create_file':
        return 'CREATE';
      case 'append_file':
        return 'APPEND';
      case 'apply_patch':
      case 'modify_file':
        return 'PATCH';
      case 'delete_file':
        return 'DELETE';
      case 'rename_file':
      case 'move_file':
        return 'MOVE';
      default:
        return 'UNKNOWN';
    }
  }

  public static inferExpectedPath(toolName: string, args: Record<string, any>): string | undefined {
    let targetPath: string | undefined;
    if (toolName === 'apply_patch') {
       targetPath = args['targetFile'] || args['path'];
    } else if (toolName === 'rename_file' || toolName === 'move_file') {
       targetPath = args['destPath'] || args['destination'] || args['newPath'];
    } else {
       targetPath = args['path'] || args['targetFile'] || args['file'];
    }
    return typeof targetPath === 'string' ? targetPath : undefined;
  }

  public static inferFromToolCalls(
    executedTools: Array<{ name: string; args: Record<string, any>; success: boolean }>,
    declaredOutputMode: TaskOutputMode
  ): InferredOutputs {
    const inferredFileOutputs = new Set<string>();
    let hasMutatingAction = false;

    for (const call of executedTools) {
      if (call.success && this.isMutatingTool(call.name)) {
        hasMutatingAction = true;
        const targetPath = this.inferExpectedPath(call.name, call.args);
        if (targetPath) {
          inferredFileOutputs.add(targetPath);
        }
      }
    }

    let inferredOutputMode = declaredOutputMode;

    if (hasMutatingAction) {
      if (inferredOutputMode === 'NO_PERSISTED_OUTPUT' || !inferredOutputMode) {
        inferredOutputMode = 'FILE_OUTPUT_REQUIRED';
      }
    }

    return {
      inferredOutputMode,
      inferredFileOutputs: Array.from(inferredFileOutputs),
    };
  }
}

