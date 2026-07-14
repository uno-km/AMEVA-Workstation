/**
 * @file orchestrator/task-runtime/trace/SecretRedactor.ts
 * @system AMEVA OS Desktop Workstation
 * @role Trace 저장 및 표시 전에 민감 데이터를 마스킹/제거하는 중앙 Redaction 계층
 *
 * [소비처 - CONSUMERS / USAGE CONTEXT]
 * - ExecutionTraceStore: TraceEvent 저장 전 및 Export 시 Redaction 적용
 * - ExecutionTraceManager: Tool 인자, Observation 텍스트 Redaction
 *
 * [Phase 4 Redaction 계약]
 * 1. Tool 실행 전에 실제 인자(Original Arguments)를 절대 변경하지 않는다. Trace 저장·표시용 복사본에만 적용.
 * 2. 원본 실행 인자와 Redacted Trace 인자를 엄격히 분리.
 * 3. Redaction 실패 시 민감 가능성이 높은 값은 기본 비공개([REDACTED]) 처리.
 * 4. Trace에 절대 기록 금지 목록: 평문 Secret, Private Key, Authorization Header, Cookie, 사용자 Credential.
 */

/**
 * [도메인 종속 지역 상수]
 * 민감 키 패턴 및 텍스트 탐지용 정규식
 */
const SENSITIVE_KEY_PATTERN = /(api[-_]?key|access[-_]?token|refresh[-_]?token|auth[-_]?token|authorization|cookie|password|secret|private[-_]?key|connection[-_]?string|credential|passwd|pwd|bearer|jwt)/i;

const BEARER_TOKEN_REGEX = /Bearer\s+[A-Za-z0-9\-\._~\+\/=_:]+/gi;
const PRIVATE_KEY_REGEX = /-----BEGIN [A-Z ]+PRIVATE KEY-----\s*[\s\S]*?\s*-----END [A-Z ]+PRIVATE KEY-----/gi;
const COOKIE_HEADER_REGEX = /(Cookie|Set-Cookie)\s*:\s*[^\r\n]+/gi;
const AUTH_HEADER_REGEX = /(Authorization|X-API-Key|Proxy-Authorization)\s*:\s*(?!Bearer\b)[^\r\n]+/gi;
const ENV_SECRET_REGEX = /\b(API_KEY|SECRET|PASSWORD|TOKEN|ACCESS_KEY|PRIVATE_KEY)\s*=\s*['"]?([^\r\n'"\s]+)['"]?/gi;
const LONG_BASE64_REGEX = /\b(?![A-Za-z0-9+/]{0,59}$)[A-Za-z0-9+/]{60,}={0,2}\b/g;

export class SecretRedactor {
  /**
   * Tool 또는 Command의 인자 객체를 검사하여 민감 정보를 Redaction한 복사본을 반환한다.
   * 원본 객체는 변경하지 않는다.
   *
   * @param args 검사할 원본 인자 객체
   * @returns Redact된 객체와 변경된 민감 키 목록
   */
  public static redactArguments(args: Record<string, any> | undefined | null): {
    redactedArguments: Record<string, any>;
    redactedArgumentKeys: string[];
  } {
    if (!args || typeof args !== 'object') {
      return { redactedArguments: args ?? {}, redactedArgumentKeys: [] };
    }

    const redactedKeys = new Set<string>();

    const redactRecursive = (obj: any, currentPath: string, depth: number): any => {
      if (depth > 15 || obj === null || obj === undefined) return obj;

      if (typeof obj === 'string') {
        if (SENSITIVE_KEY_PATTERN.test(currentPath)) {
          redactedKeys.add(currentPath);
          return '[REDACTED_CREDENTIAL]';
        }
        const redactedStr = SecretRedactor.redactText(obj);
        if (redactedStr !== obj) {
          redactedKeys.add(currentPath);
        }
        return redactedStr;
      }

      if (typeof obj === 'number' || typeof obj === 'boolean') {
        if (SENSITIVE_KEY_PATTERN.test(currentPath)) {
          redactedKeys.add(currentPath);
          return '[REDACTED_CREDENTIAL]';
        }
        return obj;
      }

      if (Array.isArray(obj)) {
        return obj.map((item, idx) => redactRecursive(item, `${currentPath}[${idx}]`, depth + 1));
      }

      if (typeof obj === 'object') {
        const copy: Record<string, any> = {};
        for (const [key, val] of Object.entries(obj)) {
          const nextPath = currentPath ? `${currentPath}.${key}` : key;
          if (SENSITIVE_KEY_PATTERN.test(key)) {
            redactedKeys.add(nextPath);
            copy[key] = '[REDACTED_CREDENTIAL]';
          } else {
            copy[key] = redactRecursive(val, nextPath, depth + 1);
          }
        }
        return copy;
      }

      return obj;
    };

    try {
      const redactedArguments = redactRecursive(args, '', 0);
      return {
        redactedArguments,
        redactedArgumentKeys: Array.from(redactedKeys)
      };
    } catch (err) {
      console.error('[SecretRedactor] redactArguments 실패, 안전 비공개 처리:', err);
      return {
        redactedArguments: { _redactorError: 'Failed to safely redact arguments', _raw: '[REDACTED_ON_ERROR]' },
        redactedArgumentKeys: ['*']
      };
    }
  }

