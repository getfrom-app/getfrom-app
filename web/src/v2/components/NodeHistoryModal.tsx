// NodeHistoryModal — historial del cuerpo de una nota, con undo. P2 "Confiar"
// de la Parte II de la auditoría (29 ago 2026). Lista los checkpoints
// guardados por DocEditor.tsx (uno cada ~5 min de edición activa) y permite
// volver a uno anterior — el revert es un `store.updateNode` normal, el
// mismo camino de guardado de siempre, no un endpoint especial.
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { store } from '../../store/nodeStore'
import { listNodeBodyVersions, getNodeBodyVersion, type NodeVersionSummary } from '../../api/nodeHistory'
import Icon from './Icon'

interface Props {
  nodeId: string
  onClose: () => void
}

export default function NodeHistoryModal({ nodeId, onClose }: Props) {
  const { t, i18n } = useTranslation()
  const [versions, setVersions] = useState<NodeVersionSummary[] | null>(null)
  const [error, setError] = useState(false)
  const [restoringId, setRestoringId] = useState<string | null>(null)
  const [restoredId, setRestoredId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    listNodeBodyVersions(nodeId)
      .then(v => { if (!cancelled) setVersions(v) })
      .catch(() => { if (!cancelled) setError(true) })
    return () => { cancelled = true }
  }, [nodeId])

  async function restore(versionId: string) {
    setRestoringId(versionId)
    try {
      const body = await getNodeBodyVersion(nodeId, versionId)
      store.updateNode(nodeId, { body })
      setRestoredId(versionId)
    } catch { /* deja el modal abierto para reintentar */ }
    finally { setRestoringId(null) }
  }

  return createPortal(
    <div className="modal-backdrop" onClick={onClose}>
      <div className="v2-templates-modal" onClick={e => e.stopPropagation()}>
        <div className="v2-templates-head">
          <span className="v2-templates-title">{t('v2.history.title', 'Historial de esta nota')}</span>
          <button className="v2-iconbtn" title={t('common.close', 'Cerrar')} onClick={onClose}><Icon name="close" /></button>
        </div>
        <div className="v2-templates-body">
          {error ? (
            <div className="v2-templates-empty">{t('v2.history.loadError', 'No se pudo cargar el historial.')}</div>
          ) : versions === null ? (
            <div className="v2-templates-empty">{t('common.loading', 'Cargando…')}</div>
          ) : versions.length === 0 ? (
            <div className="v2-templates-empty">{t('v2.history.emptyHint', 'Todavía no hay versiones guardadas de esta nota — se van creando mientras la editas.')}</div>
          ) : (
            <ul className="v2-templates-list">
              {versions.map(v => (
                <li key={v.id} className="v2-templates-item" style={{ alignItems: 'flex-start' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1, minWidth: 0, padding: '6px 4px' }}>
                    <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                      {new Date(v.createdAt).toLocaleString(i18n.language)}
                    </span>
                    <span style={{ fontSize: 13, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {v.preview || t('v2.history.emptyPreview', '(vacío)')}
                    </span>
                  </div>
                  <button
                    className="v2-templates-item-name"
                    style={{ flexShrink: 0, width: 'auto' }}
                    disabled={restoringId === v.id}
                    onClick={() => restore(v.id)}
                  >
                    {restoredId === v.id ? t('v2.history.restored', 'Restaurado ✓') : restoringId === v.id ? t('v2.history.restoring', 'Restaurando…') : t('v2.history.restore', 'Restaurar')}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}
