import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore, store } from '../../store/nodeStore'
import type { Node } from '../../types'

const SECTIONS_KEY = 'from_task_sections'
const FILTERS_KEY = 'from_tasks_filters'

function loadFilters(): { filterPriority: 'all'|'high'|'medium'|'low'; showDone: boolean; sortBy: 'date'|'priority'|'created' } {
  try {
    return JSON.parse(localStorage.getItem(FILTERS_KEY) || '{}')
  } catch { return { filterPriority: 'all', showDone: false, sortBy: 'date' } }
}

function saveFilters(f: { filterPriority: string; showDone: boolean; sortBy: string }) {
  localStorage.setItem(FILTERS_KEY, JSON.stringify(f))
}

function loadSectionState(): Record<string, boolean> {
  try {
    return JSON.parse(localStorage.getItem(SECTIONS_KEY) || '{}')
  } catch { return {} }
}

function saveSectionState(state: Record<string, boolean>) {
  localStorage.setItem(SECTIONS_KEY, JSON.stringify(state))
}

type SectionId = 'overdue' | 'today' | 'week' | 'later' | 'nodate'

interface Section {
  id: SectionId
  label: string
  tasks: Node[]
  defaultOpen: boolean
}

function formatRelativeDate(due: string): string {
  const d = new Date(due)
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const target = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const diff = Math.round((target.getTime() - today.getTime()) / 86400000)

  if (diff < 0) {
    const abs = Math.abs(diff)
    return abs === 1 ? 'ayer' : `hace ${abs}d`
  }
  if (diff === 0) return 'hoy'
  if (diff === 1) return 'mañana'
  if (diff < 7) return `en ${diff}d`
  return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
}

function PriorityBadge({ priority }: { priority: Node['priority'] }) {
  if (!priority) return null
  const labels: Record<string, string> = { low: 'baja', medium: 'media', high: 'alta' }
  return (
    <span className={`priority-badge priority-badge--${priority}`}>
      {labels[priority]}
    </span>
  )
}

function isSubtask(node: Node): boolean {
  if (!node.parentId) return false
  const parent = store.getNode(node.parentId)
  return parent ? parent.status !== null : false
}

function TaskRow({ task, depth = 0 }: { task: Node; depth?: number }) {
  const navigate = useNavigate()

  function toggleDone(e: React.MouseEvent) {
    e.stopPropagation()
    store.updateNode(task.id, { status: task.status === 'done' ? 'pending' : 'done' })
  }

  const isDone = task.status === 'done'

  return (
    <div
      className={`task-item task-item--sectioned ${isDone ? 'task-item--done' : ''}`}
      style={depth > 0 ? { paddingLeft: `${depth * 20}px` } : undefined}
      onClick={() => navigate(`/node/${task.id}`)}
    >
      <button
        className="task-check"
        onClick={toggleDone}
        aria-label={isDone ? 'Marcar pendiente' : 'Completar'}
      >
        {isDone ? (
          <svg width="16" height="16" viewBox="0 0 16 16">
            <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" fill="none"/>
            <path d="M5 8l2 2 4-4" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
          </svg>
        ) : (
          <svg width="16" height="16" viewBox="0 0 16 16">
            <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" fill="none"/>
          </svg>
        )}
      </button>

      <div className="task-info">
        <span className="task-text">{task.text || 'Sin título'}</span>
        <div className="task-meta">
          {task.due && (
            <span className={`task-due-rel ${new Date(task.due) < new Date() && task.status !== 'done' ? 'overdue' : ''}`}>
              {formatRelativeDate(task.due)}
            </span>
          )}
          <PriorityBadge priority={task.priority} />
        </div>
      </div>
    </div>
  )
}

interface SectionProps {
  section: Section
  collapsed: boolean
  onToggle: () => void
}

