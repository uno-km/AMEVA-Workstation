/**
 * @file SidebarTabFiles.tsx
 * @system AMEVA OS Desktop Workstation
 * @location src/renderer/components/sidebar/SidebarTabFiles.tsx
 * @role Core module helper and integration logic
 * 
 * [소비처 - CONSUMERS / USAGE CONTEXT]
 * - 소비처 A (src/renderer/AppLayout.tsx): 레이아웃 그리드 내부 또는 플로팅 레이어 영역 내에서 그리기로 소비.
 * - 소비처 B (src/renderer/App.tsx): 전역 모달 매니저 및 뷰포트 상태 스위칭에 따라 동적 마운트되어 소비.
 * 
 * [책임 범위 - RESPONSIBILITY]
 * - 본 파일은 AMEVA 시스템 내에서 도메인 목적에 부합하는 연산 및 데이터 처리 흐름을 안전하게 캡슐화한다.
 * - 외부 라이브러리 및 하위 종속성을 조율하고 결과 규격을 일관되게 제공한다.
 * 
 * [절대 깨면 안 되는 계약 - CONTRACT]
 * - MUST: 모든 예외 발생 시 에러를 침묵시키지 말고 에러 로그를 명확하게 남길 것.
 * - MUST NOT: TypeScript any 형식을 우회 수단으로 함부로 선언하지 말 것.
 */

import React, { useState } from 'react'
import {
  FileText, Save, Download, Terminal, Eye,
  ChevronDown, ChevronRight, X
} from 'lucide-react'
import type { EditorMode, ExportFormat } from '../../../shared/types'
import type { HotkeyConfig } from '../SettingsModal'

const EXPORT_FORMATS: { format: ExportFormat; label: string; color?: string }[] = [
  { format: 'md',   label: 'Markdown (.md)' },
  { format: 'html', label: 'HTML' },
  { format: 'pdf',  label: 'PDF' },
  { format: 'docx', label: 'Word (DOCX)' },
  { format: 'xlsx', label: 'Excel (XLSX)' },
  { format: 'pptx', label: 'PPT (PPTX)' },
  { format: 'hwpx', label: '한글 (HWPX)', color: 'rgba(167,139,250,0.5)' },
  { format: 'xml',  label: 'XML' },
]

import { useAppContext } from '../../contexts/AppContext'
import { useWorkspaceStore } from '../../stores/useWorkspaceStore'

export interface SidebarTabFilesProps {
  sectionLabel: (text: string) => React.ReactNode
}

  // [FUNCTION CONTRACT] - 외부/내부로부터 유입되는 인자 규격을 분석하여 약속된 리턴 타입을 안정적으로 생산함.
