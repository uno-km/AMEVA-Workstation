import React from 'react'
import { Terminal, AlertCircle, CheckCircle, Loader } from 'lucide-react'

interface CodeConsoleProps {
  outputs: string[]
  isRunning: boolean
  success?: boolean
  onClose: () => void
}

export function CodeConsole({ outputs, isRunning, success, onClose }: CodeConsoleProps) {
  return (
    <div
      className="glow-primary"
      style={{
        marginTop: '8px',
        backgroundColor: 'var(--term-bg)',
        border: '1px solid var(--term-border)',
        borderRadius: '6px',
        fontFamily: 'var(--font-mono)',
        fontSize: '12px',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.4)',
      }}
    >
      {/* 콘솔 헤더 */}
      <div
        style={{
          padding: '6px 12px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: 'rgba(255, 255, 255, 0.02)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--term-icon-color)' }}>
          <Terminal size={14} />
          <span>콘솔 출력 결과</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {isRunning ? (
            <span style={{ color: 'var(--secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Loader size={12} className="animate-spin" /> 실행 중...
            </span>
          ) : success === true ? (
            <span style={{ color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <CheckCircle size={12} /> 성공
            </span>
          ) : success === false ? (
            <span style={{ color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <AlertCircle size={12} /> 오류 발생
            </span>
          ) : null}
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              fontSize: '11px',
            }}
          >
            닫기
          </button>
        </div>
      </div>

      {/* 출력 결과 스크롤 영역 */}
      <div
        style={{
          padding: '10px 14px',
          maxHeight: '160px',
          overflowY: 'auto',
          color: 'var(--term-text)',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-all',
          lineHeight: '1.5',
        }}
      >
        {outputs.length === 0 ? (
          <span style={{ color: 'var(--text-dark)' }}>출력 결과가 없습니다. 코드를 실행해 보십시오.</span>
        ) : (
          outputs.map((line, idx) => {
            let color = 'var(--term-text)'
            if (line.includes('[ERROR]') || line.includes('[TIMEOUT ERROR]') || line.includes('[COMPILATION ERROR]') || line.includes('[RUNTIME ERROR]')) {
              color = 'var(--danger)'
            } else if (line.includes('[WARN]')) {
              color = '#f59e0b'
            }
            return (
              <div key={idx} style={{ color }}>
                {line}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
