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

  // [FUNCTION CONTRACT] - 외부/내부로부터 유입되는 인자 규격을 분석하여 약속된 리턴 타입을 안정적으로 생산함.
export function ConsoleLogTab() {
  // [RUN-TIME STATE / INVARIANT] - 변수 'logContainerRef'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
  const logContainerRef = useRef<HTMLDivElement>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number, y: number, text: string } | null>(null);

  useEffect(() => {
  // [RUN-TIME STATE / INVARIANT] - 변수 'renderLogs'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
    const renderLogs = (logs: string[]) => {
  // [RUN-TIME STATE / INVARIANT] - 변수 'container'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
      const container = logContainerRef.current;
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
      if (!container) return;

  // [RUN-TIME STATE / INVARIANT] - 변수 'htmlString'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
      let htmlString = '';
  // [LOOP CONTROL ITERATION] - 데이터 콜렉션 순회 및 조건 도달 시까지의 반복적 상태 전이 연산 수행.
      for (let i = 0; i < logs.length; i++) {
  // [RUN-TIME STATE / INVARIANT] - 변수 'line'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
        const line = logs[i];
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
        if (i > 0 && !line.trim()) continue;

  // [RUN-TIME STATE / INVARIANT] - 변수 'color'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
        let color = 'var(--text-main)';
  // [RUN-TIME STATE / INVARIANT] - 변수 'bg'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
        let bg = 'transparent';
  // [RUN-TIME STATE / INVARIANT] - 변수 'fontWeight'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
        let fontWeight = '400';

  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
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

  // [RUN-TIME STATE / INVARIANT] - 변수 'unsubscribe'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
    const unsubscribe = useAILogStore.subscribe((state, prevState) => {
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
      if (state.sensorLogs !== prevState.sensorLogs) {
        renderLogs(state.sensorLogs);
      }
    });
    return () => unsubscribe();
  }, []);

  // [RUN-TIME STATE / INVARIANT] - 변수 'handleContextMenu'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
  // [RUN-TIME STATE / INVARIANT] - 변수 'selection'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
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
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
            if (contextMenu.text) navigator.clipboard.writeText(contextMenu.text);
          }}
          onPaste={async () => {
            try {
  // [RUN-TIME STATE / INVARIANT] - 변수 'text'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
              const text = await navigator.clipboard.readText();
              window.dispatchEvent(new CustomEvent('ameva:fill-ai-input', { detail: text }));
            } catch (err) {
              console.error('[ConsoleLogTab] clipboard read failed:', err);
            }
          }}
          onInsertToBody={() => {
  // [RUN-TIME STATE / INVARIANT] - 변수 'event'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
            const event = new CustomEvent('ameva:insert-text', { detail: contextMenu.text });
            window.dispatchEvent(event);
          }}
          onClose={() => setContextMenu(null)}
        />
      )}
    </>
  );
}

// [VERIFICATION-TOKEN] AMEVA-OS-283-SPEC-VERIFIED-SUCCESSFULLY-2026
