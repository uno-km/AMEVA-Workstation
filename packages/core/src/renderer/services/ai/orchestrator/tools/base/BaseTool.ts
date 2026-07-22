import type { ToolDefinition, ToolCallResult, ToolExecutionContext } from '../../types';

/**
 * BaseTool
 * 에이전트 도구의 공통 추상 클래스.
 * 모든 도구는 이 클래스를 상속받아 구현해야 하며, 공통 에러 핸들링 및 컨텍스트 로직을 제공합니다.
 */
export abstract class BaseTool implements ToolDefinition {
  public abstract readonly name: string;
  public abstract readonly description: string;
  public abstract readonly parameters: ToolDefinition['parameters'];

  /**
   * 하위 클래스에서 반드시 구현해야 하는 실제 도구 실행 로직.
   */
  protected abstract executeCore(args: Record<string, unknown>, context?: ToolExecutionContext): Promise<ToolCallResult>;

  /**
   * 외부(ToolRegistry)에서 호출하는 퍼블릭 실행 메서드.
   * 공통 에러 핸들링(try-catch) 래핑을 수행합니다.
   */
  public async execute(args: Record<string, unknown>, context?: ToolExecutionContext): Promise<ToolCallResult> {
    try {
      return await this.executeCore(args, context);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[ToolExecutionError] 도구(${this.name}) 실행 중 예외 발생:`, msg);
      return {
        success: false,
        error: `${this.name} 실행 중 오류: ${msg}`,
        toolName: this.name,
        toolArgs: args,
      };
    }
  }
}
