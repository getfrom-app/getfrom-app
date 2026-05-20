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

  // All children (not just tasks) for tree view
  const children = s.children(nodeId).filter(n => !n.deletedAt)

  // Siblings
  const siblings = node.parentId
    ? s.children(node.parentId).filter(n => !n.deletedAt)
    : []

  // Outgoing links (refs stored in extraData.refs)
  const outgoingLinks = (() => {
    try {
      const ed = JSON.parse(node.extraData || '{}')
      const refs: string[] = ed.refs || []
      return refs.map(id => s.getNode(id)).filter((n): n is NonNullable<typeof n> => !!n && !n.deletedAt).slice(0, 5)
    } catch { return [] }
  })()

  const hasContent = childTasks.length > 0 || tagNodes.length > 0 || backlinks.length > 0 || relatedByTag.length > 0 || children.length > 0 || outgoingLinks.length > 0

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

      {/* Outgoing links */}
      {outgoingLinks.length > 0 && (
        <div className="context-section">
          <div className="context-section-label">→ Enlaza a</div>
          {outgoingLinks.map(n => (
            <div key={n.id} className="context-backlink" onClick={() => navigate(`/node/${n.id}`)}>
              {n.text || 'Sin título'}
            </div>
          ))}
        </div>
      )}

      {/* Backlinks */}
      {backlinks.length > 0 && (
        <div className="context-section">
          <div className="context-section-label">← Mencionado en</div>
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

      {/* Subárbol del nodo */}
      {children.length > 0 && (
        <div className="context-section">
          <div className="context-section-label">Contenido ({children.length} bullets)</div>
          {children.slice(0, 8).map(child => (
            <div key={child.id} className="context-child" onClick={() => navigate(`/node/${child.id}`)}>
              <span className="context-child-bullet">
                {child.status === 'done' ? '✓' : child.status === 'pending' ? '○' : '·'}
              </span>
              <span className="context-child-text">{child.text || 'Sin título'}</span>
              {s.children(child.id).length > 0 && (
                <span className="context-child-count">{s.children(child.id).length}</span>
              )}
            </div>
          ))}
          {children.length > 8 && (
            <div className="context-more">+{children.length - 8} más</div>
          )}
        </div>
      )}

      {/* Notas hermanas */}
      {node.parentId && siblings.length > 1 && (
        <div className="context-section">
          <div className="context-section-label">Hermanas ({siblings.length - 1})</div>
          {siblings.filter(sib => sib.id !== node.id).slice(0, 5).map(sib => (
            <div key={sib.id} className="context-backlink" onClick={() => navigate(`/node/${sib.id}`)}>
              <span>{sib.text || 'Sin título'}</span>
            </div>
          ))}
        </div>
      )}

      {/* Historial */}
      <div className="context-section">
        <div className="context-section-label">Historial</div>
        <div className="context-timestamps">
          <div className="context-ts-row">
            <span className="context-ts-label">Creado:</span>
            <span className="context-ts-value">{new Date(node.createdAt).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
          </div>
          <div className="context-ts-row">
            <span className="context-ts-label">Modificado:</span>
            <span className="context-ts-value">{new Date(node.updatedAt).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
          </div>
          <div className="context-ts-row">
            <span className="context-ts-label">ID:</span>
            <span className="context-ts-value" style={{ fontFamily: 'monospace', fontSize: 10 }}>{node.id.slice(0, 8)}...</span>
          </div>
        </div>
      </div>

      {!hasContent && (
        <div className="context-empty">Sin contexto adicional</div>
      )}
    </div>
  )
}
