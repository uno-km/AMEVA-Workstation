/**
 * @file orchestrator/recovery/SupervisorAgent.ts
 * @system AMEVA OS Desktop Workstation
 * @location src/renderer/services/ai/orchestrator/recovery/SupervisorAgent.ts
 * @role 백그라운드 Watchdog 타이머 및 실시간 에이전트 진행 단계 추정기
 *
 * [소비처 - CONSUMERS / USAGE CONTEXT]
 * - useAIAgentMode.ts: runDeepReasoningMode 진입 시 startMonitoring() 호출, 탈출 시 stopMonitoring() 호출.
 * - AgentOrchestrator.ts: 토큰 유입 시 onToken()을 호출하여 시간 갱신 연동.
 */

import { useAIState } from '../../../../stores/useAIState';
import type { RecoveryState, RecoveryReason, InferencePhase } from './types';
import * as ipc from '../../../../services/ipc/electronApiAdapter';

/**
 * SupervisorAgent
 * 에이전트의 이벤트 루프 외부에서 백그라운드 주기 타이머(Watchdog)로 상태 정체를 진단하고,
 * 생성 패턴을 분석하여 현재 추론 단계(Planning/Reasoning/Drafting/Finalizing)를 독립 추정합니다.
 */
export class SupervisorAgent {
  private static instance: SupervisorAgent | null = null;

  private sessionId: string | null = null;
  private intervalId: any = null;
  private onStallTrigger: ((reason: RecoveryReason) => void) | null = null;

  // 감시용 타임스탬프 필드
  private lastChunkTime = Date.now();
  private lastThoughtLength = 0;
  private lastThoughtChangeTime = Date.now();
  private lastToolCallTime = Date.now();
  private accumulatedTokens = 0;

  private constructor() {}

  public static getInstance(): SupervisorAgent {
    if (!SupervisorAgent.instance) {
      SupervisorAgent.instance = new SupervisorAgent();
    }
    return SupervisorAgent.instance;
  }

  /**
   * 감시 대상 세션을 지정하고 백그라운드 Watchdog 모니터링을 시작합니다.
   *
   * @param sessionId - 에이전트 추론 세션 ID
   * @param onStall - Stalled 또는 Recovery Required 감지 시 호출될 콜백 함수
   */
  public startMonitoring(sessionId: string, onStall: (reason: RecoveryReason) => void): void {
    this.stopMonitoring();
    this.sessionId = sessionId;
    this.onStallTrigger = onStall;

    // 타임스탬프 리셋
    const now = Date.now();
    this.lastChunkTime = now;
    this.lastThoughtLength = 0;
    this.lastThoughtChangeTime = now;
    this.lastToolCallTime = now;
    this.accumulatedTokens = 0;

    // 10초 주기 백그라운드 Watchdog 구동
    this.intervalId = setInterval(() => {
      void this.checkHealthAndProgress();
    }, 10000);

    console.info(`[SupervisorAgent] 세션 감시 시작: ${sessionId}`);
  }

  /**
   * 백그라운드 모니터링을 정지하고 타이머를 해제합니다.
   */
  public stopMonitoring(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.sessionId = null;
    this.onStallTrigger = null;
  }

  /**
   * 토큰 청크가 생성되어 유입되었을 때 타임스탬프를 갱신하고 진행 단계를 추정합니다.
   */
  public onToken(token: string, fullThought: string, isToolCalling: boolean): void {
    const now = Date.now();
    this.lastChunkTime = now;
    this.accumulatedTokens++;

    // 1. Thought 버퍼 변화 체크
    const cleanThought = fullThought.trim();
    if (cleanThought.length > this.lastThoughtLength) {
      this.lastThoughtLength = cleanThought.length;
      this.lastThoughtChangeTime = now;
    }

    // 2. 도구 호출 시간 갱신
    if (isToolCalling) {
      this.lastToolCallTime = now;
    }

    // 3. Inference Phase 추정 (모델 독립적 휴리스틱)
    let currentPhase: InferencePhase = 'Reasoning';
    
    if (this.accumulatedTokens < 15 && cleanThought.length === 0) {
      currentPhase = 'Planning'; // 극초기 태스크 플랜 로드 단계
    } else if (isToolCalling || token.includes('<tool_call>') || token.includes('Observation:')) {
      currentPhase = 'Drafting'; // 도구 실행 및 본문 패치 제안 단계
    } else if (token.includes('Final Answer:') || token.includes('최종 답변:') || cleanThought.length > 0 && token.includes('</thought>') || token.includes('</think>')) {
      currentPhase = 'Finalizing'; // 생각 정리 및 최종 결론 완성 단계
    }

    // Zustand 스토어 반영
    useAIState.getState().setInferencePhase(currentPhase);
  }

