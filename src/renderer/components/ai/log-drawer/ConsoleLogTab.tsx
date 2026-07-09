/**
 * @file ConsoleLogTab.tsx
 * @system AMEVA OS Desktop Workstation
 * @location src/renderer/components/ai/log-drawer/ConsoleLogTab.tsx
 * @role Core module helper and integration logic
 * 
 * [소비처 - CONSUMERS / USAGE CONTEXT]
 * - 소비처 A (src/renderer/AppLayout.tsx): 레이아웃 그리드 내부 또는 플로팅 레이어 영역 내에서 그리기로 소비.
 * - 소비처 B (src/renderer/App.tsx): 전역 모달 매니저 및 뷰포트 상태 스위칭에 따라 동적 마운트되어 소비.
 * 
 * [책임 범위 - RESPONSIBILITY]
 * - 본 파일은 AMEVA 시스템 내에서 도메인 목적에 부합하는 연산 및 데이터 처리 흐름을 안전하게 캡슐화한다.
 * - 외부 라이브러리 및 하위 종속성을 조율하고 결과 규격을 일관되게 제공한다.
 * 
 * [절대 깨면 안 되는 계약 - CONTRACT]
 * - MUST: 모든 예외 발생 시 에러를 침묵시키지 말고 에러 로그를 명확하게 남길 것.
 * - MUST NOT: TypeScript any 형식을 우회 수단으로 함부로 선언하지 말 것.
 */

import React, { useEffect, useRef, useState } from 'react';
import { useAILogStore } from '../../../stores/useAILogStore';
import { ConsoleContextMenu } from './ConsoleContextMenu';

  /*
   * [FUNCTION CONTRACT]
   * - 함수 명: `ConsoleLogTab`
   * - 역할: 인자 정보를 검수하고 비즈니스 계약 조건에 맞춰 최종 바인딩 결과물/바이너리 버퍼를 반환함.
   * - 예시: `ConsoleLogTab(...)` 호출 시 런타임 비동기/동기 연쇄 반응 유도.
   */
export function ConsoleLogTab() {
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `logContainerRef`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const logContainerRef = ...` 형태로 안전 캐싱 후 가공 기동.
       */
  const logContainerRef = useRef<HTMLDivElement>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number, y: number, text: string } | null>(null);

  useEffect(() => {
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `renderLogs`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const renderLogs = ...` 형태로 안전 캐싱 후 가공 기동.
       */
    const renderLogs = (logs: string[]) => {
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `container`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const container = ...` 형태로 안전 캐싱 후 가공 기동.
       */
      const container = logContainerRef.current;
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `!container`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (!container)` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
      if (!container) return;

      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `htmlString`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const htmlString = ...` 형태로 안전 캐싱 후 가공 기동.
       */
      let htmlString = '';
      /*
       * [LOOP CONTROL ITERATION]
       * - 루프 조건: `for (let i = 0; i < logs.length; i++) {`
       * - 예상 시나리오: 지정된 조건 한계 도달 시점까지 콜렉션 항목의 순차 매핑, 변환 및 동기 적재 처리를 수행함.
       * - 예시: `for (const item of list)` 루프 실행 시 모든 개별 블록의 html 포맷 정제 완료 후 스택 종결.
       */
      for (let i = 0; i < logs.length; i++) {
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `line`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const line = ...` 형태로 안전 캐싱 후 가공 기동.
       */
        const line = logs[i];
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `i > 0 && !line.trim()`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (i > 0 && !line.trim())` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
        if (i > 0 && !line.trim()) continue;

      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `color`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const color = ...` 형태로 안전 캐싱 후 가공 기동.
       */
        let color = 'var(--text-main)';
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `bg`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const bg = ...` 형태로 안전 캐싱 후 가공 기동.
       */
        let bg = 'transparent';
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `fontWeight`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const fontWeight = ...` 형태로 안전 캐싱 후 가공 기동.
       */
        let fontWeight = '400';

      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `line.includes('[System]')`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (line.includes('[System]'))` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
        if (line.includes('[System]')) { color = '#60a5fa'; fontWeight = '600'; }
        else if (line.includes('[Error]') || line.includes('error')) { color = '#fca5a5'; bg = 'rgba(239, 68, 68, 0.1)'; }
        else if (line.includes('[Plugin]')) { color = '#fde047'; }
        else if (line.includes('[WASM]') || line.includes('WebGPU')) { color = '#c084fc'; }
        else if (line.includes('[API]') || line.includes('OpenAI') || line.includes('Gemini')) { color = '#fdba74'; }
        else if (line.includes('[Llama]')) { color = '#34d399'; }

        htmlString += '<div style="color: ' + color + '; background: ' + bg + '; font-weight: ' + fontWeight + '; padding: 2px 4px; border-radius: 2px; min-height: 1.2em; user-select: text;">' + line + '</div>';
      }
      container.innerHTML = htmlString;
      container.scrollTop = container.scrollHeight;
    };

    renderLogs(useAILogStore.getState().sensorLogs);

      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `unsubscribe`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const unsubscribe = ...` 형태로 안전 캐싱 후 가공 기동.
       */
    const unsubscribe = useAILogStore.subscribe((state, prevState) => {
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `state.sensorLogs !== prevState.sensorLogs`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (state.sensorLogs !== prevState.sensorLogs)` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
      if (state.sensorLogs !== prevState.sensorLogs) {
        renderLogs(state.sensorLogs);
      }
    });
    return () => unsubscribe();
  }, []);

      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `handleContextMenu`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const handleContextMenu = ...` 형태로 안전 캐싱 후 가공 기동.
       */
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `selection`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const selection = ...` 형태로 안전 캐싱 후 가공 기동.
       */
    const selection = window.getSelection();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      text: selection?.toString() ?? ''
    });
  };

  return (
    <>
      <div
        className="win98-font"
        ref={logContainerRef}
        onContextMenu={handleContextMenu}
        style={{
          flex: 1, overflowY: 'auto', padding: '12px',
          fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
          fontSize: '11.5px', lineHeight: '1.5', whiteSpace: 'pre-wrap',
          userSelect: 'text', cursor: 'text', color: 'var(--term-text)'
        }}
      />

      {contextMenu && (
        <ConsoleContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          selectedText={contextMenu.text}
          onCopy={() => {
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `contextMenu.text) navigator.clipboard.writeText(contextMenu.text`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (contextMenu.text) navigator.clipboard.writeText(contextMenu.text)` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
            if (contextMenu.text) navigator.clipboard.writeText(contextMenu.text);
          }}
          onPaste={async () => {
            try {
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `text`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const text = ...` 형태로 안전 캐싱 후 가공 기동.
       */
              const text = await navigator.clipboard.readText();
              window.dispatchEvent(new CustomEvent('ameva:fill-ai-input', { detail: text }));
            } catch (err) {
              console.error('[ConsoleLogTab] clipboard read failed:', err);
            }
          }}
          onInsertToBody={() => {
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `event`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const event = ...` 형태로 안전 캐싱 후 가공 기동.
       */
            const event = new CustomEvent('ameva:insert-text', { detail: contextMenu.text });
            window.dispatchEvent(event);
          }}
          onClose={() => setContextMenu(null)}
        />
      )}
    </>
  );
}

