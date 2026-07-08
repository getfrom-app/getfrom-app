// Fila de ELEMENTO reutilizable de la columna derecha (Historial / Contexto /
// Conversación). Título a varias líneas (nunca se corta), y en lugar de la etiqueta
// de tipo (el icono ya lo dice) muestra el CONTEXTO al que pertenece, si hay alguno.
// El menú contextual (clic derecho) se añade aquí para todas las tabs a la vez.
import { firstContextOf, contextColor } from '../../utils/cajones'
import type { Node } from '../../types'

interface Props {
  node: Node
  icon: string
  onOpen: (id: string) => void
  child?: boolean          // fila indentada (elemento dentro de una conversación)
  extraMeta?: string       // texto extra a la derecha del chip (p.ej. la fecha en Historial)
  hideContext?: boolean    // no mostrar el chip de contexto (vista ya dentro de ese contexto)
}

export default function V2ElementRow({ node, icon, onOpen, child, extraMeta, hideContext }: Props) {
  const ctx = hideContext ? null : firstContextOf(node)
  const title = (node.text || '').replace(/^[✦💬]\s*/, '').trim() || 'Sin título'
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
    </div>
  )
}
