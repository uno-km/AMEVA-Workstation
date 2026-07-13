/**
 * @file debug-sidecar/server.ts
 * @system AMEVA OS Desktop Workstation
 */

import './mock';

import { DebugApiServer } from './api/DebugApiServer';
import { MissionControlService } from './control/MissionControlService';
import { MissionLogManager } from './logging/MissionLogManager';
import { SseEventBroker } from './streaming/SseEventBroker';
import { RuntimeHarnessFactory } from './harness/RuntimeHarnessFactory';
import { ConsoleCollector } from './collectors/ConsoleCollector';

async function bootstrap() {
  const logManager = new MissionLogManager();
  
  // Capture sidecar console output into events
  ConsoleCollector.initialize(logManager);

  // Auto-Approve plan reviews in sidecar mode
  const { useAIState } = await import('../renderer/stores/useAIState');
  useAIState.subscribe((state) => {
    if (state.planApprovalState === 'pending' && state.resolvePlanApproval) {
      console.info('[Sidecar Auto-Approve] 자동 계획 승인 실행.');
      state.resolvePlanApproval({ approved: true });
    }
  });

  const harnessFactory = new RuntimeHarnessFactory(logManager);
  const controlService = new MissionControlService(harnessFactory, logManager);
  const sseBroker = new SseEventBroker();
  
  const port = parseInt(process.env.SIDECAR_PORT || '11554', 10);
  const server = new DebugApiServer(port, controlService, sseBroker, logManager);

  server.start();

  process.on('SIGINT', async () => {
    console.info('[Sidecar] Shutting down...');
    await server.stop();
    await logManager.closeAll();
    ConsoleCollector.restore();
    process.exit(0);
  });
}

bootstrap().catch(console.error);