  /**
   * Watchdog 10초 주기 타이머 실행 시점의 지표 수집 및 정체 판정
   */
  private async checkHealthAndProgress(): Promise<void> {
    if (!this.sessionId) return;

    const now = Date.now();
    const elapsedSinceLastChunk = now - this.lastChunkTime;
    const elapsedSinceThoughtChange = now - this.lastThoughtChangeTime;

    // 1. Llama.cpp 헬스체크 및 물리적 응답 시간 측정
    let serverIsAlive = false;
    try {
      const startTime = Date.now();
      const res = await ipc.llmCheckHealth();
      const latency = Date.now() - startTime;

      if (res && (res.status === 'ok' || res.status === 'ready')) {
        serverIsAlive = true;
        // 지연 속도에 따른 상태 세분화 (5초 이상 지연 시 Overloaded)
        if (latency > 5000) {
          console.warn('[SupervisorAgent] Llama.cpp 서버 오버로드 감지:', latency, 'ms');
        }
      }
    } catch {
      serverIsAlive = false;
    }

    // 서버가 진짜 죽었다면 즉시 복구 엔진 트리거
    if (!serverIsAlive) {
      console.error('[SupervisorAgent] Llama.cpp 서버 무응답(Dead) 상태 감지!');
      this.triggerStall('LLAMA_UNRESPONSIVE');
      return;
    }

    // 2. 휴리스틱 기반 정체(Stall) 탐지
    // 60초 이상 아무 토큰도 공급되지 않은 상태
    if (elapsedSinceLastChunk >= 60000) {
      console.warn('[SupervisorAgent] 60초 이상 응답 정체 감지 (Recovery Required)');
      this.triggerStall('STREAM_STALL');
    }
    // 20초 이상 토큰 없음
    else if (elapsedSinceLastChunk >= 20000) {
      console.warn('[SupervisorAgent] 20초 이상 응답 지연 (Stalled)');
      useAIState.getState().setRecoveryState('stalled');
      useAIState.getState().setRecoveryReason('STREAM_STALL');
      useAIState.getState().setRecoveryElapsed(Math.round(elapsedSinceLastChunk / 1000));
    }
    // 10초 이상 토큰 없고 Thought 변화 없음
    else if (elapsedSinceLastChunk >= 10000 && elapsedSinceThoughtChange >= 10000) {
      console.info('[SupervisorAgent] 10초 이상 무반응 (Suspicious)');
      useAIState.getState().setRecoveryState('suspicious');
      useAIState.getState().setRecoveryElapsed(Math.round(elapsedSinceLastChunk / 1000));
    } else {
      // 정상 상태 복귀
      useAIState.getState().setRecoveryState('normal');
      useAIState.getState().setRecoveryReason(null);
      useAIState.getState().setRecoveryElapsed(0);
    }
  }

  /**
   * 정체를 공식 트리거하여 콜백을 실행하고 스토어를 갱신합니다.
   */
  private triggerStall(reason: RecoveryReason): void {
    useAIState.getState().setRecoveryState('recovering');
    useAIState.getState().setRecoveryReason(reason);
    if (this.onStallTrigger) {
      this.onStallTrigger(reason);
    }
  }
}
