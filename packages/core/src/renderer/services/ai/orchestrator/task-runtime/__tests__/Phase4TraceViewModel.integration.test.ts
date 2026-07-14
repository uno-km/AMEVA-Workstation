/**
 * @file Phase4TraceViewModel.integration.test.ts
 * @system AMEVA OS Desktop Workstation
 * @role Phase 4 ExecutionTraceViewModel UI 렌더링 변환 및 가시성/Artifact 상태 필터링 통합 검증
 */

import { describe, it, expect } from 'vitest';
import { ExecutionTraceViewModel } from '../trace/ExecutionTraceViewModel';
import type { TraceEvent } from '../trace/ExecutionTraceTypes';

describe('Phase 4 Trace ViewModel UI Rendering Integration Suite', () => {
  it('1. filterByVisibility hides INTERNAL raw CoT events and respects minVisibility ranks', () => {
    const events: TraceEvent[] = [
      {
        eventId: 'ev-1', traceId: 'm-1', spanId: 's-1', missionId: 'm-1',
        timestamp: 1000, eventType: 'mission_started', status: 'RUNNING', sequenceNumber: 1, visibility: 'USER', schemaVersion: '4.0.0',
        summary: 'Mission started for user'
      },
      {
        eventId: 'ev-2', traceId: 'm-1', spanId: 's-2', missionId: 'm-1',
        timestamp: 2000, eventType: 'tool_execution_started', status: 'RUNNING', sequenceNumber: 2, visibility: 'OPERATOR', schemaVersion: '4.0.0',
        summary: 'Operator audit tool run'
      },
      {
        eventId: 'ev-3', traceId: 'm-1', spanId: 's-3', missionId: 'm-1',
        timestamp: 3000, eventType: 'tool_execution_progress', status: 'RUNNING', sequenceNumber: 3, visibility: 'DEBUG', schemaVersion: '4.0.0',
        summary: 'Debug raw tool progress'
      },
      {
        eventId: 'ev-4', traceId: 'm-1', spanId: 's-4', missionId: 'm-1',
        timestamp: 4000, eventType: 'decision_summary_created', status: 'SUCCEEDED', sequenceNumber: 4, visibility: 'INTERNAL', schemaVersion: '4.0.0',
        summary: 'Raw hidden CoT tokens inside internal thought loop'
      }
    ];

    // USER visibility -> only USER events
    const userFiltered = ExecutionTraceViewModel.filterByVisibility(events, 'USER');
    expect(userFiltered.length).toBe(1);
    expect(userFiltered[0].eventId).toBe('ev-1');

    // OPERATOR visibility -> USER + OPERATOR
    const opFiltered = ExecutionTraceViewModel.filterByVisibility(events, 'OPERATOR');
    expect(opFiltered.length).toBe(2);
    expect(opFiltered.map(e => e.eventId)).toEqual(['ev-1', 'ev-2']);

    // DEBUG visibility -> USER + OPERATOR + DEBUG, but NEVER INTERNAL
    const debugFiltered = ExecutionTraceViewModel.filterByVisibility(events, 'DEBUG');
    expect(debugFiltered.length).toBe(3);
    expect(debugFiltered.some(e => e.visibility === 'INTERNAL')).toBe(false);

    // Even if requested INTERNAL, INTERNAL raw CoT is filtered out by filterByVisibility for UI safety
    const internalFiltered = ExecutionTraceViewModel.filterByVisibility(events, 'INTERNAL');
    expect(internalFiltered.some(e => e.visibility === 'INTERNAL')).toBe(false);
  });

  it('2. getArtifactCards marks uncommitted artifacts with isFinalCommitted: false to prevent fake completion UI', () => {
    const events: TraceEvent[] = [
      {
        eventId: 'art-1', traceId: 'm-art', spanId: 's-art-1', missionId: 'm-art',
        timestamp: 1000, eventType: 'artifact_created', status: 'PENDING', sequenceNumber: 1, visibility: 'USER', schemaVersion: '4.0.0',
        artifactChanges: [
          {
            artifactId: 'file-1.ts',
            changeType: 'CREATE',
            status: 'STAGED',
            commitStatus: 'UNCOMMITTED',
            summary: 'Created staged file'
          }
        ]
      },
      {
        eventId: 'art-2', traceId: 'm-art', spanId: 's-art-2', missionId: 'm-art',
        timestamp: 2000, eventType: 'artifact_committed', status: 'SUCCEEDED', sequenceNumber: 2, visibility: 'USER', schemaVersion: '4.0.0',
        artifactChanges: [
          {
            artifactId: 'file-1.ts',
            changeType: 'MODIFY',
            status: 'COMMITTED',
            commitStatus: 'COMMITTED',
            summary: 'Committed file cleanly'
          }
        ]
      }
    ];

    const cards = ExecutionTraceViewModel.getArtifactCards(events);
    expect(cards.length).toBe(2);

    expect(cards[0].artifactId).toBe('file-1.ts');
    expect(cards[0].status).toBe('STAGED');
    expect(cards[0].isFinalCommitted).toBe(false);

    expect(cards[1].artifactId).toBe('file-1.ts');
    expect(cards[1].status).toBe('COMMITTED');
    expect(cards[1].isFinalCommitted).toBe(true);
  });

  it('3. toTimelineEvents transforms trace events into ordered timeline cards cleanly', () => {
    const events: TraceEvent[] = [
      {
        eventId: 'tl-2', traceId: 'm-tl', spanId: 's-tl-2', missionId: 'm-tl',
        timestamp: 2000, eventType: 'tool_approval_requested', status: 'PENDING', sequenceNumber: 2, visibility: 'USER', schemaVersion: '4.0.0',
        title: 'Need approval',
        approval: {
          approvalId: 'appr-1', traceId: 'm-tl', missionId: 'm-tl', taskId: 't1', toolCallId: 's-tl-2',
          toolName: 'run_command', riskLevel: 'HIGH', arguments: {}, affectedResources: [], reason: 'Dangerous cmd', status: 'PENDING', requestedAt: 2000
        }
      },
      {
        eventId: 'tl-1', traceId: 'm-tl', spanId: 's-tl-1', missionId: 'm-tl',
        timestamp: 1000, eventType: 'mission_started', status: 'RUNNING', sequenceNumber: 1, visibility: 'USER', schemaVersion: '4.0.0',
        title: 'Start'
      }
    ];

    const cards = ExecutionTraceViewModel.toTimelineEvents(events, 'USER');
    expect(cards.length).toBe(2);
    expect(cards[0].sequenceNumber).toBe(1);
    expect(cards[0].type).toBe('MISSION');
    expect(cards[1].sequenceNumber).toBe(2);
    expect(cards[1].type).toBe('APPROVAL');
    expect(cards[1].data.riskLevel).toBe('HIGH');
  });

  it('4. getFinalOutcome accurately summarizes total tasks, completed tools, committed artifacts, and final status', () => {
    const events: TraceEvent[] = [
      {
        eventId: 'o-1', traceId: 'm-o', spanId: 'so-1', missionId: 'm-o', taskId: 'task-A',
        timestamp: 100, eventType: 'task_started', status: 'RUNNING', sequenceNumber: 1, visibility: 'USER', schemaVersion: '4.0.0'
      },
      {
        eventId: 'o-2', traceId: 'm-o', spanId: 'so-2', missionId: 'm-o', taskId: 'task-A',
        timestamp: 200, eventType: 'tool_execution_completed', status: 'SUCCEEDED', sequenceNumber: 2, visibility: 'USER', schemaVersion: '4.0.0'
      },
      {
        eventId: 'o-3', traceId: 'm-o', spanId: 'so-3', missionId: 'm-o', taskId: 'task-B',
        timestamp: 300, eventType: 'artifact_committed', status: 'SUCCEEDED', sequenceNumber: 3, visibility: 'USER', schemaVersion: '4.0.0',
        artifactChanges: [{ artifactId: 'a1.md', changeType: 'CREATE', status: 'COMMITTED', commitStatus: 'COMMITTED' }]
      },
      {
        eventId: 'o-4', traceId: 'm-o', spanId: 'so-4', missionId: 'm-o',
        timestamp: 400, eventType: 'mission_completed', status: 'COMPLETED', sequenceNumber: 4, visibility: 'USER', schemaVersion: '4.0.0',
        summary: 'All checks verified and committed.'
      }
    ];

    const outcome = ExecutionTraceViewModel.getFinalOutcome(events);
    expect(outcome.status).toBe('COMPLETED');
    expect(outcome.totalTasks).toBe(2);
    expect(outcome.completedTools).toBe(1);
    expect(outcome.committedArtifacts).toBe(1);
    expect(outcome.summary).toBe('All checks verified and committed.');
  });
});
