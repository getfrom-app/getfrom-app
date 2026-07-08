// ContextChip — chip ÚNICO de contexto en toda la app: píldora redondeada con el
// color del contexto, nombre clicable (cambiar/navegar) y «×» para quitarlo SIEMPRE.
// Lo usan RowContextChip (contexto asignado a una tarea/nota) y el cockpit (contexto
// padre de un contexto). Estilo unificado: no más chips cuadrados.
import { contextColor } from '../../utils/cajones'
import type { Node } from '../../types'

export default function ContextChip({
  context,
  onClick,
  onRemove,
  title = 'Contexto',
  removeTitle = 'Quitar contexto',
}: {
  context: Node
  onClick?: (e: React.MouseEvent) => void
  onRemove?: (e: React.MouseEvent) => void
  title?: string
  removeTitle?: string
}) {
  const color = contextColor(context.id)
  return (
    <span className="ctx-chip" style={{ ['--chip' as string]: color }}>
      <span className="ctx-chip-name" title={title} onClick={onClick}>{context.text || 'Contexto'}</span>
      {onRemove && (
        <button className="ctx-chip-x" title={removeTitle} aria-label={removeTitle}
          onClick={e => { e.stopPropagation(); e.preventDefault(); onRemove(e) }}>×</button>
      )}
    </span>
  )
}
