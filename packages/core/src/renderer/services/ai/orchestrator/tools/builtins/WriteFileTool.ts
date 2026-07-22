import { BaseTool } from '../base/BaseTool';
import type { ToolCallResult, ToolExecutionContext } from '../../types';
import type { IFileSystemAdapter } from '../../task-runtime/artifact/IFileSystemAdapter';
import { PathSanitizer, PathSanitizationError } from '../../task-runtime/policy/PathSanitizer';

export class WriteFileTool extends BaseTool {
  public readonly name = 'write_file';
  public readonly description = 'ì§€?•ëœ ê²½ë¡œ???´ìš©???Œì¼ë¡??€?¥í•©?ˆë‹¤. ì½”ë“œ ?ì„±, ?¤ì • ?Œì¼ ?‘ì„± ?±ì— ?¬ìš©?˜ì„¸??';
  
  public readonly parameters = {
    type: 'object' as const,
    properties: {
      path: { type: 'string', description: '?€?¥í•  ?Œì¼???ˆë? ê²½ë¡œ ?ëŠ” ?ë? ê²½ë¡œ' },
      content: { type: 'string', description: '?Œì¼???€?¥í•  ?´ìš©' }
    },
    required: ['path', 'content']
  };

  private fileAdapter?: IFileSystemAdapter;

  constructor(fileAdapter?: IFileSystemAdapter) {
    this.fileAdapter = fileAdapter;
    super();
  }

  protected async executeCore(args: Record<string, unknown>, context?: ToolExecutionContext): Promise<ToolCallResult> {
    const rawPath = String(args['path'] ?? '');
    const content = String(args['content'] ?? '');

    let safePath: string;
    try {
      safePath = PathSanitizer.sanitizePath(rawPath, 'write', context?.missionId);
    } catch (sanitizeErr: unknown) {
      const reason = sanitizeErr instanceof PathSanitizationError ? sanitizeErr.reason : 'UNKNOWN';
      return {
        success: false,
        error: `Write blocked: ${sanitizeErr instanceof Error ? sanitizeErr.message : String(sanitizeErr)} (reason: ${reason})`,
        toolName: this.name,
        toolArgs: args
      };
    }

    if (!this.fileAdapter) {
      return {
        success: false,
        error: `fileAdapter is not initialized. Cannot write file.`,
        toolName: this.name,
        toolArgs: args
      };
    }

    await this.fileAdapter.write(safePath, content);
    
    const stat = await this.fileAdapter.stat(safePath);
    const hash = await this.fileAdapter.hash(safePath);

    return {
      success: true,
      result: `?Œì¼ ?€???„ë£Œ: ${safePath}`,
      toolName: this.name,
      toolArgs: args,
      artifactId: context?.artifactId,
      missionId: context?.missionId,
      taskId: context?.taskId,
      attemptId: context?.attemptId,
      outputId: (context as any)?.expectedOutput,
      expectedPath: rawPath,
      normalizedStagedPath: safePath,
      size: stat.size,
      contentHash: hash ?? undefined,
      revision: 1,
      idempotencyKey: (context as any)?.idempotencyKey
    };
  }
}

