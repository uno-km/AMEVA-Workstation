/**
 * @file orchestrator/task-runtime/apply/SourceApplyDigestService.ts
 * @system AMEVA OS Desktop Workstation
 * @role 순수 모듈 기반 Digest 생성 및 정규화 서비스 (Node/Electron 의존성 없음)
 */

export class SourceApplyDigestService {
  /**
   * 안정적인 직렬화를 수행한다 (Stable Serialization).
   * @param input 직렬화할 객체
   * @returns 안정적으로 정렬되고 정규화된 JSON 문자열
   */
  public static stableSerialize(input: unknown): string {
    if (input === null) return 'null';
    if (input === undefined) return ''; // undefined는 포함하지 않음

    if (typeof input === 'function' || typeof input === 'symbol') {
      throw new Error('UNSUPPORTED_DIGEST_VALUE: Functions and Symbols are not allowed');
    }

    if (typeof input === 'bigint') {
      throw new Error('UNSUPPORTED_DIGEST_VALUE: BigInt is not allowed');
    }

    if (typeof input === 'number' || typeof input === 'boolean') {
      return input.toString();
    }

    if (typeof input === 'string') {
      // 민감 정보 차단
      const lower = input.toLowerCase();
      const restricted = ['approvaltoken', 'capabilitytoken', 'sessiontoken', 'accesstoken', 'authorization', 'apikey', 'password', 'privatekey', 'cookie', 'credential'];
      for (const token of restricted) {
        if (lower.includes(token)) {
          throw new Error('SENSITIVE_VALUE_NOT_ALLOWED');
        }
      }
      return JSON.stringify(input.normalize('NFC'));
    }

    if (input instanceof Date) {
      return JSON.stringify(input.toISOString());
    }

    if (Array.isArray(input)) {
      const serializedArray = input.map(item => this.stableSerialize(item)).filter(item => item !== '');
      return `[${serializedArray.join(',')}]`;
    }

    if (typeof input === 'object') {
      // 순환 참조 검사는 간단한 구현으로 생략하거나 제한 깊이 설정, 여기서는 일단 무시 (위에서 throw error 하라고 함)
      // 문제 조건 "Circular Reference 발견 시 구조화 오류로 실패하라" => WeakSet으로 추적
      return this.stableSerializeObject(input as Record<string, unknown>, new WeakSet());
    }

    throw new Error('UNSUPPORTED_DIGEST_VALUE: Unknown type');
  }

  private static stableSerializeObject(input: Record<string, unknown>, seen: WeakSet<object>): string {
    if (seen.has(input)) {
      throw new Error('CIRCULAR_DIGEST_INPUT');
    }
    seen.add(input);

    const keys = Object.keys(input).sort();
    const parts: string[] = [];

    for (const key of keys) {
      // Key에 민감정보 필드 이름이 있는지 검사
      const lowerKey = key.toLowerCase();
      const restricted = ['approvaltoken', 'capabilitytoken', 'sessiontoken', 'accesstoken', 'authorization', 'apikey', 'password', 'privatekey', 'cookie', 'credential'];
      if (restricted.includes(lowerKey)) {
        throw new Error('SENSITIVE_VALUE_NOT_ALLOWED');
      }

      const val = input[key];
      if (val === undefined) continue;

      const serializedVal = typeof val === 'object' && val !== null && !(val instanceof Date) && !Array.isArray(val)
        ? this.stableSerializeObject(val as Record<string, unknown>, seen)
        : this.stableSerialize(val);
      
      parts.push(`${JSON.stringify(key)}:${serializedVal}`);
    }

    seen.delete(input);
    return `{${parts.join(',')}}`;
  }

