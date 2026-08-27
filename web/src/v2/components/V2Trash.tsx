// Papelera de Fromly 2.0 — lista los nodos eliminados (hijos del nodo 🗑 Papelera) y
// permite RESTAURARLOS (vuelven a su sitio) o vaciar la papelera. Reutiliza los
// helpers reales de v1 (papeleraHelper): borrado suave y reversible.
import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { useStore } from '../../store/nodeStore'
import { trashItems, restoreNode, emptyTrash } from '../../utils/papeleraHelper'
import Icon from './Icon'
import { displayTitle } from '../../utils/displayText'

export default function V2Trash({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation()
  useStore()
  const [, force] = useState(0)
  const [q, setQ] = useState('')
  // Los nodos en papelera llevan lápida (`deletedAt`): es lo que hace que el resto
  // de la app no los vea. Aquí se listan a propósito.
  const allItems = trashItems()
  // Buscador — con miles de nodos borrados acumulados (27 ago 2026, Alberto,
  // tras ver 1912 elementos de golpe) desplazarse a mano para encontrar uno
  // concreto no es viable.
  const needle = q.trim().toLowerCase()
  const items = needle ? allItems.filter(n => (n.text || '').toLowerCase().includes(needle)) : allItems

  const restore = (id: string) => { restoreNode(id); force(x => x + 1) }
  const empty = () => {
    if (!allItems.length) return
    // Vacía SIEMPRE toda la papelera, no solo lo que el buscador esté
    // filtrando en este momento — un buscador que solo borrara "lo visible"
    // sería una trampa fácil de pisar sin querer.
    if (window.confirm(t('v2.trash.confirmEmpty', '¿Vaciar la papelera? Se eliminarán definitivamente {{count}} elemento(s). No se puede deshacer.', { count: allItems.length }))) {
      emptyTrash(); force(x => x + 1)
    }
  }

  const title = (txt: string) => displayTitle(txt, t('v2.untitled', 'Sin título'))

  return createPortal((
    <div className="v2-modal-overlay" onMouseDown={onClose}>
      <div className="v2-modal" onMouseDown={e => e.stopPropagation()}>
        <div className="v2-modal-head">
          <span className="v2-modal-title">{t('v2.trash.title', 'Papelera')}</span>
          <button className="v2-modal-close" onClick={onClose}>×</button>
        </div>
        {allItems.length > 0 && (
          <div className="v2-modal-search">
            <Icon name="search" size={14} />
            <input
              autoFocus
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder={t('v2.trash.searchPlaceholder', 'Buscar en la papelera')}
            />
          </div>
        )}
        <div className="v2-modal-body">
          {allItems.length === 0 ? (
            <div className="v2-right-empty" style={{ padding: '30px 12px' }}>{t('v2.trash.empty', 'La papelera está vacía.')}</div>
          ) : items.length === 0 ? (
            <div className="v2-right-empty" style={{ padding: '30px 12px' }}>{t('v2.trash.noSearchResults', 'Nada coincide con la búsqueda.')}</div>
          ) : (
            items.map(n => (
              <div className="v2-el-row" key={n.id} style={{ cursor: 'default' }}>
                <span className="v2-el-icon"><Icon name="trash" size={15} /></span>
                <span className="v2-el-main"><span className="v2-el-title">{title(n.text)}</span></span>
                <button className="v2-trash-restore" onClick={() => restore(n.id)}>{t('v2.trash.restore', 'Restaurar')}</button>
              </div>
            ))
          )}
        </div>
        {allItems.length > 0 && (
          <div className="v2-modal-foot">
            <button className="v2-trash-empty" onClick={empty}>{t('v2.trash.emptyBtn', 'Vaciar papelera ({{count}})', { count: allItems.length })}</button>
          </div>
        )}
      </div>
    </div>
  ), document.body)
}
