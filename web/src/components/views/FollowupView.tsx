import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { store, useStore } from '../../store/nodeStore'
import type { Node } from '../../types'

// Tags reservados (no son tags de usuario)
const RESERVED_TYPES = new Set(['bucle', 'tarea', 'evento', 'agente', 'prompt', 'nota',
  'enlace', 'archivo', 'panel', 'busqueda', 'chat', 'favorito', 'seguimiento',
  'quick', 'magic', 'rec', 'area'])

function getUserTags(node: Node): string[] {
  return (node.types || []).filter(t => !RESERVED_TYPES.has(t))
}

// ── Due date badge ─────────────────────────────────────────────────────────────

function formatDueBadge(due: string): { label: string; cls: string } {
  const d = new Date(due)
  const now = new Date()
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1)
  const dDay = new Date(d); dDay.setHours(0, 0, 0, 0)

  // Check if it has a specific time (not midnight)
  const hasTime = d.getHours() !== 0 || d.getMinutes() !== 0

  const diffDays = Math.round((dDay.getTime() - today.getTime()) / 86400000)

  let label: string
  if (diffDays < 0) {
    label = diffDays === -1 ? 'Ayer' : `Hace ${Math.abs(diffDays)}d`
    if (hasTime && diffDays === 0) {
      label = d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
    }
  } else if (diffDays === 0) {
    label = hasTime
      ? d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
      : 'Hoy'
  } else if (diffDays === 1) {
    label = 'Mañana'
  } else {
    label = d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
    if (hasTime) label += ' ' + d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
  }

  let cls = 'followup-due-badge'
  if (d < now && !hasTime) cls += ' followup-due-badge--overdue'
  else if (d < now) cls += ' followup-due-badge--overdue'
  else if (diffDays === 0) cls += ' followup-due-badge--today'
  else if (diffDays === 1) cls += ' followup-due-badge--soon'

  return { label, cls }
}

// ── Priority dot ──────────────────────────────────────────────────────────────

function PriorityDot({ priority }: { priority: string | null | undefined }) {
  if (!priority) return null
  const colors = { high: '#ef4444', medium: '#f59e0b', low: '#22c55e' }
  const color = colors[priority as keyof typeof colors]
  return (
    <span
      className="followup-priority-dot"
      style={{ background: color }}
      title={`Prioridad ${priority}`}
    />
  )
}

// ── Task checkbox ─────────────────────────────────────────────────────────────

