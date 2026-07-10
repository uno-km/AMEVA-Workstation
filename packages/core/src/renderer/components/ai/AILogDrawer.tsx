/**
 * @file AILogDrawer.tsx
 * @system AMEVA OS Desktop Workstation
 * @location src/renderer/components/ai/AILogDrawer.tsx
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

import React, { useState, useCallback, useRef } from 'react';
import { Terminal, ListTree, Plus, Minus } from 'lucide-react';
import { ConsoleLogTab } from './log-drawer/ConsoleLogTab';
import { ConsoleCommandTab } from './log-drawer/ConsoleCommandTab';

  /*
   * [FUNCTION CONTRACT]
   * - 함수 명: `AILogDrawer`
   * - 역할: 인자 정보를 검수하고 비즈니스 계약 조건에 맞춰 최종 바인딩 결과물/바이너리 버퍼를 반환함.
   * - 예시: `AILogDrawer(...)` 호출 시 런타임 비동기/동기 연쇄 반응 유도.
   */
export function AILogDrawer({ isExpanded, onToggle }: any) {
  const [isHovered, setIsHovered] = useState(false);
  const [activeTab, setActiveTab] = useState<'log' | 'cmd'>('log');
  // [FEAT-3] 드로어 높이 조절 상태 — 기본값 35vh (픽셀)
  const [drawerHeight, setDrawerHeight] = useState<number | null>(null);
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `isDraggingRef`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const isDraggingRef = ...` 형태로 안전 캐싱 후 가공 기동.
       */
  const isDraggingRef = useRef(false);
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `startYRef`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const startYRef = ...` 형태로 안전 캐싱 후 가공 기동.
       */
  const startYRef = useRef(0);
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `startHeightRef`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const startHeightRef = ...` 형태로 안전 캐싱 후 가공 기동.
       */
  const startHeightRef = useRef(0);

      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `scale`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const scale = ...` 형태로 안전 캐싱 후 가공 기동.
       */
  const scale = isHovered ? '1.1' : '1';
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `opacity`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const opacity = ...` 형태로 안전 캐싱 후 가공 기동.
       */
  const opacity = isHovered || isExpanded ? 1 : 0.4;

      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `tabStyle`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const tabStyle = ...` 형태로 안전 캐싱 후 가공 기동.
       */
  const tabStyle = (isActive: boolean): React.CSSProperties => ({
    padding: '4px 12px',
    background: isActive ? 'var(--bg-glass-active)' : 'transparent',
    color: isActive ? 'var(--text-main)' : 'var(--text-muted)',
    border: 'none',
    borderBottom: isActive ? '2px solid var(--primary)' : '2px solid transparent',
    cursor: 'pointer',
    fontFamily: 'var(--font-sans)',
    fontSize: '11px',
    fontWeight: isActive ? 600 : 400,
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    transition: 'all 0.2s',
  });

  // [FEAT-3] 상단 리사이즈 드래그 핸들 핸들러
  const handleResizeMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    isDraggingRef.current = true;
    startYRef.current = e.clientY;
    // 현재 실제 높이를 픽셀로 캡처
    const drawerEl = (e.target as HTMLElement).closest('[data-drawer-root]') as HTMLElement | null;
    startHeightRef.current = drawerEl?.offsetHeight ?? (window.innerHeight * 0.35);

      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `onMouseMove`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const onMouseMove = ...` 형태로 안전 캐싱 후 가공 기동.
       */
    const onMouseMove = (me: MouseEvent) => {
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `!isDraggingRef.current`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (!isDraggingRef.current)` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
      if (!isDraggingRef.current) return;
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `delta`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const delta = ...` 형태로 안전 캐싱 후 가공 기동.
       */
      const delta = startYRef.current - me.clientY; // 위로 드래그 = 높이 증가
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `newHeight`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const newHeight = ...` 형태로 안전 캐싱 후 가공 기동.
       */
      const newHeight = Math.max(120, Math.min(window.innerHeight * 0.8, startHeightRef.current + delta));
      setDrawerHeight(newHeight);
    };
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `onMouseUp`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const onMouseUp = ...` 형태로 안전 캐싱 후 가공 기동.
       */
    const onMouseUp = () => {
      isDraggingRef.current = false;
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }, []);

  // [FEAT-3] +/- 버튼으로 높이 증감
  const adjustHeight = (delta: number) => {
    setDrawerHeight(prev => {
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `base`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const base = ...` 형태로 안전 캐싱 후 가공 기동.
       */
      const base = prev ?? (window.innerHeight * 0.35);
      return Math.max(120, Math.min(window.innerHeight * 0.8, base + delta));
    });
  };

      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `resolvedHeight`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const resolvedHeight = ...` 형태로 안전 캐싱 후 가공 기동.
       */
  const resolvedHeight = drawerHeight ? `${drawerHeight}px` : '35vh';

  return (
    <div
      data-drawer-root
      style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        background: 'var(--bg-glass)', backdropFilter: 'blur(10px)',
        borderTop: '1px solid var(--border-muted)',
        boxShadow: '0 -4px 20px rgba(0,0,0,0.4)',
        transform: isExpanded ? 'translateY(0)' : 'translateY(100%)',
        transition: isDraggingRef.current ? 'none' : 'transform 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
        zIndex: 100,
        display: 'flex', flexDirection: 'column',
        height: resolvedHeight,
      }}>
      {/* [FEAT-3] 리사이즈 드래그 핸들 (상단) */}
      <div
        onMouseDown={handleResizeMouseDown}
        style={{
          position: 'absolute',
          top: 0, left: 0, right: 0,
          height: '5px',
          cursor: 'ns-resize',
          background: isDraggingRef.current ? 'var(--primary)' : 'transparent',
          zIndex: 102,
          transition: 'background 0.15s',
        }}
        title="드래그하여 높이 조절"
      />

      {/* Hover Trigger Wrapper */}
      <div
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        style={{
          position: 'absolute',
          top: '0px',
          left: '50%',
          transform: `translate(-50%, -50%)`,
          width: '180px',
          height: '180px',
          borderRadius: '50%',
          zIndex: 101,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          pointerEvents: 'auto'
        }}
      >
        <div 
          onClick={onToggle}
          title={isExpanded ? '터미널 닫기' : '터미널 열기'}
          style={{
            transform: `translateY(${isExpanded ? '-20px' : (isHovered ? '-20px' : '0px')}) scale(${scale})`,
            width: '42px',
            height: '42px',
            borderRadius: '50%',
            background: isHovered ? 'var(--primary)' : 'var(--bg-glass-active)',
            padding: '2px',
            boxShadow: isHovered 
              ? '0 0 20px var(--primary-glow)' 
              : '0 4px 12px rgba(0,0,0,0.15)',
            cursor: 'pointer', 
            opacity: opacity,
            transition: 'all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)',
            border: '1px solid var(--border-muted)',
          }}
        >
          <div style={{
            width: '100%', height: '100%', borderRadius: '50%',
            background: 'var(--bg-glass)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: isHovered ? '#fff' : 'var(--primary)',
            transition: 'background 0.3s ease',
          }}>
            <Terminal size={isHovered ? 20 : 18} style={{ transition: 'all 0.3s ease' }} />
          </div>
        </div>
      </div>
      
      {/* Tab Header */}
      <div style={{
        padding: '0 12px', background: 'var(--bg-glass)',
        borderBottom: '1px solid var(--border-muted)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end',
        height: '36px',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', height: '100%' }}>
          <button style={tabStyle(activeTab === 'log')} onClick={() => setActiveTab('log')}>
            <ListTree size={12} />
            Engine Logs
          </button>
          <button style={tabStyle(activeTab === 'cmd')} onClick={() => setActiveTab('cmd')}>
            <Terminal size={12} />
            Terminal (CMD)
          </button>
        </div>

        {/* [FEAT-3] 크기 조절 +/- 버튼 */}
        <div style={{ display: 'flex', gap: '4px', alignItems: 'center', paddingBottom: '4px' }}>
          <button
            onClick={() => adjustHeight(60)}
            title="터미널 높이 늘리기"
            style={{
              width: '22px', height: '22px', borderRadius: '4px',
              background: 'var(--bg-glass-active)', border: '1px solid var(--border-muted)',
              color: 'var(--text-muted)', cursor: 'pointer', display: 'flex',
              alignItems: 'center', justifyContent: 'center', padding: 0
            }}
          >
            <Plus size={11} />
          </button>
          <button
            onClick={() => adjustHeight(-60)}
            title="터미널 높이 줄이기"
            style={{
              width: '22px', height: '22px', borderRadius: '4px',
              background: 'var(--bg-glass-active)', border: '1px solid var(--border-muted)',
              color: 'var(--text-muted)', cursor: 'pointer', display: 'flex',
              alignItems: 'center', justifyContent: 'center', padding: 0
            }}
          >
            <Minus size={11} />
          </button>
        </div>
      </div>
      
      {/* Drawer Content */}
      <div style={{ 
        flex: 1, 
        display: 'flex', 
        flexDirection: 'column', 
        overflow: 'hidden',
        background: 'var(--term-bg)',
      }}>
        {activeTab === 'log' ? <ConsoleLogTab /> : <ConsoleCommandTab />}
      </div>
    </div>
  );
}

