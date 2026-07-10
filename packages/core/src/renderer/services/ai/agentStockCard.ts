/**
 * @file agentStockCard.ts
 * @system AMEVA OS Desktop Workstation
 * @location src/renderer/services/ai/agentStockCard.ts
 * @role Core module helper and integration logic
 * 
 * [소비처 - CONSUMERS / USAGE CONTEXT]
 * - 소비처 A (src/renderer/App.tsx): AMEVA OS 최상위 마운트 레이어에서 의존성 로더로 연동 소비.
 * - 소비처 B (src/renderer/main.tsx): 렌더러 엔트리 라이프사이클의 기본 기능으로 수입 소비.
 * 
 * [책임 범위 - RESPONSIBILITY]
 * - 본 파일은 AMEVA 시스템 내에서 도메인 목적에 부합하는 연산 및 데이터 처리 흐름을 안전하게 캡슐화한다.
 * - 외부 라이브러리 및 하위 종속성을 조율하고 결과 규격을 일관되게 제공한다.
 * 
 * [절대 깨면 안 되는 계약 - CONTRACT]
 * - MUST: 모든 예외 발생 시 에러를 침묵시키지 말고 에러 로그를 명확하게 남길 것.
 * - MUST NOT: TypeScript any 형식을 우회 수단으로 함부로 선언하지 말 것.
 */

import type { InsertSuggestion } from '../../types/aiTypes'
import { parseEditSuggestion, parseInsertSuggestions } from './aiStreamParser'

export interface AgentStockCardResult {
  cleanContent: string
  insertSuggestions: InsertSuggestion[]
}

  /*
   * [FUNCTION CONTRACT]
   * - 함수 명: `parseStockDataAndGenerateCard`
   * - 역할: 인자 정보를 검수하고 비즈니스 계약 조건에 맞춰 최종 바인딩 결과물/바이너리 버퍼를 반환함.
   * - 예시: `parseStockDataAndGenerateCard(...)` 호출 시 런타임 비동기/동기 연쇄 반응 유도.
   */
