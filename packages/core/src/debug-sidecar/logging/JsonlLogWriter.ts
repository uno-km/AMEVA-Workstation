/**
 * @file debug-sidecar/logging/JsonlLogWriter.ts
 * @system AMEVA OS Desktop Workstation
 */

import { promises as fs, createWriteStream, WriteStream } from 'node:fs';
import * as path from 'node:path';
import { UnifiedEventEnvelope } from '../observability/UnifiedEventEnvelope';
import { SecretRedactor } from '../security/SecretRedactor';

export class JsonlLogWriter {
  private stream: WriteStream | null = null;
  private queue: UnifiedEventEnvelope[] = [];
  private isWriting = false;

  constructor(public readonly filePath: string) {}

  public async init() {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    this.stream = createWriteStream(this.filePath, { flags: 'a', encoding: 'utf8' });
  }

  public append(event: UnifiedEventEnvelope) {
    // Apply redaction before queueing
    const safeEvent = {
      ...event,
      metadata: event.metadata ? SecretRedactor.redactObject(event.metadata) : undefined,
      message: SecretRedactor.redactString(event.message)
    };
    
    this.queue.push(safeEvent);
    this.flush(); // Fire and forget
  }

  private async flush() {
    if (this.isWriting || this.queue.length === 0 || !this.stream) return;
    this.isWriting = true;

    try {
      while (this.queue.length > 0) {
        const eventsToProcess = [...this.queue];
        this.queue = [];
        
        const chunk = eventsToProcess.map(e => JSON.stringify(e) + '\n').join('');
        
        await new Promise<void>((resolve, reject) => {
          if (!this.stream!.write(chunk)) {
            this.stream!.once('drain', resolve);
          } else {
            resolve();
          }
        });
      }
    } finally {
      this.isWriting = false;
      if (this.queue.length > 0) {
        this.flush(); // Continue if more arrived
      }
    }
  }

  public async close() {
    if (this.queue.length > 0) {
      await this.flush();
    }
    return new Promise<void>((resolve) => {
      if (this.stream) {
        this.stream.end(resolve);
      } else {
        resolve();
      }
    });
  }
}
