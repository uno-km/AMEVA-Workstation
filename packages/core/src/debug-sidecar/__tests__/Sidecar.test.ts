/**
 * @file debug-sidecar/__tests__/UnifiedEventEnvelope.test.ts
/**
 * @file debug-sidecar/__tests__/UnifiedEventEnvelope.test.ts
 * @system AMEVA OS Desktop Workstation
 */

import { EventNormalizer } from '../observability/EventNormalizer';
import { CorrelationContext } from '../observability/CorrelationContext';
import { SecretRedactor } from '../security/SecretRedactor';
import { describe, it, expect } from 'vitest';

describe('UnifiedEventEnvelope', () => {
  it('should run all unit tests for Sidecar', async () => {
    console.log('[Test] Running Unit Tests...');

  // Test 1: Event Envelope Millisecond Timestamps and Sequence
  const e1 = EventNormalizer.info('LIFECYCLE', 'Test', 'TEST', 'test');
  const e2 = EventNormalizer.info('LIFECYCLE', 'Test', 'TEST', 'test');
  
  expect(e1.timestamp_ms).toBeGreaterThan(0);
  expect(e2.sequence).toBeGreaterThan(e1.sequence);

  // Test 2: Correlation Context is retained
  let contextEvent: any;
  await CorrelationContext.run({ trace_id: '123', correlation_id: '456', mission_id: 'm1' }, async () => {
    contextEvent = EventNormalizer.info('LIFECYCLE', 'Test', 'TEST', 'test');
  });
  
  expect(contextEvent.trace_id).toBe('123');
  expect(contextEvent.mission_id).toBe('m1');

  // Test 3: Secret Redaction
  const rawData = {
    user: 'test',
    apikey: 'sk-1234567890',
    metadata: {
      password: 'mypassword123',
      safe: 'data'
    }
  };
  const redacted = SecretRedactor.redactObject(rawData);
  expect(redacted.apikey).toBe('[REDACTED]');
  expect(redacted.metadata.password).toBe('[REDACTED]');
  expect(redacted.metadata.safe).toBe('data');
  
  const tokenString = SecretRedactor.redactString('Authorization: Bearer my-super-secret-token');
  expect(tokenString).toContain('[REDACTED]');

    console.log('[Test] All tests passed.');
  });
});
