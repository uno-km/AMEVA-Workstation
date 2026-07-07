/**
 * 🤖 [JSON Parser Healer]
 * 소형 모델이 생성 도중 출력을 갑자기 끊거나 따옴표/괄호를 누락하는 경우,
 * 문자열을 분석하여 강제로 유효한 JSON 포맷으로 문법 규격을 복원/닫아주는 스마트 구출 함수입니다.
 */
export function tryHealJSON(jsonStr: string): string {
  let healed = jsonStr.trim();

  // 1. 닫히지 않은 따옴표 강제 폐합
  let inString = false;
  let quoteChar = null;
  let escapeActive = false;

  for (let i = 0; i < healed.length; i++) {
    const char = healed[i];
    if (char === '\\') {
      escapeActive = !escapeActive;
    } else {
      if ((char === '"' || char === "'") && !escapeActive) {
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

  for (let i = 0; i < healed.length; i++) {
    const char = healed[i];
    if (char === '\\') {
      escapeActive = !escapeActive;
    } else {
      if ((char === '"' || char === "'") && !escapeActive) {
        if (!inString) {
          inString = true;
          quoteChar = char;
        } else if (char === quoteChar) {
          inString = false;
          quoteChar = null;
        }
      }
      escapeActive = false;

      if (!inString) {
        if (char === '{' || char === '[') {
          stack.push(char === '{' ? '}' : ']');
        } else if (char === '}' || char === ']') {
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
