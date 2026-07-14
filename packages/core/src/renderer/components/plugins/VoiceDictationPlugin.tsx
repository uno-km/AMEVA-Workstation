import React, { useState } from 'react';
import { Mic, MicOff, FileText, CheckCircle2 } from 'lucide-react';
import { useLLMInference } from '../../hooks/ai/useLLMInference';

export function VoiceDictationPlugin() {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const { generate } = useLLMInference();

  const toggleRecording = () => {
    if (isRecording) {
      setIsRecording(false);
      setIsProcessing(true);
      
      const rawText = '이 프로젝트의 마켓플레이스 기능은 10개로 기획되었고, 모두 로컬 오프라인 엣지 환경에서 구동 가능하도록 설계되어야 합니다. React 상태 관리 이슈는 다음 스프린트에서 해결합시다.';
      setTranscript('');
      
      generate(
        `다음 회의 내용을 마크다운 형태로 요약해줘:\n\n${rawText}`,
        (token) => {
          setTranscript(prev => prev + token);
        },
        'You are a helpful assistant that summarizes meeting notes in markdown.'
      ).then(() => {
        setIsProcessing(false);
      }).catch(err => {
        setTranscript(`[오류 발생] ${err.message}`);
        setIsProcessing(false);
      });
    } else {
      setIsRecording(true);
      setTranscript('');
    }
  };

  const handleInsert = () => {
    alert('에디터에 회의록이 삽입되었습니다!');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'transparent', padding: '2px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', padding: '0 8px' }}>
        <div style={{ background: 'linear-gradient(135deg, #14b8a6, #0d9488)', padding: '8px', borderRadius: '8px' }}>
          <Mic size={18} color="#fff" />
        </div>
        <div>
          <h2 style={{ fontSize: '16px', fontWeight: 'bold', margin: 0 }}>Voice & Meeting</h2>
          <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: 0 }}>음성 인식 및 회의록 요약</p>
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '12px', margin: '0 8px 8px' }}>
        <div style={{ background: '#1e1e24', borderRadius: '12px', border: '1px solid var(--border-muted)', padding: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <button onClick={toggleRecording} style={{ background: isRecording ? 'rgba(239,68,68,0.2)' : 'var(--bg-glass)', border: `2px solid ${isRecording ? '#ef4444' : 'var(--border-muted)'}`, color: isRecording ? '#ef4444' : 'var(--text-main)', width: '64px', height: '64px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.2s', marginBottom: '16px' }}>
            {isRecording ? <MicOff size={28} /> : <Mic size={28} />}
          </button>
          {isRecording ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#ef4444', animation: 'pulse 1s infinite' }} />
              <span style={{ fontSize: '12px', color: '#ef4444', fontWeight: 'bold' }}>음성 듣는 중...</span>
            </div>
          ) : isProcessing ? (
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>AI 요약 중...</span>
          ) : (
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>버튼을 눌러 녹음을 시작하세요</span>
          )}
          <style>{`@keyframes pulse { 0% { opacity: 1; } 50% { opacity: 0.5; } 100% { opacity: 1; } }`}</style>
        </div>

        <div style={{ flex: 1, background: '#1e1e24', borderRadius: '12px', border: '1px solid var(--border-muted)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ padding: '8px 12px', background: 'rgba(0,0,0,0.2)', borderBottom: '1px solid var(--border-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <FileText size={12} color="var(--text-muted)" />
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Transcript & Summary</span>
          </div>
          <div style={{ flex: 1, padding: '16px', fontSize: '13px', lineHeight: '1.6', color: 'var(--text-main)', overflowY: 'auto' }}>
            {transcript ? (
              <div style={{ color: 'var(--text-main)', fontSize: '13px' }}>
                <div style={{ marginBottom: '16px', whiteSpace: 'pre-wrap' }}>
                  {transcript}
                </div>
              </div>
            ) : isProcessing ? (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', color: 'var(--text-muted)', fontSize: '12px' }}>AI 요약 생성 중...</div>
            ) : (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', color: 'var(--text-muted)', fontSize: '12px' }}>녹음이 완료되면 요약이 생성됩니다.</div>
            )}
          </div>
          {transcript && (
            <div style={{ padding: '12px', borderTop: '1px solid var(--border-muted)', background: 'rgba(0,0,0,0.2)' }}>
              <button onClick={handleInsert} style={{ width: '100%', background: '#14b8a6', color: '#fff', border: 'none', padding: '10px', borderRadius: '8px', fontSize: '12px', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', cursor: 'pointer' }}>
                <CheckCircle2 size={14}/> 에디터에 삽입하기
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
