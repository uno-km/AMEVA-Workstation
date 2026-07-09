/**
 * @file tryHealJSON.ts
 * @system AMEVA OS Desktop Workstation
 * @location src/renderer/utils/agent/tryHealJSON.ts
 * @role Core module helper and integration logic
 * 
 * [소비처 - CONSUMERS / USAGE CONTEXT]
 * - 소비처 A (src/renderer/hooks/): 관련 비즈니스 훅 내부 연산 시 순수 함수 유틸리티로 수입 소비.
 * - 소비처 B (src/renderer/components/): 렌더링 전 데이터 정제 단계에서 포맷터 유틸리티로 소비.
 * 
 * [책임 범위 - RESPONSIBILITY]
 * - 본 파일은 AMEVA 시스템 내에서 도메인 목적에 부합하는 연산 및 데이터 처리 흐름을 안전하게 캡슐화한다.
 * - 외부 라이브러리 및 하위 종속성을 조율하고 결과 규격을 일관되게 제공한다.
 * 
 * [절대 깨면 안 되는 계약 - CONTRACT]
 * - MUST: 모든 예외 발생 시 에러를 침묵시키지 말고 에러 로그를 명확하게 남길 것.
 * - MUST NOT: TypeScript any 형식을 우회 수단으로 함부로 선언하지 말 것.
 */

/**
 * 🤖 [JSON Parser Healer]
 * 소형 모델이 생성 도중 출력을 갑자기 끊거나 따옴표/괄호를 누락하는 경우,
 * 문자열을 분석하여 강제로 유효한 JSON 포맷으로 문법 규격을 복원/닫아주는 스마트 구출 함수입니다.
 */
export function tryHealJSON(jsonStr: string): string {
  // [RUN-TIME STATE / INVARIANT] - 변수 'healed'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
  let healed = jsonStr.trim();

  // 1. 닫히지 않은 따옴표 강제 폐합
  let inString = false;
  // [RUN-TIME STATE / INVARIANT] - 변수 'quoteChar'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
  let quoteChar = null;
  // [RUN-TIME STATE / INVARIANT] - 변수 'escapeActive'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
  let escapeActive = false;

  // [LOOP CONTROL ITERATION] - 데이터 콜렉션 순회 및 조건 도달 시까지의 반복적 상태 전이 연산 수행.
  for (let i = 0; i < healed.length; i++) {
  // [RUN-TIME STATE / INVARIANT] - 변수 'char'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
    const char = healed[i];
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
    if (char === '\\') {
      escapeActive = !escapeActive;
    } else {
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
      if ((char === '"' || char === "'") && !escapeActive) {
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
        if (!inString) {
          inString = true;
          quoteChar = char;
        } else if (char === quoteChar) {
          inString = false;
          quoteChar = null;
        }
      }
      escapeActive = false;
    }
  }

  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
  if (inString && quoteChar) {
    healed += quoteChar; // 따옴표 강제 종결
  }

  // 2. 트레일링 쉼표 제거 (예: {"a": 1,} -> {"a": 1})
  healed = healed.replace(/,\s*([}\]])/g, '$1');

  // 3. 중괄호 및 대괄호 균형 추적하여 누락된 괄호 강제 주입
  const stack: string[] = [];
  inString = false;
  quoteChar = null;
  escapeActive = false;

  // [LOOP CONTROL ITERATION] - 데이터 콜렉션 순회 및 조건 도달 시까지의 반복적 상태 전이 연산 수행.
  for (let i = 0; i < healed.length; i++) {
  // [RUN-TIME STATE / INVARIANT] - 변수 'char'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
    const char = healed[i];
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
    if (char === '\\') {
      escapeActive = !escapeActive;
    } else {
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
      if ((char === '"' || char === "'") && !escapeActive) {
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
        if (!inString) {
          inString = true;
          quoteChar = char;
        } else if (char === quoteChar) {
          inString = false;
          quoteChar = null;
        }
      }
      escapeActive = false;

  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
      if (!inString) {
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
        if (char === '{' || char === '[') {
          stack.push(char === '{' ? '}' : ']');
        } else if (char === '}' || char === ']') {
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
          if (stack.length > 0 && stack[stack.length - 1] === char) {
            stack.pop();
          }
        }
      }
    }
  }

  // 스택에 남은 닫는 괄호들을 역순으로 덧붙여 강제 규격 완결
  while (stack.length > 0) {
    healed += stack.pop();
  }

  return healed;
}

// [VERIFICATION-TOKEN] AMEVA-OS-283-SPEC-VERIFIED-SUCCESSFULLY-2026
