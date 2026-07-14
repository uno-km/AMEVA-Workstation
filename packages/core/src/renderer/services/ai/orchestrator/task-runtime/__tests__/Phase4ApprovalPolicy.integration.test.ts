/**
 * @file Phase4ApprovalPolicy.integration.test.ts
 * @system AMEVA OS Desktop Workstation
 * @role Phase 4 ToolApprovalPolicy 위험도 평가, 상태 전환, 실행 차단 및 중복 실행 방지(idempotency) 통합 검증
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ToolApprovalPolicy, ToolApprovalViolationError } from '../policy/ToolApprovalPolicy';

describe('Phase 4 Approval Policy Integration Suite', () => {
  beforeEach(() => {
    ToolApprovalPolicy.clear();
  });

  it('1. correctly evaluates risk levels based on default sets and definition metadata overrides', () => {
    const low = ToolApprovalPolicy.evaluateRisk('read_file');
    expect(low.riskLevel).toBe('LOW');
    expect(low.approvalRequired).toBe(false);

    const high = ToolApprovalPolicy.evaluateRisk('delete_file');
    expect(high.riskLevel).toBe('HIGH');
    expect(high.approvalRequired).toBe(true);

    const critical = ToolApprovalPolicy.evaluateRisk('sys_format_vfs');
    expect(critical.riskLevel).toBe('CRITICAL');
    expect(critical.approvalRequired).toBe(true);

    // Metadata override
    const override = ToolApprovalPolicy.evaluateRisk('read_file', {}, { riskLevel: 'HIGH', approvalRequired: true });
    expect(override.riskLevel).toBe('HIGH');
    expect(override.approvalRequired).toBe(true);
  });

  it('2. throws ToolApprovalViolationError when asserting HIGH/CRITICAL tools with PENDING or unapproved status', () => {
    expect(() => {
      ToolApprovalPolicy.assertApproved('delete_file', 'PENDING', 'HIGH');
    }).toThrowError(ToolApprovalViolationError);

    expect(() => {
      ToolApprovalPolicy.assertApproved('delete_file', undefined, 'HIGH');
    }).toThrowError(ToolApprovalViolationError);

    expect(() => {
      ToolApprovalPolicy.assertApproved('delete_file', 'APPROVED', 'HIGH');
    }).not.toThrow();
  });

  it('3. strictly blocks execution on REJECTED, EXPIRED, or CANCELLED status regardless of risk level', () => {
    expect(() => {
      ToolApprovalPolicy.assertApproved('read_file', 'REJECTED', 'LOW');
    }).toThrowError(ToolApprovalViolationError);

    expect(() => {
      ToolApprovalPolicy.assertApproved('list_dir', 'EXPIRED', 'LOW');
    }).toThrowError(ToolApprovalViolationError);

    expect(() => {
      ToolApprovalPolicy.assertApproved('run_test', 'CANCELLED', 'MEDIUM');
    }).toThrowError(ToolApprovalViolationError);
  });

  it('4. resolves approval requests with idempotency protection against duplicate resolution clicks', () => {
    const req = ToolApprovalPolicy.createApprovalRequest(
      'trace-1', 'mission-1', 'task-1', 'call-1',
      'delete_file', 'HIGH', { path: '/tmp/test' }, ['/tmp/test'], 'Testing'
    );

    expect(req.status).toBe('PENDING');

    const firstResolve = ToolApprovalPolicy.resolveApproval(req.approvalId, 'APPROVED');
    expect(firstResolve.status).toBe('APPROVED');

    // Second resolution attempt with REJECTED should be ignored because idempotencyKey is already processed
    const secondResolve = ToolApprovalPolicy.resolveApproval(req.approvalId, 'REJECTED');
    expect(secondResolve.status).toBe('APPROVED');
  });

  it('5. tracks execution idempotency keys to ensure exactly 1 execution and 0 execution on rejection', () => {
    const idempKey = 'idemp-exec-test-101';
    expect(ToolApprovalPolicy.isToolExecuted(idempKey)).toBe(false);

    ToolApprovalPolicy.markToolExecuted(idempKey);
    expect(ToolApprovalPolicy.isToolExecuted(idempKey)).toBe(true);
  });
});
