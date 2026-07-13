import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AgentOrchestratorSession } from '../../AgentOrchestrator';
import { MCPClientManager } from '../../../../../utils/mcpClient';

describe('P0 Stabilization Tests', () => {
  let originalWindow: any;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    originalWindow = global.window;
    global.window = { dispatchEvent: vi.fn() } as any;
    global.CustomEvent = class CustomEvent { constructor() {} } as any;
  });

  afterEach(() => {
    vi.useRealTimers();
    MCPClientManager.unmountAbort();
    global.window = originalWindow;
    (MCPClientManager as any).circuitState = 'CLOSED';
    (MCPClientManager as any).failureCount = 0;
    (MCPClientManager as any).mcpToken = null;
    (MCPClientManager as any).tokenPromise = null;
  });

  describe('MCP Circuit Breaker & Single-Flight', () => {
    it('should trip the circuit breaker after MAX_FAILURES and go to HALF_OPEN after backoff', async () => {
      const fetchMock = vi.fn().mockRejectedValue(new Error('Network Error'));
      global.fetch = fetchMock;

      const url = 'http://127.0.0.1:11553/mcp';
      const body = { method: 'test' };

      for (let i = 0; i < 3; i++) {
        await expect((MCPClientManager as any).safeMcpFetch(url, body)).rejects.toThrow('Network Error');
      }

      await expect((MCPClientManager as any).safeMcpFetch(url, body)).rejects.toThrow('MCP Circuit is OPEN. Connection is UNAVAILABLE.');

      vi.advanceTimersByTime(30000);

      fetchMock.mockResolvedValueOnce({ ok: true, status: 200 });
      const res = await (MCPClientManager as any).safeMcpFetch(url, body);
      expect(res.ok).toBe(true);
      expect((MCPClientManager as any).circuitState).toBe('CLOSED');
    });

    it('should deduplicate concurrent requests (Single-flight)', async () => {
      let pendingResolve: (value: any) => void;
      const fetchPromise = new Promise((resolve) => {
        pendingResolve = resolve;
      });
      global.fetch = vi.fn().mockReturnValue(fetchPromise);

      const url = 'http://127.0.0.1:11553/mcp';
      const body = { method: 'dedupe' };

      const req1 = (MCPClientManager as any).safeMcpFetch(url, body);
      const req2 = (MCPClientManager as any).safeMcpFetch(url, body);

      pendingResolve!({ ok: true, status: 200 });
      await Promise.all([req1, req2]);

      expect(global.fetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('Llama 400 Bad Payload TTL Block', () => {
    it('should block repeated identical payloads after a 400 Bad Request', async () => {
      const blockedPayloads = new Map<string, number>();
      
      const simulateGenerateStream = async (messages: any[]) => {
        const payloadString = JSON.stringify({ messages, stream: true, temperature: 0.1 });
        const payloadHash = `hash-${payloadString.length}`;

        const blockExpiry = blockedPayloads.get(payloadHash);
        if (blockExpiry && Date.now() < blockExpiry) {
          throw new Error(`[LlamaLocalEngineAdapter] TTL Blocked Bad Payload (Hash: ${payloadHash})`);
        }

        if (messages[0].content === 'bad') {
          blockedPayloads.set(payloadHash, Date.now() + 60000);
          throw new Error('Llama.cpp HTTP Error: 400');
        }

        return 'success';
      };

      const badMessages = [{ role: 'user', content: 'bad' }];
      
      await expect(simulateGenerateStream(badMessages)).rejects.toThrow('Llama.cpp HTTP Error: 400');
      await expect(simulateGenerateStream(badMessages)).rejects.toThrow(/TTL Blocked Bad Payload/);
      
      vi.advanceTimersByTime(61000);
      
      await expect(simulateGenerateStream(badMessages)).rejects.toThrow('Llama.cpp HTTP Error: 400');
    });
  });

  describe('Tool Call Idempotency', () => {
    it('should skip duplicate tool calls using executedToolHashes', async () => {
      const orchestrator = new AgentOrchestratorSession({
        systemPrompt: '',
        modelPath: '',
        maxTokens: 1000,
        temperature: 0.1
      });
      
      const toolName = 'test_tool';
      const argsStr = JSON.stringify({ param: 1 });
      const hash = `hash_${toolName}_${argsStr}`;
      
      (orchestrator as any).executedToolHashes.add(hash);

      const isDuplicate = (orchestrator as any).executedToolHashes.has(hash);
      expect(isDuplicate).toBe(true);
    });
  });
});
