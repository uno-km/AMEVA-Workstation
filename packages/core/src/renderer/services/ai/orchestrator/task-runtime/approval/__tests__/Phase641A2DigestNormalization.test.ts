import { describe, it, expect } from 'vitest';
import { SourceApplyDigestService } from '../../apply/SourceApplyDigestService';

describe('Phase 6.4.1A-2: SourceApplyDigestService', () => {
  describe('Logical Path Normalization', () => {
    it('normalizes windows to posix separators', () => {
      expect(SourceApplyDigestService.normalizeLogicalPath('foo\\bar')).toBe('foo/bar');
    });

    it('removes redundant separators and current dir components', () => {
      expect(SourceApplyDigestService.normalizeLogicalPath('foo//bar/./baz')).toBe('foo/bar/baz');
    });

    it('resolves parent directory components safely', () => {
      expect(SourceApplyDigestService.normalizeLogicalPath('foo/bar/../baz')).toBe('foo/baz');
    });

    it('blocks path traversal escaping root', () => {
      expect(() => SourceApplyDigestService.normalizeLogicalPath('../foo')).toThrow('PATH_TRAVERSAL_DETECTED');
      expect(() => SourceApplyDigestService.normalizeLogicalPath('foo/../../bar')).toThrow('PATH_TRAVERSAL_DETECTED');
    });

    it('blocks URL encoded traversal', () => {
      expect(() => SourceApplyDigestService.normalizeLogicalPath('foo/%2E%2E/bar')).toThrow('PATH_TRAVERSAL_DETECTED');
    });

    it('blocks null byte', () => {
      expect(() => SourceApplyDigestService.normalizeLogicalPath('foo\0bar')).toThrow('NULL_BYTE_DETECTED');
    });

    it('blocks absolute paths and UNC', () => {
      expect(() => SourceApplyDigestService.normalizeLogicalPath('//server/share')).toThrow('INVALID_LOGICAL_PATH');
      expect(() => SourceApplyDigestService.normalizeLogicalPath('C:/foo')).toThrow('INVALID_LOGICAL_PATH');
    });
  });

  describe('Stable Serialization', () => {
    it('serializes objects stably irrespective of key order', () => {
      const obj1 = { b: 2, a: 1 };
      const obj2 = { a: 1, b: 2 };
      expect(SourceApplyDigestService.stableSerialize(obj1)).toBe(SourceApplyDigestService.stableSerialize(obj2));
    });

    it('normalizes strings to NFC', () => {
      const nfc = '\u00E9'; // é
      const nfd = 'e\u0301'; // e + ´
      expect(SourceApplyDigestService.stableSerialize(nfc)).toBe(SourceApplyDigestService.stableSerialize(nfd));
    });

    it('rejects circular references', () => {
      const obj: any = {};
      obj.self = obj;
      expect(() => SourceApplyDigestService.stableSerialize(obj)).toThrow('CIRCULAR_DIGEST_INPUT');
    });

    it('rejects functions and symbols', () => {
      expect(() => SourceApplyDigestService.stableSerialize(() => {})).toThrow('UNSUPPORTED_DIGEST_VALUE');
      expect(() => SourceApplyDigestService.stableSerialize(Symbol('sym'))).toThrow('UNSUPPORTED_DIGEST_VALUE');
    });

    it('rejects sensitive data in keys or string values', () => {
      expect(() => SourceApplyDigestService.stableSerialize({ approvalToken: 'abc' })).toThrow('SENSITIVE_VALUE_NOT_ALLOWED');
      expect(() => SourceApplyDigestService.stableSerialize({ someField: 'my apiKey is 123' })).toThrow('SENSITIVE_VALUE_NOT_ALLOWED');
    });
  });

  describe('Digest Generation', () => {
    it('produces same digest for same semantic meaning', async () => {
      const d1 = await SourceApplyDigestService.createPreviewDigest({
        artifactRevision: 1,
        sourceDigest: 'abc',
        requiredChecks: ['a', 'b']
      });
      const d2 = await SourceApplyDigestService.createPreviewDigest({
        sourceDigest: 'abc',
        requiredChecks: ['a', 'b'],
        artifactRevision: 1
      });
      expect(d1).toBe(d2);
    });

    it('produces different digest for different semantic meaning', async () => {
      const d1 = await SourceApplyDigestService.createPreviewDigest({
        artifactRevision: 1,
      });
      const d2 = await SourceApplyDigestService.createPreviewDigest({
        artifactRevision: 2,
      });
      expect(d1).not.toBe(d2);
    });

    it('normalizes and sorts affected paths before digest', async () => {
      const p1 = await SourceApplyDigestService.createAffectedPathsDigest([
        { logicalPath: 'b.ts' },
        { logicalPath: 'a.ts' }
      ]);
      const p2 = await SourceApplyDigestService.createAffectedPathsDigest([
        { logicalPath: 'a.ts' },
        { logicalPath: 'b.ts' }
      ]);
      expect(p1).toBe(p2);
    });
  });
});
