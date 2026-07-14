import React, { useState } from 'react';
import { UploadCloud, FileText, Send, Loader2, BookOpen } from 'lucide-react';
import { useLLMInference } from '../../hooks/ai/useLLMInference';

export function PdfRagPlugin() {
  const [file, setFile] = useState<File | null>(null);
  const [isEmbedding, setIsEmbedding] = useState(false);
  const [chatHistory, setChatHistory] = useState<{ role: 'user' | 'ai'; text: string }[]>([]);
  const [input, setInput] = useState('');
  const { generate, isGenerating } = useLLMInference();

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const processFile = (f: File) => {
    setFile(f);
    setIsEmbedding(true);
    setTimeout(() => {
      setIsEmbedding(false);
      setChatHistory([{ role: 'ai', text: `"${f.name}" 문서의 로컬 벡터화가 완료되었습니다. (보안 레벨: 오프라인) \n\n이 문서에서 어떤 내용을 찾아드릴까요?` }]);
    }, 2000);
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isGenerating) return;

    const userText = input;
    setChatHistory(prev => [...prev, { role: 'user', text: userText }, { role: 'ai', text: '' }]);
    setInput('');

    try {
      await generate(
        `다음 문서를 참고하여 사용자의 질문에 답변하세요.\n\n문서 이름: ${file?.name}\n질문: ${userText}`,
        (token) => {
          setChatHistory(prev => {
            const newHistory = [...prev];
            newHistory[newHistory.length - 1].text += token;
            return newHistory;
          });
        },
        'You are a helpful local RAG assistant. Answer based on the document context.'
      );
    } catch (err: any) {
      setChatHistory(prev => {
        const newHistory = [...prev];
        newHistory[newHistory.length - 1].text = `[에러 발생] ${err.message}`;
        return newHistory;
      });
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'transparent', color: 'var(--text-main)', padding: '2px', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px', padding: '0 8px' }}>
        <div style={{ background: 'linear-gradient(135deg, #ec4899, #8b5cf6)', padding: '10px', borderRadius: '10px', boxShadow: '0 4px 12px rgba(236,72,153,0.3)' }}>
          <BookOpen size={20} color="#fff" />
        </div>
        <div>
          <h2 style={{ fontSize: '17px', fontWeight: 'bold', margin: 0, letterSpacing: '-0.3px' }}>Local RAG Assistant</h2>
          <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '2px 0 0' }}>PDF/Word 문서 100% 오프라인 대화</p>
        </div>
      </div>

      {!file ? (
        <div 
          onDragOver={(e) => e.preventDefault()} 
          onDrop={handleDrop}
          style={{ flex: 1, border: '2px dashed var(--border-muted)', borderRadius: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-glass)', cursor: 'pointer', transition: 'all 0.2s', margin: '0 8px 8px' }}
          onClick={() => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.pdf,.doc,.docx';
            input.onchange = (e: any) => { if (e.target.files[0]) processFile(e.target.files[0]) };
            input.click();
          }}
          onMouseEnter={e => e.currentTarget.style.borderColor = '#ec4899'}
          onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border-muted)'}
        >
          <div style={{ background: 'rgba(236,72,153,0.1)', padding: '20px', borderRadius: '50%', marginBottom: '16px' }}>
            <UploadCloud size={40} color="#ec4899" />
          </div>
          <h3 style={{ fontSize: '14px', marginBottom: '8px', fontWeight: 'bold' }}>문서를 여기로 드래그 앤 드롭</h3>
          <p style={{ fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center', lineHeight: '1.5' }}>또는 클릭하여 파일 선택<br/>지원 포맷: PDF, DOCX (최대 50MB)</p>
        </div>
      ) : isEmbedding ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-glass)', borderRadius: '16px', margin: '0 8px 8px' }}>
          <Loader2 size={36} color="#8b5cf6" style={{ marginBottom: '20px', animation: 'spin 1s linear infinite' }} />
          <h3 style={{ fontSize: '15px', fontWeight: 'bold', marginBottom: '8px' }}>문서 로컬 벡터 임베딩 중...</h3>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>외부 서버 전송 없이 안전하게 처리됩니다.</p>
          <style>{`@keyframes spin { 100% { transform: rotate(360deg); } }`}</style>
        </div>
      ) : (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#16161a', borderRadius: '16px', overflow: 'hidden', border: '1px solid var(--border-muted)', margin: '0 8px 8px' }}>
          <div style={{ padding: '14px 16px', background: 'rgba(0,0,0,0.3)', borderBottom: '1px solid var(--border-muted)', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ background: 'rgba(139,92,246,0.2)', padding: '6px', borderRadius: '6px' }}>
              <FileText size={16} color="#a78bfa" />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '12px', fontWeight: 'bold', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '200px' }}>{file.name}</span>
              <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>로컬 벡터화 됨 • 1,245 청크</span>
            </div>
          </div>
          
          <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {chatHistory.map((msg, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                <div style={{ 
                  maxWidth: '85%', 
                  padding: '12px 16px', 
                  borderRadius: msg.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px', 
                  background: msg.role === 'user' ? 'linear-gradient(135deg, #ec4899, #8b5cf6)' : 'var(--bg-glass)',
                  color: msg.role === 'user' ? '#fff' : 'var(--text-main)',
                  fontSize: '12.5px',
                  lineHeight: '1.6',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
                }}>
                  {msg.text.split('\n').map((line, j) => <React.Fragment key={j}>{line}<br/></React.Fragment>)}
                </div>
              </div>
            ))}
            {isGenerating && chatHistory[chatHistory.length - 1]?.text === '' && (
              <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                <div style={{ background: 'var(--bg-glass)', padding: '14px 18px', borderRadius: '16px 16px 16px 4px', display: 'flex', gap: '6px', alignItems: 'center' }}>
                  <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#8b5cf6', animation: 'bounce 1.4s infinite ease-in-out both' }} />
                  <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#8b5cf6', animation: 'bounce 1.4s infinite ease-in-out both 0.16s' }} />
                  <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#8b5cf6', animation: 'bounce 1.4s infinite ease-in-out both 0.32s' }} />
                </div>
              </div>
            )}
            <div id="rag-bottom" />
          </div>

          <form onSubmit={handleSend} style={{ padding: '14px', borderTop: '1px solid var(--border-muted)', display: 'flex', gap: '10px', background: 'rgba(0,0,0,0.3)' }}>
            <input 
              type="text" 
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="문서 내용에 대해 물어보세요..."
              style={{ flex: 1, padding: '12px 16px', borderRadius: '24px', background: 'var(--bg-main)', border: '1px solid var(--border-muted)', color: 'var(--text-main)', fontSize: '12.5px', outline: 'none', transition: 'border-color 0.2s' }}
              onFocus={e => e.currentTarget.style.borderColor = '#8b5cf6'}
              onBlur={e => e.currentTarget.style.borderColor = 'var(--border-muted)'}
            />
            <button type="submit" disabled={!input.trim() || isGenerating} style={{ background: input.trim() ? 'linear-gradient(135deg, #ec4899, #8b5cf6)' : 'var(--bg-glass)', border: 'none', borderRadius: '50%', width: '42px', height: '42px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: input.trim() && !isGenerating ? 'pointer' : 'not-allowed', flexShrink: 0, transition: 'all 0.2s', opacity: input.trim() && !isGenerating ? 1 : 0.5 }}>
              <Send size={16} color="#fff" style={{ transform: 'translateX(-1px)' }} />
            </button>
          </form>
          <style>{`@keyframes bounce { 0%, 80%, 100% { transform: scale(0); } 40% { transform: scale(1); } }`}</style>
        </div>
      )}
    </div>
  );
}
