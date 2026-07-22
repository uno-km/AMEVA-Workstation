import { BaseTool } from '../base/BaseTool';
import type { ToolCallResult, ToolExecutionContext } from '../../types';
import { executeTerminal } from '../../../../ipc/electronApiAdapter';

export class ListDirTool extends BaseTool {
  public readonly name = 'list_dir';
  public readonly description = 'ì§€?•ëœ ?”ë ‰? ë¦¬???Œì¼ ë°??´ë” ëª©ë¡??ë°˜í™˜?©ë‹ˆ?? ?„ì¬ ?‘ì—… ?”ë ‰? ë¦¬ ?ìƒ‰???¬ìš©?˜ì„¸??';
  
  public readonly parameters = {
    type: 'object' as const,
    properties: {
      path: { type: 'string', description: 'ëª©ë¡??ì¡°íšŒ???”ë ‰? ë¦¬ ê²½ë¡œ. ?ëµ ???„ì¬ ?”ë ‰? ë¦¬.' }
    },
    required: []
  };

  protected async executeCore(args: Record<string, unknown>, context?: ToolExecutionContext): Promise<ToolCallResult> {
    const path = args['path'] ? `"${String(args['path'])}"` : '.';
    const result = await executeTerminal(`Get-ChildItem ${path} | Select-Object Name, Length, LastWriteTime | Format-Table -AutoSize | Out-String`, undefined);
    
    return {
      success: true,
      result: result.stdout || '(?”ë ‰? ë¦¬ê°€ ë¹„ì–´?ˆìŠµ?ˆë‹¤)',
      toolName: this.name,
      toolArgs: args
    };
  }
}