export function parseStockDataAndGenerateCard(
  accumulatedLogs: string,
  finalAnswer: string,
  taggedBlocks?: { id: string; text: string }[]
): AgentStockCardResult {
  const insertSuggestions: InsertSuggestion[] = []
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `cleanContent`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const cleanContent = ...` 형태로 안전 캐싱 후 가공 기동.
       */
  let cleanContent = finalAnswer

      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `stockLog`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const stockLog = ...` 형태로 안전 캐싱 후 가공 기동.
       */
  const stockLog = `${accumulatedLogs} ${finalAnswer}`
  let stockData: any = null
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `jsonRegex`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const jsonRegex = ...` 형태로 안전 캐싱 후 가공 기동.
       */
  const jsonRegex = /({[\s\S]*?})/g
  let match: RegExpExecArray | null
  
      /*
       * [LOOP CONTROL ITERATION]
       * - 루프 조건: `while ((match = jsonRegex.exec(stockLog)) !== null) {`
       * - 예상 시나리오: 지정된 조건 한계 도달 시점까지 콜렉션 항목의 순차 매핑, 변환 및 동기 적재 처리를 수행함.
       * - 예시: `for (const item of list)` 루프 실행 시 모든 개별 블록의 html 포맷 정제 완료 후 스택 종결.
       */
  while ((match = jsonRegex.exec(stockLog)) !== null) {
    try {
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `parsed`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const parsed = ...` 형태로 안전 캐싱 후 가공 기동.
       */
      const parsed = JSON.parse(match[1].trim())
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `parsed && parsed.name && parsed.price`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (parsed && parsed.name && parsed.price)` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
      if (parsed && parsed.name && parsed.price) {
        stockData = parsed
        break
      }
    } catch {
      // 유효하지 않은 JSON 스킵
    }
  }

      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `stockData`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (stockData)` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
  if (stockData) {
    cleanContent = `✔ **MCP 데이터 연동 완료**\n${stockData.name}(${stockData.code})의 실시간 주가 데이터 수집을 성공했습니다.`
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `targetId`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const targetId = ...` 형태로 안전 캐싱 후 가공 기동.
       */
    const targetId = (taggedBlocks && taggedBlocks.length > 0) ? taggedBlocks[0].id : 'START'

      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `isUp`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const isUp = ...` 형태로 안전 캐싱 후 가공 기동.
       */
    const isUp = !String(stockData.change || '').includes('▼') && !String(stockData.pct || '').includes('-')
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `themeBg`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const themeBg = ...` 형태로 안전 캐싱 후 가공 기동.
       */
    const themeBg = isUp ? '#f0fdf4' : '#fef2f2'
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `themeBorder`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const themeBorder = ...` 형태로 안전 캐싱 후 가공 기동.
       */
    const themeBorder = isUp ? '#bbf7d0' : '#fecaca'
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `themeText`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const themeText = ...` 형태로 안전 캐싱 후 가공 기동.
       */
    const themeText = isUp ? '#15803d' : '#b91c1c'
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `themeAccent`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const themeAccent = ...` 형태로 안전 캐싱 후 가공 기동.
       */
    const themeAccent = isUp ? '#22c55e' : '#ef4444'

      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `htmlCard`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const htmlCard = ...` 형태로 안전 캐싱 후 가공 기동.
       */
    const htmlCard = `//# [AMEVA_LANG:html]\n` +
      `<div style="background: ${themeBg}; border: 1.5px solid ${themeBorder}; border-radius: 12px; padding: 20px; color: #1e293b; font-family: sans-serif; box-shadow: 0 4px 12px rgba(0,0,0,0.05); position: relative; max-width: 580px; box-sizing: border-box;">\n` +
      `  <div style="position: absolute; top: 16px; right: 16px; background: ${themeAccent}; color: white; font-size: 10px; font-weight: bold; padding: 3px 8px; border-radius: 20px;">⚡ MCP Live</div>\n` +
      `  <div style="font-size: 14px; font-weight: bold; color: ${themeText}; margin-bottom: 12px;">📈 ${stockData.name} (${stockData.code}) 시세 정보</div>\n` +
      `  <div style="font-size: 28px; font-weight: 800; color: #0f172a; margin-bottom: 16px;">${stockData.price} <span style="font-size: 14px; color: ${themeAccent};">${stockData.change} (${stockData.pct})</span></div>\n` +
      `  <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; font-size: 12px; color: #475569;">\n` +
      `    <div>전일가: <strong>${stockData.yesterday}</strong></div>\n` +
      `    <div>고가: <strong>${stockData.high}</strong></div>\n` +
      `    <div>거래량: <strong>${stockData.volume}</strong></div>\n` +
      `    <div>외인비중: <strong>${stockData.foreign}</strong></div>\n` +
      `  </div>\n</div>`

    insertSuggestions.push({
      afterBlockId: targetId,
      blockType: 'paragraph',
      content: htmlCard,
      reasonText: cleanContent,
      status: 'pending',
      siblingBlockIds: [targetId],
      siblingIndex: 0
    })
  } else {
    // INSERT/EDIT 제안 파싱
    const editSug = parseEditSuggestion(finalAnswer)
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `editSug`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (editSug)` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
    if (editSug) {
      cleanContent = editSug.cleanContent
    } else {
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `insertResult`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const insertResult = ...` 형태로 안전 캐싱 후 가공 기동.
       */
      const insertResult = parseInsertSuggestions(finalAnswer, finalAnswer, [])
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `insertResult`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (insertResult)` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
      if (insertResult) {
        insertSuggestions.push(...insertResult.suggestions)
        cleanContent = insertResult.cleanContent
      }
    }
  }

  return { cleanContent, insertSuggestions }
}

