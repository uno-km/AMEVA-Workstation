/**
 * @file AIChatInput.tsx
 * @system AMEVA OS Desktop Workstation
 * @location src/renderer/components/ai-panel/AIChatInput.tsx
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
import { Send, X } from 'lucide-react';

/**
 * QueueItem 인터페이스
 * 대기열에 포함되는 항목의 구조를 정의합니다.
 */
interface QueueItem {
  id: string;
  userMessage: string;
}

/**
 * AIChatInputProps 인터페이스 정의
 * 이 인터페이스는 AIChatInput 컴포넌트가 부모 컴포넌트로부터 전달받아야 하는 속성(Props)의 타입을 명시합니다.
 * 컴포넌트 간의 결합도를 최소화하기 위해 입력 상태와 제어 핸들러를 외부에서 주입받는 제어 컴포넌트(Controlled Component) 패턴을 적용했습니다.
 * 예상되는 값: input은 현재 입력된 문자열, isGenerating은 모델의 연산 진행 여부를 나타내는 boolean 값입니다.
 */
export interface AIChatInputProps {
  input: string;
  setInput: (val: string) => void;
  textareaRef: React.RefObject<HTMLTextAreaElement>;
  isInputEnabled: boolean;
  selectedText: string;
  isGenerating: boolean;
  isWhiteTheme: boolean;
  pendingQueue: QueueItem[];
  removeFromQueue?: (id: string) => void;
  onSendClick: () => void;
  onAbortClick: () => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
}

/**
 * AIChatInput 컴포넌트
 * 이 컴포넌트는 사용자의 텍스트 입력을 받고, 대기열(Queue) 상태를 렌더링하며, 전송 및 중단 컨트롤을 제공하는 UI 영역입니다.
 * 상태 변이(Mutation)를 부모에게 위임하여 컴포넌트의 순수성(Purity)을 높였습니다.
 * 예상되는 값: 유효한 AIChatInputProps 객체가 전달되면 입력창과 관련 UI가 포함된 ReactNode를 반환합니다.
 */
