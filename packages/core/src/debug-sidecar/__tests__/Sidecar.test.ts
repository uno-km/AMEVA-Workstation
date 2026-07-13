/**
 * @file debug-sidecar/__tests__/UnifiedEventEnvelope.test.ts
 * @system AMEVA OS Desktop Workstation
 */

import { EventNormalizer } from '../observability/EventNormalizer';
import { CorrelationContext } from '../observability/CorrelationContext';
import { SecretRedactor } from '../security/SecretRedactor';
import * as assert from 'node:assert';

async function runTests() {
  console.log('[Test] Running Unit Tests...');

  // Test 1: Event Envelope Millisecond Timestamps and Sequence
  const e1 = EventNormalizer.info('LIFECYCLE', 'Test', 'TEST', 'test');
  const e2 = EventNormalizer.info('LIFECYCLE', 'Test', 'TEST', 'test');
  
  assert.ok(e1.timestamp_ms > 0, 'timestamp_ms must exist');
  assert.ok(e2.sequence > e1.sequence, 'Sequence must strictly increase');

  // Test 2: Correlation Context is retained
  let contextEvent: any;
  await CorrelationContext.run({ trace_id: '123', correlation_id: '456', mission_id: 'm1' }, async () => {
    contextEvent = EventNormalizer.info('LIFECYCLE', 'Test', 'TEST', 'test');
  });
  
  assert.strictEqual(contextEvent.trace_id, '123', 'Trace ID must be captured');
  assert.strictEqual(contextEvent.mission_id, 'm1', 'Mission ID must be captured');

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
  assert.strictEqual(redacted.apikey, '[REDACTED]', 'API Key must be redacted');
  assert.strictEqual(redacted.metadata.password, '[REDACTED]', 'Nested password must be redacted');
  assert.strictEqual(redacted.metadata.safe, 'data', 'Safe data must not be touched');
  
  const tokenString = SecretRedactor.redactString('Authorization: Bearer my-super-secret-token');
  assert.ok(tokenString.includes('[REDACTED]'), 'Bearer token must be redacted');

  console.log('[Test] All tests passed.');
}

runTests().catch(err => {
  console.error(err);
  process.exit(1);
});
