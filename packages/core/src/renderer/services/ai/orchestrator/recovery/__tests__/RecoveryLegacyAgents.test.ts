/**
 * @file orchestrator/recovery/__tests__/RecoveryLegacyAgents.test.ts
 * @system AMEVA OS Desktop Workstation
 * @role Recovery-First 복구 사다리 및 모니터링 엔진 JavaScript 단위 테스트 스크립트 (Vitest 마이그레이션)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CriticAgent } from '../CriticAgent';
import { SupervisorAgent } from '../SupervisorAgent';

// Zustand 스토어 Mocking
vi.mock('../../../../../stores/useAIState', () => {
  const store = {
    recoveryState: 'normal',
    recoveryReason: null,
    recoveryElapsed: 0,
    inferencePhase: 'Planning',
    resumeFromCheckpoint: null,
    setRecoveryState: (state: any) => { store.recoveryState = state; },
    setRecoveryReason: (reason: any) => { store.recoveryReason = reason; },
    setRecoveryElapsed: (elapsed: any) => { store.recoveryElapsed = elapsed; },
    setInferencePhase: (phase: any) => { store.inferencePhase = phase; },
    setResumeFromCheckpoint: (cb: any) => { store.resumeFromCheckpoint = cb; },
    getState: () => store
  };
  return {
    useAIState: Object.assign((selector: any) => selector(store), {
      getState: () => store
    })
  };
});

describe('Recovery-First Architecture 단위 테스트 (Legacy Agents)', () => {
  describe('CriticAgent 테스트', () => {
    let critic: CriticAgent;

    beforeEach(() => {
      critic = new CriticAgent();
      critic.reset();
    });

    it('정상적인 사고 과정은 normal로 분류된다', () => {
      const thought = '사용자의 의도를 분석해 보겠습니다. 치즈 관련 보고서는 마크다운 형식으로 작성하면 적합해 보입니다.';
      const verdict = critic.evaluateThought(thought);
      expect(verdict).toBe('normal');
    });

    it('동일 문장이 연속 3회 이상 노출되는 N-gram 루프 발생 시 stalled 로 판단한다', () => {
      // 15자 패턴: "동일패턴을반복중입니다"
      const repeatUnit = '동일패턴을반복중입니다 동일패턴을반복중입니다 동일패턴을반복중입니다';
      const verdict = critic.evaluateThought(repeatUnit);
      expect(verdict).toBe('stalled');
    });

    it('마크다운 표(|)가 포함된 표 렌더링 반복은 오탐으로 필터링되어 normal을 유지한다', () => {
      const markdownTable = `
| 순위 | 제품명 | 가격 |
| 1 | 치즈A | 1000 |
| 2 | 치즈B | 2000 |
| 3 | 치즈C | 3000 |
| 4 | 치즈D | 4000 |
      `;
      const verdict = critic.evaluateThought(markdownTable);
      expect(verdict).toBe('normal');
    });
  });

  describe('SupervisorAgent 진행 단계 추정 테스트', () => {
    let supervisor: any; // Type workaround since instance may be private/complex

    beforeEach(() => {
      supervisor = SupervisorAgent.getInstance();
      supervisor.stopMonitoring();
    });

    it('토큰이 적은 초기 상황은 Planning 단계로 추정한다', async () => {
      const { useAIState } = await import('../../../../../stores/useAIState');
      const store = useAIState.getState();
      supervisor.onToken('Hello', '', false);
      expect(store.inferencePhase).toBe('Planning');
    });

    it('도구 호출 기호 감지 시 Drafting 단계로 전이한다', async () => {
      const { useAIState } = await import('../../../../../stores/useAIState');
      const store = useAIState.getState();
      supervisor.onToken('<tool_call>', '생각 중...', true);
      expect(store.inferencePhase).toBe('Drafting');
    });

    it('Final Answer 기호 유입 시 Finalizing 단계로 전이한다', async () => {
      const { useAIState } = await import('../../../../../stores/useAIState');
      const store = useAIState.getState();
      supervisor.onToken('Final Answer:', '최종 정리 단계', false);
      expect(store.inferencePhase).toBe('Finalizing');
    });
  });
});
