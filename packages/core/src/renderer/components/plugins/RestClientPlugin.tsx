import React, { useState } from 'react';
import { Server, Send, Code, Copy, CheckCircle2 } from 'lucide-react';

export function RestClientPlugin() {
  const [method, setMethod] = useState('GET');
  const [url, setUrl] = useState('https://jsonplaceholder.typicode.com/users/1');
  const [response, setResponse] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSend = () => {
    if (!url) return;
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      setResponse(JSON.stringify({
        id: 1,
        name: "Leanne Graham",
        username: "Bret",
        email: "Sincere@april.biz",
        address: {
          street: "Kulas Light",
          suite: "Apt. 556",
          city: "Gwenborough",
          zipcode: "92998-3874"
        }
      }, null, 2));
    }, 600);
  };

  const handleInsert = () => {
    alert('에디터에 응답 JSON이 삽입되었습니다!');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'transparent', padding: '2px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', padding: '0 8px' }}>
        <div style={{ background: 'linear-gradient(135deg, #8b5cf6, #6366f1)', padding: '8px', borderRadius: '8px' }}>
          <Server size={18} color="#fff" />
        </div>
        <div>
          <h2 style={{ fontSize: '16px', fontWeight: 'bold', margin: 0 }}>REST Client</h2>
          <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: 0 }}>API 호출 및 응답 마크다운 변환</p>
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '12px', margin: '0 8px 8px' }}>
        <div style={{ background: '#1e1e24', borderRadius: '12px', border: '1px solid var(--border-muted)', padding: '12px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', gap: '8px' }}>
            <select value={method} onChange={e => setMethod(e.target.value)} style={{ background: 'var(--bg-glass)', color: '#8b5cf6', border: '1px solid var(--border-muted)', borderRadius: '6px', padding: '6px 10px', fontSize: '12px', fontWeight: 'bold', outline: 'none' }}>
              <option value="GET">GET</option>
              <option value="POST">POST</option>
              <option value="PUT">PUT</option>
              <option value="DELETE">DELETE</option>
            </select>
            <input 
              type="text" 
              value={url} 
              onChange={e => setUrl(e.target.value)} 
              placeholder="https://api.example.com/v1/..."
              style={{ flex: 1, background: 'var(--bg-glass)', color: 'var(--text-main)', border: '1px solid var(--border-muted)', borderRadius: '6px', padding: '6px 12px', fontSize: '12px', outline: 'none' }}
            />
          </div>
          <button onClick={handleSend} disabled={isLoading || !url} style={{ width: '100%', background: 'linear-gradient(135deg, #8b5cf6, #6366f1)', color: '#fff', border: 'none', padding: '10px', borderRadius: '8px', fontSize: '12px', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', cursor: (isLoading || !url) ? 'not-allowed' : 'pointer', opacity: (isLoading || !url) ? 0.6 : 1 }}>
            {isLoading ? '전송 중...' : <><Send size={14}/> 요청 보내기</>}
          </button>
        </div>

        <div style={{ flex: 1, background: '#1e1e24', borderRadius: '12px', border: '1px solid var(--border-muted)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ padding: '8px 12px', background: 'rgba(0,0,0,0.2)', borderBottom: '1px solid var(--border-muted)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}><Code size={12}/> Response</span>
            {response && <span style={{ fontSize: '10px', color: '#10b981', background: 'rgba(16,185,129,0.1)', padding: '2px 6px', borderRadius: '4px' }}>200 OK</span>}
          </div>
          <div style={{ flex: 1, padding: '12px', overflow: 'auto', background: '#0d0d12' }}>
            {response ? (
              <pre style={{ margin: 0, color: '#e2e8f0', fontSize: '11px', fontFamily: 'monospace' }}>{response}</pre>
            ) : (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', color: 'var(--text-muted)', fontSize: '12px' }}>응답이 여기에 표시됩니다.</div>
            )}
          </div>
          {response && (
            <div style={{ padding: '12px', borderTop: '1px solid var(--border-muted)', background: 'rgba(0,0,0,0.2)' }}>
              <button onClick={handleInsert} style={{ width: '100%', background: 'var(--bg-glass)', color: 'var(--text-main)', border: '1px solid var(--border-muted)', padding: '8px', borderRadius: '8px', fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', cursor: 'pointer' }}>
                <CheckCircle2 size={14}/> 에디터에 JSON 삽입
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
