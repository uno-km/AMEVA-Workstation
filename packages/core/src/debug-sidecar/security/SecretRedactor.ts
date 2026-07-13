/**
 * @file debug-sidecar/security/SecretRedactor.ts
 * @system AMEVA OS Desktop Workstation
 */

export class SecretRedactor {
  private static readonly SENSITIVE_KEYS = [
    'authorization', 'apikey', 'api_key', 'token', 'password', 'secret', 'cookie', 'credentials'
  ];

  public static redactObject(obj: any): any {
    if (obj === null || obj === undefined) return obj;
    if (typeof obj !== 'object') return obj;

    if (Array.isArray(obj)) {
      return obj.map(item => this.redactObject(item));
    }

    const redacted = { ...obj };
    for (const key of Object.keys(redacted)) {
      if (this.SENSITIVE_KEYS.some(sensitive => key.toLowerCase().includes(sensitive))) {
        redacted[key] = '[REDACTED]';
      } else if (typeof redacted[key] === 'object') {
        redacted[key] = this.redactObject(redacted[key]);
      }
    }
    return redacted;
  }

  public static redactString(str: string): string {
    if (!str) return str;
    // Basic heuristics for things like Bearer tokens
    return str.replace(/(Bearer\s+)[a-zA-Z0-9\-\._~+/]+=*/gi, '$1[REDACTED]');
  }

  public static createPreview(str: string, maxLength: number = 200): string {
    if (!str) return str;
    if (str.length <= maxLength) return str;
    return `${str.substring(0, maxLength)}... [TRUNCATED ${str.length - maxLength} chars]`;
  }
}
