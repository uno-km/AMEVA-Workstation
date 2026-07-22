import { BaseTool } from '../base/BaseTool';
import type { ToolCallResult, ToolExecutionContext } from '../../types';
import { executeTerminal } from '../../../../ipc/electronApiAdapter';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';

export class ExecuteNodeTool extends BaseTool {
  public readonly name = 'execute_node';
  public readonly description = 'Node.js(JavaScript) ì½”ë“œë¥??Œë“œë°•ìŠ¤ ?˜ê²½(?ëŠ” ë¡œì»¬)?ì„œ ?¤í–‰?˜ê³  ê·?ê²°ê³¼ë¥?ë°˜í™˜?©ë‹ˆ?? ?¤í¬ë¦½íŠ¸ ?¤í–‰, ë¡œì§ ê²€ì¦??±ì— ?¬ìš©?˜ì„¸??';
  
  public readonly parameters = {
    type: 'object' as const,
    properties: {
      code: { type: 'string', description: '?¤í–‰??Node.js(JavaScript) ì½”ë“œ ë¸”ë¡' }
    },
    required: ['code']
  };

  protected async executeCore(args: Record<string, unknown>, context?: ToolExecutionContext): Promise<ToolCallResult> {
    const code = String(args['code'] ?? '');
    
    // ?„ì‹œ ?Œì¼ ?ì„±
    const tmpDir = os.tmpdir();
    const fileName = `agent_sandbox_${Date.now()}.js`;
    const filePath = path.join(tmpDir, fileName);
    
    try {
      fs.writeFileSync(filePath, code, 'utf-8');
      
      const result = await executeTerminal(`node "${filePath}"`, tmpDir);
      
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

