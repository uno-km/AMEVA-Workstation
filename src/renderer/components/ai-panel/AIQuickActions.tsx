/**
 * @file AIQuickActions.tsx
 * @system AMEVA OS Desktop Workstation
 * @location src/renderer/components/ai-panel/AIQuickActions.tsx
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

import React from 'react';
import { Sparkles, FileText, Wand2, Languages, Expand, Lightbulb } from 'lucide-react';

/**
 * QUICK_ACTIONS 상수 배열
 * 사용자가 빈번하게 활용하는 핵심 프롬프트 패턴들을 정의한 정적 데이터 구조입니다.
 * 하드코딩을 방지하고 순회 가능한 배열 형태로 관리하여 UI의 확장성을 보장합니다.
 * 예상되는 값: 각 객체는 id(고유식별자), icon(React 노드), label(UI표시명), prompt(실행할 명령어 문자열)를 포함합니다.
 */
export const QUICK_ACTIONS = [
  { id: 'summarize', icon: FileText, label: '요약', prompt: '현재 문서 내용을 핵심만 3줄로 요약해줘.' },
  { id: 'improve', icon: Wand2, label: '교정', prompt: '현재 문서의 문체와 표현을 자연스럽게 개선해줘.' },
  { id: 'translate', icon: Languages, label: '번역', prompt: '현재 문서를 영어로 번역해줘.' },
  { id: 'expand', icon: Expand, label: '확장', prompt: '현재 문서 내용을 더 풍부하게 확장해줘.' },
  { id: 'explain', icon: Lightbulb, label: '설명', prompt: '현재 문서의 핵심 개념을 쉽게 설명해줘.' },
];

/**
 * AIQuickActionsProps 인터페이스 정의
 * 이 인터페이스는 AIQuickActions 컴포넌트가 부모 컴포넌트로부터 전달받아야 하는 속성(Props)의 타입을 명시합니다.
 * 컴포넌트 간의 결합도를 최소화하기 위해 전역 상태를 직접 참조하지 않고 명시적인 속성만을 전달받습니다.
 * 예상되는 값: selectedText는 현재 선택된 문자열이며, isAvailable은 시스템 준비 여부를 나타내는 boolean 값입니다.
 */
export interface AIQuickActionsProps {
  selectedText: string;
  isAvailable: boolean;
  onQuickAction: (prompt: string) => void;
}

/**
 * AIQuickActions 컴포넌트
 * 이 컴포넌트는 대화 내역이 없을 때 표시되는 초기 환영 화면과 빠른 실행 버튼 집합을 렌더링합니다.
 * 사용자의 선택 텍스트 유무에 따라 동적으로 상태 안내 문구 및 버튼의 스타일을 변경합니다.
 * 예상되는 값: 유효한 AIQuickActionsProps 객체가 주어지면 완전한 ReactNode를 반환합니다.
 */