  /**
   * 문자열 내의 민감한 토큰, 키, 인증 헤더 등을 탐지하여 마스킹한다.
   *
   * @param text 검사할 문자열
   * @returns Redact된 문자열
   */
  public static redactText(text: string | undefined | null): string {
    if (!text || typeof text !== 'string') return text ?? '';

    try {
      let result = text;
      result = result.replace(PRIVATE_KEY_REGEX, '[REDACTED_PRIVATE_KEY]');
      result = result.replace(/((?:Authorization|X-API-Key|Proxy-Authorization)\s*:\s*)([^\r\n]+)/gi, (match, prefix, value) => {
        if (/^Bearer\s+/i.test(value)) {
          return `${prefix}Bearer [REDACTED_TOKEN]`;
        }
        return `${prefix}[REDACTED_AUTH]`;
      });
      result = result.replace(BEARER_TOKEN_REGEX, 'Bearer [REDACTED_TOKEN]');
      result = result.replace(COOKIE_HEADER_REGEX, '$1: [REDACTED_COOKIE]');
      result = result.replace(ENV_SECRET_REGEX, (match, key) => `${key}=[REDACTED_SECRET]`);

      if (LONG_BASE64_REGEX.test(result)) {
        result = result.replace(LONG_BASE64_REGEX, (match) => {
          if (match.length >= 80 || /ey[A-Za-z0-9\-_=]+\.[A-Za-z0-9\-_=]+\.?[A-Za-z0-9\-_+/=]*/.test(match)) {
            return '[REDACTED_BASE64_CREDENTIAL]';
          }
          return match;
        });
      }

      return result;
    } catch (err) {
      console.error('[SecretRedactor] redactText 실패:', err);
      return '[REDACTED_ON_ERROR]';
    }
  }

  /**
   * TraceEvent 전체 객체를 깊은 복사한 후, 메타데이터 및 구조화 하위 객체 내의 민감 정보를 Redaction한다.
   */
  public static redactEvent<T extends Record<string, any>>(event: T): T {
    try {
      const copy = structuredClone(event);

      if (copy.toolExecution) {
        if (copy.toolExecution.normalizedArguments) {
          const { redactedArguments, redactedArgumentKeys } = SecretRedactor.redactArguments(copy.toolExecution.normalizedArguments);
          copy.toolExecution.normalizedArguments = redactedArguments;
          copy.toolExecution.redactedArgumentKeys = Array.from(
            new Set([...(copy.toolExecution.redactedArgumentKeys || []), ...redactedArgumentKeys])
          );
        }
        if (copy.toolExecution.resultSummary) {
          copy.toolExecution.resultSummary = SecretRedactor.redactText(copy.toolExecution.resultSummary);
        }
        if (copy.toolExecution.stdoutSummary) {
          copy.toolExecution.stdoutSummary = SecretRedactor.redactText(copy.toolExecution.stdoutSummary);
        }
        if (copy.toolExecution.stderrSummary) {
          copy.toolExecution.stderrSummary = SecretRedactor.redactText(copy.toolExecution.stderrSummary);
        }
      }

      if (copy.commandPlan) {
        if (copy.commandPlan.arguments && Array.isArray(copy.commandPlan.arguments)) {
          copy.commandPlan.arguments = copy.commandPlan.arguments.map((arg: string) => SecretRedactor.redactText(arg));
        }
      }

      if (copy.commandResult) {
        if (copy.commandResult.stdoutPreview) {
          copy.commandResult.stdoutPreview = SecretRedactor.redactText(copy.commandResult.stdoutPreview);
        }
        if (copy.commandResult.stderrPreview) {
          copy.commandResult.stderrPreview = SecretRedactor.redactText(copy.commandResult.stderrPreview);
        }
      }

      if (copy.decision) {
        if (copy.decision.objective) copy.decision.objective = SecretRedactor.redactText(copy.decision.objective);
        if (copy.decision.selectionReason) copy.decision.selectionReason = SecretRedactor.redactText(copy.decision.selectionReason);
        if (copy.decision.expectedOutcome) copy.decision.expectedOutcome = SecretRedactor.redactText(copy.decision.expectedOutcome);
      }

      if (copy.observation) {
        if (copy.observation.summary) copy.observation.summary = SecretRedactor.redactText(copy.observation.summary);
        if (copy.observation.output) copy.observation.output = SecretRedactor.redactText(copy.observation.output);
        if (copy.observation.stdoutPreview) copy.observation.stdoutPreview = SecretRedactor.redactText(copy.observation.stdoutPreview);
        if (copy.observation.stderrPreview) copy.observation.stderrPreview = SecretRedactor.redactText(copy.observation.stderrPreview);
      }

      if (copy.summary) {
        copy.summary = SecretRedactor.redactText(copy.summary);
      }
      if (copy.title) {
        copy.title = SecretRedactor.redactText(copy.title);
      }

      return copy;
    } catch (err) {
      console.error('[SecretRedactor] redactEvent 실패, 안전 복사 반환:', err);
      return {
        ...event,
        summary: '[REDACTED_ON_ERROR]'
      };
    }
  }
}
