/**
 * @file orchestrator/task-runtime/dispatch/CapabilityCatalog.ts
 * @system AMEVA OS Desktop Workstation
 * @role 시스템이 제공 가능한 권한 및 툴 세트 명세
 */

export class CapabilityCatalog {
  // 현재 에이전트 시스템이 제공할 수 있는 임의의 툴들 목록
  private availableCapabilities = new Set([
    'file.read',
    'file.write',
    'sys.command',
    'web.search',
    'code.execute',
    'llm.reasoning'
  ]);

  public hasCapability(cap: string): boolean {
    return this.availableCapabilities.has(cap);
  }

  public getMissingCapabilities(requiredCaps: string[]): string[] {
    return requiredCaps.filter(cap => !this.hasCapability(cap));
  }
}
