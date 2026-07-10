/**
 * @file AIChatList.tsx
 * @system AMEVA OS Desktop Workstation
 * @location src/renderer/components/ai-panel/AIChatList.tsx
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
import type { AIMessage } from '../../types/aiTypes';
import { MessageBubble } from './chat-list/MessageBubble';

/**
 * AIChatList 컴포넌트 Props 스키마
 */
interface AIChatListProps {
  messages: AIMessage[];
  messagesContainerRef: React.RefObject<HTMLDivElement | null>;
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
  onApplySuggestion?: (text: string, mode: 'replace' | 'insert', blockId?: string) => void;
  selectedText?: string;
  onUpdateDiffState?: (msgId: string, state: 'accepted' | 'rejected') => void;
  onApplyInsertSuggestion?: (msgId: string, afterBlockId: string, blockType: string, content: string, level?: number, suggestionIndex?: number) => void;
  onUpdateInsertSuggestionStatus?: (msgId: string, status: 'pending' | 'accepted' | 'rejected', newAfterBlockId?: string, newSiblingIndex?: number, suggestionIndex?: number) => void;
  blocks?: any[];
  onScrollToBlock?: (blockId: string) => void;
  isWhiteTheme: boolean;
}

/**
 * AIChatList 컴포넌트
 * 전체 메시지 목록 렌더링, 스크롤 영역 관리, 각 메시지 말풍선에 대한 콜백 주입을 담당하는 컨테이너입니다.
 * 비대한 AIPanel 로직에서 '채팅 내역 리스트' 영역만을 독립적으로 분리하여 관리합니다.
 */
export function AIChatList({
  messages,
  messagesContainerRef,
  messagesEndRef,
  onApplySuggestion,
  selectedText,
  onUpdateDiffState,
  onApplyInsertSuggestion,
  onUpdateInsertSuggestionStatus,
  blocks,
  onScrollToBlock,
  isWhiteTheme,
}: AIChatListProps) {
  // 렌더링할 메시지가 없으면 영역 자체를 렌더링하지 않음
  if (messages.length === 0) return null;

  return (
    <div 
      ref={messagesContainerRef}
      style={{
        flex: 1, overflowY: 'auto',
        padding: '14px 12px',
        display: 'flex', flexDirection: 'column',
      }}
    >
      {messages.map(msg => (
        <MessageBubble
          key={msg.id}
          msg={msg}
          onApplySuggestion={onApplySuggestion}
          hasSelection={!!selectedText}
          onUpdateDiffState={onUpdateDiffState}
          onApplyInsertSuggestion={onApplyInsertSuggestion}
          onUpdateInsertSuggestionStatus={onUpdateInsertSuggestionStatus}
          blocks={blocks}
          onScrollToBlock={onScrollToBlock}
          isWhiteTheme={isWhiteTheme}
        />
      ))}
      <div ref={messagesEndRef} />
    </div>
  );
}

