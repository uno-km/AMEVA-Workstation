/**
 * @file debug-sidecar/api/DebugApiServer.ts
 * @system AMEVA OS Desktop Workstation
 */

import * as http from 'node:http';
import { MissionControlService } from '../control/MissionControlService';
import { SseEventBroker } from '../streaming/SseEventBroker';
import { MissionLogManager } from '../logging/MissionLogManager';
import { ConsoleCollector } from '../collectors/ConsoleCollector';
import { UnifiedEventEnvelope } from '../observability/UnifiedEventEnvelope';

export class DebugApiServer {
  private server: http.Server;

  constructor(
    private port: number,
    private controlService: MissionControlService,
    private sseBroker: SseEventBroker,
    private logManager: MissionLogManager
  ) {
    // Intercept logManager.logEvent to also broadcast to SSE
    const originalLog = this.logManager.logEvent.bind(this.logManager);
    this.logManager.logEvent = async (event: UnifiedEventEnvelope) => {
      this.sseBroker.broadcast(event);
      return originalLog(event);
    };

    this.server = http.createServer((req, res) => this.handleRequest(req, res));
  }

  private parseBody(req: http.IncomingMessage): Promise<any> {
    return new Promise((resolve, reject) => {
      let body = '';
      req.on('data', chunk => body += chunk.toString());
      req.on('end', () => {
        try {
          resolve(body ? JSON.parse(body) : {});
        } catch (e) {
          reject(e);
        }
      });
    });
  }

  private sendJson(res: http.ServerResponse, status: number, data: any) {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
  }

  private async handleRequest(req: http.IncomingMessage, res: http.ServerResponse) {
    const url = new URL(req.url || '/', `http://${req.headers.host}`);
    const method = req.method;

    if (method === 'GET' && url.pathname === '/api/debug/v1/health') {
      return this.sendJson(res, 200, { status: 'OK' });
    }

    if (method === 'POST' && url.pathname === '/api/debug/v1/missions') {
      const body = await this.parseBody(req);
      const missionId = crypto.randomUUID();
      
      this.sendJson(res, 200, { mission_id: missionId, status: 'CREATED', stream_url: `/api/debug/v1/missions/${missionId}/stream` });
      return;
    }

    if (method === 'POST' && url.pathname.match(/^\/api\/debug\/v1\/missions\/([^\/]+)\/run$/)) {
      const match = url.pathname.match(/^\/api\/debug\/v1\/missions\/([^\/]+)\/run$/);
      const missionId = match![1];
      const body = await this.parseBody(req);

      try {
        await this.controlService.startMission({
          missionId,
          prompt: body.prompt || 'test',
          model: body.model || 'test-model',
          endpoint: body.endpoint || 'http://localhost:11434',
          runtimeMode: body.runtimeMode || 'legacy'
        });
        return this.sendJson(res, 200, { status: 'STARTED' });
      } catch (e: any) {
        return this.sendJson(res, 500, { error: e.message });
      }
    }

    if (method === 'POST' && url.pathname.match(/^\/api\/debug\/v1\/missions\/([^\/]+)\/cancel$/)) {
      const match = url.pathname.match(/^\/api\/debug\/v1\/missions\/([^\/]+)\/cancel$/);
      await this.controlService.cancelMission(match![1]);
      return this.sendJson(res, 200, { status: 'CANCELLED' });
    }

    if (method === 'GET' && url.pathname.match(/^\/api\/debug\/v1\/missions\/([^\/]+)\/stream$/)) {
      const match = url.pathname.match(/^\/api\/debug\/v1\/missions\/([^\/]+)\/stream$/);
      const missionId = match![1];
      const lastEventId = parseInt(req.headers['last-event-id'] as string || '0', 10);
      this.sseBroker.addClient(res, missionId, lastEventId);
      return;
    }

    this.sendJson(res, 404, { error: 'Not Found' });
  }

  public start() {
    this.server.listen(this.port, '127.0.0.1', () => {
      console.log(`[DebugApiServer] Listening on http://127.0.0.1:${this.port}`);
    });
  }

  public async stop() {
    return new Promise<void>((resolve) => this.server.close(() => resolve()));
  }
}
