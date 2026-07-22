import { BaseTool } from '../base/BaseTool';
import type { ToolCallResult, ToolExecutionContext } from '../../types';
import type { IFileSystemAdapter } from '../../task-runtime/artifact/IFileSystemAdapter';
import { PathSanitizer, PathSanitizationError } from '../../task-runtime/policy/PathSanitizer';

export class ReadFileTool extends BaseTool {
  public readonly name = 'read_file';
  public readonly description = 'ì§€?•ëœ ?Œì¼ ê²½ë¡œ???´ìš©???½ì–´ ë°˜í™˜?©ë‹ˆ?? ì½”ë“œ ?Œì¼, ?¤ì • ?Œì¼, ë¬¸ì„œ ?Œì¼ ?±ì„ ?½ì„ ???¬ìš©?˜ì„¸??';
  
  public readonly parameters = {
    type: 'object' as const,
    properties: {
      path: { type: 'string', description: '?½ì„ ?Œì¼???ˆë? ê²½ë¡œ ?ëŠ” ?ë? ê²½ë¡œ' }
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
      result: content ?? '(ë¹??Œì¼)',
      toolName: this.name,
      toolArgs: args
    };
  }
}

