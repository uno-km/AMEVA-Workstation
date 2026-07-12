/**
 * @file orchestrator/task-runtime/dispatch/CapabilityCatalog.ts
 * @system AMEVA OS Desktop Workstation
 * @role 시스템이 제공 가능한 권한 및 툴 세트 명세
 */

export class CapabilityCatalog {
  // PHASE 3.5: Tool Runtime 구현 전까지 Tool 기능을 비활성화 (Disabled Safely).
  // 오직 LLM Reasoning만 허용합니다.
  private availableCapabilities = new Set([
    'llm.reasoning'
    // 'file.read',
    // 'file.write',
    // 'sys.command',
    // 'web.search',
    // 'code.execute',
  ]);

  public hasCapability(cap: string): boolean {
    return this.availableCapabilities.has(cap);
  }

  public getMissingCapabilities(requiredCaps: string[]): string[] {
    return requiredCaps.filter(cap => !this.hasCapability(cap));
  }
}
