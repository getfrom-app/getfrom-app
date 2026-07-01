// Auto-layout del lienzo único (NO destructivo): calcula EN MEMORIA una posición
// para cada nodo del árbol de contenido que no tenga pin propio. Disposición en
// ESQUEMA VERTICAL (outline): contextos → subcontextos → elementos, indentados por
// profundidad, uno debajo de otro, para poder revisarlo fácil (no desperdigado).
// No escribe nada: si el usuario mueve algo, ESO se persiste (pin propio) y manda.
import { store } from '../store/nodeStore'
import type { Node } from '../types'
import { parseExtraData } from './papeleraHelper'

export interface LRect { x: number; y: number; w: number; h: number; zone: boolean }

const ROW_H = 40   // alto de línea reservado por nodo
const GAP_Y = 14   // separación vertical entre líneas
const INDENT = 56  // indentación por nivel de profundidad
const W = 620      // ancho de la tarjeta en la lista

function aggregable(n: Node): boolean {
  if (n.deletedAt) return false
  const ed = parseExtraData(n.extraData)
  if (ed._capture === '1' || ed._logAt) return false
  return !!(n.text && n.text.trim())
}

function realChildren(id: string): Node[] {
  return store.children(id).filter(aggregable)
}

/** Auto-layout del subárbol de `rootId` como esquema vertical (outline). */
export function computeCanvasLayout(rootId: string): Map<string, LRect> {
  const out = new Map<string, LRect>()
  let y = 0
  const walk = (id: string, depth: number) => {
    for (const n of realChildren(id)) {
      const kids = realChildren(n.id)
      out.set(n.id, { x: depth * INDENT, y, w: W, h: ROW_H, zone: kids.length > 0 })
      y += ROW_H + GAP_Y
      if (kids.length) walk(n.id, depth + 1) // hijos indentados, justo debajo
    }
  }
  walk(rootId, 0)
  return out
}
