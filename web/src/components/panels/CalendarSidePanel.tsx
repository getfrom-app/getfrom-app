import { useState, useRef } from 'react'
import { store, useStore } from '../../store/nodeStore'
import type { Node } from '../../types'
import { TaskPropsPopover } from './DiaryRightPanel'

interface Props {
  periodStart: Date   // inicio del periodo visible (lunes, 1 de mes, 1 de año)
  view: 'day' | 'week' | 'month' | 'year'
}

// ID de arrastre compartido (módulo-level, igual que en OutlinerNode)
export let calDragNodeId: string | null = null

// ── Helpers ───────────────────────────────────────────────────────────────────

function isTemporalNode(node: Node): boolean {
  return !!node.isDiaryEntry
}

interface TaskGroup {
  parentId: string | null
  parentText: string
  parentIsSeguimiento: boolean
  tasks: Node[]
}

function buildGroups(tasks: Node[], allNodes: Node[]): TaskGroup[] {
  const groups = new Map<string | null, TaskGroup>()

  for (const task of tasks) {
    const parent = task.parentId ? allNodes.find(n => n.id === task.parentId) : null
    const isRealParent = parent && !isTemporalNode(parent) && !parent.deletedAt
    const key = isRealParent ? parent!.id : null

    if (!groups.has(key)) {
      groups.set(key, {
        parentId: key,
        parentText: isRealParent ? (parent!.text || 'Sin título') : '',
        parentIsSeguimiento: isRealParent ? !!parent!.isSeguimiento : false,
        tasks: [],
      })
    }
    groups.get(key)!.tasks.push(task)
  }

  // Sort: seguimiento groups first, then grouped by parent, then standalone last
  return Array.from(groups.values()).sort((a, b) => {
    if (a.parentIsSeguimiento && !b.parentIsSeguimiento) return -1
    if (!a.parentIsSeguimiento && b.parentIsSeguimiento) return 1
    if (a.parentId && !b.parentId) return -1
    if (!a.parentId && b.parentId) return 1
    return a.parentText.localeCompare(b.parentText)
  })
}

// ── TaskCheckbox ──────────────────────────────────────────────────────────────

interface TaskCheckboxProps {
  node: Node
  color: string
}

function TaskCheckbox({ node, color }: TaskCheckboxProps) {
  const isDone = node.status === 'done'
  return (
    <button
      className="cal-task-checkbox"
      style={{ borderColor: color } as React.CSSProperties}
      onClick={e => {
        e.stopPropagation()
        store.updateNode(node.id, { status: isDone ? 'pending' : 'done' })
      }}
      title={isDone ? 'Marcar como pendiente' : 'Marcar como hecho'}
    >
      {isDone && (
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
          <path d="M2 5l2.5 2.5L8 3" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </button>
  )
}

// ── TaskRow ───────────────────────────────────────────────────────────────────

interface TaskRowProps {
  node: Node
  checkColor: string
  indented?: boolean
}

function TaskRow({ node, checkColor, indented }: TaskRowProps) {
  const isDone = node.status === 'done'
  const [popoverOpen, setPopoverOpen] = useState(false)
  const rowRef = useRef<HTMLDivElement>(null!)

  return (
    <>
      <div
        ref={rowRef}
        className={`cal-panel-task ${indented ? 'cal-panel-task--indented' : ''} ${isDone ? 'cal-panel-task--done' : ''}`}
        draggable
        onDragStart={e => {
          calDragNodeId = node.id
          e.dataTransfer.setData('cal-node-id', node.id)
          e.dataTransfer.effectAllowed = 'move'
        }}
        onDragEnd={() => { calDragNodeId = null }}
        onClick={() => setPopoverOpen(v => !v)}
        title={node.text || 'Sin título'}
      >
        <TaskCheckbox node={node} color={checkColor} />
        <span className="cal-panel-task-text">{node.text || 'Sin título'}</span>
        {node.due && (
          <span className="cal-panel-task-date">
            {new Date(node.due).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
          </span>
        )}
      </div>
      {popoverOpen && (
        <TaskPropsPopover
          node={node}
          onClose={() => setPopoverOpen(false)}
          anchorRef={rowRef}
          allowRename
          allowDelete
        />
      )}
    </>
  )
}

// ── GroupedSection ────────────────────────────────────────────────────────────

interface GroupedSectionProps {
  groups: TaskGroup[]
  checkColor: string
}

function GroupedSection({ groups, checkColor }: GroupedSectionProps) {
  return (
    <>
      {groups.map((group, gi) => (
        <div key={group.parentId ?? `standalone-${gi}`} className="cal-panel-group">
          {group.parentId && (
            <div
              className={`cal-panel-group-header ${group.parentIsSeguimiento ? 'cal-panel-group-header--seguimiento' : ''}`}
              title={group.parentText}
            >
              {group.parentIsSeguimiento && <span className="cal-panel-seguimiento-icon">👁</span>}
              <span className="cal-panel-group-title">{group.parentText}</span>
              <span className="cal-panel-count">{group.tasks.length}</span>
            </div>
          )}
          {group.tasks.map(n => (
            <TaskRow key={n.id} node={n} checkColor={checkColor} indented={!!group.parentId} />
          ))}
        </div>
      ))}
    </>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function CalendarSidePanel({ periodStart, view }: Props) {
  const s = useStore()
  const [isDragOver, setIsDragOver] = useState(false)

  const allNodes = s.allActive().filter(n => !n.deletedAt)
  const allPending = allNodes.filter(n => n.status === 'pending')

  // Overdue: vencidas ANTES del inicio del periodo visible
  const overdue = allPending.filter(n => n.due && new Date(n.due) < periodStart)

  // Sin fecha: sin due date
  const unscheduled = allPending.filter(n => !n.due)

  const overdueGroups = buildGroups(overdue, allNodes)
  const unscheduledGroups = buildGroups(unscheduled, allNodes)

  const label = view === 'day' ? 'pendientes anteriores'
    : view === 'week' ? 'semana pasada y anteriores'
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
          <GroupedSection groups={overdueGroups} checkColor="#ef4444" />
        </div>
      )}

      {/* Sin fecha */}
      {unscheduled.length > 0 && (
        <div className="cal-panel-section">
          <div className="cal-panel-label">
            Sin fecha
            <span className="cal-panel-count">{unscheduled.length}</span>
          </div>
          <GroupedSection groups={unscheduledGroups} checkColor="#f59e0b" />
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