export const AIQuickActions: React.FC<AIQuickActionsProps> = ({
  selectedText,
  isAvailable,
  onQuickAction
}) => {

  /**
   * getBorderColor 함수
   * 마우스 오버 상태 및 선택 영역의 존재 여부에 따라 테두리 색상을 동적으로 계산합니다.
   * 복잡한 삼항 연산자를 함수로 분리하여 렌더링 블록 내부의 가독성을 극대화합니다.
   * 예상되는 값: isHovered가 참이고 selectedText가 존재하면 'var(--secondary)'를 반환합니다.
   */
  const getBorderColor = (isHovered: boolean): string => {
    // 사용자가 버튼에 마우스를 올렸는지(Hover) 확인하는 조건문입니다.
    // 마우스가 올려진 상태라면 현재 텍스트가 선택되었는지 여부에 따라 강조 색상을 달리 적용합니다.
    // 이 조건문이 참이면 내부 로직에 의해 즉시 색상값이 반환됩니다.
    // 예상되는 값: isHovered === true 일 때 내부 분기 진입.
    if (isHovered) {
      // 에디터에서 특정 영역이 선택된 상태인지 확인하는 조건문입니다.
      // 선택 영역이 있다면 보조 색상(Secondary)을 반환하여 사용자의 주의를 환기시킵니다.
      // 만약 선택 영역이 없다면 기본 색상(Primary)을 반환하여 일관성을 유지합니다.
      // 예상되는 값: selectedText가 빈 문자열이 아닐 경우 'var(--secondary)' 반환.
      if (selectedText) {
        return 'var(--secondary)';
      }
      return 'var(--primary)';
    }

    // 마우스가 버튼 위에 없는 기본 상태를 처리하는 조건문입니다.
    // 사용자가 에디터 텍스트를 드래그한 상태라면 대기 상태임을 알리기 위해 옅은 테두리 색상을 부여합니다.
    // 선택된 텍스트가 전혀 없다면 가장 기본적인 테두리 색상을 반환합니다.
    // 예상되는 값: isHovered === false 이고 selectedText가 존재할 때 'rgba(6,182,212,0.25)' 반환.
    if (selectedText) {
      return 'rgba(6,182,212,0.25)';
    }
    return 'var(--border-muted)';
  };

  /**
   * getBackgroundColor 함수
   * 마우스 오버 상태 및 선택 영역의 존재 여부에 따라 배경 색상을 동적으로 계산합니다.
   * 렌더링 구조에서 인라인 스타일 연산을 배제하기 위한 추상화 함수입니다.
   * 예상되는 값: isHovered가 참이면 'var(--bg-glass-active)'를 반환합니다.
   */
  const getBackgroundColor = (isHovered: boolean): string => {
    // 사용자의 마우스가 현재 버튼 영역에 진입해 있는지 확인하는 조건문입니다.
    // 버튼의 활성화 느낌을 주기 위해 즉각적으로 활성 배경색을 부여합니다.
    // 이 조건이 참일 경우 즉시 정해진 CSS 변수 문자열을 반환합니다.
    // 예상되는 값: isHovered === true 일 때 'var(--bg-glass-active)' 반환.
    if (isHovered) {
      return 'var(--bg-glass-active)';
    }

    // 마우스가 벗어난 기본 상태일 때 선택된 텍스트 유무를 검사하는 조건문입니다.
    // 선택 영역이 존재한다면 옅은 배경색을 주어 해당 동작이 선택 영역을 대상으로 함을 시각적으로 알립니다.
    // 선택 영역이 없다면 기본 유리 배경 효과를 적용합니다.
    // 예상되는 값: selectedText가 참일 때 'rgba(6,182,212,0.06)' 반환.
    if (selectedText) {
      return 'rgba(6,182,212,0.06)';
    }
    return 'var(--bg-glass)';
  };

  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: '20px', gap: '16px',
      overflowY: 'auto',
    }}>
      <div style={{
        width: '56px', height: '56px', borderRadius: '16px',
        background: 'linear-gradient(135deg, rgba(139,92,246,0.3), rgba(6,182,212,0.3))',
        border: '1px solid rgba(139,92,246,0.3)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: '0 0 30px rgba(139,92,246,0.15)',
      }}>
        <Sparkles size={24} color="var(--primary)" />
      </div>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '14px', fontWeight: 700, marginBottom: '6px' }}>
          AMEVA AI
        </div>
        <div style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: '1.5' }}>
          문서 작성을 돕는 로컬 AI입니다.<br />
          {/* 사용자가 텍스트를 선택했는지에 따라 안내 메시지를 분기 렌더링합니다. */}
          {/* 선택 영역이 있을 경우 해당 글자 수와 대기 상태를 강조하여 출력합니다. */}
          {/* 예상되는 값: selectedText가 존재하면 강조 span 요소 렌더링. */}
          {selectedText ? (
            <span style={{ color: 'var(--secondary)', fontWeight: 'bold' }}>
              에디터 선택 영역({selectedText.length}자) 분석 대기 중!
            </span>
          ) : (
            '아래 빠른 작업으로 시작하거나 직접 입력하세요.'
          )}
        </div>
      </div>

      <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {/* QUICK_ACTIONS 배열을 순회하여 버튼 요소들을 동적으로 생성하는 맵핑 반복문입니다. */}
        {/* 각 액션 객체의 속성들을 활용하여 버튼의 텍스트, 아이콘, 클릭 이벤트를 바인딩합니다. */}
        {/* 예상되는 값: QUICK_ACTIONS의 길이(예: 5)만큼 버튼 컴포넌트들이 배열 형태로 렌더링됩니다. */}
        {QUICK_ACTIONS.map(action => {
          // 선택 영역 유무에 따라 버튼 텍스트의 접두사를 동적으로 결정합니다.
          const labelText = selectedText ? `선택 영역 ${action.label}` : action.label;
          
          return (
            <button
              key={action.id}
              onClick={() => onQuickAction(action.prompt)}
              disabled={!isAvailable}
              style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                padding: '10px 14px', borderRadius: '8px',
                background: getBackgroundColor(false),
                border: `1px solid ${getBorderColor(false)}`,
                color: 'var(--text-main)', cursor: isAvailable ? 'pointer' : 'not-allowed',
                fontSize: '12px', textAlign: 'left',
                transition: 'all 0.15s',
                opacity: isAvailable ? 1 : 0.5,
              }}
              onMouseEnter={e => {
                // 버튼이 활성화된 상태일 때만 마우스 오버 시각적 효과를 적용하는 조건문입니다.
                // 비활성 버튼에 시각적 피드백이 들어가는 논리적 오류를 방지하기 위함입니다.
                // 조건이 참이면 직접 DOM 요소의 인라인 스타일을 수정합니다.
                // 예상되는 값: isAvailable === true 일 때 style 객체 조작 실행.
                if (isAvailable) {
                  const target = e.currentTarget as HTMLButtonElement;
                  target.style.borderColor = getBorderColor(true);
                  target.style.background = getBackgroundColor(true);
                  target.style.color = 'var(--text-on-active)';
                }
              }}
              onMouseLeave={e => {
                const target = e.currentTarget as HTMLButtonElement;
                target.style.borderColor = getBorderColor(false);
                target.style.background = getBackgroundColor(false);
                target.style.color = 'var(--text-main)';
              }}
            >
              <action.icon size={14} style={{ color: selectedText ? 'var(--secondary)' : 'var(--primary)', flexShrink: 0 }} />
              <span>{labelText}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
