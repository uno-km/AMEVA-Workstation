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

interface HistoryItem {
  type: 'in' | 'out' | 'err';
  text: string;
}

  /*
   * [FUNCTION CONTRACT]
   * - 함수 명: `ConsoleCommandTab`
   * - 역할: 인자 정보를 검수하고 비즈니스 계약 조건에 맞춰 최종 바인딩 결과물/바이너리 버퍼를 반환함.
   * - 예시: `ConsoleCommandTab(...)` 호출 시 런타임 비동기/동기 연쇄 반응 유도.
   */
export function ConsoleCommandTab() {
  const [history, setHistory] = useState<HistoryItem[]>([
    { type: 'out', text: 'AMEVA Virtual Terminal [Host OS RPC]' },
    { type: 'out', text: 'Type standard Linux or Windows commands here.' }
  ]);
  const [input, setInput] = useState('');
  const [cwd, setCwd] = useState('~/workspace');
  const [isFocused, setIsFocused] = useState(false);
  const [cmdHistory, setCmdHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `bottomRef`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const bottomRef = ...` 형태로 안전 캐싱 후 가공 기동.
       */
  const bottomRef = useRef<HTMLDivElement>(null);
  
  // 컨텍스트 메뉴 상태
  const [contextMenu, setContextMenu] = useState<{ x: number, y: number, text: string } | null>(null);

      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `scrollToBottom`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const scrollToBottom = ...` 형태로 안전 캐싱 후 가공 기동.
       */
  const scrollToBottom = () => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  };
  
  useEffect(() => scrollToBottom(), [history]);

      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `handleCommand`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const handleCommand = ...` 형태로 안전 캐싱 후 가공 기동.
       */
  const handleCommand = async (e: React.KeyboardEvent<HTMLInputElement>) => {
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `e.key === 'ArrowUp'`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (e.key === 'ArrowUp')` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `cmdHistory.length > 0`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (cmdHistory.length > 0)` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
      if (cmdHistory.length > 0) {
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `nextIndex`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const nextIndex = ...` 형태로 안전 캐싱 후 가공 기동.
       */
        const nextIndex = historyIndex > 0 ? historyIndex - 1 : 0;
        setHistoryIndex(nextIndex);
        setInput(cmdHistory[nextIndex]);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `historyIndex < cmdHistory.length - 1`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (historyIndex < cmdHistory.length - 1)` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
      if (historyIndex < cmdHistory.length - 1) {
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `nextIndex`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const nextIndex = ...` 형태로 안전 캐싱 후 가공 기동.
       */
        const nextIndex = historyIndex + 1;
        setHistoryIndex(nextIndex);
        setInput(cmdHistory[nextIndex]);
      } else if (historyIndex === cmdHistory.length - 1) {
        setHistoryIndex(cmdHistory.length);
        setInput('');
      }
    } else if (e.key === 'Enter' && input.trim()) {
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `cmd`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const cmd = ...` 형태로 안전 캐싱 후 가공 기동.
       */
      const cmd = input.trim();
      setInput('');
      setCmdHistory(prev => {
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `newHistory`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const newHistory = ...` 형태로 안전 캐싱 후 가공 기동.
       */
        const newHistory = [...prev, cmd];
        setHistoryIndex(newHistory.length);
        return newHistory;
      });
      setHistory(prev => [...prev, { type: 'in', text: `${cwd} $ ${cmd}` }]);
      
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `cmd === 'clear'`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (cmd === 'clear')` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
      if (cmd === 'clear') {
        setHistory([]);
        return;
      }
      
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `ipc.isElectronEnv()`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (ipc.isElectronEnv())` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
      if (ipc.isElectronEnv()) {
        try {
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `res`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const res = ...` 형태로 안전 캐싱 후 가공 기동.
       */
          const res = await (window as any).electronAPI.executeTerminal(cmd, cwd);
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `res.newCwd) setCwd(res.newCwd`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (res.newCwd) setCwd(res.newCwd)` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
          if (res.newCwd) setCwd(res.newCwd);
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `res.stdout) setHistory(prev => [...prev, { type: 'out', text: res.stdout }]`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (res.stdout) setHistory(prev => [...prev, { type: 'out', text: res.stdout }])` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
          if (res.stdout) setHistory(prev => [...prev, { type: 'out', text: res.stdout }]);
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `res.stderr) setHistory(prev => [...prev, { type: 'err', text: res.stderr }]`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (res.stderr) setHistory(prev => [...prev, { type: 'err', text: res.stderr }])` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
          if (res.stderr) setHistory(prev => [...prev, { type: 'err', text: res.stderr }]);
        } catch (err: any) {
          setHistory(prev => [...prev, { type: 'err', text: err.message || String(err) }]);
        }
      } else {
        setHistory(prev => [...prev, { type: 'err', text: 'Command execution is only supported in Electron environment.' }]);
      }
    }
  };

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
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `selection && selection.toString().trim()`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (selection && selection.toString().trim())` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
    if (selection && selection.toString().trim()) {
      setContextMenu({
        x: e.clientX,
        y: e.clientY,
        text: selection.toString()
      });
    } else {
      // 선택 영역이 없으면 붙여넣기를 위한 메뉴 오픈
      setContextMenu({
        x: e.clientX,
        y: e.clientY,
        text: ''
      });
    }
  };

  return (
    <div 
      className={`win98-font ${isFocused ? 'terminal-focused' : ''}`} 
      onContextMenu={handleContextMenu}
      style={{ 
        flex: 1, 
        overflowY: 'auto', 
        padding: '12px', 
        fontFamily: "'JetBrains Mono', 'Fira Code', monospace", 
        fontSize: '11.5px', 
        color: 'var(--term-text)',
        transition: 'box-shadow 0.2s',
        boxShadow: isFocused ? 'inset 0 0 0 1px var(--primary), inset 0 0 10px var(--primary-glow)' : 'none',
        userSelect: 'text',
        cursor: 'text'
      }}
      onClick={() => {
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `window.getSelection()?.toString().trim()`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (window.getSelection()?.toString().trim())` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
        if (window.getSelection()?.toString().trim()) {
          return; // Allow text selection without stealing focus
        }
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `inputEl`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const inputEl = ...` 형태로 안전 캐싱 후 가공 기동.
       */
        const inputEl = document.getElementById('terminal-input');
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `inputEl) inputEl.focus(`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (inputEl) inputEl.focus()` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
        if (inputEl) inputEl.focus();
      }}
    >
      {history.map((item, i) => (
        <div key={i} style={{ 
          color: item.type === 'err' ? '#fca5a5' : item.type === 'in' ? '#fbbf24' : 'var(--term-text)',
          whiteSpace: 'pre-wrap', 
          marginBottom: '4px',
          wordBreak: 'break-all'
        }}>
          {item.text}
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
              setInput(prev => prev + text);
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `inputEl`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const inputEl = ...` 형태로 안전 캐싱 후 가공 기동.
       */
              const inputEl = document.getElementById('terminal-input');
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `inputEl) inputEl.focus(`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (inputEl) inputEl.focus()` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
              if (inputEl) inputEl.focus();
            } catch (err) {
              console.error('clipboard read failed:', err);
            }
          }}
          onInsertToBody={contextMenu.text ? () => {
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `event`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const event = ...` 형태로 안전 캐싱 후 가공 기동.
       */
            const event = new CustomEvent('ameva:insert-text', { detail: contextMenu.text });
            window.dispatchEvent(event);
          } : undefined}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  );
}

