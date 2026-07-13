/**
 * @file debug-sidecar/harness/RuntimeHarnessFactory.ts
 * @system AMEVA OS Desktop Workstation
 */

import { MissionLogManager } from '../logging/MissionLogManager';
import { LegacyRuntimeHarness } from './LegacyRuntimeHarness';
import { V2RuntimeHarness } from './V2RuntimeHarness';

export interface HarnessOptions {
  missionId: string;
  prompt: string;
  model: string;
  endpoint: string;
  runtimeMode: 'legacy' | 'v2';
}

export interface IRuntimeHarness {
  start(): Promise<void>;
  pause(): Promise<void>;
  resume(): Promise<void>;
  cancel(): Promise<void>;
  dispose(): Promise<void>;
}

export class RuntimeHarnessFactory {
  constructor(private logManager: MissionLogManager) {}

  public create(options: HarnessOptions): IRuntimeHarness {
    if (options.runtimeMode === 'v2') {
      return new V2RuntimeHarness(options, this.logManager);
    }
    return new LegacyRuntimeHarness(options, this.logManager);
  }
}