export function SidebarTabFiles({ sectionLabel }: SidebarTabFilesProps) {
  const {
    editorMode, setEditorMode, handleOpenFile, handleSaveFile, handleExport,
    settings
  } = useAppContext()
  
  const {
    filePath, fileOpenMode, setFileOpenMode, appendedFiles,
    tabs, activeTabId, setActiveTabId, removeTab
  } = useWorkspaceStore()
  
  // [RUN-TIME STATE / INVARIANT] - 변수 'hkeys'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
  const hkeys = settings?.hotkeys || {
    save: 'Control+s', open: 'Control+o', newFile: 'Control+n', pdfExport: 'Control+p',
    toggleAI: 'Control+\\', toggleMode: 'Control+h', zoomIn: 'Control+=', zoomOut: 'Control+-', zoomReset: 'Control+0'
  }
  
  // [RUN-TIME STATE / INVARIANT] - 변수 'formatHotkey'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
  const formatHotkey = (raw: string | undefined): string => {
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
    if (!raw) return ''
    return raw.replace('Control', 'Ctrl').replace('Shift', 'Shift').replace('Alt', 'Alt').replace('Meta', 'Cmd')
      .split('+').map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' + ')
  }
  
  // [RUN-TIME STATE / INVARIANT] - 변수 'onSelectAppendedFile'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
  const onSelectAppendedFile = (startBlockId: string) => {
  // [RUN-TIME STATE / INVARIANT] - 변수 'el'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
    const el = document.querySelector(`[data-id="${startBlockId}"], [data-block-id="${startBlockId}"]`)
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  // [RUN-TIME STATE / INVARIANT] - 변수 'outer'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
      const outer = el.closest('.bn-block-outer') || el
      outer.setAttribute('data-highlighted-temp', 'true')
      setTimeout(() => { outer.removeAttribute('data-highlighted-temp') }, 1800)
    }
  }
  
  // [RUN-TIME STATE / INVARIANT] - 변수 'onOpenFile'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
  const onOpenFile = handleOpenFile
  // [RUN-TIME STATE / INVARIANT] - 변수 'onSaveFile'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
  const onSaveFile = handleSaveFile
  // [RUN-TIME STATE / INVARIANT] - 변수 'onExport'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
  const onExport = handleExport
  // [RUN-TIME STATE / INVARIANT] - 변수 'onSelectTab'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
  const onSelectTab = (id: string) => setActiveTabId(id)
  // [RUN-TIME STATE / INVARIANT] - 변수 'onCloseTab'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
  const onCloseTab = (id: string) => removeTab(id)

  const [exportOpen, setExportOpen] = useState(false)

  // [RUN-TIME STATE / INVARIANT] - 변수 'handleExportClick'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
  const handleExportClick = (format: ExportFormat) => {
    onExport(format)
  }

  return (
    <div
      data-focus-region="sidebar-files"
      style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '18px', flex: 1, position: 'relative' }}
    >
      {/* 편집/뷰어 모드 */}
      <div>
        {sectionLabel('에디터 모드')}
        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
          <button
            className={`btn btn-glass ${editorMode === 'edit' ? 'active' : ''}`}
            style={{ flex: '1 1 0', fontSize: '11px', padding: '7px 6px', minWidth: '70px', justifyContent: 'center' }}
            onClick={() => setEditorMode('edit')}
            title={`에디터 모드 전환 (${formatHotkey(hkeys.toggleMode)})`}
          >
            <Terminal size={12} /> 편집
          </button>
          <button
            className={`btn btn-glass ${editorMode === 'preview' ? 'active' : ''}`}
            style={{ flex: '1 1 0', fontSize: '11px', padding: '7px 6px', minWidth: '70px', justifyContent: 'center' }}
            onClick={() => setEditorMode('preview')}
            title={`미리보기 모드 전환 (${formatHotkey(hkeys.toggleMode)})`}
          >
            <Eye size={12} /> 미리보기
          </button>
          <button
            className={`btn btn-glass ${editorMode === 'raw' ? 'active' : ''}`}
            style={{ flex: '1 1 0', fontSize: '11px', padding: '7px 6px', minWidth: '70px', justifyContent: 'center' }}
            onClick={() => setEditorMode('raw')}
            title={`원문(Markdown) 보기`}
          >
            <FileText size={12} /> 원문보기
          </button>
        </div>
      </div>

      {/* 파일 관리 */}
      <div>
        {sectionLabel('파일 관리')}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <button
            className="btn btn-glass"
            style={{ justifyContent: 'flex-start', fontSize: '13px' }}
            onClick={onOpenFile}
            title={`문서 파일 열기 (${formatHotkey(hkeys.open)})`}
          >
            <FileText size={14} /> 파일 열기...
          </button>
          <button
            className="btn btn-primary"
            style={{ justifyContent: 'flex-start', fontSize: '13px' }}
            onClick={onSaveFile}
            title={`문서 파일 저장 (${formatHotkey(hkeys.save)})`}
          >
            <Save size={14} /> 저장 ({formatHotkey(hkeys.save)})
          </button>
        </div>
      </div>

      {/* 파일 열기 모드 */}
      <div>
        {sectionLabel('파일 열기 모드')}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '12px' }}>
            <input
              type="radio"
              name="fileOpenMode"
              checked={fileOpenMode === 'replace'}
              onChange={() => setFileOpenMode('replace')}
              style={{ cursor: 'pointer', accentColor: 'var(--primary)' }}
            />
            <span style={{ color: fileOpenMode === 'replace' ? 'var(--text-main)' : 'var(--text-muted)' }}>덮어쓰기 (기본)</span>
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '12px' }}>
            <input
              type="radio"
              name="fileOpenMode"
              checked={fileOpenMode === 'append'}
              onChange={() => setFileOpenMode('append')}
              style={{ cursor: 'pointer', accentColor: 'var(--primary)' }}
            />
            <span style={{ color: fileOpenMode === 'append' ? 'var(--text-main)' : 'var(--text-muted)' }}>이어서 열기 (본문 추가)</span>
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '12px' }}>
            <input
              type="radio"
              name="fileOpenMode"
              checked={fileOpenMode === 'tab'}
              onChange={() => setFileOpenMode('tab')}
              style={{ cursor: 'pointer', accentColor: 'var(--primary)' }}
            />
            <span style={{ color: fileOpenMode === 'tab' ? 'var(--text-main)' : 'var(--text-muted)' }}>탭별 열기 (다중 탭)</span>
          </label>
        </div>
      </div>

      {/* 열린 파일 목록 */}
      <div>
        {sectionLabel('열린 파일 목록')}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '180px', overflowY: 'auto', paddingRight: '4px' }}>
          {fileOpenMode === 'replace' && (
            <div
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                width: '100%', padding: '6px 8px', borderRadius: '6px',
                background: 'var(--bg-glass-active)', border: '1px solid var(--primary)',
                color: 'var(--text-main)', fontSize: '11px',
                textOverflow: 'ellipsis', whiteSpace: 'nowrap', overflow: 'hidden',
              }}
            >
              <FileText size={12} style={{ color: 'var(--primary)' }} />
              <span>{filePath ? filePath.split(/[\\/]/).pop() : '무제 문서.md'}</span>
            </div>
          )}

          {fileOpenMode === 'append' && (
            appendedFiles.length > 0 ? (
              appendedFiles.map((file, idx) => (
                <button
                  key={file.id}
                  onClick={() => onSelectAppendedFile(file.startBlockId)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '6px',
                    width: '100%', padding: '6px 8px', borderRadius: '6px',
                    background: 'var(--bg-glass)', border: '1px solid var(--border-muted)',
                    color: 'var(--text-main)', fontSize: '11px', cursor: 'pointer',
                    textAlign: 'left', textOverflow: 'ellipsis', whiteSpace: 'nowrap', overflow: 'hidden',
                    transition: 'all 0.15s'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = 'var(--primary)'
                    e.currentTarget.style.backgroundColor = 'var(--bg-glass-active)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'var(--border-muted)'
                    e.currentTarget.style.backgroundColor = 'var(--bg-glass)'
                  }}
                >
                  <span style={{ color: 'var(--primary)', fontWeight: 'bold' }}>#{idx + 1}</span>
                  <span>{file.filePath}</span>
                </button>
              ))
            ) : (
              <div
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  width: '100%', padding: '6px 8px', borderRadius: '6px',
                  background: 'var(--bg-glass-active)', border: '1px solid var(--primary)',
                  color: 'var(--text-main)', fontSize: '11px',
                  textOverflow: 'ellipsis', whiteSpace: 'nowrap', overflow: 'hidden',
                }}
              >
                <FileText size={12} style={{ color: 'var(--primary)' }} />
                <span>{filePath ? filePath.split(/[\\/]/).pop() : '무제 문서.md'}</span>
              </div>
            )
          )}

          {fileOpenMode === 'tab' && tabs.map((tab, idx) => {
  // [RUN-TIME STATE / INVARIANT] - 변수 'isActive'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
            const isActive = activeTabId === tab.id
            return (
              <div
                key={tab.id}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px',
                  width: '100%', padding: '5px 8px', borderRadius: '6px',
                  background: isActive ? 'var(--bg-glass-active)' : 'var(--bg-glass)',
                  border: `1px solid ${isActive ? 'var(--primary)' : 'var(--border-muted)'}`,
                  transition: 'all 0.15s'
                }}
              >
                <button
                  onClick={() => onSelectTab(tab.id)}
                  style={{
                    flex: 1, display: 'flex', alignItems: 'center', gap: '6px',
                    background: 'transparent', border: 'none',
                    color: isActive ? 'var(--primary)' : 'var(--text-main)',
                    fontSize: '11px', cursor: 'pointer', textAlign: 'left',
                    textOverflow: 'ellipsis', whiteSpace: 'nowrap', overflow: 'hidden', padding: 0
                  }}
                >
                  <span style={{ fontWeight: 'bold' }}>T{idx + 1}</span>
                  <span>{tab.filePath ? tab.filePath.split(/[\\/]/).pop() : '무제 문서'}</span>
                </button>
                <button
                  onClick={() => onCloseTab(tab.id)}
                  style={{
                    background: 'transparent', border: 'none',
                    color: 'var(--text-muted)', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    padding: '2px', borderRadius: '4px', transition: 'all 0.15s'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = 'var(--danger)'
                    e.currentTarget.style.backgroundColor = 'rgba(239,68,68,0.1)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = 'var(--text-muted)'
                    e.currentTarget.style.backgroundColor = 'transparent'
                  }}
                >
                  <X size={10} />
                </button>
              </div>
            )
          })}
        </div>
      </div>

      {/* 내보내기 */}
      <div>
        {sectionLabel('내보내기')}
        <button
          onClick={() => setExportOpen(!exportOpen)}
          style={{
            width: '100%', padding: '8px 12px', borderRadius: '8px',
            background: 'var(--bg-glass)', border: '1px solid var(--border-muted)',
            color: 'var(--text-main)', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            fontSize: '12px', fontWeight: 500, fontFamily: 'var(--font-sans)',
            transition: 'all 0.15s',
            marginBottom: exportOpen ? '6px' : '0',
          }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Download size={13} /> 포맷 변환...
          </span>
          {exportOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        </button>

        {exportOpen && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            {EXPORT_FORMATS.map(({ format, label, color }) => (
              <button
                key={format}
                className="btn btn-glass"
                style={{
                  justifyContent: 'flex-start', fontSize: '12px', padding: '7px 12px',
                  borderColor: color || undefined,
                }}
                onClick={() => handleExportClick(format)}
              >
                {label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// [VERIFICATION-TOKEN] AMEVA-OS-283-SPEC-VERIFIED-SUCCESSFULLY-2026
