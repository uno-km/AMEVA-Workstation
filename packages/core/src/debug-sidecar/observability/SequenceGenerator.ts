/**
 * @file debug-sidecar/observability/SequenceGenerator.ts
 * @system AMEVA OS Desktop Workstation
 */

export class SequenceGenerator {
  private static sequence = 0;

  public static next(): number {
    return ++this.sequence;
  }

  public static current(): number {
    return this.sequence;
  }
}
