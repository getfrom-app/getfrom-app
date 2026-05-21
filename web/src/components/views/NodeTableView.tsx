import { useNavigate } from 'react-router-dom'
import { store, useStore } from '../../store/nodeStore'

interface Props { parentId: string }

export default function NodeTableView({ parentId }: Props) {
  const s = useStore()
  const navigate = useNavigate()
  const children = store.children(parentId).filter(n => !n.deletedAt)

  // Detect which columns have data
  const hasStatus = children.some(n => n.status !== null)
  const hasDue = children.some(n => n.due)
  const hasTags = children.some(n => (n.types || []).length > 0)
  const hasPriority = children.some(n => n.priority)

  if (children.length === 0) return (
    <div className="node-table-empty">Sin elementos</div>
  )

  return (
    <div className="node-table-wrapper">
      <table className="node-table">
        <thead>
          <tr>
            <th className="node-table-th node-table-th--title">Título</th>
            {hasStatus && <th className="node-table-th">Estado</th>}
            {hasDue && <th className="node-table-th">Fecha</th>}
            {hasPriority && <th className="node-table-th">Prioridad</th>}
            {hasTags && <th className="node-table-th">Tags</th>}
          </tr>
        </thead>
        <tbody>
          {children.map(node => {
            const grandchildren = store.children(node.id).filter(n => !n.deletedAt).length
            const tags = (node.types || []).filter(t => !['bucle','seguimiento','nota','tarea','proyecto','área'].includes(t))
            return (
              <tr
                key={node.id}
                className={`node-table-row ${node.status === 'done' ? 'node-table-row--done' : ''}`}
                onClick={() => navigate(`/node/${node.id}`)}
              >
                <td className="node-table-td node-table-td--title">
                  <span className="node-table-title">
                    {node.text || 'Sin título'}
                  </span>
                  {grandchildren > 0 && (
                    <span className="node-table-children-badge">{grandchildren}</span>
                  )}
                </td>
                {hasStatus && (
                  <td className="node-table-td" onClick={e => {
                    e.stopPropagation()
                    if (node.status === null) store.updateNode(node.id, { status: 'pending' })
                    else if (node.status === 'pending') store.updateNode(node.id, { status: 'done' })
                    else store.updateNode(node.id, { status: null })
                  }}>
                    {node.status === null ? (
                      <span className="node-table-status node-table-status--none">—</span>
                    ) : node.status === 'pending' ? (
                      <span className="node-table-status node-table-status--pending">○ Pendiente</span>
                    ) : (
                      <span className="node-table-status node-table-status--done">✓ Hecho</span>
                    )}
                  </td>
                )}
                {hasDue && (
                  <td className="node-table-td">
                    {node.due ? (
                      <span className="node-table-due">
                        {new Date(node.due).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                      </span>
                    ) : <span className="node-table-empty-cell">—</span>}
                  </td>
                )}
                {hasPriority && (
                  <td className="node-table-td">
                    {node.priority === 'high' ? <span className="node-table-priority high">↑ Alta</span>
                    : node.priority === 'medium' ? <span className="node-table-priority medium">→ Media</span>
                    : node.priority === 'low' ? <span className="node-table-priority low">↓ Baja</span>
                    : <span className="node-table-empty-cell">—</span>}
                  </td>
                )}
                {hasTags && (
                  <td className="node-table-td">
                    <div className="node-table-tags">
                      {tags.map(t => (
                        <span key={t} className="node-table-tag" style={{ background: s.tagColor(t) + '20', color: s.tagColor(t) }}>#{t}</span>
                      ))}
                    </div>
                  </td>
                )}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
