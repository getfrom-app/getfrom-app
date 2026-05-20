import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore, store } from '../../store/nodeStore'
import type { Node } from '../../types'

// ── Priority badge ───────────────────────────────────────────────────────────

function PriorityDot({ priority }: { priority: Node['priority'] }) {
  if (!priority) return null
  const colors: Record<string, string> = {
    high: '#ef4444',
    medium: '#f59e0b',
    low: '#6b7280',
  }
  return (
    <span
      className="kanban-priority-dot"
      style={{ background: colors[priority] }}
      title={priority}
    />
  )
}

// ── Relative date ────────────────────────────────────────────────────────────

function formatDue(due: string): { label: string; overdue: boolean } {
  const d = new Date(due)
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const target = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const diff = Math.round((target.getTime() - today.getTime()) / 86400000)
  const overdue = diff < 0

  let label: string
  if (diff < 0) label = diff === -1 ? 'ayer' : `hace ${Math.abs(diff)}d`
  else if (diff === 0) label = 'hoy'
  else if (diff === 1) label = 'mañana'
  else if (diff < 7) label = `en ${diff}d`
  else label = d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })

  return { label, overdue }
}

// ── Kanban card ──────────────────────────────────────────────────────────────

function KanbanCard({ task, onDrop }: { task: Node; onDrop: (id: string, newStatus: Node['status']) => void }) {
  const navigate = useNavigate()
  const [dragOver, setDragOver] = useState(false)

  return (
    <div
      className={`kanban-card ${dragOver ? 'kanban-card--drag-over' : ''}`}
      draggable
      onDragStart={e => e.dataTransfer.setData('taskId', task.id)}
      onDragOver={e => { e.preventDefault(); setDragOver(true) }}
      onDragLeave={() => setDragOver(false)}
      onDrop={e => {
        e.preventDefault()
        setDragOver(false)
        const draggedId = e.dataTransfer.getData('taskId')
        if (draggedId && draggedId !== task.id) onDrop(draggedId, task.status)
      }}
      onClick={() => navigate(`/node/${task.id}`)}
    >
      <div className="kanban-card-header">
        <PriorityDot priority={task.priority} />
        <span className="kanban-card-title">{task.text || 'Sin título'}</span>
      </div>
      {task.due && (() => {
        const { label, overdue } = formatDue(task.due)
        return (
          <div className={`kanban-card-due ${overdue ? 'overdue' : ''}`}>
            📅 {label}
          </div>
        )
      })()}
      {task.body && (
        <div className="kanban-card-body">{task.body.slice(0, 80)}{task.body.length > 80 ? '…' : ''}</div>
      )}
    </div>
  )
}

// ── Kanban column ────────────────────────────────────────────────────────────

interface ColumnConfig {
  status: Node['status']
  label: string
  color: string
  icon: string
}

const COLUMNS: ColumnConfig[] = [
  { status: 'pending',   label: 'Activo',      color: '#3b82f6', icon: '●' },
  { status: 'done',      label: 'Completado',  color: '#22c55e', icon: '✓' },
  { status: null,        label: 'Sin estado',  color: '#6b7280', icon: '○' },
]

