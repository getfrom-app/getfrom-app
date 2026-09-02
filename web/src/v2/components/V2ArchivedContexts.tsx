// Archivo de contextos — lista los contextos archivados (`archiveContext`,
// cajones.ts) y permite DESARCHIVARLOS: vuelven a la sidebar con TODO su
// contenido (mismo criterio que Papelera pero para contextos enteros, no
// nodos sueltos — no comparte lista con ella porque un contexto archivado
// no vive bajo 🗑 Papelera, ver comentario en cajones.ts).
import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { useStore } from '../../store/nodeStore'
import { listArchivedContexts, unarchiveContext, contextPathLabel } from '../../utils/cajones'
import Icon from './Icon'
import { displayTitle } from '../../utils/displayText'

export default function V2ArchivedContexts({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation()
  useStore()
  const [, force] = useState(0)
  const [q, setQ] = useState('')

  const allItems = listArchivedContexts()
  const needle = q.trim().toLowerCase()
  const items = needle ? allItems.filter(n => (n.text || '').toLowerCase().includes(needle)) : allItems

  const restore = (id: string) => {
    unarchiveContext(id)
    force(x => x + 1)
  }

  const title = (txt: string) => displayTitle(txt, t('v2.untitled', 'Sin título'))

  return createPortal((
    <div className="v2-modal-overlay" onMouseDown={onClose}>
      <div className="v2-modal" onMouseDown={e => e.stopPropagation()}>
        <div className="v2-modal-head">
          <span className="v2-modal-title">{t('v2.archivedContexts.title', 'Archivo de contextos')}</span>
          <button className="v2-modal-close" onClick={onClose}>×</button>
        </div>
        {allItems.length > 0 && (
          <div className="v2-modal-search">
            <Icon name="search" size={14} />
            <input
              autoFocus
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder={t('v2.archivedContexts.searchPlaceholder', 'Buscar en el archivo')}
            />
          </div>
        )}
        <div className="v2-modal-body">
          {allItems.length === 0 ? (
            <div className="v2-right-empty" style={{ padding: '30px 12px' }}>{t('v2.archivedContexts.empty', 'No hay contextos archivados.')}</div>
          ) : items.length === 0 ? (
            <div className="v2-right-empty" style={{ padding: '30px 12px' }}>{t('v2.archivedContexts.noSearchResults', 'Nada coincide con la búsqueda.')}</div>
          ) : (
            items.map(n => (
              <div className="v2-el-row" key={n.id} style={{ cursor: 'default' }}>
                <span className="v2-el-icon"><Icon name="archive" size={15} /></span>
                <span className="v2-el-main">
                  <span className="v2-el-title">{title(n.text)}</span>
                  {contextPathLabel(n.id) && <span className="v2-el-meta">{contextPathLabel(n.id)}</span>}
                </span>
                <button className="v2-trash-restore" onClick={() => restore(n.id)}>{t('v2.archivedContexts.unarchive', 'Desarchivar')}</button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  ), document.body)
}
