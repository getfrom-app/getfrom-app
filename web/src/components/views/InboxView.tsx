import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { store, useStore } from '../../store/nodeStore'
import type { Node } from '../../types'

export default function InboxView() {
  const s = useStore()
  const navigate = useNavigate()
  const [processedIds, setProcessedIds] = useState<Set<string>>(new Set())

  // "Inbox" = nodos sin padres, sin estado específico, sin ser diario, recientes (últimos 30 días)
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const inboxItems = useMemo(() => {
    return s.allActive()
      .filter(n => {
        if (n.deletedAt || n.isDiaryEntry || n.isFavorite) return false
        if (n.parentId) return false // solo raíz
        if (processedIds.has(n.id)) return false
        // Recientes (creados en los últimos 30 días)
        return new Date(n.createdAt) > thirtyDaysAgo
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }, [s, processedIds])

  function markProcessed(id: string) {
    setProcessedIds(prev => new Set([...prev, id]))
  }

  function quickMove(node: Node, targetParentId: string | null) {
    const siblings = store.children(targetParentId)
    const maxOrder = siblings.reduce((max, n) => Math.max(max, n.siblingOrder), 0)
    store.updateNode(node.id, { parentId: targetParentId, siblingOrder: maxOrder + 1000 })
    markProcessed(node.id)
  }

  return (
    <div className="view inbox-view">
      <div className="view-header">
        <h1 className="view-title">
          📥 Inbox
          {inboxItems.length > 0 && (
            <span className="inbox-count">{inboxItems.length}</span>
          )}
        </h1>
        <p className="view-subtitle">Notas recientes sin organizar. Revísalas y muévelas a donde correspondan.</p>
      </div>

      <div className="view-body">
        {inboxItems.length === 0 ? (
          <div className="view-empty">
            <div style={{ fontSize: 32, marginBottom: 12 }}>✓</div>
            <div>Tu inbox está vacío. Todas las notas recientes están organizadas.</div>
          </div>
        ) : (
          <div className="inbox-list">
            {inboxItems.map(item => (
              <div key={item.id} className="inbox-item">
                <div className="inbox-item-main" onClick={() => navigate(`/node/${item.id}`)}>
                  <span className="inbox-item-icon">
                    {item.status === 'pending' ? '○' : item.status === 'done' ? '✓' : item.isEvent ? '📅' : (item.types || []).includes('bucle') ? '↺' : '📄'}
                  </span>
                  <div className="inbox-item-content">
                    <span className="inbox-item-title">{item.text || 'Sin título'}</span>
                    {item.body && <span className="inbox-item-preview">{item.body.slice(0, 60)}...</span>}
                    <span className="inbox-item-date">{new Date(item.createdAt).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}</span>
                  </div>
                </div>
                <div className="inbox-item-actions">
                  <button
                    className="inbox-action-btn inbox-action-btn--keep"
                    onClick={() => store.updateNode(item.id, { isFavorite: true })}
                    title="Marcar como favorito"
                  >★</button>
                  <button
                    className="inbox-action-btn inbox-action-btn--done"
                    onClick={() => markProcessed(item.id)}
                    title="Marcar como procesado"
                  >✓</button>
                  <button
                    className="inbox-action-btn inbox-action-btn--delete"
                    onClick={() => {
                      store.deleteNode(item.id)
                      markProcessed(item.id)
                    }}
                    title="Eliminar"
                  >✕</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
