/**
 * @file orchestrator/recovery/RecoveryEngine.ts
 * @system AMEVA OS Desktop Workstation
 * @location src/renderer/services/ai/orchestrator/recovery/RecoveryEngine.ts
 * @role 5단계 점진적 복구 사다리(Recovery Ladder) 제어 엔진
 *
 * [소비처 - CONSUMERS / USAGE CONTEXT]
 * - useAIAgentMode.ts: SupervisorAgent의 Stalled 신호 수신 시 RecoveryEngine.handleStall()을 호출.
 */

import { useAIState } from '../../../stores/useAIState';
import { FailureMemory } from './FailureMemory';
import type { RecoveryReason, RecoveryCheckpoint } from './types';
import { CheckpointSystem } from './CheckpointSystem';

/**
 * RecoveryOrchestratorBridge
 * 오케스트레이터 세션이 RecoveryEngine에 제공해야 하는 복구 액션 실행 브릿지 인터페이스.
 */
export interface RecoveryOrchestratorBridge {
  sessionId: string;
  abortCurrentStream(): void;
  reconnectStream(): Promise<boolean>;
  resetParser(): void;
  rebuildStreamContext(): Promise<boolean>;
  resumeFromCheckpoint(checkpoint: RecoveryCheckpoint): Promise<boolean>;
}

/**
 * RecoveryEngine
 * 정체 상황 발생 시 점진적으로 레벨을 상향시키며 복구를 시도하는 회복 사다리(Recovery Ladder) 엔진.
 */
export class RecoveryEngine {
  private static instance: RecoveryEngine | null = null;
  private currentLevelMap = new Map<string, number>(); // sessionId -> current ladder level
  private isProcessing = false;

  private constructor() {}

  public static getInstance(): RecoveryEngine {
    if (!RecoveryEngine.instance) {
      RecoveryEngine.instance = new RecoveryEngine();
    }
    return RecoveryEngine.instance;
  }

  /**
   * 세션 종료 시 복구 레벨 정보를 리셋합니다.
   */
  public resetSession(sessionId: string): void {
    this.currentLevelMap.delete(sessionId);
    this.isProcessing = false;
  }

  /**
   * SupervisorAgent로부터 정체 신호를 수신했을 때 점진적 복구를 전개합니다.
   *
   * @param reason - 진단된 정체 원인
   * @param bridge - 오케스트레이터 복구 실행 브릿지
   */
  public async handleStall(reason: RecoveryReason, bridge: RecoveryOrchestratorBridge): Promise<void> {
    if (this.isProcessing) return;
    this.isProcessing = true;

    const sessionId = bridge.sessionId;
    const currentLevel = this.currentLevelMap.get(sessionId) || 1;
    console.info(`[RecoveryEngine] 복구 시도 시작 - 세션: ${sessionId}, 사다리 레벨: ${currentLevel}, 원인: ${reason}`);

    useAIState.getState().setRecoveryState('recovering');

    let success = false;
    let actionName = '';

    try {
      switch (currentLevel) {
        case 1:
          // Level 1. Reconnection (단순 스트림 끊고 재연결)
          actionName = 'Reconnection';
          bridge.abortCurrentStream();
          success = await bridge.reconnectStream();
          break;

        case 2:
          // Level 2. Parser Reset (스트림 끊고 파서 리셋 후 재연결)
          actionName = 'Parser Reset';
          bridge.abortCurrentStream();
          bridge.resetParser();
          success = await bridge.reconnectStream();
          break;

        case 3:
          // Level 3. Stream Rebuild (컨텍스트 히스토리 재결합 후 재요청)
          actionName = 'Stream Rebuild';
          bridge.abortCurrentStream();
          success = await bridge.rebuildStreamContext();
          break;

        case 4:
          // Level 4. Checkpoint Resume (5초 전 스냅샷 복원 및 재시작)
          actionName = 'Checkpoint Resume';
          bridge.abortCurrentStream();
          const checkpoint = await CheckpointSystem.loadCheckpoint(sessionId);
          if (checkpoint) {
            success = await bridge.resumeFromCheckpoint(checkpoint);
          } else {
            console.warn('[RecoveryEngine] 로드할 체크포인트가 없어 Level 4 건너뜀');
            success = false;
          }
          break;

        case 5:
        default:
          // Level 5. User Assist (복구 실패 및 사용자 수동 재개 전환)
          actionName = 'User Assist';
          bridge.abortCurrentStream();
          useAIState.getState().setRecoveryState('recovery_failed');
          // 사용자 수동 복원 콜백 등록
          const cp = await CheckpointSystem.loadCheckpoint(sessionId);
          if (cp) {
            useAIState.getState().setResumeFromCheckpoint(async () => {
              console.info('[RecoveryEngine] 사용자에 의한 수동 복원 재개 실행');
              useAIState.getState().setRecoveryState('normal');
              useAIState.getState().setRecoveryReason(null);
              useAIState.getState().setRecoveryElapsed(0);
              await bridge.resumeFromCheckpoint(cp);
            });
          }
          success = false;
          break;
      }

      // 복구 실패 시 다음 레벨로 레더 상향 조절
      if (!success && currentLevel < 5) {
        this.currentLevelMap.set(sessionId, currentLevel + 1);
      } else if (success) {
        // 복구 성공 시 레벨 1로 복귀
        this.currentLevelMap.set(sessionId, 1);
        useAIState.getState().setRecoveryState('normal');
        useAIState.getState().setRecoveryReason(null);
        useAIState.getState().setRecoveryElapsed(0);
        console.info(`[RecoveryEngine] 복구 성공 - 레벨: ${currentLevel}`);
      }

      // FailureMemory 에 이력 영속 기록 (ReadOnly 이력 보존 목적)
      await FailureMemory.recordFailure({
        sessionId,
        reason,
        details: `사다리 레벨 ${currentLevel} (${actionName}) 실행`,
        actionTaken: actionName,
        success
      });

    } catch (err: any) {
      console.error('[RecoveryEngine] 복구 실행 도중 에러 발생:', err);
      // 예외 발생 시 다음 사다리로 강제 이전
      if (currentLevel < 5) {
        this.currentLevelMap.set(sessionId, currentLevel + 1);
      }
    } finally {
      this.isProcessing = false;
    }
  }
}
