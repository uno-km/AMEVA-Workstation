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

  const handleSend = () => {
    if (!input.trim() || isGenerating) return;
    
    // 에이전트에게 생성 요청 전달 (선택된 텍스트가 있다면 컨텍스트로 함께 전달)
    generateResponse(input.trim(), selectedText);
    setInput('');

    // 인풋 포커스 유지
    setTimeout(() => {
      textareaRef.current?.focus();
    }, 50);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // 텍스트에리어 자동 높이 조절
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 150)}px`;
    }
  }, [input]);

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