function KanbanColumn({
  column,
  tasks,
  onDrop,
  onCreateTask,
}: {
  column: ColumnConfig
  tasks: Node[]
  onDrop: (id: string, newStatus: Node['status']) => void
  onCreateTask: (status: Node['status'], text: string) => void
}) {
  const [colDragOver, setColDragOver] = useState(false)
  const [adding, setAdding] = useState(false)
  const [newText, setNewText] = useState('')

  function handleAddConfirm() {
    const trimmed = newText.trim()
    if (trimmed) {
      onCreateTask(column.status, trimmed)
    }
    setNewText('')
    setAdding(false)
  }

  return (
    <div
      className={`kanban-column ${colDragOver ? 'kanban-column--drag-over' : ''}`}
      onDragOver={e => { e.preventDefault(); setColDragOver(true) }}
      onDragLeave={() => setColDragOver(false)}
      onDrop={e => {
        e.preventDefault()
        setColDragOver(false)
        const id = e.dataTransfer.getData('taskId')
        if (id) onDrop(id, column.status)
      }}
    >
      <div className="kanban-column-header">
        <div className="kanban-column-title">
          <span className="kanban-column-icon" style={{ color: column.color }}>{column.icon}</span>
          <span>{column.label}</span>
          <span className="kanban-column-count">{tasks.length}</span>
        </div>
        <button
          className="kanban-add-btn"
          onClick={() => { setAdding(true); setNewText('') }}
          title={`Nueva tarea en ${column.label}`}
        >
          +
        </button>
      </div>
      <div className="kanban-column-body">
        {tasks.map(t => (
          <KanbanCard key={t.id} task={t} onDrop={onDrop} />
        ))}
        {tasks.length === 0 && !adding && (
          <div className="kanban-column-empty">Sin tareas</div>
        )}
        {adding && (
          <input
            className="kanban-add-input"
            value={newText}
            onChange={e => setNewText(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') { handleAddConfirm() }
              if (e.key === 'Escape') { setAdding(false); setNewText('') }
            }}
            autoFocus
            placeholder="Nombre de la tarea..."
          />
        )}
      </div>
    </div>
  )
}

// ── Priority filter ──────────────────────────────────────────────────────────

type PriorityFilter = 'all' | 'high' | 'medium' | 'low'
type KanbanViewMode = 'board' | 'table'

// ── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: Node['status'] }) {
  const map: Record<string, { label: string; color: string }> = {
    pending: { label: 'Activo', color: '#3b82f6' },
    done: { label: 'Completado', color: '#22c55e' },
  }
  const entry = status ? map[status] : null
  if (!entry) return <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Sin estado</span>
  return (
    <span style={{
      fontSize: 11, fontWeight: 600, padding: '1px 6px', borderRadius: 4,
      background: entry.color + '20', color: entry.color,
    }}>
      {entry.label}
    </span>
  )
}

// ── Priority badge (for table) ───────────────────────────────────────────────

function PriorityBadge({ priority }: { priority: Node['priority'] }) {
  if (!priority) return <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>—</span>
  const map: Record<string, { label: string; color: string }> = {
    high: { label: 'Alta', color: '#ef4444' },
    medium: { label: 'Media', color: '#f59e0b' },
    low: { label: 'Baja', color: '#6b7280' },
  }
  const entry = map[priority]
  return (
    <span style={{
      fontSize: 11, fontWeight: 600, padding: '1px 6px', borderRadius: 4,
      background: entry.color + '20', color: entry.color,
    }}>
      {entry.label}
    </span>
  )
}

// ── Table view ───────────────────────────────────────────────────────────────

