import React, { useState } from 'react';
import { Database, Play, Table, Code } from 'lucide-react';

export function DatabaseExplorerPlugin() {
  const [query, setQuery] = useState('SELECT * FROM users LIMIT 10;');
  const [result, setResult] = useState<any[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleRun = () => {
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      setResult([
        { id: 1, name: 'Alice', role: 'Admin', created_at: '2026-01-01' },
        { id: 2, name: 'Bob', role: 'User', created_at: '2026-02-15' },
        { id: 3, name: 'Charlie', role: 'Editor', created_at: '2026-03-20' },
      ]);
    }, 800);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'transparent', padding: '2px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', padding: '0 8px' }}>
        <div style={{ background: 'linear-gradient(135deg, #3b82f6, #0ea5e9)', padding: '8px', borderRadius: '8px' }}>
          <Database size={18} color="#fff" />
        </div>
        <div>
          <h2 style={{ fontSize: '16px', fontWeight: 'bold', margin: 0 }}>DB Explorer</h2>
          <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: 0 }}>로컬 데이터베이스 연결 & 쿼리</p>
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '12px', margin: '0 8px 8px' }}>
        <div style={{ background: '#1e1e24', borderRadius: '12px', border: '1px solid var(--border-muted)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '8px 12px', background: 'rgba(0,0,0,0.2)', borderBottom: '1px solid var(--border-muted)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}><Code size={12}/> SQL Query</span>
            <button onClick={handleRun} style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(59,130,246,0.2)', border: '1px solid rgba(59,130,246,0.3)', color: '#60a5fa', padding: '4px 10px', borderRadius: '6px', fontSize: '11px', cursor: 'pointer' }}>
              <Play size={10} /> 실행
            </button>
          </div>
          <textarea
            value={query}
            onChange={e => setQuery(e.target.value)}
            style={{ width: '100%', height: '120px', background: 'transparent', border: 'none', padding: '12px', color: '#e2e8f0', fontFamily: 'monospace', fontSize: '12px', outline: 'none', resize: 'none' }}
          />
        </div>

        <div style={{ flex: 1, background: '#1e1e24', borderRadius: '12px', border: '1px solid var(--border-muted)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ padding: '8px 12px', background: 'rgba(0,0,0,0.2)', borderBottom: '1px solid var(--border-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Table size={12} color="var(--text-muted)" />
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Query Result</span>
          </div>
          <div style={{ flex: 1, padding: '12px', overflow: 'auto' }}>
            {isLoading ? (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', color: 'var(--text-muted)', fontSize: '12px' }}>Executing...</div>
            ) : result ? (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-muted)' }}>
                    {Object.keys(result[0]).map(k => <th key={k} style={{ padding: '6px 8px', color: '#94a3b8' }}>{k}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {result.map((row, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      {Object.values(row).map((v: any, j) => <td key={j} style={{ padding: '6px 8px', color: 'var(--text-main)' }}>{v}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', color: 'var(--text-muted)', fontSize: '12px' }}>결과가 여기에 표시됩니다.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
