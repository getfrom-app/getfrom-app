// ContextChip — chip ÚNICO de contexto en toda la app: píldora redondeada con el
// color del contexto, nombre clicable (cambiar/navegar) y «×» para quitarlo SIEMPRE.
// Lo usan RowContextChip (contexto asignado a una tarea/nota) y el cockpit (contexto
// padre de un contexto). Estilo unificado: no más chips cuadrados.
import { contextColor, contextPath } from '../../utils/cajones'
import type { Node } from '../../types'

export default function ContextChip({
  context,
  onClick,
  onRemove,
  title = 'Contexto',
  removeTitle = 'Quitar contexto',
  /** Sin píldora — texto plano de color, junto a la fecha (24 ago 2026,
   *  paridad iOS: "quita los bordes de los hashtags"). Sigue siendo clicable:
   *  la web no tiene swipe, así que el clic es la única forma de reasignar. */
  flat = false,
}: {
  context: Node
  onClick?: (e: React.MouseEvent) => void
  onRemove?: (e: React.MouseEvent) => void
  title?: string
  removeTitle?: string
  flat?: boolean
}) {
  const color = contextColor(context.id)
  // Tag anidado: `#tag/subtag`. Los tramos padre van atenuados y el propio en
  // color pleno — se ve de dónde cuelga sin que el chip grite la ruta entera.
  const path = contextPath(context.id) || ''
  const parts = path ? path.split('/') : []
  const leaf = parts.length ? parts[parts.length - 1] : (context.text || 'Contexto')
  // El chip es estrecho: de la ruta se enseña como mucho el tramo padre más
  // cercano, con `…/` delante si hay más arriba. Cortar por el final escondía
  // justo la hoja — el nombre del contexto — y dejaba a la vista los ancestros,
  // que es lo menos informativo (visto en `#la-isla/marketing/…`, 20 ago 2026).
  // La ruta entera sigue en el `title`.
  const parents = parts.slice(0, -1)
  const parentPath = parents.length === 0 ? ''
    : parents.length === 1 ? parents[0]
    : '…/' + parents[parents.length - 1]
  return (
    <span className={`ctx-chip${flat ? ' ctx-chip--flat' : ''}`} style={{ ['--chip' as string]: color }}>
      <span className="ctx-chip-name" title={path ? `#${path}` : title} onClick={onClick}>
        <span className="ctx-chip-path">#{parentPath ? parentPath + '/' : ''}</span>{leaf}
      </span>
      {onRemove && (
        <button className="ctx-chip-x" title={removeTitle} aria-label={removeTitle}
          onClick={e => { e.stopPropagation(); e.preventDefault(); onRemove(e) }}>×</button>
      )}
    </span>
  )
}
