import { BaseTool } from '../base/BaseTool';
import type { ToolCallResult, ToolExecutionContext } from '../../types';
import { executeTerminal } from '../../../../ipc/electronApiAdapter';

export class RunCommandTool extends BaseTool {
  public readonly name = 'run_command';
  public readonly description = '?¸ìŠ¤??OS(Windows)?ì„œ PowerShell ëª…ë ¹?´ë? ?¤í–‰?˜ê³  stdout/stderrë¥?ë°˜í™˜?©ë‹ˆ?? ?Œì¼ ?‘ì—…, ë¹Œë“œ, ?¨í‚¤ì§€ ?¤ì¹˜ ?±ì— ?¬ìš©?˜ì„¸??';
  
  public readonly parameters = {
    type: 'object' as const,
    properties: {
      cmd: { type: 'string', description: '?¤í–‰??PowerShell ëª…ë ¹??(?? dir, npm install, git status)' },
      cwd: { type: 'string', description: 'ëª…ë ¹???¤í–‰ ?”ë ‰? ë¦¬ ê²½ë¡œ (? íƒ?¬í•­)' }
    },
    required: ['cmd']
  };

  protected async executeCore(args: Record<string, unknown>, context?: ToolExecutionContext): Promise<ToolCallResult> {
    const cmd = String(args['cmd'] ?? '');
    const cwd = args['cwd'] ? String(args['cwd']) : undefined;

    const result = await executeTerminal(cmd, cwd);
    return {
      success: true,
      result: result.stdout || result.stderr || '(ì¶œë ¥ ?†ìŒ)',
      toolName: this.name,
      toolArgs: args
    };
  }
}

