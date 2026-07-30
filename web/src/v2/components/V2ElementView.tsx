// Vista de un elemento (documento/PDF/imagen/audio/nota/tarea/evento): cabecera
// (título editable + botón de chat + publicar/eliminar si es un recurso +
// fechas) + cuerpo (V2DetailView). ÚNICO sitio donde se abre un elemento
// (`V2App.centerElementId`, espacio central) — desde el rediseño del 30 jul
// ya no hay una segunda instancia «artifact» en la columna derecha: su chat
// asociado vive ahí (V2ElementChat/V2RightColumn.tsx), pero el elemento en sí
// solo se ve una vez, aquí.
import { useStore, store } from '../../store/nodeStore'
import { useTranslation } from 'react-i18next'
import { parseExtraData } from '../../utils/papeleraHelper'
import PublishButton from '../../components/PublishButton'
import V2DetailView from './V2DetailView'
import { elementDisplayTitle } from '../../utils/docNode'
import { fmtDate, fmtDateFull } from '../../utils/formatDate'
import { useState } from 'react'
import type { ElemKind } from '../../components/panels/ElementsPanel'

// Título de la cabecera — clic para renombrar el nodo.
function EditableTitle({ nodeId }: { nodeId: string }) {
  useStore()
  const { t } = useTranslation()
  const [editing, setEditing] = useState(false)
  const node = store.getNode(nodeId)
  const title = elementDisplayTitle(node).replace(/^✦\s*/, '').trim().slice(0, 80) || t('v2.rightColumn.element', 'Elemento')
  if (editing) {
    return (
      <input
        autoFocus
        className="v2-detail-title-input"
        defaultValue={title}
        onClick={e => e.stopPropagation()}
        onKeyDown={e => {
          if (e.key === 'Enter') { const v = (e.target as HTMLInputElement).value.trim(); if (v) store.updateNode(nodeId, { text: v }); setEditing(false) }
          if (e.key === 'Escape') setEditing(false)
        }}
        onBlur={e => { const v = e.target.value.trim(); if (v && v !== title) store.updateNode(nodeId, { text: v }); setEditing(false) }}
      />
    )
  }
  return (
    <span className="v2-center-title v2-detail-title" title={t('v2.rightColumn.clickToRename', 'Clic para renombrar')} onClick={() => setEditing(true)}
      style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', cursor: 'text' }}>
      {title}
    </span>
  )
}

export default function V2ElementView({ nodeId, onClose, onSelectCtx, onOpenElementsFiltered, onOpenChat }: {
  nodeId: string
  onClose: () => void
  onSelectCtx: (id: string) => void
  onOpenElementsFiltered?: (kind: ElemKind) => void
  /** Abre la tab Detalles (columna derecha) — que YA es el chat de este elemento,
   *  siempre (V2RightColumn.tsx). Solo un atajo/afordancia junto al título; no
   *  crea ni gestiona nada aquí. */
  onOpenChat?: () => void
}) {
  useStore()
  const { t, i18n } = useTranslation()
  const node = store.getNode(nodeId)
  // Recursos (PDF/imagen/audio/enlace/podcast…) llevan publicar+eliminar AQUÍ, en la
  // cabecera, junto al título — antes cada visor de recurso repetía el título en su
  // propia fila solo para poder colgar estos 2 botones (redundante: el título ya
  // está arriba). Nota/tarea NO: ya tienen su propia barra con más acciones propias.
  const ed = node ? parseExtraData(node.extraData) : {}
  const isResourceLike = !!node && (node.isResource || !!node.resourceType || Array.isArray(ed._audios))
  return (
    <div className="v2-right-fill">
      <div className="v2-detail-head">
        <div className="v2-detail-head-top">
          <EditableTitle nodeId={nodeId} />
          {onOpenChat && node && (
            <button className="v2-iconbtn" onClick={onOpenChat} title={t('v2.rightColumn.chatAboutThis', 'Hablar de esto')}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
            </button>
          )}
          {isResourceLike && node && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <PublishButton node={node} />
              <button
                title={t('tip.delete', 'Eliminar')}
                onClick={() => { store.deleteNode(node.id); onClose() }}
                className="v2-iconbtn"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>
              </button>
            </div>
          )}
        </div>
        {/* Nota diaria: la fecha YA es el título, «Creado/Modificado» no aporta
            nada (Alberto, 22 jul: "en las notas diarias arriba no hace falta
            que ponga la fecha de creación y modificación... es indiferente"). */}
        {node && !node.isDiaryEntry && (
          <div className="v2-detail-dates" title={`${t('v2.rightColumn.created', 'Creado')}: ${fmtDateFull(node.createdAt, i18n.language)}\n${t('v2.rightColumn.updated', 'Modificado')}: ${fmtDateFull(node.updatedAt, i18n.language)}`}>
            {t('v2.rightColumn.created', 'Creado')} {fmtDate(node.createdAt, i18n.language)}
            {node.updatedAt && node.updatedAt !== node.createdAt && (
              <> · {t('v2.rightColumn.updated', 'Modificado')} {fmtDate(node.updatedAt, i18n.language)}</>
            )}
          </div>
        )}
      </div>
      <div className="v2-detail-body"><V2DetailView nodeId={nodeId} onSelectCtx={onSelectCtx} onOpenElementsFiltered={onOpenElementsFiltered} /></div>
    </div>
  )
}
