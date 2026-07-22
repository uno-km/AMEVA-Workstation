import { BaseTool } from '../base/BaseTool';
import type { ToolCallResult, ToolExecutionContext } from '../../types';
import { executeTerminal } from '../../../../ipc/electronApiAdapter';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';

export class ExecutePythonTool extends BaseTool {
  public readonly name = 'execute_python';
  public readonly description = 'Python 肄붾뱶瑜??뚮뱶諛뺤뒪 ?섍꼍(?먮뒗 濡쒖뺄)?먯꽌 ?ㅽ뻾?섍퀬 洹?寃곌낵瑜?諛섑솚?⑸땲?? ?곗씠??遺꾩꽍, ?ㅽ겕由쏀듃 寃利??깆뿉 ?ъ슜?섏꽭??';
  
  public readonly parameters = {
    type: 'object' as const,
    properties: {
      code: { type: 'string', description: '?ㅽ뻾??Python 肄붾뱶 釉붾줉' }
    },
    required: ['code']
  };

  protected async executeCore(args: Record<string, unknown>, context?: ToolExecutionContext): Promise<ToolCallResult> {
    const code = String(args['code'] ?? '');
    
    // ?꾩떆 ?뚯씪 ?앹꽦
    const tmpDir = os.tmpdir();
    const fileName = `agent_sandbox_${Date.now()}.py`;
    const filePath = path.join(tmpDir, fileName);
    
    try {
      // 濡쒖뺄 ?뚯씪 ?쒖뒪?쒖쓣 ?듯빐 ?꾩떆 ?뚯씪 ?묒꽦
      fs.writeFileSync(filePath, code, 'utf-8');
      
      // ?뚯씠???ㅽ뻾
      const result = await executeTerminal(`python "${filePath}"`, tmpDir);
      
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
      // ?ㅽ뻾 ???꾩떆 ?뚯씪 ?뺣━
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


