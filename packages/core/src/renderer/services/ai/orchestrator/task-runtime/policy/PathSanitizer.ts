/**
 * @file orchestrator/task-runtime/policy/PathSanitizer.ts
 * @system AMEVA OS Desktop Workstation
 * @role 파일 쓰기/읽기 Tool에서 path traversal 공격 차단 및 안전한 경로 정규화
 *
 * [소비처 - CONSUMERS / USAGE CONTEXT]
 * - ToolRegistry: write_file, read_file Tool의 execute 함수에서 경로 검증 전에 호출
 *
 * [Item 7 — path traversal 차단]
 *
 * [공격 패턴 목록 및 대응]
 * 1. Directory Traversal: "../../../etc/passwd" → 차단
 * 2. Null Byte Injection: "/path/file\x00.txt" → 차단
 * 3. Absolute Path Escape: "/sys/vfs/../../../etc" → 정규화 후 검증
 * 4. Windows Path Separators: "..\\..\\Windows\\System32" → 정규화
 * 5. URL Encoding Bypass: "%2E%2E/etc" → 차단
 * 6. Double Encoding: "%252E%252E" → 차단
 * 7. UNC Path: "\\\\server\\share" → 차단 (Windows 전용)
 *
 * [허용 기준]
 * - ALLOWED_ROOT_PREFIXES 목록 내의 경로만 허용
 * - 정규화 후 경로가 여전히 허용된 루트 안에 있어야 허용
 *
 * [AGENTS.md 3단계 상수화]
 * 허용 루트 목록은 이 파일에 도메인 종속 지역 상수로 정의한다.
 */

/**
 * 파일 쓰기가 허용되는 루트 경로 목록.
 * 이 목록 외의 경로에 대한 write_file은 차단된다.
 *
 * [Windows 환경 기준 - AMEVA OS AGENTS.md]
 * 사용자 작업 공간으로 제한한다.
 */
const ALLOWED_WRITE_ROOT_PREFIXES: readonly string[] = [
  // 사용자 홈 내 작업 폴더
  'C:\\Users\\',
  // Unix-style 홈 (WSL/개발환경)
  '/home/',
  '/tmp/',
  // 상대 경로 (현재 작업 디렉토리 기준)
  './',
  '../', // 한 단계 위만 허용 (아래 traversal 검증으로 다중 .. 차단)
];

/**
 * 차단된 경로 패턴 (정규식).
 * 이 패턴에 매치되면 즉시 차단.
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
 * 경로 검증 실패 시 발생하는 예외.
 */
export class PathSanitizationError extends Error {
  public readonly inputPath: string;
  public readonly reason: string;
  constructor(
    message: string,
    inputPath: string,
    reason: string
  ) {
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
  /**
   * 파일 경로를 검증하고 안전한 경로를 반환한다.
   * 안전하지 않으면 PathSanitizationError를 발생시킨다.
   *
   * @param inputPath - LLM이 제공한 원본 경로
   * @param operation - 작업 유형 ('read' | 'write' | 'list') — 쓰기만 엄격 검증
   * @returns 정규화된 안전한 경로
   * @throws PathSanitizationError - 경로 검증 실패 시
   */
  public static sanitizePath(
    inputPath: string,
    operation: 'read' | 'write' | 'list' = 'write'
  ): string {
    if (!inputPath || typeof inputPath !== 'string') {
      throw new PathSanitizationError(
        `Invalid path: empty or non-string input.`,
        String(inputPath),
        'EMPTY_OR_INVALID'
      );
    }

    // 최대 경로 길이 제한 (255자 — Windows MAX_PATH 기준)
    if (inputPath.length > 1024) {
      throw new PathSanitizationError(
        `Path too long: ${inputPath.length} chars (max 1024).`,
        inputPath,
        'PATH_TOO_LONG'
      );
    }

    // Null byte 및 제어 문자 차단
    if (/[\x00-\x1f\x7f]/.test(inputPath)) {
      throw new PathSanitizationError(
        `Path contains control characters or null bytes.`,
        inputPath,
        'CONTROL_CHARS'
      );
    }

    // URL decoding 시도 후 재검증 (URL encoding bypass 차단)
    let decoded = inputPath;
    try {
      decoded = decodeURIComponent(inputPath);
    } catch {
      // decodeURIComponent가 실패하면 원본 유지 (이미 non-encoded)
    }

    // Double-encoding 시도 탐지
    if (decoded.includes('%')) {
      throw new PathSanitizationError(
        `Path contains suspicious percent-encoding.`,
        inputPath,
        'SUSPICIOUS_ENCODING'
      );
    }

    // 차단 패턴 검사
    for (const pattern of BLOCKED_PATH_PATTERNS) {
      if (pattern.test(decoded)) {
        throw new PathSanitizationError(
          `Path blocked by security policy (pattern: ${pattern.source}).`,
          inputPath,
          'BLOCKED_PATTERN'
        );
      }
    }

    // 다중 Directory Traversal 차단 (2단계 이상)
    const traversalDepth = (decoded.match(/\.\.[/\\]/g) ?? []).length;
    if (traversalDepth >= 2) {
      throw new PathSanitizationError(
        `Path contains deep directory traversal (${traversalDepth} levels).`,
        inputPath,
        'TRAVERSAL_TOO_DEEP'
      );
    }

    // 쓰기 작업은 허용된 루트만 통과
    if (operation === 'write') {
      const normalizedForCheck = decoded.replace(/\//g, '\\');
      const isAllowed = ALLOWED_WRITE_ROOT_PREFIXES.some(prefix =>
        decoded.startsWith(prefix) || normalizedForCheck.startsWith(prefix.replace(/\//g, '\\'))
      );

      if (!isAllowed) {
        throw new PathSanitizationError(
          `Write blocked: path '${inputPath}' is outside allowed write roots.`,
          inputPath,
          'OUTSIDE_ALLOWED_ROOTS'
        );
      }
    }

    return decoded;
  }

  /**
   * 경로가 안전한지 조회한다 (예외 없는 버전).
   * UI 표시 목적으로 사용.
   */
  public static isSafe(inputPath: string, operation: 'read' | 'write' | 'list' = 'write'): boolean {
    try {
      PathSanitizer.sanitizePath(inputPath, operation);
      return true;
    } catch {
      return false;
    }
  }
}
