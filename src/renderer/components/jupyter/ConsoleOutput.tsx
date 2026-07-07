import React from 'react'
import { Terminal } from 'lucide-react'

interface ConsoleOutputProps {
  success: boolean | null
  resolvedLanguage: string
  tableData: any
  outputLines: { type: 'stdout' | 'stderr' | 'info'; text: string }[]
  accentColor: string
}

export function ConsoleOutput({
  success,
  resolvedLanguage,
  tableData,
  outputLines,
  accentColor
}: ConsoleOutputProps) {
  return (
    <div style={{
      background: '#0a0b10',
      borderTop: `1px solid ${accentColor}22`,
      fontFamily: 'Consolas, Monaco, monospace',
      fontSize: '12px',
      textAlign: 'left',
      boxSizing: 'border-box',
      borderRadius: '0 0 8px 8px',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '6px 14px', background: '#0e1017', borderBottom: '1px solid rgba(255,255,255,0.05)',
        userSelect: 'none'
      }}>
        <span style={{ color: 'var(--text-muted)', fontSize: '10px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '5px' }}>
          <Terminal size={11} />
          _ OUTPUT
        </span>
        {success !== null && (
          <span style={{
            color: success ? '#10b981' : '#f43f5e',
            background: success ? 'rgba(16,185,129,0.1)' : 'rgba(244,63,94,0.1)',
            border: `1px solid ${success ? '#10b98133' : '#f43f5e33'}`,
            padding: '1px 6px', borderRadius: '3px', fontSize: '9px', fontWeight: 'bold'
          }}>
            {success ? 'EXIT 0' : 'EXIT 1'}
          </span>
        )}
      </div>
      <div style={{
        padding: '12px 16px', maxHeight: '200px', overflowY: 'auto',
        color: '#e5e7eb',
        lineHeight: '1.5'
      }}>
        {resolvedLanguage === 'sql' && success && tableData ? (
          <table style={{ width: '100%', borderCollapse: 'collapse', color: '#e5e7eb', textAlign: 'left', fontSize: '12px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.03)' }}>
                {tableData.columns.map((col: string, i: number) => (
                  <th key={i} style={{ padding: '6px 10px', fontWeight: 'bold', color: '#a78bfa' }}>{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tableData.values.map((row: any[], ri: number) => (
                <tr key={ri} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  {row.map((val: any, ci: number) => (
                    <td key={ci} style={{ padding: '6px 10px', fontFamily: 'monospace' }}>{val !== null ? String(val) : <span style={{color:'#6b7280', fontStyle:'italic'}}>NULL</span>}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', fontFamily: 'monospace' }}>
            {outputLines.map((line, idx) => (
              <div
                key={idx}
                style={{
                  color: line.type === 'stderr' ? '#f87171' : line.type === 'info' ? `${accentColor}cc` : '#e5e7eb',
                  marginBottom: '2px',
                }}
              >
                {line.text}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