function TaskCheckbox({ node }: { node: Node }) {
  const isDone = node.status === 'done'
  return (
    <button
      className={`followup-task-checkbox ${isDone ? 'followup-task-checkbox--done' : ''}`}
      onClick={e => {
        e.stopPropagation()
        store.updateNode(node.id, { status: isDone ? 'pending' : 'done' })
      }}
      title={isDone ? 'Marcar como pendiente' : 'Marcar como hecha'}
    >
      {isDone && (
        <svg width="9" height="9" viewBox="0 0 9 9" fill="none">
          <path d="M1.5 4.5l2 2L7.5 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      )}
    </button>
  )
}

// ── Child task/event row ──────────────────────────────────────────────────────

interface ChildRowProps {
  node: Node
}

function ChildRow({ node }: ChildRowProps) {
  const navigate = useNavigate()
  const isDone = node.status === 'done'
  const isEvent = node.isEvent
  const due = node.due ? formatDueBadge(node.due) : null

  return (
    <div
      className={`followup-child-row ${isDone ? 'followup-child-row--done' : ''}`}
      onClick={() => navigate(`/node/${node.id}`)}
    >
      {/* Icon: event calendar or task checkbox */}
      {isEvent ? (
        <span className="followup-child-event-icon">📅</span>
      ) : (
        <TaskCheckbox node={node} />
      )}

      <span className={`followup-child-text ${isDone ? 'followup-child-text--done' : ''}`}>
        {node.text || 'Sin título'}
      </span>

      <PriorityDot priority={node.priority} />

      {due && (
        <span className={due.cls}>{due.label}</span>
      )}
    </div>
  )
}

// ── Seguimiento row (parent node + children) ──────────────────────────────────

interface SeguimientoRowProps {
  node: Node
}

function SeguimientoRow({ node }: SeguimientoRowProps) {
  const navigate = useNavigate()
  const [hovered, setHovered] = useState(false)
  const [childrenCollapsed, setChildrenCollapsed] = useState(false)

  // Children: tasks and events (exclude diary/temporal children)
  const children = useMemo(() => {
    const todayMidnight = new Date()
    todayMidnight.setHours(0, 0, 0, 0)

    return store.children(node.id).filter(n =>
      !n.deletedAt &&
      !n.isDiaryEntry &&
      (n.status !== null || n.isEvent)
    ).sort((a, b) => {
      // Done tasks always last
      if (a.status === 'done' && b.status !== 'done') return 1
      if (a.status !== 'done' && b.status === 'done') return -1

      // Among pending: Mac-style groups — overdue (0) → today/future (1) → no due (2)
      const groupOf = (n: Node) => {
        if (!n.due) return 2
        return new Date(n.due) < todayMidnight ? 0 : 1
      }
      const ga = groupOf(a)
      const gb = groupOf(b)
      if (ga !== gb) return ga - gb

      // Within group: due ASC (nulls last)
      if (a.due && b.due) return new Date(a.due).getTime() - new Date(b.due).getTime()
      if (a.due && !b.due) return -1
      if (!a.due && b.due) return 1
      return a.siblingOrder - b.siblingOrder
    })
  }, [node.id])

  const pendingChildren = children.filter(n => n.status !== 'done')
  const doneChildren = children.filter(n => n.status === 'done')
  const due = node.due ? formatDueBadge(node.due) : null

  function handleClose(e: React.MouseEvent) {
    e.stopPropagation()
    const types = (node.types || []).filter(t => t !== 'bucle')
    store.updateNode(node.id, { isSeguimiento: false, types })
  }

  return (
    <div
      className="followup-item"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Header row */}
      <div className="followup-item-header" onClick={() => navigate(`/node/${node.id}`)}>
        {/* Collapse toggle (only if has children) */}
        {children.length > 0 ? (
          <button
            className="followup-collapse-btn"
            onClick={e => { e.stopPropagation(); setChildrenCollapsed(v => !v) }}
          >
            <svg
              width="10" height="10" viewBox="0 0 10 10"
              style={{ transform: childrenCollapsed ? 'rotate(-90deg)' : 'rotate(0)', transition: 'transform 0.15s' }}
            >
              <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
            </svg>
          </button>
        ) : (
          <span className="followup-collapse-btn" style={{ opacity: 0 }}>
            <svg width="10" height="10" viewBox="0 0 10 10"/>
          </span>
        )}

        {/* Purple seguimiento bullet */}
        <span className="followup-seguimiento-bullet" />

        <span className="followup-item-title">{node.text || 'Sin título'}</span>

        <PriorityDot priority={node.priority} />

        {due && (
          <span className={due.cls}>{due.label}</span>
        )}

        {/* Pending count badge */}
        {pendingChildren.length > 0 && (
          <span className="followup-pending-badge">{pendingChildren.length}</span>
        )}

        {hovered && (
          <button
            className="followup-close-btn"
            onClick={handleClose}
            title="Desactivar nota"
          >
            ✓ Cerrar
          </button>
        )}
      </div>

      {/* Children */}
      {!childrenCollapsed && children.length > 0 && (
        <div className="followup-children">
          {/* Pending tasks + events first */}
          {pendingChildren.map(child => (
            <ChildRow key={child.id} node={child} />
          ))}
          {/* Done tasks (collapsible in future, for now always shown) */}
          {doneChildren.map(child => (
            <ChildRow key={child.id} node={child} />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Main view ─────────────────────────────────────────────────────────────────

export default function FollowupView() {
  const s = useStore()
  const [search, setSearch] = useState('')

  const allSeguimiento = useMemo(() => {
    return s.allActive().filter(n =>
      !n.deletedAt &&
      n.status !== 'done' &&
      (n.isSeguimiento || (n.types || []).includes('bucle'))
    ).sort((a, b) => {
      const pa = a.priority === 'high' ? 0 : a.priority === 'medium' ? 1 : 2
      const pb = b.priority === 'high' ? 0 : b.priority === 'medium' ? 1 : 2
      if (pa !== pb) return pa - pb
      return b.updatedAt.localeCompare(a.updatedAt)
    })
  }, [s])

  const filtered = useMemo(() => {
    if (!search.trim()) return allSeguimiento
    const q = search.toLowerCase()
    return allSeguimiento.filter(n => (n.text || '').toLowerCase().includes(q))
  }, [allSeguimiento, search])

  // Agrupar por tag de usuario
  const groups = useMemo(() => {
    const tagMap = new Map<string, Node[]>()
    const sinTag: Node[] = []

    for (const node of filtered) {
      const tags = getUserTags(node)
      if (tags.length === 0) {
        sinTag.push(node)
      } else {
        const tag = tags[0]
        if (!tagMap.has(tag)) tagMap.set(tag, [])
        tagMap.get(tag)!.push(node)
      }
    }

    const result: Array<{ tag: string | null; nodes: Node[] }> = []
    const sorted = [...tagMap.entries()].sort((a, b) => b[1].length - a[1].length)
    for (const [tag, nodes] of sorted) result.push({ tag, nodes })
    if (sinTag.length > 0) result.push({ tag: null, nodes: sinTag })
    return result
  }, [filtered])

  return (
    <div className="view followup-view">
      <div className="view-header">
        <h1 className="view-title">
          <span style={{ marginRight: 8, color: '#8b5cf6' }}>●</span>
          Bucles
          {allSeguimiento.length > 0 && (
            <span className="followup-total-count">{allSeguimiento.length}</span>
          )}
        </h1>
        <p className="view-subtitle">Bucles abiertos — bucles abiertos — notas activas agrupadas por tema</p>
      </div>

      <div className="view-body">
        <div className="followup-filters">
          <input
            type="text"
            className="followup-search"
            placeholder="Buscar..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {allSeguimiento.length === 0 && (
          <div className="view-empty">
            <p>Sin bucles abiertos.</p>
            <p style={{ fontSize: 13, color: 'var(--text-tertiary)', marginTop: 8 }}>
              Abre cualquier nota y conviértela en bucle para que aparezca aquí.
            </p>
          </div>
        )}

        {filtered.length === 0 && allSeguimiento.length > 0 && (
          <div className="view-empty">Sin resultados para "{search}"</div>
        )}

        {groups.map(({ tag, nodes }) => (
          <div key={tag ?? '__sin_tag__'} className="followup-group">
            {(groups.length > 1 || tag !== null) && (
              <div className="followup-group-header">
                <span
                  className="followup-group-label"
                  style={{ color: tag ? store.tagColor(tag) : undefined }}
                >
                  {tag ? `#${tag}` : 'Sin tag'}
                </span>
                <span className="followup-group-count">{nodes.length}</span>
              </div>
            )}
            {nodes.map(node => (
              <SeguimientoRow key={node.id} node={node} />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
