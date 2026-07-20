import React, { useState, useEffect, useRef } from 'react';
import { useAIState } from '../../stores/useAIState';
import { ExecutionTraceViewModel, type TimelineCard } from '../../services/ai/orchestrator/task-runtime/trace/ExecutionTraceViewModel';
import { Terminal, Shield, FileText, CheckCircle, RefreshCw, Layers, ChevronDown, ChevronRight, Activity, Eye } from 'lucide-react';

export function ExecutionTraceTimeline() {
  const executionTraceEvents = useAIState((s) => s.executionTraceEvents) || [];
  const [isExpanded, setIsExpanded] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isExpanded && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [executionTraceEvents.length, isExpanded]);

  if (executionTraceEvents.length === 0) return null;

  // USER 가시성 이상의 Timeline Card 추출 (최신순 또는 순차)
  const timelineCards = ExecutionTraceViewModel.toTimelineEvents(executionTraceEvents, 'USER');
  if (timelineCards.length === 0) return null;

  const getIconForType = (type: TimelineCard['type']) => {
    switch (type) {
      case 'MISSION': return <Layers size={14} color="#a78bfa" />;
      case 'TASK': return <Activity size={14} color="#60a5fa" />;
      case 'TOOL': return <Terminal size={14} color="#f472b6" />;
      case 'ARTIFACT': return <FileText size={14} color="#34d399" />;
      case 'VERIFICATION': return <CheckCircle size={14} color="#facc15" />;
      case 'RETRY': return <RefreshCw size={14} color="#fb923c" />;
      case 'APPROVAL': return <Shield size={14} color="#ef4444" />;
      case 'DECISION': return <Activity size={14} color="#8b5cf6" />;
      default: return <Eye size={14} color="#9ca3af" />;
    }
  };

  const getStatusColor = (status?: string) => {
    if (!status) return '#9ca3af';
    if (['SUCCEEDED', 'COMMITTED', 'COMPLETED', 'GRANTED', 'PASS'].includes(status.toUpperCase())) return '#34d399';
    if (['FAILED', 'REJECTED', 'FAIL'].includes(status.toUpperCase())) return '#ef4444';
    if (['STARTED', 'RUNNING', 'PENDING', 'REQUESTED'].includes(status.toUpperCase())) return '#60a5fa';
    return '#fbbf24';
  };

  return (
    <div style={{
      marginTop: '10px',
      borderRadius: '8px',
      border: '1px solid rgba(255, 255, 255, 0.08)',
      background: 'rgba(0, 0, 0, 0.2)',
      overflow: 'hidden',
      fontFamily: 'Inter, system-ui, sans-serif'
    }}>
      <div 
        onClick={() => setIsExpanded(!isExpanded)}
        style={{
          padding: '8px 12px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          cursor: 'pointer',
          background: 'rgba(255, 255, 255, 0.03)',
          borderBottom: isExpanded ? '1px solid rgba(255, 255, 255, 0.05)' : 'none'
        }}
      >
        <Activity size={14} style={{ color: 'rgba(255, 255, 255, 0.7)' }} />
        <span style={{ fontSize: '11px', fontWeight: 600, color: 'rgba(255, 255, 255, 0.8)', flex: 1 }}>
          Execution Trace ({timelineCards.length} Events)
        </span>
        {isExpanded ? <ChevronDown size={14} color="rgba(255,255,255,0.4)" /> : <ChevronRight size={14} color="rgba(255,255,255,0.4)" />}
      </div>

      {isExpanded && (
        <div ref={scrollRef} style={{ padding: '8px', maxHeight: '300px', overflowY: 'auto' }}>
          {timelineCards.map((card, idx) => (
            <div key={card.id} style={{
              display: 'flex',
              gap: '8px',
              padding: '6px',
              borderRadius: '6px',
              borderLeft: `2px solid ${getStatusColor(card.status)}`,
              background: 'rgba(255, 255, 255, 0.02)',
              marginBottom: idx < timelineCards.length - 1 ? '4px' : '0'
            }}>
              <div style={{ paddingTop: '2px' }}>
                {getIconForType(card.type)}
              </div>
              <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                  <span style={{ 
                    fontSize: '11px', 
                    fontWeight: 600, 
                    color: 'rgba(255, 255, 255, 0.9)',
                    whiteSpace: 'nowrap',
                    textOverflow: 'ellipsis',
                    overflow: 'hidden'
                  }}>
                    {card.title}
                  </span>
                  <span style={{ 
                    fontSize: '9px', 
                    color: getStatusColor(card.status),
                    border: `1px solid ${getStatusColor(card.status)}40`,
                    padding: '1px 4px',
                    borderRadius: '4px',
                    background: `${getStatusColor(card.status)}15`
                  }}>
                    {card.status || 'INFO'}
                  </span>
                </div>
                {card.summary && (
                  <span style={{ fontSize: '10px', color: 'rgba(255, 255, 255, 0.6)', lineHeight: 1.4 }}>
                    {card.summary}
                  </span>
                )}
                
                {/* 승인 대기열 액션 버튼 */}
                {card.type === 'APPROVAL' && card.status === 'PENDING' && card.data?.approvalId && (
                  <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
                    <button
                      onClick={() => {
                        try {
                          require('../../services/ai/orchestrator/task-runtime/policy/ToolApprovalPolicy').ToolApprovalPolicy.resolveApproval(card.data.approvalId, 'APPROVED');
                        } catch(e) { console.error(e); }
                      }}
                      style={{
                        padding: '4px 10px',
                        borderRadius: '4px',
                        background: 'rgba(52, 211, 153, 0.2)',
                        border: '1px solid rgba(52, 211, 153, 0.4)',
                        color: '#34d399',
                        fontSize: '10px',
                        fontWeight: 600,
                        cursor: 'pointer'
                      }}
                    >
                      승인 (Approve)
                    </button>
                    <button
                      onClick={() => {
                        try {
                          require('../../services/ai/orchestrator/task-runtime/policy/ToolApprovalPolicy').ToolApprovalPolicy.resolveApproval(card.data.approvalId, 'REJECTED');
                        } catch(e) { console.error(e); }
                      }}
                      style={{
                        padding: '4px 10px',
                        borderRadius: '4px',
                        background: 'rgba(239, 68, 68, 0.2)',
                        border: '1px solid rgba(239, 68, 68, 0.4)',
                        color: '#ef4444',
                        fontSize: '10px',
                        fontWeight: 600,
                        cursor: 'pointer'
                      }}
                    >
                      거부 (Reject)
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
