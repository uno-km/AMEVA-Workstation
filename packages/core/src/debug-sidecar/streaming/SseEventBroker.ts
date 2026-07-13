/**
 * @file debug-sidecar/streaming/SseEventBroker.ts
 * @system AMEVA OS Desktop Workstation
 */

import { ServerResponse } from 'node:http';
import { UnifiedEventEnvelope } from '../observability/UnifiedEventEnvelope';

interface Client {
  res: ServerResponse;
  missionId?: string;
  sequenceCursor: number;
}

export class SseEventBroker {
  private clients = new Set<Client>();
  private history: UnifiedEventEnvelope[] = [];
  private readonly MAX_HISTORY = 10000;

  public addClient(res: ServerResponse, missionId?: string, lastEventId?: number) {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*'
    });

    const client: Client = { res, missionId, sequenceCursor: lastEventId || 0 };
    this.clients.add(client);

    // Replay history if needed
    if (lastEventId) {
      const missed = this.history.filter(e => e.sequence > lastEventId && (!missionId || e.mission_id === missionId));
      for (const e of missed) {
        this.sendToClient(client, e);
      }
    }

    res.on('close', () => {
      this.clients.delete(client);
    });

    // Heartbeat
    const interval = setInterval(() => {
      if (this.clients.has(client)) {
        res.write(':\n\n'); // SSE comment
      } else {
        clearInterval(interval);
      }
    }, 15000);
  }

  public broadcast(event: UnifiedEventEnvelope) {
    this.history.push(event);
    if (this.history.length > this.MAX_HISTORY) {
      this.history.shift(); // simple rotation
    }

    for (const client of this.clients) {
      if (!client.missionId || client.missionId === event.mission_id) {
        this.sendToClient(client, event);
      }
    }
  }

  private sendToClient(client: Client, event: UnifiedEventEnvelope) {
    try {
      client.res.write(`id: ${event.sequence}\n`);
      client.res.write(`event: ${event.event_type}\n`);
      client.res.write(`data: ${JSON.stringify(event)}\n\n`);
      client.sequenceCursor = event.sequence;
    } catch (err) {
      // Slow client or closed connection, remove it
      this.clients.delete(client);
      client.res.end();
    }
  }
}
