import { BaseTool } from '../base/BaseTool';
import type { ToolCallResult, ToolExecutionContext } from '../../types';
import type { IFileSystemAdapter } from '../../task-runtime/artifact/IFileSystemAdapter';
import { PathSanitizer, PathSanitizationError } from '../../task-runtime/policy/PathSanitizer';

export class ReadFileTool extends BaseTool {
  public readonly name = 'read_file';
  public readonly description = '吏?뺣맂 ?뚯씪 寃쎈줈???댁슜???쎌뼱 諛섑솚?⑸땲?? 肄붾뱶 ?뚯씪, ?ㅼ젙 ?뚯씪, 臾몄꽌 ?뚯씪 ?깆쓣 ?쎌쓣 ???ъ슜?섏꽭??';
  
  public readonly parameters = {
    type: 'object' as const,
    properties: {
      path: { type: 'string', description: '?쎌쓣 ?뚯씪???덈? 寃쎈줈 ?먮뒗 ?곷? 寃쎈줈' }
    },
    required: ['path']
  };

  private fileAdapter?: IFileSystemAdapter;

  constructor(fileAdapter?: IFileSystemAdapter) {
    this.fileAdapter = fileAdapter;
    super();
  }

  protected async executeCore(args: Record<string, unknown>, context?: ToolExecutionContext): Promise<ToolCallResult> {
    const rawPath = String(args['path'] ?? '');

    let safePath: string;
    try {
      safePath = PathSanitizer.sanitizePath(rawPath, 'read', context?.missionId);
    } catch (sanitizeErr: unknown) {
      const reason = sanitizeErr instanceof PathSanitizationError ? sanitizeErr.reason : 'UNKNOWN';
      return {
        success: false,
        error: `Path blocked: ${sanitizeErr instanceof Error ? sanitizeErr.message : String(sanitizeErr)} (reason: ${reason})`,
        toolName: this.name,
        toolArgs: args
      };
    }

    if (!this.fileAdapter) {
      return {
        success: false,
        error: `fileAdapter is not initialized. Cannot read file.`,
        toolName: this.name,
        toolArgs: args
      };
    }

    const content = await this.fileAdapter.read(safePath);
    return {
      success: true,
      result: content ?? '(鍮??뚯씪)',
      toolName: this.name,
      toolArgs: args
    };
  }
}


