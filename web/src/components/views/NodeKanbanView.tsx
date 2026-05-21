import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { store, useStore } from '../../store/nodeStore'

interface Props { parentId: string }

export default function NodeKanbanView({ parentId }: Props) {
  const s = useStore()
  const navigate = useNavigate()
  const [newCardCol, setNewCardCol] = useState<string | null>(null)
  const [newCardText, setNewCardText] = useState('')
  const children = store.children(parentId).filter(n => !n.deletedAt)

  const columns = [
    { id: 'none', label: 'Sin estado', status: null as null | string },
    { id: 'pending', label: 'Pendiente', status: 'pending' as null | string },
    { id: 'done', label: 'Hecho', status: 'done' as null | string },
  ]

  function getCards(status: null | string) {
    return children.filter(n => n.status === status)
  }

  function handleAddCard(colId: string, status: null | string) {
    if (!newCardText.trim()) { setNewCardCol(null); return }
    store.createNode({
      text: newCardText.trim(),
      parentId,
      isTask: status !== null,
      siblingOrder: Date.now(),
    })
    if (status !== null) {
      // will be set by createNode isTask flag → status='pending', but for 'done' we need extra update
    }
    setNewCardText('')
    setNewCardCol(null)
  }

  return (
    <div className="node-kanban">
      {columns.map(col => {
        const cards = getCards(col.status)
        return (
          <div key={col.id} className="node-kanban-col">
            <div className="node-kanban-col-header">
              <span className="node-kanban-col-label">{col.label}</span>
              <span className="node-kanban-col-count">{cards.length}</span>
            </div>
            <div className="node-kanban-cards">
              {cards.map(node => (
                <div
                  key={node.id}
                  className="node-kanban-card"
                  onClick={() => navigate(`/node/${node.id}`)}
                >
                  <span className="node-kanban-card-title">{node.text || 'Sin título'}</span>
                  {node.due && (
                    <span className="node-kanban-card-due">
                      📅 {new Date(node.due).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                    </span>
                  )}
                  {(node.types || []).filter(t => !['bucle','nota','tarea','proyecto','área'].includes(t)).map(t => (
                    <span key={t} className="node-kanban-card-tag" style={{ background: s.tagColor(t) + '20', color: s.tagColor(t) }}>#{t}</span>
                  ))}
                </div>
              ))}
              {newCardCol === col.id ? (
                <div className="node-kanban-add-input">
                  <input
                    autoFocus
                    className="node-kanban-card-input"
                    value={newCardText}
                    onChange={e => setNewCardText(e.target.value)}
                    placeholder="Título..."
                    onKeyDown={e => {
                      if (e.key === 'Enter') handleAddCard(col.id, col.status)
                      if (e.key === 'Escape') { setNewCardCol(null); setNewCardText('') }
                    }}
                    onBlur={() => handleAddCard(col.id, col.status)}
                  />
                </div>
              ) : (
                <button className="node-kanban-add-btn" onClick={() => setNewCardCol(col.id)}>
                  + Añadir
                </button>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
