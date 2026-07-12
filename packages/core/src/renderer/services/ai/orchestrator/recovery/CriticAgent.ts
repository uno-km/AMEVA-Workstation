/**
 * @file orchestrator/recovery/CriticAgent.ts
 * @system AMEVA OS Desktop Workstation
 * @location src/renderer/services/ai/orchestrator/recovery/CriticAgent.ts
 * @role 실시간 사고 과정(CoT) 교착/반복/무반응 룰 기반 모니터링 에이전트
 *
 * [소비처 - CONSUMERS / USAGE CONTEXT]
 * - AgentOrchestrator.ts: runSingleTurn() 내 토큰 생성 콜백에서 실시간 텍스트 유입 시 criticAgent.evaluateThought() 호출.
 */

/**
 * CriticAgent
 * AI 에이전트의 사고 흐름(Thought Buffer)이 루프를 돌거나, 무반응 교착상태에 빠졌는지 감시하는 검수 모듈.
 * 오탐을 줄이기 위해 Markdown 테이블 기호(|) 및 코드 블록(```) 내 텍스트는 반복 감시 영역에서 격리 처리합니다.
 */
export class CriticAgent {
  private lastThoughtLength = 0;
  private lastChangeTimestamp = Date.now();

  /**
   * 세션 상태 초기화 (새로운 추론 세션/턴 시작 시 호출)
   */
  public reset(): void {
    this.lastThoughtLength = 0;
    this.lastChangeTimestamp = Date.now();
  }

  /**
   * 현재까지 누적된 생각 과정 텍스트를 분석하여 정체 또는 반복 루프 유무를 판정합니다.
   *
   * @param thoughtText - 현재까지 누적된 사고 텍스트 (<thought> 내 누적 버퍼)
   * @returns 'normal' | 'suspicious' | 'stalled' (정상/주의/정체 분류)
   */
  public evaluateThought(thoughtText: string): 'normal' | 'suspicious' | 'stalled' {
    const now = Date.now();
    const cleanText = thoughtText.trim();

    // 1. 무반응 정체(Stall) 검사
    if (cleanText.length > this.lastThoughtLength) {
      this.lastThoughtLength = cleanText.length;
      this.lastChangeTimestamp = now;
    }

    const elapsedMs = now - this.lastChangeTimestamp;
    
    // 토큰이 들어오더라도 텍스트 길이가 20초 이상 늘어나지 않고 멈춰있다면 정체
    if (elapsedMs >= 20000) {
      return 'stalled';
    }
    // 10초 이상 무반응이면 주의
    if (elapsedMs >= 10000) {
      return 'suspicious';
    }

    // 2. 룰 기반 반복(Repetition Loop) 검사
    if (cleanText.length > 30) {
      // 오탐 방지 가드: 코드 블록(```)이나 테이블 기호(|)가 다량 포함된 청크는 검사에서 격리
      const isTable = (cleanText.match(/\|/g) || []).length > 4;
      const isCode = cleanText.includes('```') || cleanText.includes('    '); // 들여쓰기 가드
      
      if (!isTable && !isCode) {
        // 공백 및 띄어쓰기를 전부 트리밍한 밀착 문자열로 변환하여 변칙 띄어쓰기 루프 대응
        const denseText = cleanText.replace(/\s+/g, '');
        
        // N-gram 반복 탐지: 6자부터 15자까지 윈도우 크기를 유연하게 순회하며 연속 중복 탐색
        for (let winSize = 6; winSize <= 15; winSize++) {
          if (denseText.length >= winSize * 3) {
            for (let i = 0; i <= denseText.length - winSize * 3; i++) {
              const pattern = denseText.slice(i, i + winSize);
              const subText = denseText.slice(i + winSize);
              
              // 패턴이 직후 구역에서 또 연속 등장하는지 확인
              if (subText.startsWith(pattern) && subText.slice(winSize).startsWith(pattern)) {
                console.warn('[CriticAgent] 사고 과정 무한 루프 감지! 패턴:', pattern);
                return 'stalled'; // 즉시 교착 상태로 간주하여 복구 시그널 발송
              }
            }
          }
        }
      }
    }

    return 'normal';
  }
}