function TaskSection({ section, collapsed, onToggle }: SectionProps) {
  if (section.tasks.length === 0) return null

  return (
    <div className={`tasks-section tasks-section--${section.id}`}>
      <button className="tasks-section-header" onClick={onToggle}>
        <svg
          className={`tasks-section-arrow ${collapsed ? 'collapsed' : ''}`}
          width="10" height="10" viewBox="0 0 10 10"
        >
          <path d="M2.5 3.5L5 6.5L7.5 3.5" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
        </svg>
        <span className="tasks-section-label">{section.label}</span>
        <span className="tasks-section-count">{section.tasks.length}</span>
      </button>
      {!collapsed && (
        <div className="tasks-section-body">
          {section.tasks.map(t => {
            const subtasks = store.children(t.id).filter(c => c.status !== null)
            return (
              <div key={t.id}>
                <TaskRow task={t} />
                {subtasks.map(sub => (
                  <TaskRow key={sub.id} task={sub} depth={1} />
                ))}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default function TasksView() {
  const s = useStore()
  const [sectionState, setSectionStateRaw] = useState<Record<string, boolean>>(loadSectionState)
  const savedFilters = useMemo(() => loadFilters(), [])
  const [filterPriority, setFilterPriority] = useState<'all'|'high'|'medium'|'low'>(savedFilters.filterPriority || 'all')
  const [showDone, setShowDone] = useState<boolean>(savedFilters.showDone || false)
  const [sortBy, setSortBy] = useState<'date'|'priority'|'created'>(savedFilters.sortBy || 'date')

  function updateFilter<K extends keyof ReturnType<typeof loadFilters>>(key: K, value: ReturnType<typeof loadFilters>[K]) {
    const current = loadFilters()
    const next = { ...current, [key]: value }
    saveFilters(next)
  }

  function setAndSaveFilterPriority(v: 'all'|'high'|'medium'|'low') {
    setFilterPriority(v)
    updateFilter('filterPriority', v)
  }

  function setAndSaveShowDone(v: boolean) {
    setShowDone(v)
    updateFilter('showDone', v)
  }

  function setAndSaveSortBy(v: 'date'|'priority'|'created') {
    setSortBy(v)
    updateFilter('sortBy', v)
  }

  function toggleSection(id: SectionId) {
    setSectionStateRaw(prev => {
      const next = { ...prev, [id]: !prev[id] }
      saveSectionState(next)
      return next
    })
  }

  function isCollapsed(id: SectionId, defaultOpen: boolean): boolean {
    if (id in sectionState) return sectionState[id]
    return !defaultOpen
  }

  const allTasks = useMemo(() => {
    let tasks = s.allActive().filter(n => n.status !== null && !isSubtask(n))
    // Filter by priority
    if (filterPriority !== 'all') {
      tasks = tasks.filter(n => n.priority === filterPriority)
    }
    // Filter done
    if (!showDone) {
      tasks = tasks.filter(n => n.status !== 'done')
    }
    return tasks
  }, [s, filterPriority, showDone])

  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const todayEnd = new Date(todayStart.getTime() + 86400000)
  const weekEnd = new Date(todayStart.getTime() + 7 * 86400000)

  const sections: Section[] = useMemo(() => {
    const overdue: Node[] = []
    const today: Node[] = []
    const week: Node[] = []
    const later: Node[] = []
    const nodate: Node[] = []

    for (const t of allTasks) {
      if (!showDone && t.status === 'done') continue
      if (!t.due) {
        nodate.push(t)
        continue
      }
      const d = new Date(t.due)
      if (d < todayStart) {
        overdue.push(t)
      } else if (d < todayEnd) {
        today.push(t)
      } else if (d < weekEnd) {
        week.push(t)
      } else {
        later.push(t)
      }
    }

    const PRIORITY_ORDER: Record<string, number> = { high: 0, medium: 1, low: 2 }

    function makeSorter(list: Node[]): Node[] {
      if (sortBy === 'priority') {
        return list.sort((a, b) => {
          const pa = PRIORITY_ORDER[a.priority || ''] ?? 3
          const pb = PRIORITY_ORDER[b.priority || ''] ?? 3
          if (pa !== pb) return pa - pb
          if (a.due && b.due) return a.due < b.due ? -1 : 1
          return 0
        })
      }
      if (sortBy === 'created') {
        return list.sort((a, b) => (a.createdAt || '') < (b.createdAt || '') ? -1 : 1)
      }
      // default: date
      return list.sort((a, b) => {
        if (a.due && b.due) return a.due < b.due ? -1 : 1
        return 0
      })
    }

    return [
      { id: 'overdue', label: 'Vencidas', tasks: makeSorter(overdue), defaultOpen: true },
      { id: 'today', label: 'Hoy', tasks: makeSorter(today), defaultOpen: true },
      { id: 'week', label: 'Esta semana', tasks: makeSorter(week), defaultOpen: true },
      { id: 'later', label: 'Más tarde', tasks: makeSorter(later), defaultOpen: false },
      { id: 'nodate', label: 'Sin fecha', tasks: makeSorter(nodate), defaultOpen: false },
    ]
  }, [allTasks, sortBy, showDone]) // eslint-disable-line react-hooks/exhaustive-deps

  const totalPending = sections.reduce((acc, s) => acc + s.tasks.filter(t => t.status !== 'done').length, 0)

  return (
    <div className="view tasks-view">
      <div className="view-header">
        <h1 className="view-title">Tareas</h1>
        {totalPending > 0 && (
          <span className="tasks-count">{totalPending} pendiente{totalPending !== 1 ? 's' : ''}</span>
        )}
      </div>

      {/* Filter bar */}
      <div className="tasks-filter-bar">
        <div className="tasks-filter-group">
          {(['all', 'high', 'medium', 'low'] as const).map(p => (
            <button
              key={p}
              className={`tasks-filter-chip ${filterPriority === p ? 'active' : ''}`}
              onClick={() => setAndSaveFilterPriority(p)}
            >
              {p === 'all' ? 'Todas' : p === 'high' ? 'Alta' : p === 'medium' ? 'Media' : 'Baja'}
            </button>
          ))}
        </div>
        <div className="tasks-filter-separator" />
        <div className="tasks-filter-group">
          <button
            className={`tasks-filter-chip ${!showDone ? 'active' : ''}`}
            onClick={() => setAndSaveShowDone(false)}
          >
            Solo pendientes
          </button>
          <button
            className={`tasks-filter-chip ${showDone ? 'active' : ''}`}
            onClick={() => setAndSaveShowDone(true)}
          >
            Incluir completadas
          </button>
        </div>
        <div className="tasks-filter-separator" />
        <div className="tasks-filter-group">
          {(['date', 'priority', 'created'] as const).map(s => (
            <button
              key={s}
              className={`tasks-filter-chip ${sortBy === s ? 'active' : ''}`}
              onClick={() => setAndSaveSortBy(s)}
            >
              {s === 'date' ? 'Por fecha' : s === 'priority' ? 'Por prioridad' : 'Por creación'}
            </button>
          ))}
        </div>
      </div>

      <div className="view-body">
        {totalPending === 0 ? (
          <div className="view-empty-state">
            <p>No hay tareas pendientes 🎉</p>
          </div>
        ) : (
          <div className="tasks-sections">
            {sections.map(section => (
              <TaskSection
                key={section.id}
                section={section}
                collapsed={isCollapsed(section.id, section.defaultOpen)}
                onToggle={() => toggleSection(section.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
