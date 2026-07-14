import React, { useState, useEffect } from 'react'
import type { BlockNoteEditor } from '@blocknote/core'

export function KanbanBoard({ editor }: { editor: BlockNoteEditor | null }) {
  const [tasks, setTasks] = useState<any[]>([])

  useEffect(() => {
    if (!editor) return

    // 재귀적으로 체크리스트 블록 추출
    const extractChecklists = (blocks: any[]) => {
      let list: any[] = []
      for (const block of blocks) {
        if (block.type === 'checkListItem') {
          list.push(block)
        }
        if (block.children && block.children.length > 0) {
          list.push(...extractChecklists(block.children))
        }
      }
      return list
    }

    const loadTasks = () => {
      const allBlocks = editor.document
      const checklists = extractChecklists(allBlocks)
      setTasks(checklists)
    }

    loadTasks()

    // 에디터 변경 시 즉각 반영을 위해 이벤트 리스너 부착
    const unsubscribe = editor.onDocumentChange(() => {
      loadTasks()
    })

    return () => {
      unsubscribe()
    }
  }, [editor])

  // Drag & Drop 핸들러
  const onDragStart = (e: React.DragEvent, taskId: string) => {
    e.dataTransfer.setData('taskId', taskId)
  }

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault()
  }

  const onDrop = (e: React.DragEvent, targetStatus: boolean) => {
    e.preventDefault()
    const taskId = e.dataTransfer.getData('taskId')
    if (!taskId || !editor) return

    const task = tasks.find(t => t.id === taskId)
    if (!task || task.props.checked === targetStatus) return

    // BlockNote 원문 상태 업데이트 (이것이 핵심 요구사항!)
    editor.updateBlock(taskId, {
      props: { ...task.props, checked: targetStatus }
    })

    // UI 즉각 갱신
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, props: { ...t.props, checked: targetStatus } } : t))
  }

  const todoTasks = tasks.filter(t => !t.props.checked)
  const doneTasks = tasks.filter(t => t.props.checked)

  const renderContent = (block: any) => {
    if (Array.isArray(block.content)) {
      return block.content.map((c: any) => c.text).join('')
    }
    return '내용 없음'
  }

  return (
    <div style={{ padding: '24px', height: '100%', display: 'flex', flexDirection: 'column', color: 'var(--text-main)', background: 'var(--bg-editor)', overflow: 'auto' }}>
      <div style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <h2 style={{ fontSize: '20px', fontWeight: 'bold' }}>Kanban Board</h2>
        <span style={{ fontSize: '11px', background: 'rgba(139,92,246,0.2)', color: '#a78bfa', padding: '2px 6px', borderRadius: '4px' }}>Marketplace Pro</span>
      </div>
      
      <div style={{ display: 'flex', gap: '20px', flex: 1, minHeight: 0 }}>
        {/* To Do Column */}
        <div
          onDragOver={onDragOver}
          onDrop={(e) => onDrop(e, false)}
          style={{ flex: 1, background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-muted)', borderRadius: '12px', padding: '16px', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ fontSize: '14px', fontWeight: 'bold' }}>To Do</h3>
            <span style={{ fontSize: '11px', background: '#3f3f46', padding: '2px 8px', borderRadius: '10px' }}>{todoTasks.length}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {todoTasks.map(task => (
              <div
                key={task.id}
                draggable
                onDragStart={(e) => onDragStart(e, task.id)}
                style={{ background: 'var(--bg-sidebar)', padding: '14px', borderRadius: '8px', cursor: 'grab', border: '1px solid var(--border-muted)', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', transition: 'transform 0.1s' }}
                onDragStartCapture={(e) => (e.currentTarget.style.opacity = '0.5')}
                onDragEnd={(e) => (e.currentTarget.style.opacity = '1')}
              >
                {renderContent(task)}
              </div>
            ))}
            {todoTasks.length === 0 && <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px', padding: '20px' }}>No tasks in To Do</div>}
          </div>
        </div>

        {/* Done Column */}
        <div
          onDragOver={onDragOver}
          onDrop={(e) => onDrop(e, true)}
          style={{ flex: 1, background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-muted)', borderRadius: '12px', padding: '16px', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ fontSize: '14px', fontWeight: 'bold', color: '#4ade80' }}>Done</h3>
            <span style={{ fontSize: '11px', background: '#166534', color: '#bbf7d0', padding: '2px 8px', borderRadius: '10px' }}>{doneTasks.length}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {doneTasks.map(task => (
              <div
                key={task.id}
                draggable
                onDragStart={(e) => onDragStart(e, task.id)}
                style={{ background: 'var(--bg-sidebar)', padding: '14px', borderRadius: '8px', cursor: 'grab', border: '1px solid var(--border-muted)', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', opacity: 0.6 }}
              >
                <div style={{ textDecoration: 'line-through', color: 'var(--text-muted)' }}>
                  {renderContent(task)}
                </div>
              </div>
            ))}
            {doneTasks.length === 0 && <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px', padding: '20px' }}>No tasks done yet</div>}
          </div>
        </div>
      </div>
    </div>
  )
}
