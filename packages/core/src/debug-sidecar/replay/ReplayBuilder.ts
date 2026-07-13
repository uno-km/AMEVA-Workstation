/**
 * @file debug-sidecar/replay/ReplayBuilder.ts
 * @system AMEVA OS Desktop Workstation
 */

import { UnifiedEventEnvelope } from '../observability/UnifiedEventEnvelope';

export class ReplayBuilder {
  public static buildManifest(missionId: string, events: UnifiedEventEnvelope[]) {
    const startEvent = events.find(e => e.event_type === 'HARNESS_START');
    const llmRequests = events.filter(e => e.event_type === 'LLM_REQUEST_START');
    
    return {
      original_mission_id: missionId,
      created_at: new Date().toISOString(),
      runtime_mode: startEvent?.component === 'V2RuntimeHarness' ? 'v2' : 'legacy',
      failure_fingerprint: events.find(e => e.level === 'ERROR')?.failure_code || 'NONE',
      llm_requests_count: llmRequests.length,
      replay_policy: {
        allow_read_only: true,
        allow_write: false, // Core strict policy
        allow_shell: false
      }
    };
  }
}
