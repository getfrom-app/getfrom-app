import { useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useStore, store } from '../../store/nodeStore'

function formatDue(due: string): string {
  const d = new Date(due)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const target = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const diff = Math.round((target.getTime() - today.getTime()) / 86400000)
  if (diff === 0) return 'hoy'
  if (diff === 1) return 'mañana'
  if (diff === -1) return 'ayer'
  if (diff < 0) return `hace ${Math.abs(diff)}d`
  return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
}

const PRIORITY_ORDER: Record<string, number> = { high: 0, medium: 1, low: 2 }

type SortKey = 'updated' | 'priority' | 'due' | 'alpha'
type KindFilter = 'all' | 'tasks' | 'notes' | 'events'

export default function TagView() {
  const { name } = useParams<{ name: string }>()
  const navigate = useNavigate()
  const s = useStore()

  const [sortBy, setSortBy] = useState<SortKey>('updated')
  const [showDone, setShowDone] = useState(false)
  const [kindFilter, setKindFilter] = useState<KindFilter>('all')
  const [search, setSearch] = useState('')

  const tagName = name || ''
  const tagColor = s.tagColor(tagName)

  const allTagged = useMemo(() => {
    if (!tagName) return []
    return s.allActive().filter(n => (n.types || []).includes(tagName))
  }, [tagName, s])

  const results = useMemo(() => {
    let items = allTagged
    if (!showDone) items = items.filter(n => n.status !== 'done')
    if (kindFilter === 'tasks') items = items.filter(n => n.status !== null)
    else if (kindFilter === 'notes') items = items.filter(n => n.status === null && !n.isEvent)
    else if (kindFilter === 'events') items = items.filter(n => n.isEvent)
    if (search.trim()) {
      const q = search.toLowerCase()
      items = items.filter(n => n.text.toLowerCase().includes(q) || (n.body || '').toLowerCase().includes(q))
    }
    // Sort
    const sorted = [...items]
    if (sortBy === 'updated') sorted.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    else if (sortBy === 'priority') {
      sorted.sort((a, b) => {
        const pa = PRIORITY_ORDER[a.priority ?? ''] ?? 3
        const pb = PRIORITY_ORDER[b.priority ?? ''] ?? 3
        return pa - pb
      })
    } else if (sortBy === 'due') {
      sorted.sort((a, b) => {
        if (!a.due && !b.due) return 0
        if (!a.due) return 1
        if (!b.due) return -1
        return a.due.localeCompare(b.due)
      })
    } else if (sortBy === 'alpha') {
      sorted.sort((a, b) => a.text.localeCompare(b.text, 'es'))
    }
    return sorted
  }, [allTagged, showDone, kindFilter, search, sortBy])

  const pending = allTagged.filter(n => n.status === 'pending').length
  const done = allTagged.filter(n => n.status === 'done').length
  const notes = allTagged.filter(n => n.status === null && !n.isEvent).length

  if (!tagName) {
    return <div className="view"><div className="view-empty">Tag no especificado</div></div>
  }

  return (
    <div className="view tag-view">
      <div className="view-header">
        <div className="tag-view-header">
          <span className="tag-view-title" style={{ color: tagColor }}>#{tagName}</span>
          <div className="tag-view-stats">
            {pending > 0 && <span className="tag-stat">○ {pending} pendiente{pending !== 1 ? 's' : ''}</span>}
            {done > 0 && <span className="tag-stat tag-stat--done">✓ {done} hecha{done !== 1 ? 's' : ''}</span>}
            {notes > 0 && <span className="tag-stat">📄 {notes} nota{notes !== 1 ? 's' : ''}</span>}
          </div>
        </div>

        {/* Filters row */}
        <div className="tag-view-filters">
          <input
            className="tag-view-search"
            type="text"
            placeholder="Filtrar..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <div className="tag-kind-tabs">
            {([['all', 'Todos'], ['tasks', 'Tareas'], ['notes', 'Notas'], ['events', 'Eventos']] as [KindFilter, string][]).map(([k, l]) => (
              <button
                key={k}
                className={`tag-kind-tab ${kindFilter === k ? 'active' : ''}`}
                onClick={() => setKindFilter(k)}
              >{l}</button>
            ))}
          </div>
          <select className="tag-sort-select" value={sortBy} onChange={e => setSortBy(e.target.value as SortKey)}>
            <option value="updated">Recientes</option>
            <option value="priority">Prioridad</option>
            <option value="due">Fecha</option>
            <option value="alpha">A–Z</option>
          </select>
          <label className="tag-done-toggle">
            <input type="checkbox" checked={showDone} onChange={e => setShowDone(e.target.checked)} />
            <span>Mostrar hechas</span>
          </label>
        </div>

        <div className="tag-view-count">{results.length} {results.length === 1 ? 'resultado' : 'resultados'}</div>
      </div>

      <div className="view-body">
        {results.length === 0 && (
          <div className="view-empty">Sin resultados para #{tagName}</div>
        )}

        {results.map(node => {
          const isDone = node.status === 'done'
          const overdue = node.due && new Date(node.due) < new Date() && node.status === 'pending'
          return (
            <div
              key={node.id}
              className={`tag-result ${isDone ? 'tag-result--done' : ''}`}
              onClick={() => navigate(`/node/${node.id}`)}
            >
              {/* Left: status indicator */}
              <div className="tag-result-indicator">
                {node.status === 'done'
                  ? <span style={{ color: '#22c55e', fontSize: 14 }}>✓</span>
                  : node.status === 'pending'
                    ? <button
                        className="tag-result-check"
                        onClick={e => {
                          e.stopPropagation()
                          store.updateNode(node.id, { status: 'done' })
                        }}
                      >○</button>
                    : node.isEvent
                      ? <span style={{ fontSize: 14 }}>📅</span>
                      : <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>📄</span>
                }
              </div>

              {/* Main content */}
              <div className="tag-result-main">
                <span className="tag-result-text">{node.text || 'Sin título'}</span>
                {node.body && (
                  <span className="tag-result-preview">{node.body.slice(0, 80)}{node.body.length > 80 ? '…' : ''}</span>
                )}
                <div className="tag-result-meta">
                  {node.priority && (
                    <span className={`result-badge priority-badge priority-badge--${node.priority}`}>
                      {node.priority === 'high' ? '▲ Alta' : node.priority === 'medium' ? '● Media' : '▽ Baja'}
                    </span>
                  )}
                  {node.due && (
                    <span className={`result-badge ${overdue ? 'due-badge--overdue' : 'due-badge'}`}>
                      📅 {formatDue(node.due)}
                    </span>
                  )}
                  {node.isFavorite && <span style={{ fontSize: 11, color: '#f59e0b' }}>★</span>}
                  {(node.types || []).filter(t => t !== tagName).slice(0, 3).map(t => (
                    <span key={t} className="result-badge" style={{ background: s.tagColor(t) + '20', color: s.tagColor(t) }}>#{t}</span>
                  ))}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
