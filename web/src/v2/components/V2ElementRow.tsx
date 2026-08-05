// Fila de ELEMENTO reutilizable de la columna derecha (Historial / Contexto /
// Conversación). Título a varias líneas (nunca se corta), y en lugar de la etiqueta
// de tipo (el icono ya lo dice) muestra el CONTEXTO al que pertenece, si hay alguno.
// El menú contextual (clic derecho) se añade aquí para todas las tabs a la vez.
import { useTranslation } from 'react-i18next'
import { store } from '../../store/nodeStore'
import { firstContextOf, contextColor } from '../../utils/cajones'
import { fmtDateFull } from '../../utils/formatDate'
import Icon, { type IconName } from './Icon'
import { displayTitle } from '../../utils/displayText'
import type { Node } from '../../types'

interface Props {
  node: Node
  /** Nombre de icono del sistema propio (components/Icon.tsx) — nunca un emoji. */
  icon: IconName
  onOpen: (id: string) => void
  child?: boolean          // fila indentada (elemento dentro de una conversación)
  extraMeta?: string       // texto extra a la derecha del chip (p.ej. la fecha en Historial)
  hideContext?: boolean    // no mostrar el chip de contexto (vista ya dentro de ese contexto)
  /** Si se pasa, aparece un botón «quitar de aquí» (distinto de eliminar): saca el
   *  elemento de este contenedor (p.ej. una conversación) sin borrarlo — sigue en
   *  Fromly y buscable, solo deja de estar «dentro» de este sitio concreto. */
  onDetach?: (id: string) => void
}

export default function V2ElementRow({ node, icon, onOpen, child, extraMeta, hideContext, onDetach }: Props) {
  const { t, i18n } = useTranslation()
  const ctx = hideContext ? null : firstContextOf(node)
  // `displayTitle` quita el emoji decorativo escrito en el propio dato («✦ …»,
  // «💬 …», «🤖 …») — la UI ya pone el icono del sistema a la izquierda.
  const title = displayTitle(node.text, t('v2.elementRow.untitled', 'Sin título'))
  const del = (e: React.MouseEvent) => {
    e.stopPropagation(); e.preventDefault()
    const deletedIds = store.deleteNode(node.id)
    if (deletedIds.length === 0) return
    window.dispatchEvent(new CustomEvent('from:toast', {
      detail: {
        message: t('v2.elementRow.movedToTrash', 'Movido a la papelera'),
        type: 'success',
        action: { label: t('tip.undo', 'Deshacer'), onClick: () => store.restoreDeleted(deletedIds) },
      },
    }))
  }
  const datesTip = `${t('v2.rightColumn.created', 'Creado')}: ${fmtDateFull(node.createdAt, i18n.language)}\n${t('v2.rightColumn.updated', 'Modificado')}: ${fmtDateFull(node.updatedAt, i18n.language)}`
  return (
    <div
      className={`v2-el-row ${child ? 'v2-el-child' : ''}`}
      title={datesTip}
      onClick={() => onOpen(node.id)}
      onContextMenu={e => {
        e.preventDefault(); e.stopPropagation()
        window.dispatchEvent(new CustomEvent('from:open-rowmenu', { detail: { nodeId: node.id, x: e.clientX, y: e.clientY } }))
      }}
    >
      <span className="v2-el-icon"><Icon name={icon} size={16} /></span>
      <span className="v2-el-main">
        <span className="v2-el-title">{title}</span>
        {(ctx || extraMeta) && (
          <span className="v2-el-metarow">
            {ctx && (
              <span className="v2-el-ctxchip" style={{ ['--chip' as string]: contextColor(ctx.id) }}>
                {ctx.text}
              </span>
            )}
            {extraMeta && <span className="v2-el-meta">{extraMeta}</span>}
          </span>
        )}
      </span>
      {/* Quitar de la conversación (no borra, solo desengancha) + Eliminar — al hover. */}
      {onDetach && (
        <button className="v2-el-del" title={t('v2.elementRow.detach', 'Quitar de esta conversación')} onClick={e => { e.stopPropagation(); e.preventDefault(); onDetach(node.id) }}>
          <Icon name="close" size={14} />
        </button>
      )}
      <button className="v2-el-del" title={t('tip.delete', 'Eliminar')} onClick={del}>
        <Icon name="trash" size={14} />
      </button>
    </div>
  )
}
