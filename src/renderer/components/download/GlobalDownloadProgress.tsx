import React, { useState } from 'react'
import { Download, CheckCircle, XCircle, Loader2 } from 'lucide-react'
import { useProcessStore } from '../../stores/useProcessStore'
import type { DownloadQueueItem } from '../../hooks/app/useDownloadManager'

function formatBytes(bytes: number = 0): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

export function GlobalDownloadProgress() {
  const downloadQueue = useProcessStore(state => state.downloadQueue)
  const clearCompletedDownloads = useProcessStore(state => state.clearCompletedDownloads)
  const [isHovered, setIsHovered] = useState(false)

  // 진행 중이거나 대기 중인 항목
  const activeDownloads = downloadQueue.filter((q: DownloadQueueItem) => q.status !== 'completed' && q.status !== 'error')
  const completedOrError = downloadQueue.filter((q: DownloadQueueItem) => q.status === 'completed' || q.status === 'error')
  
  if (downloadQueue.length === 0) return null

  const currentActive = downloadQueue.find((q: DownloadQueueItem) => q.status === 'downloading')
  const isAllDone = activeDownloads.length === 0

  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        position: 'fixed',
        bottom: '46px',
        right: '20px',
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
      }}
    >
      {/* 팝업 오버레이 (Hover 시 노출) */}
      {isHovered && (
        <div style={{
          marginBottom: '10px',
          background: 'rgba(5, 5, 10, 0.95)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(139, 92, 246, 0.3)',
          borderRadius: '12px',
          width: '320px',
          boxShadow: '0 10px 40px rgba(0,0,0,0.5)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          animation: 'slideUp 0.2s ease-out'
        }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Download size={14} /> 다운로드 매니저
            </span>
            {completedOrError.length > 0 && (
              <button
                onClick={clearCompletedDownloads}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: '10px', cursor: 'pointer', padding: '2px 6px' }}
              >
                기록 지우기
              </button>
            )}
          </div>
          <div style={{ padding: '8px', display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '250px', overflowY: 'auto' }}>
            {downloadQueue.map((item: DownloadQueueItem, idx: number) => (
              <div key={item.id} style={{
                padding: '10px 12px', borderRadius: '8px', background: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column', gap: '6px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {idx + 1}. {item.filename}
                  </span>
                  {item.status === 'downloading' && <Loader2 size={12} className="animate-spin text-primary" />}
                  {item.status === 'completed' && <CheckCircle size={12} style={{ color: '#34d399' }} />}
                  {item.status === 'error' && <XCircle size={12} style={{ color: '#ef4444' }} />}
                  {item.status === 'pending' && <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>대기 중</span>}
                </div>
                
                {item.status === 'downloading' && (
                  <>
                    <div style={{ width: '100%', height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', overflow: 'hidden' }}>
                      <div style={{ width: `${item.progress || 0}%`, height: '100%', background: 'var(--primary)', transition: 'width 0.2s' }} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9.5px', color: 'var(--text-muted)' }}>
                      <span>{formatBytes(item.speed ? item.speed * 1024 * 1024 : 0)}/s</span>
                      <span>{item.progress} %</span>
                    </div>
                  </>
                )}
                {item.status === 'error' && (
                  <span style={{ fontSize: '10px', color: '#ef4444' }}>{item.error}</span>
                )}
                {(item.status === 'pending' || item.status === 'completed') && item.sizeBytes ? (
                  <span style={{ fontSize: '9.5px', color: 'var(--text-muted)' }}>{formatBytes(item.sizeBytes)}</span>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 축소된 상태의 배지 바 */}
      <div style={{
        background: isAllDone ? 'rgba(52, 211, 153, 0.15)' : 'rgba(139, 92, 246, 0.15)',
        border: `1px solid ${isAllDone ? 'rgba(52, 211, 153, 0.4)' : 'rgba(139, 92, 246, 0.4)'}`,
        backdropFilter: 'blur(10px)',
        padding: '8px 14px',
        borderRadius: '20px',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        cursor: 'pointer',
        boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
        transition: 'all 0.2s ease',
      }}>
        {isAllDone ? (
          <>
            <CheckCircle size={14} style={{ color: '#34d399' }} />
            <span style={{ fontSize: '11px', fontWeight: 600, color: '#34d399' }}>다운로드 완료</span>
          </>
        ) : (
          <>
            <Loader2 size={14} className="animate-spin" style={{ color: 'var(--primary)' }} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: '120px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', fontWeight: 600, color: 'var(--text-main)' }}>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '80px' }}>
                  {currentActive?.filename || '대기 중...'}
                </span>
                <span>{currentActive?.progress || 0}%</span>
              </div>
              <div style={{ width: '100%', height: '3px', background: 'rgba(255,255,255,0.1)', borderRadius: '1.5px', overflow: 'hidden' }}>
                <div style={{ width: `${currentActive?.progress || 0}%`, height: '100%', background: 'var(--primary)', transition: 'width 0.2s' }} />
              </div>
            </div>
            <span style={{ fontSize: '9px', fontWeight: 700, color: 'var(--text-muted)', background: 'rgba(255,255,255,0.1)', padding: '2px 6px', borderRadius: '10px' }}>
              대기 {activeDownloads.length - (currentActive ? 1 : 0)}건
            </span>
          </>
        )}
      </div>
    </div>
  )
}
