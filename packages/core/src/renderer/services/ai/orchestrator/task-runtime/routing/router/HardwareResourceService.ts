/**
 * @file routing/router/HardwareResourceService.ts
 * @system AMEVA OS Desktop Workstation
 * @role Hardware and Resource metric provider
 */

import * as ipc from '../../../../../ipc/electronApiAdapter';

export interface HardwareMetrics {
  availableVramMb: number;
  cpuLoad: number;
  gpuLoad: number;
  memoryPressure: 'low' | 'medium' | 'high';
}

export class HardwareResourceService {
  /**
   * Retrieves real hardware metrics from IPC.
   * If not available, returns null so the router can use Conservative Policy.
   * Do NOT return mock data in production.
   */
  public static async getMetrics(): Promise<HardwareMetrics | null> {
    if (!ipc.isElectronEnv()) {
      return null;
    }

    try {
      // Assuming there's a system stats IPC call. If it doesn't exist, this will throw or return null.
      // For now, we simulate fetching real data by checking window.AMEVA_SYS or similar if it existed.
      // If no explicit hardware IPC exists yet, we MUST return null to trigger Conservative Policy.
      if (typeof (ipc as Record<string, unknown>).getHardwareMetrics === 'function') {
        const metrics = await (ipc as { getHardwareMetrics: () => Promise<HardwareMetrics> }).getHardwareMetrics();
        return {
          availableVramMb: metrics.freeVram || metrics.totalVram * 0.5,
          cpuLoad: metrics.cpuUsage || 0,
          gpuLoad: metrics.gpuUsage || 0,
          memoryPressure: metrics.memoryPressure || 'medium'
        };
      }
      return null; 
    } catch (e) {
      console.warn('[HardwareResourceService] Failed to get real hardware metrics:', e);
      return null;
    }
  }
}
