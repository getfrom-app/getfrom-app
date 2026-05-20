import { useNavigate } from 'react-router-dom'
import { useStore } from '../../store/nodeStore'

interface Props {
  nodeId: string
}

export default function NodeContextPanel({ nodeId }: Props) {
  const s = useStore()
  const node = s.getNode(nodeId)
  const navigate = useNavigate()

  if (!node) return null

  // Child tasks
  const childTasks = s.children(nodeId).filter(n => n.status !== null && !n.deletedAt)

  // Related by tag
  const tags = node.types || []
  const tagNodes = s.tagDefinitions().filter(td => tags.includes(s.tagName(td) || ''))

  // Backlinks: nodes that @mention this node's text or reference this node's id via extraData.refs
  const nodeText = node.text || ''
  const backlinks = s.allActive().filter(n => {
    if (n.id === nodeId) return false
    if (nodeText.length > 2 && n.text.includes('@' + nodeText)) return true
    try {
      const ed = JSON.parse(n.extraData || '{}')
      return (ed.refs || []).includes(nodeId)
    } catch { return false }
  }).slice(0, 10)

  // Related by shared tags
  const relatedByTag = tags.length > 0
    ? s.allActive().filter(n => {
        if (n.id === nodeId || n.deletedAt) return false
        return (n.types || []).some(t => tags.includes(t))
      })
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, 5)
    : []

  const hasContent = childTasks.length > 0 || tagNodes.length > 0 || backlinks.length > 0 || relatedByTag.length > 0

  return (
    <div className="node-context-panel">
      {/* Child tasks */}
      {childTasks.length > 0 && (
        <div className="context-section">
          <div className="context-section-label">Subtareas</div>
          {childTasks.slice(0, 10).map(t => (
            <div key={t.id} className="context-task-row" onClick={() => navigate(`/node/${t.id}`)}>
              <span className="context-task-status">{t.status === 'done' ? '✓' : '○'}</span>
              <span className="context-task-text">{t.text || 'Sin título'}</span>
            </div>
          ))}
        </div>
      )}

      {/* Tag areas */}
      {tagNodes.map(td => (
        <div key={td.id} className="context-section">
          <div className="context-section-label">#{s.tagName(td)}</div>
          <div className="context-tag-link" onClick={() => navigate(`/node/${td.id}`)}>
            Ver área completa →
          </div>
        </div>
      ))}

      {/* Backlinks */}
      {backlinks.length > 0 && (
        <div className="context-section">
          <div className="context-section-label">Mencionado en</div>
          {backlinks.map(n => (
            <div key={n.id} className="context-backlink" onClick={() => navigate(`/node/${n.id}`)}>
              {n.text || 'Sin título'}
            </div>
          ))}
        </div>
      )}

      {/* Related by shared tags */}
      {relatedByTag.length > 0 && (
        <div className="context-section">
          <div className="context-section-label">Relacionadas</div>
          {relatedByTag.map(n => (
            <div key={n.id} className="context-backlink" onClick={() => navigate(`/node/${n.id}`)}>
              {n.text || 'Sin título'}
            </div>
          ))}
        </div>
      )}

      {!hasContent && (
        <div className="context-empty">Sin contexto adicional</div>
      )}
    </div>
  )
}
