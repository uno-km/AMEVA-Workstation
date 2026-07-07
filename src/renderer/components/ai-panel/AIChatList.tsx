import React from 'react';
import type { AIMessage } from '../../hooks/useAI';
import { MessageBubble } from './chat-list/MessageBubble';

/**
 * AIChatList 컴포넌트 Props 스키마
 */
interface AIChatListProps {
  messages: AIMessage[];
  messagesContainerRef: React.RefObject<HTMLDivElement>;
  messagesEndRef: React.RefObject<HTMLDivElement>;
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
