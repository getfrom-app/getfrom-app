// Fila de ELEMENTO reutilizable de la columna derecha (Historial / Contexto /
// Conversación). Título a varias líneas (nunca se corta), y en lugar de la etiqueta
// de tipo (el icono ya lo dice) muestra el CONTEXTO al que pertenece, si hay alguno.
// El menú contextual (clic derecho) se añade aquí para todas las tabs a la vez.
import { useTranslation } from 'react-i18next'
import { store } from '../../store/nodeStore'
import { firstContextOf, contextColor } from '../../utils/cajones'
import type { Node } from '../../types'

interface Props {
  node: Node
  icon: string
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
  const { t } = useTranslation()
  const ctx = hideContext ? null : firstContextOf(node)
  const title = (node.text || '').replace(/^(?:✦|💬)\s*/u, '').trim() || t('v2.elementRow.untitled', 'Sin título')
  const del = (e: React.MouseEvent) => {
    e.stopPropagation(); e.preventDefault()
    store.deleteNode(node.id)
    window.dispatchEvent(new CustomEvent('from:toast', { detail: { message: t('v2.elementRow.movedToTrash', 'Movido a la papelera'), type: 'success' } }))
  }
  return (
    <div
      className={`v2-el-row ${child ? 'v2-el-child' : ''}`}
      onClick={() => onOpen(node.id)}
      onContextMenu={e => {
        e.preventDefault(); e.stopPropagation()
        window.dispatchEvent(new CustomEvent('from:open-rowmenu', { detail: { nodeId: node.id, x: e.clientX, y: e.clientY } }))
      }}
    >
      <span className="v2-el-icon">{icon}</span>
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
          <svg width="13" height="13" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M6 6l8 8M14 6l-8 8"/><rect x="2" y="14" width="16" height="4" rx="1"/></svg>
        </button>
      )}
      <button className="v2-el-del" title={t('tip.delete', 'Eliminar')} onClick={del}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>
      </button>
    </div>
  )
}
