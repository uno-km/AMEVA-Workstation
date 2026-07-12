/**
 * @file orchestrator/recovery/__tests__/recovery.test.js
 * @system AMEVA OS Desktop Workstation
 * @role Recovery-First 복구 사다리 및 모니터링 엔진 JavaScript 단위 테스트 스크립트
 */

const { CriticAgent } = require('../CriticAgent');
const { SupervisorAgent } = require('../SupervisorAgent');

// ── 브라우저 환경 전역 객체 Mocking ────────────────────────────────
global.window = global;
global.indexedDB = {
  open: () => ({
    onupgradeneeded: () => {},
    onsuccess: () => {},
    onerror: () => {}
  })
};

// Zustand 스토어 Mocking
jest.mock('../../../../../stores/useAIState', () => {
  const store = {
    recoveryState: 'normal',
    recoveryReason: null,
    recoveryElapsed: 0,
    inferencePhase: 'Planning',
    resumeFromCheckpoint: null,
    setRecoveryState: (state) => { store.recoveryState = state; },
    setRecoveryReason: (reason) => { store.recoveryReason = reason; },
    setRecoveryElapsed: (elapsed) => { store.recoveryElapsed = elapsed; },
    setInferencePhase: (phase) => { store.inferencePhase = phase; },
    setResumeFromCheckpoint: (cb) => { store.resumeFromCheckpoint = cb; },
    getState: () => store
  };
  return {
    useAIState: Object.assign((selector) => selector(store), {
      getState: () => store
    })
  };
});

describe('Recovery-First Architecture 단위 테스트', () => {
  describe('CriticAgent 테스트', () => {
    let critic;

    beforeEach(() => {
      critic = new CriticAgent();
      critic.reset();
    });

    test('정상적인 사고 과정은 normal로 분류된다', () => {
      const thought = '사용자의 의도를 분석해 보겠습니다. 치즈 관련 보고서는 마크다운 형식으로 작성하면 적합해 보입니다.';
      const verdict = critic.evaluateThought(thought);
      expect(verdict).toBe('normal');
    });

    test('동일 문장이 연속 3회 이상 노출되는 N-gram 루프 발생 시 stalled 로 판단한다', () => {
      // 15자 패턴: "동일패턴을반복중입니다"
      const repeatUnit = '동일패턴을반복중입니다 동일패턴을반복중입니다 동일패턴을반복중입니다';
      const verdict = critic.evaluateThought(repeatUnit);
      expect(verdict).toBe('stalled');
    });

    test('마크다운 표(|)가 포함된 표 렌더링 반복은 오탐으로 필터링되어 normal을 유지한다', () => {
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
    let supervisor;

    beforeEach(() => {
      supervisor = SupervisorAgent.getInstance();
      supervisor.stopMonitoring();
    });

    test('토큰이 적은 초기 상황은 Planning 단계로 추정한다', () => {
      const store = require('../../../../../stores/useAIState').useAIState.getState();
      supervisor.onToken('Hello', '', false);
      expect(store.inferencePhase).toBe('Planning');
    });

    test('도구 호출 기호 감지 시 Drafting 단계로 전이한다', () => {
      const store = require('../../../../../stores/useAIState').useAIState.getState();
      supervisor.onToken('<tool_call>', '생각 중...', true);
      expect(store.inferencePhase).toBe('Drafting');
    });

    test('Final Answer 기호 유입 시 Finalizing 단계로 전이한다', () => {
      const store = require('../../../../../stores/useAIState').useAIState.getState();
      supervisor.onToken('Final Answer:', '최종 정리 단계', false);
      expect(store.inferencePhase).toBe('Finalizing');
    });
  });
});
