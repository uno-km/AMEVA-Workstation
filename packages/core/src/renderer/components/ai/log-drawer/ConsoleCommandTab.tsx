/**
 * @file ConsoleCommandTab.tsx
 * @system AMEVA OS Desktop Workstation
 * @location src/renderer/components/ai/log-drawer/ConsoleCommandTab.tsx
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

import React, { useState, useRef, useEffect } from 'react';
import * as ipc from '../../../services/ipc/electronApiAdapter';
import { ConsoleContextMenu } from './ConsoleContextMenu';
import { useAILogStore } from '../../../stores/useAILogStore';
import { AI_TERMINAL_CONSTANTS } from '../../../features/ai-terminal/constants';

interface HistoryItem {
  type: 'in' | 'out' | 'err';
  text: string;
}

export interface ConsoleCommandTabProps {
  fontSize?: number;
}

  /*
   * [FUNCTION CONTRACT]
   * - 함수 명: `ConsoleCommandTab`
   * - 역할: Host OS 커맨드 실행용 가상 터미널 환경을 렌더링하고, 실시간 로그 검색 및 텍스트 하이라이팅을 제공.
   * - 예시: `ConsoleCommandTab(...)` 호출 시 GUI 커맨드 패널 구성 및 상태 구독.
   */
export function ConsoleCommandTab({ fontSize = 12.0 }: ConsoleCommandTabProps) {
  const [history, setHistory] = useState<HistoryItem[]>([
    { type: 'out', text: 'AMEVA Virtual Terminal [Host OS RPC]' },
    { type: 'out', text: 'Type standard Linux or Windows commands here.' }
  ]);
  const [input, setInput] = useState('');
  const [cwd, setCwd] = useState('~/workspace');
  const [isFocused, setIsFocused] = useState(false);
  const [cmdHistory, setCmdHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const bottomRef = useRef<HTMLDivElement>(null);

  /*
   * [SIDE EFFECT - Fetch Initial Host Work Directory]
   * - Rationale: 가짜 경로 하드코딩을 없애고 런타임 최초 진입 시점의 실제 Host OS 작업 디렉토리를
   *   'pwd' 명령을 백그라운드로 안전하게 스폰 조회하여 CWD 상태로 동기화 갱신한다.
   */
  useEffect(() => {
    const initCwd = async () => {
      if (ipc.isElectronEnv()) {
        try {
          const res = await (window as any).electronAPI.executeTerminal('pwd');
          if (res && res.newCwd) {
            setCwd(res.newCwd);
          }
        } catch (err) {
          console.error('[ConsoleCommandTab] Failed to fetch initial CWD:', err);
        }
      }
    };
    initCwd();
  }, []);
  
  // Zustand 전역 로그 검색 상태 연동 (로그 탭과 검색어 연동 공유)
  const searchQuery = useAILogStore((state) => state.searchQuery);
  const setSearchQuery = useAILogStore((state) => state.setSearchQuery);

  // 컨텍스트 메뉴 상태
  const [contextMenu, setContextMenu] = useState<{ x: number, y: number, text: string } | null>(null);

  // 검색 쿼리에 따른 필터링 내역 및 매치 카운트 계산
  const trimmedQuery = searchQuery.trim().toLowerCase();
  const filteredHistory = trimmedQuery
    ? history.filter((item) => item.text.toLowerCase().includes(trimmedQuery))
    : history;
  const matchCount = trimmedQuery
    ? history.filter((item) => item.text.toLowerCase().includes(trimmedQuery)).length
    : 0;

  const scrollToBottom = () => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  };
  
  useEffect(() => scrollToBottom(), [history]);

  /*
   * [INVARIANT - Highlight Match Keyword in React]
   * - Rationale: XSS 취약점을 방지하기 위해 dangerouslySetInnerHTML 대신 React JSX 단위의 안전한 split 매핑 하이라이팅을 수행한다.
   */
  const highlightText = (text: string, query: string) => {
    if (!query.trim()) return text;
    const parts = text.split(new RegExp(`(${query.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')})`, 'gi'));
    return (
      <>
        {parts.map((part, index) =>
          part.toLowerCase() === query.trim().toLowerCase() ? (
            <mark
              key={index}
              style={{
                background: AI_TERMINAL_CONSTANTS.HIGHLIGHT.BG,
                color: AI_TERMINAL_CONSTANTS.HIGHLIGHT.COLOR,
                borderRadius: AI_TERMINAL_CONSTANTS.HIGHLIGHT.BORDER_RADIUS,
                padding: AI_TERMINAL_CONSTANTS.HIGHLIGHT.PADDING,
              }}
            >
              {part}
            </mark>
          ) : (
            part
          )
        )}
      </>
    );
  };

  const handleCommand = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (cmdHistory.length > 0) {
        const nextIndex = historyIndex > 0 ? historyIndex - 1 : 0;
        setHistoryIndex(nextIndex);
        setInput(cmdHistory[nextIndex]);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex < cmdHistory.length - 1) {
        const nextIndex = historyIndex + 1;
        setHistoryIndex(nextIndex);
        setInput(cmdHistory[nextIndex]);
      } else if (historyIndex === cmdHistory.length - 1) {
        setHistoryIndex(cmdHistory.length);
        setInput('');
      }
    } else if (e.key === 'Enter' && input.trim()) {
      const cmd = input.trim();
      setInput('');
      setCmdHistory(prev => {
        const newHistory = [...prev, cmd];
        setHistoryIndex(newHistory.length);
        return newHistory;
      });
      setHistory(prev => [...prev, { type: 'in', text: `${cwd} $ ${cmd}` }]);
      
      if (cmd === 'clear') {
        setHistory([]);
        return;
      }
      
      if (ipc.isElectronEnv()) {
        try {
          const res = await (window as any).electronAPI.executeTerminal(cmd, cwd);
          if (res.newCwd) setCwd(res.newCwd);
          if (res.stdout) setHistory(prev => [...prev, { type: 'out', text: res.stdout }]);
          if (res.stderr) setHistory(prev => [...prev, { type: 'err', text: res.stderr }]);
        } catch (err: any) {
          setHistory(prev => [...prev, { type: 'err', text: err.message || String(err) }]);
        }
      } else {
        setHistory(prev => [...prev, { type: 'err', text: 'Command execution is only supported in Electron environment.' }]);
      }
    }
  };

  useEffect(() => {
    return () => {
      ipc.setBypassNativeContextMenu(false);
    };
  }, []);

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    const selection = window.getSelection();
    if (selection && selection.toString().trim()) {
      setContextMenu({
        x: e.clientX,
        y: e.clientY,
        text: selection.toString()
      });
    } else {
      setContextMenu({
        x: e.clientX,
        y: e.clientY,
        text: ''
      });
    }
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
          placeholder="검색할 커맨드 로그를 입력하세요..."
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
        className={`win98-font ${isFocused ? 'terminal-focused' : ''}`} 
        onContextMenu={handleContextMenu}
        onMouseEnter={() => ipc.setBypassNativeContextMenu(true)}
        onMouseLeave={() => ipc.setBypassNativeContextMenu(false)}
        style={{ 
          flex: 1, 
          overflowY: 'auto', 
          padding: '12px', 
          fontFamily: "'JetBrains Mono', 'Fira Code', monospace", 
          fontSize: `${fontSize}px`, 
          color: 'var(--term-text)',
          transition: 'box-shadow 0.2s',
          boxShadow: isFocused ? 'inset 0 0 0 1px var(--primary), inset 0 0 10px var(--primary-glow)' : 'none',
          userSelect: 'text',
          cursor: 'text',
          background: 'var(--term-bg)'
        }}
        onClick={() => {
          if (window.getSelection()?.toString().trim()) {
            return; // Allow text selection without stealing focus
          }
          const inputEl = document.getElementById('terminal-input');
          if (inputEl) inputEl.focus();
        }}
      >
        {filteredHistory.map((item, i) => (
          <div key={i} style={{ 
            color: item.type === 'err' ? '#fca5a5' : item.type === 'in' ? '#fbbf24' : 'var(--term-text)',
            whiteSpace: 'pre-wrap', 
            marginBottom: '4px',
            wordBreak: 'break-all'
          }}>
            {highlightText(item.text, searchQuery)}
          </div>
        ))}
        <div style={{ display: 'flex', alignItems: 'center', marginTop: '8px' }}>
          <span style={{ color: '#fbbf24', marginRight: '8px', flexShrink: 0 }}>{cwd} $</span>
          <input 
            id="terminal-input"
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleCommand}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            spellCheck={false}
            autoComplete="off"
            style={{
              flex: 1, 
              background: 'transparent', 
              border: 'none', 
              color: 'var(--term-text)',
              fontFamily: 'inherit', 
              fontSize: 'inherit', 
              outline: 'none',
              minWidth: 0
            }}
            autoFocus
          />
        </div>
        <div ref={bottomRef} style={{ height: '10px' }} />
      </div>
      
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
              setInput(prev => prev + text);
              const inputEl = document.getElementById('terminal-input');
              if (inputEl) inputEl.focus();
            } catch (err) {
              console.error('clipboard read failed:', err);
            }
          }}
          onInsertToBody={contextMenu.text ? () => {
            const event = new CustomEvent(AI_TERMINAL_CONSTANTS.EVENTS.INSERT_TEXT, { detail: contextMenu.text });
            window.dispatchEvent(event);
          } : undefined}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  );
}
