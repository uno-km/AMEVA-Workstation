/**
 * @file debug-sidecar/observability/TimestampProvider.ts
 * @system AMEVA OS Desktop Workstation
 */

export class TimestampProvider {
  public static getNow() {
    const now = new Date();
    // Using performance.now() for monotonic time
    const monotonic_ms = typeof performance !== 'undefined' ? performance.now() : Date.now();
    
    // Getting timezone offset e.g. "+09:00"
    const offset = -now.getTimezoneOffset();
    const sign = offset >= 0 ? '+' : '-';
    const pad = (num: number) => num.toString().padStart(2, '0');
    const hours = pad(Math.floor(Math.abs(offset) / 60));
    const minutes = pad(Math.abs(offset) % 60);
    const timezone = `${sign}${hours}:${minutes}`;

    return {
      timestamp: now.toISOString(),
      timestamp_ms: now.getTime(),
      monotonic_ms,
      timezone
    };
  }
}
