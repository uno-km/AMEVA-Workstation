/**
 * @file Phase4TraceRedaction.test.ts
 * @system AMEVA OS Desktop Workstation
 * @role Phase 4 SecretRedactor 및 ExecutionTraceStore의 민감정보(Credential, PI, Token, Key) 차단 및 Redaction 검증
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { SecretRedactor } from '../trace/SecretRedactor';
import { ExecutionTraceStore } from '../trace/ExecutionTraceStore';

describe('Phase 4 Trace Redaction Suite', () => {
  let store: ExecutionTraceStore;

  beforeEach(() => {
    store = new ExecutionTraceStore();
  });

  it('1. masks credentials, tokens, passwords, and API keys in arguments cleanly without mutating original object', () => {
    const original = {
      apiKey: 'sk-live-secret-12345',
      database: {
        connectionString: 'postgres://admin:password123@db.example.com:5432/main',
        dbUrl: 'postgres://admin:password123@db.example.com:5432/main',
        auth: { password: 'my_db_password' }
      },
      headers: {
        Authorization: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c'
      },
      safeField: 'hello world'
    };

    const { redactedArguments, redactedArgumentKeys } = SecretRedactor.redactArguments(original);

    // Original must remain untouched
    expect(original.apiKey).toBe('sk-live-secret-12345');
    expect(original.database.auth.password).toBe('my_db_password');

    // Redacted copy
    expect(redactedArguments.apiKey).toBe('[REDACTED_CREDENTIAL]');
    expect(redactedArguments.database.connectionString).toBe('[REDACTED_CREDENTIAL]');
    expect(redactedArguments.database.dbUrl).toContain('[REDACTED_CONNECTION_STRING]');
    expect(redactedArguments.database.auth.password).toBe('[REDACTED_CREDENTIAL]');
    expect(redactedArguments.headers.Authorization).toBe('[REDACTED_CREDENTIAL]');
    expect(redactedArguments.safeField).toBe('hello world');

    expect(redactedArgumentKeys).toContain('apiKey');
    expect(redactedArgumentKeys).toContain('database.auth.password');
  });

  it('2. masks private RSA keys, tokens, cookies, and connection strings in raw string blocks (redactText)', () => {
    const text = `
Connecting to postgres://root:supersecret@localhost:5432/mydb
Cookie: session=xyz9876543210; path=/
Authorization: Bearer secret_jwt_string_1234
And SSH Key:
-----BEGIN RSA PRIVATE KEY-----
MIIBOgIBAAJBAKj3...
-----END RSA PRIVATE KEY-----
    `;

    const redacted = SecretRedactor.redactText(text);
    expect(redacted).toContain('[REDACTED_CONNECTION_STRING]');
    expect(redacted).toContain('Cookie: [REDACTED_COOKIE]');
    expect(redacted).toContain('Bearer [REDACTED_TOKEN]');
    expect(redacted).toContain('[REDACTED_PRIVATE_KEY]');
    expect(redacted).not.toContain('supersecret');
  });

  it('3. automatically scrubs event metadata and error stack traces when redacting an entire TraceEvent', () => {
    const ev = {
      eventId: 'ev-redact-meta',
      traceId: 'm-redact',
      spanId: 's-redact',
      missionId: 'm-redact',
      timestamp: Date.now(),
      eventType: 'tool_execution_failed' as const,
      status: 'FAILED',
      title: 'Failed call',
      summary: 'Failure due to wrong API key: Bearer secret_token_abc',
      sequenceNumber: 1,
      visibility: 'USER' as const,
      schemaVersion: '4.0.0',
      metadata: {
        dbUrl: 'postgres://admin:secretpass@backend.local',
        token: 'Bearer sensitive_bearer_token'
      },
      error: {
        errorCode: 'AUTH_FAILED',
        message: 'Unauthorized with apiKey=sk-12345',
        stack: 'Error: Unauthorized\n  at login (Bearer secret_stack_token_xyz)\n  at main'
      }
    };

    const redacted = SecretRedactor.redactEvent(ev);
    expect(redacted.summary).toContain('Bearer [REDACTED_TOKEN]');
    expect(redacted.metadata?.dbUrl).toContain('[REDACTED_CONNECTION_STRING]');
    expect(redacted.error?.message).toContain('apiKey=[REDACTED_SECRET]');
    expect(redacted.error?.stack).toContain('Bearer [REDACTED_TOKEN]');
  });

  it('4. guarantees store automatically applies SecretRedactor upon appendEvent before storing in memory', () => {
    store.appendEvent({
      eventId: 'ev-store-redact',
      traceId: 'm-s-redact',
      spanId: 's-s-redact',
      missionId: 'm-s-redact',
      timestamp: Date.now(),
      eventType: 'tool_execution_started',
      status: 'RUNNING',
      title: 'Network request',
      summary: 'Calling network with Authorization: Bearer my_secret_token',
      sequenceNumber: 1,
      visibility: 'USER',
      schemaVersion: '4.0.0',
      toolExecution: {
        toolCallId: 'tcall-secret',
        toolName: 'fetch_url',
        toolCategory: 'network',
        selectionReason: 'Fetch protected url',
        normalizedArguments: { apiKey: 'my_secret_key', url: 'https://api.example.com' },
        redactedArgumentKeys: [],
        riskLevel: 'LOW',
        approvalRequired: false,
        startedAt: Date.now(),
        resultStatus: 'RUNNING'
      }
    });

    const stored = store.getMissionTrace('m-s-redact')[0];
    expect(stored.summary).toContain('Bearer [REDACTED_TOKEN]');
    expect(stored.toolExecution?.normalizedArguments.apiKey).toBe('[REDACTED_CREDENTIAL]');
  });
});
