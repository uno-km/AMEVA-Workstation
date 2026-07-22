import { BaseTool } from '../base/BaseTool';
import type { ToolCallResult, ToolExecutionContext } from '../../types';
import type { IFileSystemAdapter } from '../../task-runtime/artifact/IFileSystemAdapter';
import { PathSanitizer, PathSanitizationError } from '../../task-runtime/policy/PathSanitizer';

export class AppendFileTool extends BaseTool {
  public readonly name = 'append_file';
  public readonly description = 'ê¸°ì¡´ ?Œì¼???ì— ?ˆë¡œ???´ìš©??ì¶”ê?(Append)?©ë‹ˆ?? ë³´ê³ ?œë‚˜ ë¬¸ì„œë¥??œì°¨?ìœ¼ë¡??´ì–´???‘ì„±?????´ì „ ?´ìš©????–´?Œì›Œì§€ì§€ ?Šë„ë¡?ë°˜ë“œ?????„êµ¬ë¥??¬ìš©?˜ì„¸??';
  
  public readonly parameters = {
    type: 'object' as const,
    properties: {
      path: { type: 'string', description: '?´ìš©??ì¶”ê????Œì¼???ˆë? ê²½ë¡œ ?ëŠ” ?ë? ê²½ë¡œ' },
      content: { type: 'string', description: '?Œì¼ ?ì— ì¶”ê????´ìš©' }
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
    const appendContent = String(args['content'] ?? '');

    let safePath: string;
    try {
      safePath = PathSanitizer.sanitizePath(rawPath, 'write', context?.missionId);
    } catch (sanitizeErr: unknown) {
      const reason = sanitizeErr instanceof PathSanitizationError ? sanitizeErr.reason : 'UNKNOWN';
      return {
        success: false,
        error: `Append blocked: ${sanitizeErr instanceof Error ? sanitizeErr.message : String(sanitizeErr)} (reason: ${reason})`,
        toolName: this.name,
        toolArgs: args
      };
    }

    if (!this.fileAdapter) {
      return {
        success: false,
        error: `fileAdapter is not initialized. Cannot append file.`,
        toolName: this.name,
        toolArgs: args
      };
    }

    // 1. ê¸°ì¡´ ?´ìš© ?½ê¸° (?†ìœ¼ë©?ë¹?ë¬¸ì??
    let existingContent = '';
    try {
      existingContent = (await this.fileAdapter.read(safePath)) ?? '';
    } catch (e) {
      existingContent = '';
    }

    // 2. ?´ìš© ê²°í•©
    let finalContent = existingContent;
    if (finalContent.length > 0 && !finalContent.endsWith('\n')) {
      finalContent += '\n';
    }
    finalContent += appendContent;

    // 3. ?¤ì‹œ ?°ê¸°
    await this.fileAdapter.write(safePath, finalContent);
    
    const stat = await this.fileAdapter.stat(safePath);
    const hash = await this.fileAdapter.hash(safePath);

    return {
      success: true,
      result: `?Œì¼ ?´ìš© ì¶”ê?(Append) ?„ë£Œ: ${safePath}`,
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

