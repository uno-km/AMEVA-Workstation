/**
 * @file debug-sidecar/observability/UnifiedEventEnvelope.ts
 * @system AMEVA OS Desktop Workstation
 * @role Event Model for Debug Sidecar
 */

export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
export type EventCategory = 'LIFECYCLE' | 'SCHEDULER' | 'LLM' | 'TOOL' | 'VERIFICATION' | 'RECOVERY' | 'SYSTEM';
export type EventStatus = 'PENDING' | 'IN_PROGRESS' | 'SUCCESS' | 'FAILED' | 'CANCELLED';

export interface UnifiedEventEnvelope {
  event_id: string;
  sequence: number;
  timestamp: string; // ISO 8601
  timestamp_ms: number; // Date.now()
  monotonic_ms: number; // performance.now()
  timezone: string;
  level: LogLevel;
  category: EventCategory;
  component: string;
  event_type: string;
  message: string;
  
  mission_id?: string;
  chat_id?: string;
  session_id?: string;
  goal_id?: string;
  plan_id?: string;
  plan_version?: number;
  task_id?: string;
  attempt_id?: string;
  execution_id?: string;
  result_id?: string;
  verification_id?: string;
  recovery_request_id?: string;
  tool_call_id?: string;
  parent_event_id?: string;
  correlation_id?: string;
  causation_id?: string;
  trace_id?: string;
  span_id?: string;
  
  duration_ms?: number;
  status?: EventStatus;
  failure_code?: string;
  retryable?: boolean;
  metadata?: Record<string, any>;
  payload_reference?: string;
  source: string;
  schema_version: '1.0';
}
