import { BaseTool } from '../base/BaseTool';
import type { ToolCallResult, ToolExecutionContext } from '../../types';
import { executeTerminal } from '../../../../ipc/electronApiAdapter';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';

export class ExecutePythonTool extends BaseTool {
  public readonly name = 'execute_python';
  public readonly description = 'Python ì½”ë“œë¥??Œë“œë°•ìŠ¤ ?˜ê²½(?ëŠ” ë¡œì»¬)?ì„œ ?¤í–‰?˜ê³  ê·?ê²°ê³¼ë¥?ë°˜í™˜?©ë‹ˆ?? ?°ì´??ë¶„ì„, ?¤í¬ë¦½íŠ¸ ê²€ì¦??±ì— ?¬ìš©?˜ì„¸??';
  
  public readonly parameters = {
    type: 'object' as const,
    properties: {
      code: { type: 'string', description: '?¤í–‰??Python ì½”ë“œ ë¸”ë¡' }
    },
    required: ['code']
  };

  protected async executeCore(args: Record<string, unknown>, context?: ToolExecutionContext): Promise<ToolCallResult> {
    const code = String(args['code'] ?? '');
    
    // ?„ì‹œ ?Œì¼ ?ì„±
    const tmpDir = os.tmpdir();
    const fileName = `agent_sandbox_${Date.now()}.py`;
    const filePath = path.join(tmpDir, fileName);
    
    try {
      // ë¡œì»¬ ?Œì¼ ?œìŠ¤?œì„ ?µí•´ ?„ì‹œ ?Œì¼ ?‘ì„±
      fs.writeFileSync(filePath, code, 'utf-8');
      
      // ?Œì´???¤í–‰
      const result = await executeTerminal(`python "${filePath}"`, tmpDir);
      
      return {
        success: true,
        result: result.stdout || result.stderr || '(ì¶œë ¥ ?†ìŒ)',
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
      // ?¤í–‰ ???„ì‹œ ?Œì¼ ?•ë¦¬
      try {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      } catch (e) {
        console.error(`?„ì‹œ ?Œì¼ ?? œ ?¤íŒ¨: ${filePath}`);
      }
    }
  }
}

