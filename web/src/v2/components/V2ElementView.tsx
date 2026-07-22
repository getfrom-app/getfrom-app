// Vista de un elemento (documento/PDF/imagen/audio/nota/tarea/evento): cabecera
// (volver + título editable + publicar/eliminar si es un recurso + fechas) +
// cuerpo (V2DetailView). Extraído de V2RightColumn para reutilizarse en DOS
// sitios (Alberto, 22 jul: "los elementos deberían poder abrirse igual que el
// chat en el espacio principal... la columna derecha mantendría todo igual"):
//   1. Columna derecha, tab Detalles — SOLO para el artifact de la conversación
//      activa (el elemento que el chat está creando/usando en este momento).
//   2. Espacio central — para cualquier otro elemento abierto (Elementos,
//      Agenda, sidebar, búsqueda…), reemplazando al chat como hace el Perfil.
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

export default function V2ElementView({ nodeId, onClose, onSelectCtx, onOpenElementsFiltered, hideBack }: {
  nodeId: string
  onClose: () => void
  onSelectCtx: (id: string) => void
  onOpenElementsFiltered?: (kind: ElemKind) => void
  /** El espacio central sustituye, no apila — no hay «atrás» al que volver
   *  (la siguiente navegación ya reemplaza esto). En la columna derecha
   *  (tab Detalles) sí hace falta: cierra el artifact y descubre el chat
   *  debajo (Alberto, 22 jul: "cada vez que se abre algo, se sustituye lo
   *  que había... no es necesario que haya un botón atrás"). */
  hideBack?: boolean
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
          {!hideBack && <button className="v2-iconbtn" onClick={onClose} title={t('v2.rightColumn.back', 'Volver')}>‹</button>}
          <EditableTitle nodeId={nodeId} />
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
        {node && (
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
