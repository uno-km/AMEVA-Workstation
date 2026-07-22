import { BaseTool } from '../base/BaseTool';
import type { ToolCallResult, ToolExecutionContext } from '../../types';
import { executeTerminal } from '../../../../ipc/electronApiAdapter';

export class RunCommandTool extends BaseTool {
  public readonly name = 'run_command';
  public readonly description = '?몄뒪??OS(Windows)?먯꽌 PowerShell 紐낅졊?대? ?ㅽ뻾?섍퀬 stdout/stderr瑜?諛섑솚?⑸땲?? ?뚯씪 ?묒뾽, 鍮뚮뱶, ?⑦궎吏 ?ㅼ튂 ?깆뿉 ?ъ슜?섏꽭??';
  
  public readonly parameters = {
    type: 'object' as const,
    properties: {
      cmd: { type: 'string', description: '?ㅽ뻾??PowerShell 紐낅졊??(?? dir, npm install, git status)' },
      cwd: { type: 'string', description: '紐낅졊???ㅽ뻾 ?붾젆?좊━ 寃쎈줈 (?좏깮?ы빆)' }
    },
    required: ['cmd']
  };

  protected async executeCore(args: Record<string, unknown>, context?: ToolExecutionContext): Promise<ToolCallResult> {
    const cmd = String(args['cmd'] ?? '');
    const cwd = args['cwd'] ? String(args['cwd']) : undefined;

    const result = await executeTerminal(cmd, cwd);
    return {
      success: true,
      result: result.stdout || result.stderr || '(異쒕젰 ?놁쓬)',
      toolName: this.name,
      toolArgs: args
    };
  }
}


