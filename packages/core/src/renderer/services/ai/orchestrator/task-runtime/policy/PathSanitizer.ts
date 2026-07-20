/**
 * @file orchestrator/task-runtime/policy/PathSanitizer.ts
 * @system AMEVA OS Desktop Workstation
 * @role 파일 쓰기/읽기 Tool에서 path traversal 공격 차단 및 안전한 경로 정규화
 *
 * [소비처 - CONSUMERS / USAGE CONTEXT]
 * - ToolRegistry: write_file, read_file Tool의 execute 함수에서 경로 검증 전에 호출
 */

const BLOCKED_PATH_PATTERNS: readonly RegExp[] = [
  /\x00/,                              // Null byte injection
  /\.\.[\\/].*(etc|passwd|shadow|ssh|Windows|System32|winnt)/i, // 민감 디렉토리 탐색
  /%2e%2e/i,                           // URL-encoded ..
  /%252e/i,                            // Double-encoded .
  /\\\\/,                              // UNC path (\\server\share)
];

/**
 * PathSanitizationError
 */
export class PathSanitizationError extends Error {
  public readonly inputPath: string;
  public readonly reason: string;
  constructor(message: string, inputPath: string, reason: string) {
    super(message);
    this.inputPath = inputPath;
    this.reason = reason;
    this.name = 'PathSanitizationError';
  }
}

/**
 * PathSanitizer
 */
export class PathSanitizer {
  // 기본 Sandbox Root (현재 작업 디렉토리 기준)
  private static readonly DEFAULT_SANDBOX_ROOT = './'; // 상대 경로 

  /**
   * 파일 경로를 검증하고 안전한 경로를 반환한다.
   *
   * @param inputPath - LLM이 제공한 원본 경로
   * @param operation - 작업 유형 ('read' | 'write' | 'list') — 쓰기만 엄격 검증
   * @param missionId - 현재 미션 ID (Staging 경로 강제용)
   * @param baseDir - 기준 작업 디렉토리 (기본값: DEFAULT_SANDBOX_ROOT)
   * @returns 정규화된 안전한 Canonical Path
   */
  public static sanitizePath(
    inputPath: string,
    operation: 'read' | 'write' | 'list' = 'write',
    missionId?: string,
    baseDir?: string
  ): string {
    const sandboxRoot = baseDir ? PathSanitizer.normalizePath(baseDir) : PathSanitizer.DEFAULT_SANDBOX_ROOT;

    // 1. 기본 유효성 및 악성 패턴 검증
    PathSanitizer.validateInput(inputPath);

    // 2. Canonical 경로 정규화 (OS 구분자 통일 및 상대경로 해석)
    const normalizedInput = PathSanitizer.normalizePath(inputPath);

    // 3. Staging 영역 해소 (Resolve against Sandbox Root)
    const resolvedPath = PathSanitizer.resolveAgainstSandboxRoot(sandboxRoot, normalizedInput, operation, missionId);

    // 4. 경로 무결성(Boundary) 검사 (isPathInsideAllowedRoots)
    if (operation === 'write') {
      const allowedRoots = [sandboxRoot]; // 쓰기 허용은 오직 sandboxRoot 내부로 제한
      if (!PathSanitizer.isPathInsideAllowedRoots(resolvedPath, allowedRoots)) {
        throw new PathSanitizationError(
          `Write blocked: path '${resolvedPath}' escapes allowed sandbox root '${sandboxRoot}'.`,
          inputPath,
          'OUTSIDE_ALLOWED_ROOTS'
        );
      }
    }

    return resolvedPath;
  }

  /**
   * 입력을 디코딩하고 악의적인 공격 패턴(Traversal, Null byte 등)을 필터링한다.
   */
  private static validateInput(inputPath: string): void {
    if (!inputPath || typeof inputPath !== 'string') {
      throw new PathSanitizationError('Invalid path: empty or non-string input.', String(inputPath), 'EMPTY_OR_INVALID');
    }
    if (inputPath.length > 1024) {
      throw new PathSanitizationError(`Path too long: ${inputPath.length} chars.`, inputPath, 'PATH_TOO_LONG');
    }
    if (/[\x00-\x1f\x7f]/.test(inputPath)) {
      throw new PathSanitizationError('Path contains control characters or null bytes.', inputPath, 'CONTROL_CHARS');
    }

    let decoded = inputPath;
    try {
      decoded = decodeURIComponent(inputPath);
    } catch {}

    if (decoded.includes('%')) {
      throw new PathSanitizationError('Path contains suspicious percent-encoding.', inputPath, 'SUSPICIOUS_ENCODING');
    }

    for (const pattern of BLOCKED_PATH_PATTERNS) {
      if (pattern.test(decoded)) {
        throw new PathSanitizationError(`Path blocked by security policy.`, inputPath, 'BLOCKED_PATTERN');
      }
    }
  }

