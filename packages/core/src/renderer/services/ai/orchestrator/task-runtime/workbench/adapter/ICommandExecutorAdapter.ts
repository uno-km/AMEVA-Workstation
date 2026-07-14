import { CommandPlan, CommandExecutionResult } from '../domain/WorkbenchTypes';

export interface ICommandExecutorAdapter {
  execute(plan: CommandPlan, networkPolicy: string, memoryLimitBytes: number): Promise<CommandExecutionResult>;
  cancel(commandId: string): Promise<void>;
  getStatus(commandId: string): Promise<'RUNNING' | 'COMPLETED' | 'FAILED' | 'INTERRUPTED'>;
  getCapabilities(): Record<string, string>;
}
