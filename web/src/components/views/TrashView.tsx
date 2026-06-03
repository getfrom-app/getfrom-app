import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { store, useStore } from '../../store/nodeStore'
import { deleteFile } from '../../api/client'

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function TrashView() {
  const s = useStore()
  const navigate = useNavigate()
  const { t } = useTranslation()
  const [search, setSearch] = useState('')
  const [confirmClear, setConfirmClear] = useState(false)

  const deletedNodes = useMemo(() => {
    return [...store.nodes.values()]
      .filter(n => n.deletedAt)   // todos los eliminados, incluyendo diarios y temporales
      .filter(n => !search || (n.text || '').toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => (b.deletedAt ?? '').localeCompare(a.deletedAt ?? ''))
      .slice(0, 100)
  }, [s, search]) // eslint-disable-line react-hooks/exhaustive-deps

  function handleRestore(id: string) {
    const deleted = store.getNode(id)
    if (!deleted) return

    // Buscar si ya existe un nodo activo con el mismo nombre bajo el mismo padre
    const siblings = store.children(deleted.parentId ?? null)
    const conflict = siblings.find(n =>
      n.id !== id &&
      !n.deletedAt &&
      (n.text || '').toLowerCase() === (deleted.text || '').toLowerCase()
    )

    if (conflict) {
      // Merge: mover todos los hijos del nodo eliminado al nodo existente
      const children = store.children(id)
      const existingChildrenCount = store.children(conflict.id).filter(c => !c.deletedAt).length
      children.forEach((child, idx) => {
        store.updateNode(child.id, {
          parentId: conflict.id,
          siblingOrder: existingChildrenCount + idx + 1,
        })
      })
      // Eliminar permanentemente el duplicado (ya fusionado)
      store.updateNode(id, { deletedAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 365 * 10).toISOString() })
      window.dispatchEvent(new CustomEvent('from:toast', {
        detail: { message: `"${deleted.text}" fusionado con nodo existente`, type: 'success' }
      }))
    } else {
      // Restaurar normalmente
      store.updateNode(id, { deletedAt: null })
    }
  }

  async function handlePermanentDelete(id: string) {
    const node = store.getNode(id)
    if (!node) return
    // Eliminar archivo de R2 si el nodo tiene un archivo adjunto
    try {
      const ed = JSON.parse(node.extraData || '{}')
      if (ed._resourceKey) await deleteFile(ed._resourceKey as string)
    } catch { /* silencioso */ }
    // Hard delete: marca con fecha muy futura para que el servidor lo elimine
    store.updateNode(id, { deletedAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 365).toISOString() })
  }

  async function handleClearTrash() {
    for (const n of deletedNodes) {
      await handlePermanentDelete(n.id)
    }
    setConfirmClear(false)
  }

  return (
    <div className="view trash-view">
      <div className="view-header">
        <div className="trash-header-row">
          <h1 className="view-title">{t('trash.title')}</h1>
          <span className="trash-count">{deletedNodes.length} elemento{deletedNodes.length !== 1 ? 's' : ''}</span>
        </div>
        <p className="view-subtitle">{t('trash.hint')}</p>
        <div className="trash-actions-bar">
          <input
            type="text"
            className="search-input"
            placeholder={t('trash.searchPlaceholder')}
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {deletedNodes.length > 0 && (
            !confirmClear ? (
              <button className="btn-secondary" style={{ fontSize: 12 }} onClick={() => setConfirmClear(true)}>
                {t('trash.empty')}
              </button>
            ) : (
              <div className="trash-confirm-row">
                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{t('trash.confirmEmpty')}</span>
                <button className="btn-primary" style={{ fontSize: 12, background: '#ef4444' }} onClick={handleClearTrash}>
                  {t('common.yes')}, {t('common.delete').toLowerCase()}
                </button>
                <button className="btn-secondary" style={{ fontSize: 12 }} onClick={() => setConfirmClear(false)}>
                  {t('common.cancel')}
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
            <div>{search ? `${t('search.noResultsFor')} "${search}"` : 'La papelera está vacía'}</div>
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
                    <span className="trash-item-title">{node.text || t('common.noTitle')}</span>
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
                  <button
                    className="trash-delete-btn"
                    onClick={() => handlePermanentDelete(node.id)}
                    title="Eliminar permanentemente"
                  >
                    🗑 Eliminar
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
