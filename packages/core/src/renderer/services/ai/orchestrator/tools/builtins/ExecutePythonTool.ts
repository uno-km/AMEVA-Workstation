import { BaseTool } from '../base/BaseTool';
import type { ToolCallResult, ToolExecutionContext } from '../../types';
import { executeTerminal } from '../../../../ipc/electronApiAdapter';

export class ExecutePythonTool extends BaseTool {
  public readonly name = 'execute_python';
  public readonly description = 'Python 코드를 샌드박스 환경(또는 로컬)에서 실행하고 그 결과를 반환합니다. 데이터 분석, 스크립트 검증 등에 사용하세요.';
  
  public readonly parameters = {
    type: 'object' as const,
    properties: {
      code: { type: 'string', description: '실행할 Python 코드 블록' }
    },
    required: ['code']
  };

  protected async executeCore(args: Record<string, unknown>, context?: ToolExecutionContext): Promise<ToolCallResult> {
    const code = String(args['code'] ?? '');
    
    try {
      const b64 = btoa(unescape(encodeURIComponent(code)));
      const psCmd = `
        $tmpPath = Join-Path $env:TEMP "agent_sandbox_$([Guid]::NewGuid().ToString()).py"
        [System.IO.File]::WriteAllText($tmpPath, [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String('${b64}')))
        python $tmpPath
        Remove-Item -Path $tmpPath -ErrorAction SilentlyContinue
      `.replace(/\\n/g, ';').trim();
      
      const result = await executeTerminal(`powershell -NoProfile -Command "${psCmd}"`);
      
      return {
        success: true,
        result: result.stdout || result.stderr || '(출력 없음)',
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
    }
  }
}


