/**
 * @file orchestrator/task-runtime/verification/runtime/Phase7StrictVerification.test.ts
 * @system AMEVA OS Desktop Workstation
 */

import { DeterministicVerifier } from '../verifiers/DeterministicVerifier';
import { OutputInferenceService } from '../services/OutputInferenceService';
import { PathSanitizer } from '../../policy/PathSanitizer';
import type { VerificationInput } from './VerificationInputBuilder';

describe('Phase 7: Strict Verification & Path Sanitization', () => {
  describe('PathSanitizer', () => {
    const sandboxRoot = '/sandbox/root/';

    it('should resolve against sandboxRoot correctly', () => {
      const resolved = PathSanitizer.resolveAgainstSandboxRoot(sandboxRoot, 'report.md', 'write', 'm1');
      expect(resolved).toBe('/sandbox/root/missions/m1/staging/report.md');
    });

    it('should block outside access for writes', () => {
      expect(() => {
        PathSanitizer.sanitizePath('../../../etc/passwd', 'write', 'm1', '/sandbox/root/');
      }).toThrow('escapes allowed sandbox root');
    });
  });

  describe('OutputInferenceService', () => {
    it('should infer FILE_OUTPUT_REQUIRED if append_file is used', () => {
      const result = OutputInferenceService.inferFromToolCalls(
        [{ name: 'append_file', args: { path: 'a.md' }, success: true }],
        'NO_PERSISTED_OUTPUT'
      );
      expect(result.inferredOutputMode).toBe('FILE_OUTPUT_REQUIRED');
      expect(result.inferredFileOutputs).toContain('a.md');
    });
  });

  describe('DeterministicVerifier', () => {
    let verifier: DeterministicVerifier;

    beforeEach(() => {
      verifier = new DeterministicVerifier({
        exists: async (p) => p === 'exists.md',
        stat: async () => ({ size: 100 }),
        hash: async () => 'hash1',
        write: async () => {},
        read: async () => '',
        delete: async () => {}
      } as any);
    });

    it('should fail NO_PERSISTED_OUTPUT if response is empty', async () => {
      const input = {
        taskDefinition: { outputMode: 'NO_PERSISTED_OUTPUT' },
        taskState: { status: 'VERIFYING' },
        targetAttempt: {
          resultReference: { outputs: [{ type: 'text', content: '' }] }
        },
        attemptId: '1'
      } as unknown as VerificationInput;

      const results = await verifier.verify(input);
      expect(results[0].verdict).toBe('FAIL');
      expect(results[0].defect?.type).toBe('STRICT_VERIFICATION_FAILED');
    });

    it('should pass FILE_OUTPUT_REQUIRED if file exists', async () => {
      const input = {
        taskDefinition: { outputMode: 'FILE_OUTPUT_REQUIRED', expectedFileOutputs: ['exists.md'] },
        taskState: { status: 'VERIFYING' },
        targetAttempt: {
          resultReference: {
             outputs: [{ type: 'file', artifactId: 'exists.md', path: 'exists.md' }] 
          }
        },
        attemptId: '1'
      } as unknown as VerificationInput;

      const results = await verifier.verify(input);
      expect(results[0].verdict).toBe('PASS');
    });
    
    it('should fail FILE_OUTPUT_REQUIRED if file missing', async () => {
      const input = {
        taskDefinition: { outputMode: 'FILE_OUTPUT_REQUIRED', expectedFileOutputs: ['missing.md'] },
        taskState: { status: 'VERIFYING' },
        targetAttempt: {
          resultReference: {
             outputs: [{ type: 'file', artifactId: 'missing.md', path: 'missing.md' }] 
          }
        },
        attemptId: '1'
      } as unknown as VerificationInput;

      const results = await verifier.verify(input);
      expect(results[0].verdict).toBe('FAIL');
      expect(results[0].defect?.type).toBe('OUTPUT_FILE_NOT_FOUND');
    });
  });
});
