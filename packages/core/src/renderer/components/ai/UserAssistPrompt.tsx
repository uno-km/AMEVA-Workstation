import React, { useState } from 'react';
import { useAIState } from '../../stores/useAIState';
import { ShieldAlert, CheckCircle2, XCircle, RotateCcw, AlertTriangle } from 'lucide-react';
import type { UserAssistRequest, UserAssistOption } from '../../services/ai/orchestrator/task-runtime/assist/UserAssistRuntime';

/**
 * 사용자 개입(User Assist)을 요청하는 프롬프트 모달/인라인 컴포넌트
 */
export function UserAssistPrompt() {
  const { userAssistRequests, setUserAssistRequests } = useAIState();
  const [submittingId, setSubmittingId] = useState<string | null>(null);

  // 진행 중인 요청 중 하나만 표시
  const activeRequest = userAssistRequests.find(r => r.status === 'PENDING');

  if (!activeRequest) {
    return null;
  }

  const handleResponse = async (option: UserAssistOption) => {
    setSubmittingId(activeRequest.requestId);
    try {
      // MissionExecutionRuntime의 UserAssistRuntime을 가져와야 하지만, 
      // 현재 아키텍처에서는 ipc나 Event bus를 사용하거나 전역 메서드를 호출해야 할 수 있음.
      // 간단히 이벤트를 dispatch하여 Orchestrator가 처리하게 함.
      window.dispatchEvent(new CustomEvent('ameva:user-assist-response', {
        detail: {
          requestId: activeRequest.requestId,
          selectedOption: option
        }
      }));
      
      // UI 상에서 즉각 낙관적 업데이트
      setUserAssistRequests(userAssistRequests.map(r => 
        r.requestId === activeRequest.requestId ? { ...r, status: 'RESPONDED' } : r
      ));
    } catch (e) {
      console.error('UserAssist response failed:', e);
    } finally {
      setSubmittingId(null);
    }
  };

  const hasProposedPlan = !!activeRequest.proposedPlan;

  return (
    <div style={{
      position: 'relative',
      margin: '12px',
      padding: '16px',
      background: 'var(--bg-card, #1e1e2e)',
      border: '1px solid rgba(239, 68, 68, 0.4)',
      borderRadius: '8px',
      boxShadow: '0 4px 12px rgba(239, 68, 68, 0.1)',
      color: 'var(--text-main, #e0e0e0)',
      display: 'flex',
      flexDirection: 'column',
      gap: '12px'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#f87171' }}>
        <ShieldAlert size={20} />
        <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 'bold' }}>{activeRequest.title}</h3>
      </div>

      <div style={{ fontSize: '12px', lineHeight: '1.5' }}>
        <p style={{ margin: '0 0 8px 0' }}>{activeRequest.summary}</p>
        <div style={{ background: 'rgba(255,255,255,0.05)', padding: '8px', borderRadius: '4px' }}>
          <strong>실패 사유:</strong><br/>
          <span style={{ color: '#fca5a5' }}>{activeRequest.failureReason}</span>
        </div>
      </div>

      {hasProposedPlan && (
        <div style={{
          marginTop: '8px',
          padding: '12px',
          background: 'rgba(139, 92, 246, 0.1)',
          border: '1px solid rgba(139, 92, 246, 0.3)',
          borderRadius: '6px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#c084fc', marginBottom: '8px', fontWeight: 'bold', fontSize: '13px' }}>
            <AlertTriangle size={16} /> AI 자아성찰 및 복구 계획 제안
          </div>
          <div style={{ fontSize: '12px', marginBottom: '8px' }}>
            <strong style={{ color: '#e9d5ff' }}>분석 (Analysis):</strong>
            <p style={{ margin: '4px 0 0 0', whiteSpace: 'pre-wrap' }}>{activeRequest.proposedPlan!.analysis}</p>
          </div>
          <div style={{ fontSize: '12px' }}>
            <strong style={{ color: '#e9d5ff' }}>제안 액션 (Proposed Action):</strong>
            <p style={{ margin: '4px 0 0 0', whiteSpace: 'pre-wrap', color: '#a78bfa' }}>{activeRequest.proposedPlan!.proposedAction}</p>
          </div>

          <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
            <button
              onClick={() => handleResponse('ACCEPT_PROPOSED_PLAN')}
              disabled={submittingId !== null}
              style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                padding: '8px', background: 'var(--primary, #8b5cf6)', color: '#fff',
                border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold'
              }}
            >
              <CheckCircle2 size={16} /> 계획 승인 (진행)
            </button>
            <button
              onClick={() => handleResponse('DISAGREE_AND_REPLAN')}
              disabled={submittingId !== null}
              style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                padding: '8px', background: 'rgba(255,255,255,0.1)', color: 'var(--text-main)',
                border: '1px solid rgba(255,255,255,0.2)', borderRadius: '4px', cursor: 'pointer'
              }}
            >
              <XCircle size={16} /> 거절 (다른 방법)
            </button>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: '8px', marginTop: hasProposedPlan ? '0' : '8px', flexWrap: 'wrap' }}>
        {!hasProposedPlan && activeRequest.options.includes('RETRY_SAME_STRATEGY') && (
          <button
            onClick={() => handleResponse('RETRY_SAME_STRATEGY')}
            style={{ padding: '6px 10px', fontSize: '11px', cursor: 'pointer', background: 'rgba(255,255,255,0.1)', color: '#fff', border: 'none', borderRadius: '4px' }}
          >
            동일 전략으로 재시도
          </button>
        )}
        {!hasProposedPlan && activeRequest.options.includes('RESUME_FROM_CHECKPOINT') && (
          <button
            onClick={() => handleResponse('RESUME_FROM_CHECKPOINT')}
            style={{ padding: '6px 10px', fontSize: '11px', cursor: 'pointer', background: 'rgba(59, 130, 246, 0.2)', color: '#93c5fd', border: '1px solid rgba(59, 130, 246, 0.5)', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}
          >
            <RotateCcw size={12} /> 체크포인트로 복원
          </button>
        )}
        <button
          onClick={() => handleResponse('CANCEL_MISSION')}
          style={{ padding: '6px 10px', fontSize: '11px', cursor: 'pointer', background: 'rgba(239, 68, 68, 0.1)', color: '#fca5a5', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '4px', marginLeft: 'auto' }}
        >
          미션 취소
        </button>
      </div>
    </div>
  );
}
