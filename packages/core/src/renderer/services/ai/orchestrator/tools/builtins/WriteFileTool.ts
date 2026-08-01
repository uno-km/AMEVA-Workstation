import { BaseTool } from '../base/BaseTool';
import type { ToolCallResult, ToolExecutionContext } from '../../types';
import type { IFileSystemAdapter } from '../../task-runtime/artifact/IFileSystemAdapter';
import { PathSanitizer, PathSanitizationError } from '../../task-runtime/policy/PathSanitizer';

export class WriteFileTool extends BaseTool {
  public readonly name = 'write_file';
  public readonly description = '지정된 경로에 내용을 파일로 저장합니다. 코드 생성, 설정 파일 작성 등에 사용하세요.';
  
  public readonly parameters = {
    type: 'object' as const,
    properties: {
      path: { type: 'string', description: '저장할 파일의 절대 경로 또는 상대 경로' },
      content: { type: 'string', description: '파일에 저장할 내용' }
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

    let stat;
    let hash;
    try {
      await this.fileAdapter.write(safePath, content);
      stat = await this.fileAdapter.stat(safePath);
      hash = await this.fileAdapter.hash(safePath);
    } catch (e: unknown) {
      return {
        success: false,
        error: `파일 쓰기 실패: ${e instanceof Error ? e.message : String(e)}`,
        toolName: this.name,
        toolArgs: args
      };
    }

    return {
      success: true,
      result: `파일 저장 완료: ${safePath}`,
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


