/**
 * @file orchestrator/task-runtime/utils/PathSanitizer.ts
 * @system AMEVA OS Desktop Workstation
 * @role canonical path 기반 sandbox root 검증
 */

export interface SandboxResolutionResult {
  logicalPath: string;
  canonicalPath: string;
  insideRoot: boolean;
  violationReason?: string;
}

function normalizeSeparators(p: string): string {
  return p.replace(/\\/g, '/').replace(/\/+/g, '/');
}
function isUNCPath(p: string): boolean {
  // 정규화 전에 원래 문자열로 체크 (// 또는 \\\\ 시작)
  return /^\/\/[^/]/.test(p) || /^\\\\[^\\]/.test(p) || /^\/\/[^/]/.test(normalizeSeparators(p));
}
function isWindowsDrivePath(p: string): boolean {
  return /^[A-Za-z]:[\\/]/.test(p);
}
function pathStartsWith(candidate: string, root: string): boolean {
  const lowerCandidate = normalizeSeparators(candidate).toLowerCase();
  const lowerRoot = normalizeSeparators(root).toLowerCase();
  const rootWithSlash = lowerRoot.endsWith('/') ? lowerRoot : lowerRoot + '/';
  return lowerCandidate === lowerRoot.replace(/\/$/, '') || lowerCandidate.startsWith(rootWithSlash);
}
function hasTraversalPattern(p: string): boolean {
  const normalized = normalizeSeparators(p);
  return /(^|\/)\.\.(\/|$)/.test(normalized);
}
function hasNullByte(p: string): boolean {
  return p.includes('\0');
}

