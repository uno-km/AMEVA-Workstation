/**
 * @file debug-sidecar/observability/CorrelationContext.ts
 * @system AMEVA OS Desktop Workstation
 */

import { AsyncLocalStorage } from 'node:async_hooks';

export interface TraceContext {
  trace_id: string;
  correlation_id: string;
  mission_id?: string;
  session_id?: string;
  plan_id?: string;
  plan_version?: number;
  task_id?: string;
  attempt_id?: string;
  execution_id?: string;
  tool_call_id?: string;
  verification_id?: string;
  recovery_request_id?: string;
}

export class CorrelationContext {
  private static storage = new AsyncLocalStorage<TraceContext>();

  public static run<T>(context: TraceContext, callback: () => T): T {
    return this.storage.run(context, callback);
  }

  public static current(): TraceContext | undefined {
    return this.storage.getStore();
  }

  public static inheritAndExtend<T>(newContextFields: Partial<TraceContext>, callback: () => T): T {
    const current = this.current() || { trace_id: crypto.randomUUID(), correlation_id: crypto.randomUUID() };
    const extended = { ...current, ...newContextFields };
    return this.run(extended, callback);
  }
}
