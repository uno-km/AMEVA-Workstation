/**
 * @file debug-sidecar/observability/EventNormalizer.ts
 * @system AMEVA OS Desktop Workstation
 */

import { UnifiedEventEnvelope, LogLevel, EventCategory, EventStatus } from './UnifiedEventEnvelope';
import { SequenceGenerator } from './SequenceGenerator';
import { TimestampProvider } from './TimestampProvider';
import { CorrelationContext } from './CorrelationContext';

export class EventNormalizer {
  public static create(
    level: LogLevel,
    category: EventCategory,
    component: string,
    event_type: string,
    message: string,
    options?: {
      duration_ms?: number;
      status?: EventStatus;
      failure_code?: string;
      retryable?: boolean;
      metadata?: Record<string, any>;
      payload_reference?: string;
      source?: string;
    }
  ): UnifiedEventEnvelope {
    const timeInfo = TimestampProvider.getNow();
    const context = CorrelationContext.current() || {};
    
    return {
      event_id: crypto.randomUUID(),
      sequence: SequenceGenerator.next(),
      ...timeInfo,
      level,
      category,
      component,
      event_type,
      message,
      ...context,
      ...options,
      source: options?.source || 'sidecar',
      schema_version: '1.0'
    };
  }

  public static info(category: EventCategory, component: string, event_type: string, message: string, meta?: any) {
    return this.create('INFO', category, component, event_type, message, { metadata: meta });
  }

  public static error(category: EventCategory, component: string, event_type: string, message: string, failure_code?: string, meta?: any) {
    return this.create('ERROR', category, component, event_type, message, { failure_code, metadata: meta, status: 'FAILED' });
  }

  public static debug(category: EventCategory, component: string, event_type: string, message: string, meta?: any) {
    return this.create('DEBUG', category, component, event_type, message, { metadata: meta });
  }
}
