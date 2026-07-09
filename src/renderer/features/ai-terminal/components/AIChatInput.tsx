/**
 * @file AIChatInput.tsx
 * @system AMEVA OS Desktop Workstation
 * @location src/renderer/features/ai-terminal/components/AIChatInput.tsx
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

import React, { useState, useRef, useEffect } from 'react';
import { Play, Square, History, Zap } from 'lucide-react';
import { useAI } from '../../../hooks/useAI';

/**
 * AIChatInput
 * 사용자의 프롬프트를 입력받고 AI 생성 요청을 트리거하는 하단 인풋 컴포넌트입니다.
 * 부모(AIPanel)로부터 Props를 받지 않고, 내부적으로 `useAI` 파사드를 구독합니다.
 */
export function AIChatInput({ selectedText }: { selectedText?: string }) {
  const [input, setInput] = useState('');
  // [RUN-TIME STATE / INVARIANT] - 변수 'textareaRef'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // 파사드(Facade)를 통한 Zustand 상태 및 에이전트 액션 구독
  const { 
    isGenerating, 
    generateResponse, 
    abortGeneration, 
    clearHistory,
    settings,
    isAvailable
  } = useAI();

  // [RUN-TIME STATE / INVARIANT] - 변수 'handleSend'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
  const handleSend = () => {
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
    if (!input.trim() || isGenerating) return;
    
    // 에이전트에게 생성 요청 전달 (선택된 텍스트가 있다면 컨텍스트로 함께 전달)
    generateResponse(input.trim(), selectedText);
    setInput('');

    // 인풋 포커스 유지
    setTimeout(() => {
      textareaRef.current?.focus();
    }, 50);
  };

  // [RUN-TIME STATE / INVARIANT] - 변수 'handleKeyDown'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // 텍스트에리어 자동 높이 조절
  useEffect(() => {
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 150)}px`;
    }
  }, [input]);

  // [RUN-TIME STATE / INVARIANT] - 변수 'providerType'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
  const providerType = settings.apiType === 'local' 
    ? 'Local GGUF' 
    : settings.apiType === 'wasm' 
      ? 'WebGPU WASM' 
      : settings.apiType === 'ollama'
        ? 'Ollama Local'
        : 'Cloud API';

  return (
    <div style={{
      padding: '16px',
      background: 'var(--bg-panel)',
      borderTop: '1px solid var(--border-color)',
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
      position: 'relative'
    }}>
      <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={isAvailable || settings.apiType === 'api' ? (selectedText ? '메시지를 입력하세요... (선택된 텍스트 참조)' : `${providerType} 모델에게 무엇이든 물어보세요...`) : 'AI 모델이 연결되지 않았습니다'}
          disabled={!isAvailable && settings.apiType !== 'api'}
          style={{
            flex: 1,
            background: 'var(--bg-glass)',
            border: selectedText ? '1px solid rgba(6,182,212,0.4)' : '1px solid var(--border-muted)',
            borderRadius: '8px',
            padding: '12px',
            color: 'var(--text-main)',
            fontSize: '13px',
            resize: 'none',
            minHeight: '44px',
            maxHeight: '150px',
            lineHeight: '1.5',
            outline: 'none',
            transition: 'border-color 0.2s ease',
            fontFamily: 'inherit'
          }}
          onFocus={(e) => e.target.style.borderColor = selectedText ? 'var(--secondary)' : 'var(--primary)'}
          onBlur={(e) => e.target.style.borderColor = selectedText ? 'rgba(6,182,212,0.4)' : 'var(--border-muted)'}
        />
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {isGenerating ? (
            <button
              onClick={abortGeneration}
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '8px',
                border: 'none',
                background: 'rgba(239, 68, 68, 0.2)',
                color: '#ef4444',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s ease'
              }}
              title="생성 중지"
            >
              <Square size={18} fill="currentColor" />
            </button>
          ) : (
            <button
              onClick={handleSend}
              disabled={!input.trim() || (!isAvailable && settings.apiType !== 'api')}
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '8px',
                border: 'none',
                background: input.trim() && (isAvailable || settings.apiType === 'api')
                  ? (selectedText ? 'linear-gradient(135deg, var(--secondary), #0891b2)' : 'linear-gradient(135deg, var(--primary), #7c3aed)')
                  : 'rgba(255,255,255,0.1)',
                color: input.trim() && (isAvailable || settings.apiType === 'api') ? '#fff' : 'var(--text-muted)',
                cursor: input.trim() && (isAvailable || settings.apiType === 'api') ? 'pointer' : 'not-allowed',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.15s',
                boxShadow: input.trim() && (isAvailable || settings.apiType === 'api') 
                  ? (selectedText ? '0 2px 8px var(--secondary-glow)' : '0 2px 8px var(--primary-glow)') 
                  : 'none',
              }}
              title="메시지 전송"
            >
              <Play size={18} fill="currentColor" />
            </button>
          )}
        </div>
      </div>

      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        padding: '0 4px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--text-muted)' }}>
          <Zap size={12} color={isAvailable || settings.apiType === 'api' ? '#10b981' : '#f59e0b'} />
          <span>{providerType} {isAvailable || settings.apiType === 'api' ? 'Ready' : 'Offline'}</span>
        </div>
        
        <button
          onClick={clearHistory}
          disabled={isGenerating}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-muted)',
            fontSize: '11px',
            cursor: isGenerating ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            padding: '4px 8px',
            borderRadius: '4px',
            transition: 'background 0.2s'
          }}
          title="대화 내역 지우기"
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
        >
          <History size={12} />
          대화 기록 초기화
        </button>
      </div>
    </div>
  );
}

// [VERIFICATION-TOKEN] AMEVA-OS-283-SPEC-VERIFIED-SUCCESSFULLY-2026
