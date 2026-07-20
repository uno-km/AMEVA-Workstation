/**
 * @file debug-sidecar/logging/MissionLogManager.ts
 * @system AMEVA OS Desktop Workstation
 */

import * as path from 'node:path';
import { JsonlLogWriter } from './JsonlLogWriter';
import { UnifiedEventEnvelope } from '../observability/UnifiedEventEnvelope';

export class MissionLogManager {
  private writers = new Map<string, JsonlLogWriter>();
  private readonly baseDir: string;

  constructor(baseDir?: string) {
    this.baseDir = baseDir || path.join(process.cwd(), 'debug-logs');
  }

  private getMissionDateDir(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }

  public async getWriter(missionId: string, type: 'mission' | 'timeline' | 'events', chatId?: string): Promise<JsonlLogWriter> {
    const key = `${missionId}:${type}`;
    if (this.writers.has(key)) {
      return this.writers.get(key)!;
    }

    const dir = chatId 
      ? path.join(this.baseDir, chatId, missionId)
      : path.join(this.baseDir, this.getMissionDateDir(), `mission_${missionId}`);
    
    const filePath = path.join(dir, `${type}.jsonl`);
    
    const writer = new JsonlLogWriter(filePath);
    await writer.init();
    this.writers.set(key, writer);
    return writer;
  }

  public async getTaskWriter(missionId: string, taskId: string, type: 'task' | 'llm-stream' | 'tool-calls', chatId?: string): Promise<JsonlLogWriter> {
    const key = `${missionId}:${taskId}:${type}`;
    if (this.writers.has(key)) {
      return this.writers.get(key)!;
    }

    const baseMissionDir = chatId 
      ? path.join(this.baseDir, chatId, missionId)
      : path.join(this.baseDir, this.getMissionDateDir(), `mission_${missionId}`);
      
    const dir = path.join(baseMissionDir, 'tasks', `task_${taskId}`);
    const filePath = path.join(dir, `${type}.jsonl`);
    
    const writer = new JsonlLogWriter(filePath);
    await writer.init();
    this.writers.set(key, writer);
    return writer;
  }

  public async logEvent(event: UnifiedEventEnvelope) {
    if (!event.mission_id) return; // Drop or write to global unscoped if needed

    // Write to mission log
    const missionWriter = await this.getWriter(event.mission_id, 'mission', event.chat_id);
    missionWriter.append(event);

    // If it has a task id, write to task log
    if (event.task_id) {
      const taskWriter = await this.getTaskWriter(event.mission_id, event.task_id, 'task', event.chat_id);
      taskWriter.append(event);
      
      if (event.event_type === 'LLM_STREAM_CHUNK') {
        const streamWriter = await this.getTaskWriter(event.mission_id, event.task_id, 'llm-stream', event.chat_id);
        streamWriter.append(event);
      }
      if (event.category === 'TOOL') {
        const toolWriter = await this.getTaskWriter(event.mission_id, event.task_id, 'tool-calls', event.chat_id);
        toolWriter.append(event);
      }
    }
  }

  public async closeAll() {
    const closePromises = Array.from(this.writers.values()).map(w => w.close());
    await Promise.all(closePromises);
    this.writers.clear();
  }
}
