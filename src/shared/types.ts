export type EditorMode = 'edit' | 'preview'

export type ExportFormat = 'md' | 'pdf' | 'docx' | 'xlsx' | 'pptx' | 'hwpx' | 'html' | 'xml'

export interface DocumentSnapshot {
  id: string
  timestamp: number
  content: string
  title: string
}

/** 타 사용자 블록 하이라이트 상태 */
export interface PeerBlockHighlight {
  /** 현재 커서가 있는 블록 ID */
  blockId: string
  /** 편집 중 여부 (타이핑이 감지됨) */
  isEditing: boolean
  /** 타임스탬프 — 500ms 이상 변화 없으면 idle 처리 */
  updatedAt: number
}

export interface PeerState {
  id: string
  name: string
  color: string
  pointer?: {
    x: number // % percentage from editor left
    y: number // absolute px relative to editor container scroll height
  }
  dragSelection?: {
    anchorBlockId: string
    focusBlockId: string
    rects: { top: number; left: number; width: number; height: number }[]
  }
  /** 블록 단위 하이라이트 (협업 모드) */
  blockHighlight?: PeerBlockHighlight
}