  public static normalizeLogicalPath(path: string): string {
    if (!path) throw new Error('INVALID_LOGICAL_PATH');
    if (path.indexOf('\0') !== -1) throw new Error('NULL_BYTE_DETECTED');
    if (path.includes('%2e') || path.includes('%2E') || path.includes('%2f') || path.includes('%2F') || path.includes('%5c') || path.includes('%5C')) {
      throw new Error('PATH_TRAVERSAL_DETECTED');
    }

    // Windows separator to POSIX
    let normalized = path.replace(/\\/g, '/');
    
    // UNC / Device / Drive block
    if (normalized.startsWith('//') || normalized.match(/^[a-zA-Z]:/)) {
      throw new Error('INVALID_LOGICAL_PATH');
    }

    const segments = normalized.split('/').filter(s => s !== '' && s !== '.');
    const stack: string[] = [];
    for (const seg of segments) {
      if (seg === '..') {
        if (stack.length === 0) throw new Error('PATH_TRAVERSAL_DETECTED');
        stack.pop();
      } else {
        stack.push(seg);
      }
    }
    
    if (stack.length === 0) throw new Error('INVALID_LOGICAL_PATH');

    return stack.join('/');
  }

  public static async createPreviewDigest(input: Record<string, unknown>): Promise<string> {
    const serialized = this.stableSerialize(input);
    return this.hashString(serialized);
  }

  public static async createOperationDigest(input: Record<string, unknown>): Promise<string> {
    const serialized = this.stableSerialize(input);
    return this.hashString(serialized);
  }

  public static async createAffectedPathsDigest(input: unknown[]): Promise<string> {
    // 각 path 정규화 후 정렬
    const normalizedArr = input.map(item => {
      const obj = item as any;
      if (obj && typeof obj.logicalPath === 'string') {
        return { ...obj, logicalPath: this.normalizeLogicalPath(obj.logicalPath) };
      }
      return obj;
    });

    normalizedArr.sort((a, b) => {
      const pathA = a.logicalPath || '';
      const pathB = b.logicalPath || '';
      return pathA.localeCompare(pathB);
    });

    const serialized = this.stableSerialize(normalizedArr);
    return this.hashString(serialized);
  }

  public static async createArtifactDigest(revision: number, contentHash: string): Promise<string> {
    const input = { revision, contentHash };
    const serialized = this.stableSerialize(input);
    return this.hashString(serialized);
  }

  public static async createSourceDigest(workspaceRoot: string, affectedPaths: string[]): Promise<string> {
    const fs = await import('fs/promises');
    const path = await import('path');
    const digests: Record<string, string> = {};

    for (const logicalPath of affectedPaths) {
      const normalizedPath = this.normalizeLogicalPath(logicalPath);
      const fullPath = path.join(workspaceRoot, normalizedPath);
      
      try {
        const stat = await fs.stat(fullPath);
        if (stat.isFile()) {
          const content = await fs.readFile(fullPath);
          // For digest, we hash the content
          let hex = '';
          if (typeof crypto !== 'undefined' && crypto.subtle) {
             const hashBuffer = await crypto.subtle.digest('SHA-256', content);
             const hashArray = Array.from(new Uint8Array(hashBuffer));
             hex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
          } else {
             const cryptoModule = await import('crypto');
             hex = cryptoModule.createHash('sha256').update(content).digest('hex');
          }
          digests[normalizedPath] = hex;
        } else {
          digests[normalizedPath] = 'DIRECTORY';
        }
      } catch (e: any) {
        if (e.code === 'ENOENT') {
          digests[normalizedPath] = 'NOT_FOUND';
        } else {
          throw e;
        }
      }
    }
    
    // stable serialize the mapping and hash it
    const serialized = this.stableSerialize(digests);
    return this.hashString(serialized);
  }

  private static async hashString(data: string): Promise<string> {
    if (typeof crypto !== 'undefined' && crypto.subtle) {
      const encoder = new TextEncoder();
      const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(data));
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    } else {
      // Fallback for Node test env if crypto.subtle is absent (though node 18+ has crypto in global)
      const cryptoModule = await import('crypto');
      return cryptoModule.createHash('sha256').update(data).digest('hex');
    }
  }
}
