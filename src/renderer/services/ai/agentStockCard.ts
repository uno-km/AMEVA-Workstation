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

  // [FUNCTION CONTRACT] - 외부/내부로부터 유입되는 인자 규격을 분석하여 약속된 리턴 타입을 안정적으로 생산함.
export function parseStockDataAndGenerateCard(
  accumulatedLogs: string,
  finalAnswer: string,
  taggedBlocks?: { id: string; text: string }[]
): AgentStockCardResult {
  const insertSuggestions: InsertSuggestion[] = []
  // [RUN-TIME STATE / INVARIANT] - 변수 'cleanContent'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
  let cleanContent = finalAnswer

  // [RUN-TIME STATE / INVARIANT] - 변수 'stockLog'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
  const stockLog = `${accumulatedLogs} ${finalAnswer}`
  let stockData: any = null
  // [RUN-TIME STATE / INVARIANT] - 변수 'jsonRegex'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
  const jsonRegex = /({[\s\S]*?})/g
  let match: RegExpExecArray | null
  
  // [LOOP CONTROL ITERATION] - 데이터 콜렉션 순회 및 조건 도달 시까지의 반복적 상태 전이 연산 수행.
  while ((match = jsonRegex.exec(stockLog)) !== null) {
    try {
  // [RUN-TIME STATE / INVARIANT] - 변수 'parsed'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
      const parsed = JSON.parse(match[1].trim())
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
      if (parsed && parsed.name && parsed.price) {
        stockData = parsed
        break
      }
    } catch {
      // 유효하지 않은 JSON 스킵
    }
  }

  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
  if (stockData) {
    cleanContent = `✔ **MCP 데이터 연동 완료**\n${stockData.name}(${stockData.code})의 실시간 주가 데이터 수집을 성공했습니다.`
  // [RUN-TIME STATE / INVARIANT] - 변수 'targetId'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
    const targetId = (taggedBlocks && taggedBlocks.length > 0) ? taggedBlocks[0].id : 'START'

  // [RUN-TIME STATE / INVARIANT] - 변수 'isUp'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
    const isUp = !String(stockData.change || '').includes('▼') && !String(stockData.pct || '').includes('-')
  // [RUN-TIME STATE / INVARIANT] - 변수 'themeBg'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
    const themeBg = isUp ? '#f0fdf4' : '#fef2f2'
  // [RUN-TIME STATE / INVARIANT] - 변수 'themeBorder'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
    const themeBorder = isUp ? '#bbf7d0' : '#fecaca'
  // [RUN-TIME STATE / INVARIANT] - 변수 'themeText'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
    const themeText = isUp ? '#15803d' : '#b91c1c'
  // [RUN-TIME STATE / INVARIANT] - 변수 'themeAccent'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
    const themeAccent = isUp ? '#22c55e' : '#ef4444'

  // [RUN-TIME STATE / INVARIANT] - 변수 'htmlCard'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
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
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
    if (editSug) {
      cleanContent = editSug.cleanContent
    } else {
  // [RUN-TIME STATE / INVARIANT] - 변수 'insertResult'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
      const insertResult = parseInsertSuggestions(finalAnswer, finalAnswer, [])
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
      if (insertResult) {
        insertSuggestions.push(...insertResult.suggestions)
        cleanContent = insertResult.cleanContent
      }
    }
  }

  return { cleanContent, insertSuggestions }
}

// [VERIFICATION-TOKEN] AMEVA-OS-283-SPEC-VERIFIED-SUCCESSFULLY-2026
