import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { store, useStore } from '../../store/nodeStore'

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function TrashView() {
  const s = useStore()
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [confirmClear, setConfirmClear] = useState(false)

  const deletedNodes = useMemo(() => {
    return [...store.nodes.values()]
      .filter(n => n.deletedAt && !n.isDiaryEntry)
      .filter(n => !search || n.text.toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => (b.deletedAt ?? '').localeCompare(a.deletedAt ?? ''))
      .slice(0, 100)
  }, [s, search]) // eslint-disable-line react-hooks/exhaustive-deps

  function handleRestore(id: string) {
    store.updateNode(id, { deletedAt: null })
  }

  function handlePermanentDelete(id: string) {
    // Hard delete: remove from the local map and mark as dirty to sync
    store.updateNode(id, { deletedAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 365).toISOString() })
  }

  function handleClearTrash() {
    for (const n of deletedNodes) {
      handlePermanentDelete(n.id)
    }
    setConfirmClear(false)
  }

  return (
    <div className="view trash-view">
      <div className="view-header">
        <div className="trash-header-row">
          <h1 className="view-title">🗑 Papelera</h1>
          <span className="trash-count">{deletedNodes.length} elemento{deletedNodes.length !== 1 ? 's' : ''}</span>
        </div>
        <p className="view-subtitle">Elementos eliminados en los últimos 30 días.</p>
        <div className="trash-actions-bar">
          <input
            type="text"
            className="search-input"
            placeholder="Buscar en papelera..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {deletedNodes.length > 0 && (
            !confirmClear ? (
              <button className="btn-secondary" style={{ fontSize: 12 }} onClick={() => setConfirmClear(true)}>
                Vaciar papelera
              </button>
            ) : (
              <div className="trash-confirm-row">
                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>¿Seguro?</span>
                <button className="btn-primary" style={{ fontSize: 12, background: '#ef4444' }} onClick={handleClearTrash}>
                  Sí, eliminar
                </button>
                <button className="btn-secondary" style={{ fontSize: 12 }} onClick={() => setConfirmClear(false)}>
                  Cancelar
                </button>
              </div>
            )
          )}
        </div>
      </div>

      <div className="view-body">
        {deletedNodes.length === 0 ? (
          <div className="view-empty">
            <div style={{ fontSize: 32, marginBottom: 12 }}>✓</div>
            <div>{search ? `Sin resultados para "${search}"` : 'La papelera está vacía'}</div>
          </div>
        ) : (
          <div className="trash-list">
            {deletedNodes.map(node => (
              <div key={node.id} className="trash-item">
                <div className="trash-item-info" onClick={() => navigate(`/node/${node.id}`)}>
                  <span className="trash-item-icon">
                    {node.status === 'pending' ? '○' : node.status === 'done' ? '✓' : node.isEvent ? '📅' : (node.types || []).includes('bucle') ? '↺' : '📄'}
                  </span>
                  <div className="trash-item-content">
                    <span className="trash-item-title">{node.text || 'Sin título'}</span>
                    {node.body && <span className="trash-item-preview">{node.body.slice(0, 80)}</span>}
                    {node.deletedAt && (
                      <span className="trash-item-date">Eliminado: {formatDate(node.deletedAt)}</span>
                    )}
                  </div>
                </div>
                <div className="trash-item-actions">
                  <button
                    className="trash-restore-btn"
                    onClick={() => handleRestore(node.id)}
                    title="Restaurar"
                  >
                    ↩ Restaurar
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
