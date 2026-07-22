import { BaseTool } from '../base/BaseTool';
import type { ToolCallResult, ToolExecutionContext } from '../../types';
import { executeTerminal } from '../../../../ipc/electronApiAdapter';

export class ListDirTool extends BaseTool {
  public readonly name = 'list_dir';
  public readonly description = '吏?뺣맂 ?붾젆?좊━???뚯씪 諛??대뜑 紐⑸줉??諛섑솚?⑸땲?? ?꾩옱 ?묒뾽 ?붾젆?좊━ ?먯깋???ъ슜?섏꽭??';
  
  public readonly parameters = {
    type: 'object' as const,
    properties: {
      path: { type: 'string', description: '紐⑸줉??議고쉶???붾젆?좊━ 寃쎈줈. ?앸왂 ???꾩옱 ?붾젆?좊━.' }
    },
    required: []
  };

  protected async executeCore(args: Record<string, unknown>, context?: ToolExecutionContext): Promise<ToolCallResult> {
    const path = args['path'] ? `"${String(args['path'])}"` : '.';
    const result = await executeTerminal(`Get-ChildItem ${path} | Select-Object Name, Length, LastWriteTime | Format-Table -AutoSize | Out-String`, undefined);
    
    return {
      success: true,
      result: result.stdout || '(?붾젆?좊━媛 鍮꾩뼱?덉뒿?덈떎)',
      toolName: this.name,
      toolArgs: args
    };
  }
}