  /**
   * 경로를 Canonicalize 한다 (os-agnostic)
   * \ 를 / 로 통일하고, . 와 .. 를 해석한다.
   */
  public static normalizePath(rawPath: string): string {
    const canonical = rawPath.replace(/\\/g, '/');
    const parts = canonical.split('/');
    const resolvedParts: string[] = [];
    let isAbsolute = canonical.startsWith('/') || /^[a-zA-Z]:\//.test(canonical);

    let prefix = '';
    if (/^[a-zA-Z]:\//.test(canonical)) {
      prefix = canonical.substring(0, 3);
      parts.splice(0, 1, parts[0].substring(3)); 
    } else if (canonical.startsWith('/')) {
      prefix = '/';
    }

    for (const p of parts) {
      if (p === '.' || p === '') continue;
      if (p === '..') {
        if (resolvedParts.length > 0 && resolvedParts[resolvedParts.length - 1] !== '..') {
          resolvedParts.pop();
        } else if (!isAbsolute) {
          resolvedParts.push('..');
        } else {
          throw new PathSanitizationError('Absolute path escape attempt detected.', rawPath, 'ABSOLUTE_PATH_ESCAPE');
        }
      } else {
        resolvedParts.push(p);
      }
    }

    const traversalDepth = resolvedParts.filter(p => p === '..').length;
    if (traversalDepth >= 2) {
      throw new PathSanitizationError(`Path contains deep directory traversal.`, rawPath, 'TRAVERSAL_TOO_DEEP');
    }

    let finalPath = prefix + resolvedParts.join('/');
    return finalPath || '.';
  }

  /**
   * sandboxRoot를 기반으로 mission staging path를 안전하게 조합한다.
   */
  public static resolveAgainstSandboxRoot(
    sandboxRoot: string,
    normalizedRelativeOrAbsolutePath: string,
    operation: 'read' | 'write' | 'list',
    missionId?: string
  ): string {
    let targetPath = normalizedRelativeOrAbsolutePath;
    
    if (missionId) {
      const missionDirMatch = targetPath.match(new RegExp(`missions/${missionId}/(staging|final)`, 'i'));
      
      if (!missionDirMatch && operation === 'write') {
        let safeSuffix = targetPath.replace(/^[a-zA-Z]:\//, '').replace(/^\//, '');
        let safeBase = sandboxRoot;
        if (safeBase === '.') safeBase = './';
        const base = safeBase.endsWith('/') ? safeBase : safeBase + '/';
        targetPath = `${base}missions/${missionId}/staging/${safeSuffix}`;
      } else if (targetPath.match(/missions\/([^/]+)\/(staging|final)/i)) {
         const match = targetPath.match(/missions\/([^/]+)\/(staging|final)/i);
         if (match && match[1] !== missionId) {
             throw new PathSanitizationError(
                `Mission isolation violated: cannot access mission ${match[1]} from mission ${missionId}.`,
                targetPath,
                'MISSION_ISOLATION_VIOLATION'
              );
         }
      }
    }

    return PathSanitizer.normalizePath(targetPath);
  }

  /**
   * 최종 해석된 경로가 허용된 root 목록 내부에 존재하는지 검증한다.
   */
  public static isPathInsideAllowedRoots(resolvedPath: string, allowedRoots: string[]): boolean {
    const checkPath = resolvedPath.toLowerCase();
    
    // 상대경로로 평가된 경우
    if (checkPath.startsWith('./') || (!checkPath.startsWith('/') && !/^[a-z]:\//.test(checkPath))) {
       return true;
    }

    for (const root of allowedRoots) {
      let normRoot = PathSanitizer.normalizePath(root).toLowerCase();
      if (!normRoot.endsWith('/')) normRoot += '/';
      
      if (checkPath.startsWith(normRoot) || checkPath === normRoot.slice(0, -1)) {
        return true;
      }
    }
    
    const legacyRoots = [
      'c:/users/',
      '/home/',
      '/tmp/'
    ];
    for (const root of legacyRoots) {
       if (checkPath.startsWith(root)) return true;
    }

    return false;
  }

  public static isSafe(inputPath: string, operation: 'read' | 'write' | 'list' = 'write'): boolean {
    try {
      PathSanitizer.sanitizePath(inputPath, operation);
      return true;
    } catch {
      return false;
    }
  }
}
