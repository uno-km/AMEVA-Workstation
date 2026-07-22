import { BaseTool } from '../base/BaseTool';
import type { ToolCallResult, ToolExecutionContext } from '../../types';
import type { IFileSystemAdapter } from '../../task-runtime/artifact/IFileSystemAdapter';
import { PathSanitizer, PathSanitizationError } from '../../task-runtime/policy/PathSanitizer';

export class AppendFileTool extends BaseTool {
  public readonly name = 'append_file';
  public readonly description = '湲곗〈 ?뚯씪???앹뿉 ?덈줈???댁슜??異붽?(Append)?⑸땲?? 蹂닿퀬?쒕굹 臾몄꽌瑜??쒖감?곸쑝濡??댁뼱???묒꽦?????댁쟾 ?댁슜????뼱?뚯썙吏吏 ?딅룄濡?諛섎뱶?????꾧뎄瑜??ъ슜?섏꽭??';
  
  public readonly parameters = {
    type: 'object' as const,
    properties: {
      path: { type: 'string', description: '?댁슜??異붽????뚯씪???덈? 寃쎈줈 ?먮뒗 ?곷? 寃쎈줈' },
      content: { type: 'string', description: '?뚯씪 ?앹뿉 異붽????댁슜' }
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

    // 1. 湲곗〈 ?댁슜 ?쎄린 (?놁쑝硫?鍮?臾몄옄??
    let existingContent = '';
    try {
      existingContent = (await this.fileAdapter.read(safePath)) ?? '';
    } catch (e) {
      existingContent = '';
    }

    // 2. ?댁슜 寃고빀
    let finalContent = existingContent;
    if (finalContent.length > 0 && !finalContent.endsWith('\n')) {
      finalContent += '\n';
    }
    finalContent += appendContent;

    // 3. ?ㅼ떆 ?곌린
    await this.fileAdapter.write(safePath, finalContent);
    
    const stat = await this.fileAdapter.stat(safePath);
    const hash = await this.fileAdapter.hash(safePath);

    return {
      success: true,
      result: `?뚯씪 ?댁슜 異붽?(Append) ?꾨즺: ${safePath}`,
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