export function resolveAgainstSandboxRoot(
  sandboxRoot: string,
  missionId: string,
  relativeOutputPath: string
): SandboxResolutionResult {
  if (hasNullByte(relativeOutputPath)) {
    return { logicalPath: relativeOutputPath, canonicalPath: '', insideRoot: false, violationReason: 'NULL_BYTE_IN_PATH' };
  }
  if (hasTraversalPattern(missionId) || missionId.includes('/') || missionId.includes('\\')) {
    return { logicalPath: relativeOutputPath, canonicalPath: '', insideRoot: false, violationReason: 'INVALID_MISSION_ID' };
  }
  if (isUNCPath(relativeOutputPath)) {
    return { logicalPath: relativeOutputPath, canonicalPath: '', insideRoot: false, violationReason: 'UNC_PATH_NOT_ALLOWED' };
  }
  if (hasTraversalPattern(relativeOutputPath)) {
    return { logicalPath: relativeOutputPath, canonicalPath: '', insideRoot: false, violationReason: `PATH_TRAVERSAL_DETECTED: ${relativeOutputPath}` };
  }

  const isAbsolute = isWindowsDrivePath(relativeOutputPath) || relativeOutputPath.startsWith('/') || relativeOutputPath.startsWith('\\');
  let candidatePath: string;
  if (isAbsolute) {
    candidatePath = relativeOutputPath;
  } else {
    const base = normalizeSeparators(sandboxRoot).replace(/\/$/, '');
    const mission = normalizeSeparators(missionId).replace(/^\/|\/$/g, '');
    const rel = normalizeSeparators(relativeOutputPath).replace(/^\//, '');
    candidatePath = `${base}/${mission}/${rel}`;
  }

  let canonicalPath: string;
  try {
    const normalized = normalizeSeparators(candidatePath);
    const withFileScheme = normalized.startsWith('/') ? `file://${normalized}` : `file:///${normalized}`;
    const url = new URL(withFileScheme);
    canonicalPath = decodeURIComponent(url.pathname);
    if (/^\/[A-Za-z]:\//.test(canonicalPath)) { canonicalPath = canonicalPath.slice(1); }
  } catch {
    canonicalPath = normalizeSeparators(candidatePath).split('/').reduce((acc: string[], seg) => {
      if (seg === '.' || seg === '') return acc;
      if (seg === '..') { acc.pop(); return acc; }
      acc.push(seg); return acc;
    }, []).join('/');
  }

  if (hasTraversalPattern(canonicalPath)) {
    return { logicalPath: relativeOutputPath, canonicalPath, insideRoot: false, violationReason: `PATH_TRAVERSAL_AFTER_NORMALIZATION: ${canonicalPath}` };
  }

  const inside = pathStartsWith(canonicalPath, normalizeSeparators(sandboxRoot));
  return {
    logicalPath: relativeOutputPath,
    canonicalPath,
    insideRoot: inside,
    violationReason: inside ? undefined : `PATH_OUTSIDE_SANDBOX: ${canonicalPath}`
  };
}

export function isPathInsideSandbox(sandboxRoot: string, missionId: string, path: string): boolean {
  return resolveAgainstSandboxRoot(sandboxRoot, missionId, path).insideRoot;
}

/**
 * [P0-4 FIX] Real Filesystem Containment & Symlink / Junction Escape 검증.
 * - realpath 기반 실시간 FS 검증
 * - symlink / junction이 sandboxRoot 외부를 가리키는 경우 차단
 * - 검증 불가능한 환경(Adapter 없음/에러)인 경우 INCOMPLETE_PATH_VERIFICATION 반환
 */
export async function verifyRealFilesystemContainment(
  sandboxRoot: string,
  canonicalPath: string,
  fileAdapter?: { realpath?: (p: string) => Promise<string>; stat?: (p: string) => Promise<{ exists: boolean; isSymbolicLink?: boolean }> }
): Promise<{ safe: boolean; realPath?: string; reason?: string }> {
  const normalizedRoot = normalizeSeparators(sandboxRoot);
  const normalizedTarget = normalizeSeparators(canonicalPath);

  // 1. Lexical check 우선
  if (!pathStartsWith(normalizedTarget, normalizedRoot)) {
    return { safe: false, reason: `PATH_OUTSIDE_SANDBOX: ${normalizedTarget}` };
  }

  // 2. FS 어댑터 및 realpath 지원 검사
  if (!fileAdapter || typeof fileAdapter.realpath !== 'function') {
    // Node.js 환경에서 fs.realpathSync fallback 시도
    try {
      const fs = require('fs');
      if (fs && typeof fs.realpathSync === 'function') {
        if (fs.existsSync(canonicalPath)) {
          const realPath = normalizeSeparators(fs.realpathSync(canonicalPath));
          if (!pathStartsWith(realPath, normalizedRoot)) {
            return { safe: false, realPath, reason: `SYMLINK_ESCAPE_DETECTED: Real path ${realPath} escapes sandbox ${normalizedRoot}` };
          }
          return { safe: true, realPath };
        }
      }
    } catch (e) {
      // 파일이 존재하지 않는 신규 생성 파일인 경우, 부모 디렉토리 체인 검사
      try {
        const fs = require('fs');
        const path = require('path');
        let current = path.dirname(canonicalPath);
        while (current && current.length >= normalizedRoot.length) {
          if (fs.existsSync(current)) {
            const realParent = normalizeSeparators(fs.realpathSync(current));
            if (!pathStartsWith(realParent, normalizedRoot)) {
              return { safe: false, realPath: realParent, reason: `PARENT_SYMLINK_ESCAPE_DETECTED: Parent path ${realParent} escapes sandbox ${normalizedRoot}` };
            }
            break;
          }
          const parent = path.dirname(current);
          if (parent === current) break;
          current = parent;
        }
        return { safe: true };
      } catch (parentErr) {
        return { safe: false, reason: 'INCOMPLETE_PATH_VERIFICATION: Failed realpath parent chain check' };
      }
    }

    return { safe: false, reason: 'INCOMPLETE_PATH_VERIFICATION: No filesystem adapter or realpath method available for verification' };
  }

  try {
    const realPath = normalizeSeparators(await fileAdapter.realpath(canonicalPath));
    if (!pathStartsWith(realPath, normalizedRoot)) {
      return { safe: false, realPath, reason: `SYMLINK_ESCAPE_DETECTED: Real path ${realPath} escapes sandbox ${normalizedRoot}` };
    }
    return { safe: true, realPath };
  } catch (err: any) {
    return { safe: false, reason: `INCOMPLETE_PATH_VERIFICATION: ${err.message || String(err)}` };
  }
}
