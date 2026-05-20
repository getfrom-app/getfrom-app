import { createPortal } from 'react-dom'
import { useState, useRef, useEffect } from 'react'
import { store, useStore } from '../../store/nodeStore'
import type { Node } from '../../types'

interface Props {
  node: Node
  onClose: () => void
}

export default function MoveNodeModal({ node, onClose }: Props) {
  const s = useStore()
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // Candidates: all active nodes except self, descendants, and diary entries
  const candidates = s.allActive().filter(n => {
    if (n.id === node.id) return false
    if (n.deletedAt) return false
    if (n.isDiaryEntry) return false
    if (query.trim()) {
      return (n.text || '').toLowerCase().includes(query.toLowerCase())
    }
    return n.parentId === null  // root notes when no query
  }).slice(0, 12)

  function moveTo(targetId: string | null) {
    const siblings = store.children(targetId)
    const maxOrder = siblings.reduce((max, n) => Math.max(max, n.siblingOrder), 0)
    store.updateNode(node.id, {
      parentId: targetId,
      siblingOrder: maxOrder + 1000,
    })
    onClose()
  }

  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card move-node-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-icon">→</span>
          <h2>Mover nota</h2>
          <button className="modal-close-btn" onClick={onClose}>×</button>
        </div>
        <div className="move-node-search">
          <input
            ref={inputRef}
            type="text"
            className="modal-input"
            placeholder="Buscar destino..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => { if (e.key === 'Escape') onClose() }}
          />
        </div>
        <div className="move-node-results">
          {/* Option: move to root */}
          <div className="move-node-item" onClick={() => moveTo(null)}>
            <span className="move-node-icon">🏠</span>
            <span>Raíz (sin padre)</span>
          </div>
          {candidates.map(n => (
            <div key={n.id} className="move-node-item" onClick={() => moveTo(n.id)}>
              <span className="move-node-icon">📄</span>
              <span className="move-node-text">{n.text || 'Sin título'}</span>
              {n.status === 'pending' && <span className="move-node-badge">tarea</span>}
            </div>
          ))}
          {candidates.length === 0 && query && (
            <div className="move-node-empty">Sin resultados para "{query}"</div>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}
