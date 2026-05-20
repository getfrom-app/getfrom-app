import { useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useStore } from '../../store/nodeStore'

function formatDue(due: string): string {
  const d = new Date(due)
  return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
}

const PRIORITY_LABEL: Record<string, string> = {
  high: 'Alta',
  medium: 'Media',
  low: 'Baja',
}

const PRIORITY_CLASS: Record<string, string> = {
  high: 'priority-high',
  medium: 'priority-medium',
  low: 'priority-low',
}

export default function TagView() {
  const { name } = useParams<{ name: string }>()
  const navigate = useNavigate()
  const s = useStore()

  const tagName = name || ''

  const results = useMemo(() => {
    if (!tagName) return []
    return s.allActive().filter(n => (n.types || []).includes(tagName))
  }, [tagName, s])

  if (!tagName) {
    return <div className="view search-view"><div className="view-empty">Tag no especificado</div></div>
  }

  const tagColor = s.tagColor(tagName)

  return (
    <div className="view search-view">
      <div className="view-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 0 8px' }}>
          <span style={{
            fontSize: 22,
            fontWeight: 700,
            color: tagColor || 'var(--accent)',
            letterSpacing: '-0.01em',
          }}>
            #{tagName}
          </span>
          <span style={{
            fontSize: 13,
            color: 'var(--text-tertiary)',
            fontWeight: 400,
          }}>
            {results.length} {results.length === 1 ? 'nota' : 'notas'}
          </span>
        </div>
      </div>

      <div className="view-body">
        {results.length === 0 && (
          <div className="view-empty">Sin notas con #{tagName}</div>
        )}

        {results.map(node => (
          <div
            key={node.id}
            className="search-result"
            onClick={() => navigate(`/node/${node.id}`)}
          >
            <div className="search-result-main">
              <span className="result-text">{node.text || 'Sin título'}</span>
              {node.isFavorite && <span className="result-badge favorite" title="Favorito">★</span>}
            </div>
            <div className="search-result-meta">
              {node.status !== null && (
                <span className={`result-badge status-badge ${node.status}`}>
                  {node.status === 'pending' ? '○ Pendiente' : '✓ Hecho'}
                </span>
              )}
              {node.priority && (
                <span className={`result-badge priority-badge ${PRIORITY_CLASS[node.priority]}`}>
                  {PRIORITY_LABEL[node.priority]}
                </span>
              )}
              {node.due && (
                <span className="result-badge due-badge">
                  📅 {formatDue(node.due)}
                </span>
              )}
              {node.isEvent && (
                <span className="result-badge event-badge">Evento</span>
              )}
              {(node.types || []).includes('bucle') && (
                <span className="result-badge loop-badge">Bucle</span>
              )}
              {node.body && (
                <span className="result-preview" style={{
                  fontSize: 12,
                  color: 'var(--text-tertiary)',
                  marginLeft: 4,
                  fontStyle: 'italic',
                }}>
                  {node.body.slice(0, 60)}{node.body.length > 60 ? '…' : ''}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
