/**
 * @file debug-sidecar/control/MissionControlService.ts
 * @system AMEVA OS Desktop Workstation
 */

import { RuntimeHarnessFactory, IRuntimeHarness, HarnessOptions } from '../harness/RuntimeHarnessFactory';
import { MissionLogManager } from '../logging/MissionLogManager';
import { EventNormalizer } from '../observability/EventNormalizer';

export class MissionControlService {
  private activeMissions = new Map<string, IRuntimeHarness>();

  constructor(
    private harnessFactory: RuntimeHarnessFactory,
    private logManager: MissionLogManager
  ) {}

  public async startMission(options: HarnessOptions): Promise<void> {
    if (this.activeMissions.has(options.missionId)) {
      throw new Error(`Mission ${options.missionId} is already active`);
    }

    const harness = this.harnessFactory.create(options);
    this.activeMissions.set(options.missionId, harness);

    // Fire and forget
    harness.start().finally(() => {
      this.activeMissions.delete(options.missionId);
      harness.dispose().catch(console.error);
    });
  }

  public async pauseMission(missionId: string): Promise<void> {
    const harness = this.activeMissions.get(missionId);
    if (!harness) throw new Error(`Mission ${missionId} not found`);
    await harness.pause();
  }

  public async resumeMission(missionId: string): Promise<void> {
    const harness = this.activeMissions.get(missionId);
    if (!harness) throw new Error(`Mission ${missionId} not found`);
    await harness.resume();
  }

  public async cancelMission(missionId: string): Promise<void> {
    const harness = this.activeMissions.get(missionId);
    if (!harness) throw new Error(`Mission ${missionId} not found`);
    await harness.cancel();
  }
}
