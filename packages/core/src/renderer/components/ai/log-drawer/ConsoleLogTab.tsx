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
import { AI_TERMINAL_CONSTANTS } from '../../../features/ai-terminal/constants';

export interface ConsoleLogTabProps {
  fontSize?: number;
}

  /*
   * [FUNCTION CONTRACT]
   * - 함수 명: `ConsoleLogTab`
   * - 역할: Llama.cpp 및 WebGPU 진단 로그 표준 출력 버퍼링과 실시간 텍스트 매칭 하이라이트/필터링 검색창을 렌더링.
   * - 예시: `ConsoleLogTab(...)` 호출 시 상태 바인딩 및 Transient DOM 업데이트 활성화.
   */
export function ConsoleLogTab({ fontSize = 12.0 }: ConsoleLogTabProps) {
  const logContainerRef = useRef<HTMLDivElement>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number, y: number, text: string } | null>(null);

  // Zustand 전역 로그 검색 상태 및 액션 바인딩
  const searchQuery = useAILogStore((state) => state.searchQuery);
  const setSearchQuery = useAILogStore((state) => state.setSearchQuery);
  const logs = useAILogStore((state) => state.sensorLogs);

  // 검색어에 일치하는 매칭 로그 라인 개수 계산
  const trimmedQuery = searchQuery.trim().toLowerCase();
  const matchCount = trimmedQuery
    ? logs.filter((log) => log.toLowerCase().includes(trimmedQuery)).length
    : 0;

  useEffect(() => {
    /*
     * [RUN-TIME STATE / INVARIANT]
     * - 변수 명: `renderLogs`
     * - Rationale: React 리렌더링 루프를 거치지 않고 DOM innerHTML에 직접 HTML 스트링을 꽂아 과부하를 줄인다.
     */
    const renderLogs = (currentLogs: string[], query: string) => {
      const container = logContainerRef.current;
      if (!container) return;

      let htmlString = '';
      const filterQuery = query.trim().toLowerCase();

      for (let i = 0; i < currentLogs.length; i++) {
        const line = currentLogs[i];
        if (i > 0 && !line.trim()) continue;

        // 1. 검색어가 존재하고 라인에 미포함된 경우 필터 아웃
        if (filterQuery && !line.toLowerCase().includes(filterQuery)) {
          continue;
        }

        // 2. 기본 스타일 매핑 정의
        let color = 'var(--term-text)';
        let bg = 'transparent';
        let fontWeight = '400';

        if (line.includes('[System]')) { color = '#60a5fa'; fontWeight = '600'; }
        else if (line.includes('[Error]') || line.includes('error')) { color = '#fca5a5'; bg = 'rgba(239, 68, 68, 0.1)'; }
        else if (line.includes('[Plugin]')) { color = '#fde047'; }
        else if (line.includes('[WASM]') || line.includes('WebGPU')) { color = '#c084fc'; }
        else if (line.includes('[API]') || line.includes('OpenAI') || line.includes('Gemini')) { color = '#fdba74'; }
        else if (line.includes('[Llama]')) { color = '#34d399'; }

        // 3. 검색 매치 키워드 하이라이팅 적용
        let renderedText = line;
        if (filterQuery) {
          // 정규식 매칭을 위해 이스케이프 문자 처리 적용
          const escapedQuery = filterQuery.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
          const regex = new RegExp(`(${escapedQuery})`, 'gi');
          renderedText = line.replace(
            regex,
            `<mark style="background: ${AI_TERMINAL_CONSTANTS.HIGHLIGHT.BG}; color: ${AI_TERMINAL_CONSTANTS.HIGHLIGHT.COLOR}; border-radius: ${AI_TERMINAL_CONSTANTS.HIGHLIGHT.BORDER_RADIUS}; padding: ${AI_TERMINAL_CONSTANTS.HIGHLIGHT.PADDING};">$1</mark>`
          );
        }

        htmlString += `<div style="color: ${color}; background: ${bg}; font-size: ${fontSize}px; font-weight: ${fontWeight}; padding: 2px 4px; border-radius: 2px; min-height: 1.2em; user-select: text;">${renderedText}</div>`;
      }
      container.innerHTML = htmlString;
      container.scrollTop = container.scrollHeight;
    };

    // 최초 기동 마운트 렌더링
    renderLogs(useAILogStore.getState().sensorLogs, useAILogStore.getState().searchQuery);

    // Zustand 스토어 실시간 구독 바인딩
    const unsubscribe = useAILogStore.subscribe((state) => {
      renderLogs(state.sensorLogs, state.searchQuery);
    });
    return () => unsubscribe();
  }, [fontSize]);

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    const selection = window.getSelection();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      text: selection?.toString() ?? ''
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, height: '100%', overflow: 'hidden' }}>
      {/* [FEAT] 상단 검색 바 디자인 통합 */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '6px 12px',
        background: 'rgba(0, 0, 0, 0.2)',
        borderBottom: '1px solid var(--border-muted)',
        flexShrink: 0,
      }}>
        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>🔍</span>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="검색할 로그 단어를 입력하세요..."
          style={{
            flex: 1,
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid var(--border-muted)',
            borderRadius: '4px',
            color: 'var(--text-main)',
            fontSize: '11.5px',
            padding: '4px 8px',
            outline: 'none',
          }}
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              fontSize: '11px',
              padding: '0 4px',
            }}
          >
            Clear
          </button>
        )}
        {trimmedQuery && (
          <span style={{ fontSize: '11px', color: 'var(--primary)', fontWeight: 600 }}>
            {matchCount} 건 매치됨
          </span>
        )}
      </div>

      <div
        className="win98-font"
        ref={logContainerRef}
        onContextMenu={handleContextMenu}
        style={{
          flex: 1, overflowY: 'auto', padding: '12px',
          fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
          fontSize: `${fontSize}px`, lineHeight: '1.5', whiteSpace: 'pre-wrap',
          userSelect: 'text', cursor: 'text', color: 'var(--term-text)',
          background: 'var(--term-bg)'
        }}
      />

      {contextMenu && (
        <ConsoleContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          selectedText={contextMenu.text}
          onCopy={() => {
            if (contextMenu.text) navigator.clipboard.writeText(contextMenu.text);
          }}
          onPaste={async () => {
            try {
              const text = await navigator.clipboard.readText();
              window.dispatchEvent(new CustomEvent(AI_TERMINAL_CONSTANTS.EVENTS.FILL_AI_INPUT, { detail: text }));
            } catch (err) {
              console.error('[ConsoleLogTab] clipboard read failed:', err);
            }
          }}
          onInsertToBody={() => {
            const event = new CustomEvent(AI_TERMINAL_CONSTANTS.EVENTS.INSERT_TEXT, { detail: contextMenu.text });
            window.dispatchEvent(event);
          }}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  );
}