export const AIChatInput: React.FC<AIChatInputProps> = ({
  input,
  setInput,
  textareaRef,
  isInputEnabled,
  selectedText,
  isGenerating,
  isWhiteTheme,
  pendingQueue,
  removeFromQueue,
  onSendClick,
  onAbortClick,
  onKeyDown
}) => {

  /**
   * getQueueContainerBackground 함수
   * 현재 테마 설정에 따라 대기열(Queue) 컨테이너의 배경색을 결정합니다.
   * 복잡한 삼항 연산자를 분리하여 렌더링 블록 내 가독성을 확보하기 위함입니다.
   * 예상되는 값: isWhiteTheme가 참이면 밝은 테마용 색상 코드를 반환합니다.
   */
  const getQueueContainerBackground = (): string => {
    // 화이트 테마 적용 여부를 확인하는 조건문입니다.
    // 어두운 배경과 밝은 배경 각각에서 큐 영역이 주변과 조화를 이루도록 대비를 조정합니다.
    // 이 조건문이 참이면 화이트 테마에 적합한 투명도 값을 반환합니다.
    // 예상되는 값: isWhiteTheme === true 일 때 'rgba(0,0,0,0.02)' 반환.
    if (isWhiteTheme) {
      return 'rgba(0,0,0,0.02)';
    }
    
    // 다크 테마(기본값)에 적용되는 기본 반환값입니다.
    // 어두운 화면에서는 반대로 흰색을 낮은 투명도로 덮어 씌워 영역을 시각적으로 분리합니다.
    // 화이트 테마가 아닐 경우 실행되는 폴백 구문입니다.
    // 예상되는 값: isWhiteTheme === false 일 때 'rgba(255,255,255,0.02)' 반환.
    return 'rgba(255,255,255,0.02)';
  };

  /**
   * getQueueItemBackground 함수
   * 현재 테마 설정에 따라 개별 대기열 항목의 배경색을 결정합니다.
   * 항목 간 시각적 계층 구조를 명확히 하기 위해 컨테이너와 다른 배경색을 적용합니다.
   * 예상되는 값: isWhiteTheme가 참이면 'var(--bg-card)'를 반환합니다.
   */
  const getQueueItemBackground = (): string => {
    // 화이트 테마 모드인지 식별하는 조건문입니다.
    // 리스트 아이템이 배경에 묻히지 않도록 완전히 불투명하거나 특정 변수로 정의된 카드 배경색을 사용합니다.
    // 이 조건문이 참일 때 지정된 CSS 변수를 반환합니다.
    // 예상되는 값: isWhiteTheme === true 일 때 'var(--bg-card)' 반환.
    if (isWhiteTheme) {
      return 'var(--bg-card)';
    }

    // 다크 테마에서 대기열 개별 항목에 적용되는 기본 배경색입니다.
    // 컨테이너보다 미세하게 더 밝은 투명도를 적용하여 레이어 뎁스(Depth)를 표현합니다.
    // 화이트 테마가 아닐 때의 기본 반환값입니다.
    // 예상되는 값: isWhiteTheme === false 일 때 'rgba(255,255,255,0.03)' 반환.
    return 'rgba(255,255,255,0.03)';
  };

  /**
   * getSendButtonBackground 함수
   * 입력 필드의 상태, 에디터 텍스트 선택 여부 등에 따라 전송 버튼의 배경색을 결정합니다.
   * 예상되는 값: 입력된 텍스트가 없고, 비활성화 상태이면 'rgba(255,255,255,0.05)'를 반환합니다.
   */
  const getSendButtonBackground = (): string => {
    // 입력창에 전송 가능한 유효한 텍스트가 존재하며, 입력 자체가 허용된 상태인지 확인하는 조건문입니다.
    // trim()을 사용하여 공백 문자열 전송 시도를 방지하고, 시스템이 입력을 수용할 수 있는지 이중 검증합니다.
    // 만약 전송 가능 상태라면, 선택 영역의 유무에 따라 다시 시각적 효과를 분기합니다.
    // 예상되는 값: input.trim()이 참이고 isInputEnabled가 참이면 내부 분기 진입.
    if (input.trim() && isInputEnabled) {
      // 에디터에서 텍스트가 선택되어 있는지 확인하는 중첩 조건문입니다.
      // 선택 영역을 대상으로 한 동작일 경우 보조 색상(Secondary)을 사용하여 상황 맥락을 시각적으로 알립니다.
      // 선택 영역이 없다면 일반 동작을 의미하는 기본 색상(Primary)을 사용합니다.
      // 예상되는 값: selectedText가 존재할 때 'linear-gradient(135deg, var(--secondary), #0891b2)' 반환.
      if (selectedText) {
        return 'linear-gradient(135deg, var(--secondary), #0891b2)';
      }
      return 'linear-gradient(135deg, var(--primary), #7c3aed)';
    }

    // 텍스트가 없거나 시스템이 입력을 비활성화한 대기 상태의 배경색입니다.
    // 사용자가 상호작용할 수 없음을 명시적으로 드러내는 매우 흐린 배경색을 적용합니다.
    // 입력 불가능 상태일 때의 기본 반환값입니다.
    // 예상되는 값: 비활성 상태일 때 'rgba(255,255,255,0.05)' 반환.
    return 'rgba(255,255,255,0.05)';
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
      {/* ⏳ 대기열 큐 (Request Queue) UI 목록 영역입니다. */}
      {/* 대기 중인 작업이 1개 이상 존재할 경우에만 이 컨테이너를 렌더링합니다. */}
      {/* 예상되는 값: pendingQueue.length가 0보다 클 때 전체 큐 레이아웃 출력. */}
      {pendingQueue.length > 0 && (
        <div style={{
          display: 'flex', flexDirection: 'column', gap: '5px', padding: '6px 8px',
          background: getQueueContainerBackground(),
          border: '1px solid var(--border-muted)',
          borderRadius: '8px', marginBottom: '6px', maxHeight: '120px', overflowY: 'auto',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
            <span style={{ fontSize: '9px', fontWeight: 800, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              ⏳ 처리 대기열 ({pendingQueue.length}개)
            </span>
            <span style={{ fontSize: '8.5px', color: 'var(--text-muted)' }}>
              순차적으로 자동 실행됩니다
            </span>
          </div>
          {/* pendingQueue 배열을 순회하며 대기 중인 개별 아이템들을 렌더링하는 반복문입니다. */}
          {/* 배열 내의 순서를 직관적으로 표시하고, 개별 항목마다 삭제 기능을 연결합니다. */}
          {/* 예상되는 값: pendingQueue 배열의 각 항목마다 하나의 div 블록 생성. */}
          {pendingQueue.map((item, idx) => (
            <div
              key={item.id || idx}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                background: getQueueItemBackground(),
                border: '1px solid var(--border-muted)', borderRadius: '6px', padding: '4px 8px',
              }}
            >
              <span style={{
                fontSize: '10px', color: 'var(--text-main)', textOverflow: 'ellipsis',
                overflow: 'hidden', whiteSpace: 'nowrap', maxWidth: '85%',
              }}>
                {idx + 1}. {item.userMessage}
              </span>
              <button
                onClick={() => removeFromQueue?.(item.id)}
                style={{
                  background: 'transparent', border: 'none', color: '#f87171',
                  cursor: 'pointer', display: 'flex', alignItems: 'center',
                  padding: '2px', borderRadius: '4px',
                }}
                title="대기열에서 제거"
              >
                <X size={10} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* 텍스트 입력부 및 동작 실행 버튼을 포괄하는 부모 컨테이너 영역입니다. */}
      <div
        data-focus-region="ai-input"
        style={{ display: 'flex', gap: '6px', alignItems: 'flex-end', position: 'relative', borderRadius: '10px' }}
      >
        <textarea
          ref={textareaRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={isInputEnabled ? '메시지를 입력하세요... (Shift+Enter: 줄바꿈)' : 'llama.cpp 설치 필요'}
          disabled={!isInputEnabled}
          rows={2}
          style={{
            flex: 1, background: 'var(--bg-glass)',
            border: selectedText ? '1px solid rgba(6,182,212,0.4)' : '1px solid var(--border-muted)',
            borderRadius: '8px', padding: '8px 10px',
            color: 'var(--text-main)', fontSize: '12px', resize: 'none',
            outline: 'none', fontFamily: 'var(--font-sans)', lineHeight: '1.5',
            transition: 'border-color 0.15s', maxHeight: '80px', overflowY: 'auto',
          }}
          onFocus={e => (e.target.style.borderColor = selectedText ? 'var(--secondary)' : 'var(--primary)')}
          onBlur={e => (e.target.style.borderColor = selectedText ? 'rgba(6,182,212,0.4)' : 'var(--border-muted)')}
        />

        {/* AI가 응답을 생성 중인지 여부에 따라 전송 버튼과 취소 버튼을 교체하는 조건부 렌더링입니다. */}
        {/* 사용자에게 명확한 상태 변화를 인지시키고, 오작동을 원천적으로 막는 방어 기제 역할을 합니다. */}
        {/* 예상되는 값: isGenerating이 참일 경우 취소 버튼 렌더링. */}
        {isGenerating ? (
          <button
            onClick={onAbortClick}
            style={{
              width: '36px', height: '36px', borderRadius: '8px',
              background: 'rgba(239,68,68,0.2)', border: '1px solid rgba(239,68,68,0.4)',
              color: '#f87171', cursor: 'pointer', display: 'flex',
              alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}
            title="중단"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2">
              <rect x="4" y="4" width="16" height="16" rx="2" />
            </svg>
          </button>
        ) : (
          <button
            onClick={onSendClick}
            disabled={!input.trim() || !isInputEnabled}
            style={{
              width: '36px', height: '36px', borderRadius: '8px',
              background: getSendButtonBackground(),
              border: '1px solid transparent',
              color: '#fff', cursor: input.trim() && isInputEnabled ? 'pointer' : 'not-allowed',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              boxShadow: input.trim() && isInputEnabled ? (selectedText ? '0 2px 8px var(--secondary-glow)' : '0 2px 8px var(--primary-glow)') : 'none',
              transition: 'all 0.15s',
              opacity: input.trim() && isInputEnabled ? 1 : 0.4,
            }}
            title="전송 (Enter)"
          >
            <Send size={14} />
          </button>
        )}
      </div>
    </div>
  );
};