function KanbanTable({ tasks }: { tasks: Node[] }) {
  const navigate = useNavigate()

  function toggleDone(e: React.MouseEvent, task: Node) {
    e.stopPropagation()
    store.updateNode(task.id, { status: task.status === 'done' ? 'pending' : 'done' })
  }

  return (
    <div className="kanban-table-wrapper">
      <table className="kanban-table" style={{ borderCollapse: 'collapse', width: '100%' }}>
        <thead>
          <tr className="kanban-table-head-row">
            <th className="kanban-table-th" style={{ width: 32 }}></th>
            <th className="kanban-table-th" style={{ textAlign: 'left' }}>Título</th>
            <th className="kanban-table-th" style={{ width: 110 }}>Estado</th>
            <th className="kanban-table-th" style={{ width: 90 }}>Prioridad</th>
            <th className="kanban-table-th" style={{ width: 110 }}>Fecha límite</th>
          </tr>
        </thead>
        <tbody>
          {tasks.map(task => {
            const isDone = task.status === 'done'
            const { label: dueLabel, overdue } = task.due ? formatDue(task.due) : { label: '—', overdue: false }
            return (
              <tr
                key={task.id}
                className="kanban-table-row"
                onClick={() => navigate(`/node/${task.id}`)}
                style={{ opacity: isDone ? 0.6 : 1, cursor: 'pointer' }}
              >
                <td className="kanban-table-td" onClick={e => toggleDone(e, task)} style={{ textAlign: 'center', cursor: 'pointer' }}>
                  <span style={{ fontSize: 14, color: isDone ? '#22c55e' : 'var(--text-tertiary)' }}>
                    {isDone ? '✓' : '○'}
                  </span>
                </td>
                <td className="kanban-table-td">
                  <span style={{ fontSize: 13, textDecoration: isDone ? 'line-through' : 'none' }}>
                    {task.text || 'Sin título'}
                  </span>
                </td>
                <td className="kanban-table-td"><StatusBadge status={task.status} /></td>
                <td className="kanban-table-td"><PriorityBadge priority={task.priority} /></td>
                <td className="kanban-table-td" style={{ fontSize: 12, color: overdue ? '#ef4444' : 'var(--text-secondary)' }}>
                  {dueLabel}
                </td>
              </tr>
            )
          })}
          {tasks.length === 0 && (
            <tr>
              <td colSpan={5} style={{ textAlign: 'center', padding: '32px 0', fontSize: 13, color: 'var(--text-tertiary)' }}>
                Sin tareas
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

// ── KanbanView (main) ────────────────────────────────────────────────────────

export default function KanbanView() {
  const navigate = useNavigate()
  const s = useStore()
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [viewMode, setViewMode] = useState<KanbanViewMode>('board')

  const allTasks = useMemo(
    () => s.allActive().filter(n => n.status !== null),
    [s]
  )

  const filteredTasks = useMemo(() => {
    let tasks = allTasks
    if (priorityFilter !== 'all') tasks = tasks.filter(t => t.priority === priorityFilter)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      tasks = tasks.filter(t => (t.text || '').toLowerCase().includes(q) || (t.body || '').toLowerCase().includes(q))
    }
    return tasks
  }, [allTasks, priorityFilter, searchQuery])

  function tasksByStatus(status: Node['status']): Node[] {
    return filteredTasks
      .filter(t => t.status === status)
      .sort((a, b) => {
        // Priority order: high > medium > low > null
        const pOrder = { high: 0, medium: 1, low: 2, null: 3 }
        const pa = pOrder[a.priority ?? 'null']
        const pb = pOrder[b.priority ?? 'null']
        if (pa !== pb) return pa - pb
        // Then by due date
        if (a.due && b.due) return a.due < b.due ? -1 : 1
        if (a.due) return -1
        if (b.due) return 1
        return 0
      })
  }

  function handleDrop(taskId: string, newStatus: Node['status']) {
    store.updateNode(taskId, { status: newStatus })
  }

  function handleCreateTask(status: Node['status'], text: string) {
    const newNode = store.createNode({ text, parentId: null, isTask: true })
    store.updateNode(newNode.id, { status })
    navigate(`/node/${newNode.id}`)
  }

  const totalPending = allTasks.filter(t => t.status === 'pending').length
  const totalDone = allTasks.filter(t => t.status === 'done').length

  return (
    <div className="view kanban-view">
      <div className="view-header">
        <h1 className="view-title">Kanban</h1>
        <div className="kanban-stats">
          <span className="kanban-stat">{totalPending} pendientes</span>
          <span className="kanban-stat kanban-stat--done">{totalDone} completadas</span>
        </div>
      </div>

      {/* Filters */}
      <div className="kanban-filters">
        <input
          className="kanban-search"
          type="text"
          placeholder="Buscar tarea..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
        />
        <div className="kanban-priority-filter">
          {(['all', 'high', 'medium', 'low'] as PriorityFilter[]).map(p => (
            <button
              key={p}
              className={`kanban-filter-btn ${priorityFilter === p ? 'active' : ''}`}
              onClick={() => setPriorityFilter(p)}
            >
              {p === 'all' ? 'Todas' : p === 'high' ? '🔴 Alta' : p === 'medium' ? '🟡 Media' : '⚪ Baja'}
            </button>
          ))}
        </div>
      </div>

      {/* Columns */}
      <div className="kanban-board">
        {COLUMNS.map(col => (
          <KanbanColumn
            key={col.status ?? 'null'}
            column={col}
            tasks={tasksByStatus(col.status)}
            onDrop={handleDrop}
            onCreateTask={handleCreateTask}
          />
        ))}
      </div>
    </div>
  )
}
