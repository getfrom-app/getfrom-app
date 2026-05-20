import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { store, useStore } from '../../store/nodeStore'
import type { Node } from '../../types'

function formatDue(due: string): string {
  const d = new Date(due)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  d.setHours(0, 0, 0, 0)
  const diff = Math.round((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
  if (diff === 0) return 'Hoy'
  if (diff === -1) return 'Ayer'
  if (diff === 1) return 'Mañana'
  if (diff < 0) return `Hace ${Math.abs(diff)} días`
  return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
}

const PRIORITY_ORDER: Record<string, number> = { high: 0, medium: 1, low: 2 }

interface BucleRowProps {
  bucle: Node
  onMarkDone: (id: string) => void
}

function BucleRow({ bucle, onMarkDone }: BucleRowProps) {
  const navigate = useNavigate()
  const [collapsed, setCollapsed] = useState(false)
  const [hovered, setHovered] = useState(false)

  const children = useMemo(
    () => store.children(bucle.id).filter(n => n.status === 'pending' && !n.deletedAt),
    [bucle.id]
  )

  const priorityColor =
    bucle.priority === 'high'
      ? '#ef4444'
      : bucle.priority === 'medium'
      ? '#f59e0b'
      : bucle.priority === 'low'
      ? '#6b7280'
      : undefined

  return (
    <div className="followup-bucle">
      <div
        className="followup-bucle-header"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {/* Collapse toggle */}
        {children.length > 0 && (
          <button
            className="followup-collapse-btn"
            onClick={() => setCollapsed(v => !v)}
            title={collapsed ? 'Expandir' : 'Colapsar'}
          >
            <svg
              width="10"
              height="10"
              viewBox="0 0 10 10"
              style={{ transform: collapsed ? 'rotate(-90deg)' : 'rotate(0deg)', transition: 'transform 0.15s' }}
            >
              <path d="M2.5 3.5L5 6.5L7.5 3.5" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" />
            </svg>
          </button>
        )}
        {children.length === 0 && <span style={{ width: 18 }} />}

        {/* Loop icon */}
        <span className="followup-loop-icon" style={{ color: priorityColor || 'var(--text-tertiary)' }}>↺</span>

        {/* Title */}
        <button
          className="followup-bucle-title"
          onClick={() => navigate(`/node/${bucle.id}`)}
          title="Ver nodo"
        >
          {bucle.text || 'Sin título'}
        </button>

        {/* Meta */}
        <div className="followup-bucle-meta">
          {children.length > 0 && (
            <span className="followup-child-count">{children.length} pendiente{children.length !== 1 ? 's' : ''}</span>
          )}
          {bucle.due && (
            <span
              className={`followup-due ${new Date(bucle.due) < new Date() ? 'followup-due--overdue' : ''}`}
            >
              📅 {formatDue(bucle.due)}
            </span>
          )}
          {bucle.priority && (
            <span className="followup-priority" style={{ color: priorityColor }}>
              {bucle.priority === 'high' ? '▲ Alta' : bucle.priority === 'medium' ? '● Media' : '▽ Baja'}
            </span>
          )}
        </div>

        {/* Close button on hover */}
        {hovered && (
          <button
            className="followup-close-btn"
            onClick={e => {
              e.stopPropagation()
              onMarkDone(bucle.id)
            }}
            title="Cerrar bucle"
          >
            ✓ Cerrar
          </button>
        )}
      </div>

      {/* Children */}
      {!collapsed && children.length > 0 && (
        <div className="followup-children">
          {children.map(child => (
            <div
              key={child.id}
              className="followup-child"
              onClick={() => navigate(`/node/${child.id}`)}
            >
              <span className="followup-child-bullet">○</span>
              <span className="followup-child-text">{child.text || 'Sin título'}</span>
              {child.due && (
                <span className="followup-child-due">📅 {formatDue(child.due)}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function FollowupView() {
  const s = useStore()

  const activeBucles = useMemo(() => {
    return s.allActive()
      .filter(n => (n.types || []).includes('bucle') && n.status !== 'done' && !n.deletedAt)
      .sort((a, b) => {
        const pa = PRIORITY_ORDER[a.priority ?? ''] ?? 3
        const pb = PRIORITY_ORDER[b.priority ?? ''] ?? 3
        if (pa !== pb) return pa - pb
        return a.text.localeCompare(b.text, 'es')
      })
  }, [s])

  function handleMarkDone(id: string) {
    store.updateNode(id, { status: 'done' })
  }

  // Group by priority
  const highPriority = activeBucles.filter(n => n.priority === 'high')
  const mediumPriority = activeBucles.filter(n => n.priority === 'medium')
  const lowPriority = activeBucles.filter(n => n.priority === 'low')
  const noPriority = activeBucles.filter(n => !n.priority)

  const groups: Array<{ label: string; nodes: Node[]; color?: string }> = []
  if (highPriority.length > 0) groups.push({ label: 'Alta prioridad', nodes: highPriority, color: '#ef4444' })
  if (mediumPriority.length > 0) groups.push({ label: 'Media prioridad', nodes: mediumPriority, color: '#f59e0b' })
  if (lowPriority.length > 0) groups.push({ label: 'Baja prioridad', nodes: lowPriority, color: '#6b7280' })
  if (noPriority.length > 0) groups.push({ label: 'Sin prioridad', nodes: noPriority })

  return (
    <div className="view followup-view">
      <div className="view-header">
        <h1 className="view-title">
          <span style={{ marginRight: 8 }}>↺</span>
          En seguimiento
          {activeBucles.length > 0 && (
            <span className="followup-total-count">{activeBucles.length}</span>
          )}
        </h1>
        <p className="view-subtitle">Bucles activos pendientes de cierre</p>
      </div>

      <div className="view-body">
        {activeBucles.length === 0 && (
          <div className="view-empty">
            No hay bucles activos. Crea uno escribiendo <code>/bucle</code> en cualquier nota.
          </div>
        )}

        {groups.map(group => (
          <div key={group.label} className="followup-group">
            <div className="followup-group-header" style={{ color: group.color }}>
              <span className="followup-group-label">{group.label}</span>
              <span className="followup-group-count">{group.nodes.length}</span>
            </div>
            {group.nodes.map(bucle => (
              <BucleRow
                key={bucle.id}
                bucle={bucle}
                onMarkDone={handleMarkDone}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
