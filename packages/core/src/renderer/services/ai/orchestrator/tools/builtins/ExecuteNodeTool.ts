import { BaseTool } from '../base/BaseTool';
import type { ToolCallResult, ToolExecutionContext } from '../../types';
import { executeTerminal } from '../../../../ipc/electronApiAdapter';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';

export class ExecuteNodeTool extends BaseTool {
  public readonly name = 'execute_node';
  public readonly description = 'Node.js(JavaScript) 肄붾뱶瑜??뚮뱶諛뺤뒪 ?섍꼍(?먮뒗 濡쒖뺄)?먯꽌 ?ㅽ뻾?섍퀬 洹?寃곌낵瑜?諛섑솚?⑸땲?? ?ㅽ겕由쏀듃 ?ㅽ뻾, 濡쒖쭅 寃利??깆뿉 ?ъ슜?섏꽭??';
  
  public readonly parameters = {
    type: 'object' as const,
    properties: {
      code: { type: 'string', description: '?ㅽ뻾??Node.js(JavaScript) 肄붾뱶 釉붾줉' }
    },
    required: ['code']
  };

  protected async executeCore(args: Record<string, unknown>, context?: ToolExecutionContext): Promise<ToolCallResult> {
    const code = String(args['code'] ?? '');
    
    // ?꾩떆 ?뚯씪 ?앹꽦
    const tmpDir = os.tmpdir();
    const fileName = `agent_sandbox_${Date.now()}.js`;
    const filePath = path.join(tmpDir, fileName);
    
    try {
      fs.writeFileSync(filePath, code, 'utf-8');
      
      const result = await executeTerminal(`node "${filePath}"`, tmpDir);
      
      return {
        success: true,
        result: result.stdout || result.stderr || '(異쒕젰 ?놁쓬)',
        toolName: this.name,
        toolArgs: args
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        error: msg,
        toolName: this.name,
        toolArgs: args
      };
    } finally {
      try {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      } catch (e) {
        console.error(`?꾩떆 ?뚯씪 ??젣 ?ㅽ뙣: ${filePath}`);
      }
    }
  }
}


