import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { store, useStore } from '../../store/nodeStore'
import type { Node } from '../../types'

interface Props {
  periodStart: Date   // inicio del periodo visible (lunes, 1 de mes, 1 de año)
  view: 'week' | 'month' | 'year'
}

// ID de arrastre compartido (módulo-level, igual que en OutlinerNode)
export let calDragNodeId: string | null = null

function TaskRow({ node }: { node: Node }) {
  const navigate = useNavigate()
  const priorityColor = node.priority === 'high' ? '#ef4444'
    : node.priority === 'medium' ? '#f59e0b'
    : 'var(--text-tertiary)'

  return (
    <div
      className="cal-panel-task"
      draggable
      onDragStart={e => {
        calDragNodeId = node.id
        e.dataTransfer.setData('cal-node-id', node.id)
        e.dataTransfer.effectAllowed = 'move'
      }}
      onDragEnd={() => { calDragNodeId = null }}
      onClick={() => navigate(`/node/${node.id}`)}
      title={node.text || 'Sin título'}
    >
      <span className="cal-panel-task-dot" style={{ background: priorityColor }} />
      <span className="cal-panel-task-text">{node.text || 'Sin título'}</span>
      {node.due && (
        <span className="cal-panel-task-date">
          {new Date(node.due).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
        </span>
      )}
    </div>
  )
}

export default function CalendarSidePanel({ periodStart, view }: Props) {
  const s = useStore()
  const [isDragOver, setIsDragOver] = useState(false)

  const allPending = s.allActive().filter(n => !n.deletedAt && n.status === 'pending')

  // Overdue: vencidas ANTES del inicio del periodo visible
  const overdue = allPending.filter(n => n.due && new Date(n.due) < periodStart)

  // Sin fecha: sin due date
  const unscheduled = allPending.filter(n => !n.due)

  const label = view === 'week' ? 'semana pasada y anteriores'
    : view === 'month' ? 'mes pasado y anteriores'
    : 'año pasado y anteriores'

  return (
    <div
      className={`cal-side-panel ${isDragOver ? 'cal-side-panel--drag-over' : ''}`}
      onDragOver={e => { e.preventDefault(); setIsDragOver(true) }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={e => {
        e.preventDefault()
        setIsDragOver(false)
        const nodeId = e.dataTransfer.getData('cal-node-id')
        if (nodeId) store.updateNode(nodeId, { due: null })
      }}
    >
      {isDragOver && (
        <div className="cal-panel-drop-hint">Suelta para desagendar</div>
      )}

      {/* Overdue */}
      {overdue.length > 0 && (
        <div className="cal-panel-section">
          <div className="cal-panel-label cal-panel-label--overdue">
            ⚠ Vencidas — {label}
            <span className="cal-panel-count">{overdue.length}</span>
          </div>
          {overdue.map(n => <TaskRow key={n.id} node={n} />)}
        </div>
      )}

      {/* Sin fecha */}
      {unscheduled.length > 0 && (
        <div className="cal-panel-section">
          <div className="cal-panel-label">
            Sin fecha
            <span className="cal-panel-count">{unscheduled.length}</span>
          </div>
          {unscheduled.map(n => <TaskRow key={n.id} node={n} />)}
        </div>
      )}

      {overdue.length === 0 && unscheduled.length === 0 && (
        <div className="cal-panel-empty">
          <span style={{ fontSize: 20, opacity: 0.3 }}>✓</span>
          <span>Todo agendado</span>
        </div>
      )}
    </div>
  )
}
