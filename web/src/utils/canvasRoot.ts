// Nodo-lienzo raíz DEDICADO (singleton, id determinista) = el contenedor del lienzo
// único. Renderiza SIEMPRE como pizarra (globalCanvas) de forma fiable (a diferencia
// de las raíces estructurales, que tienen render especial de lista). La cámara y los
// trazos viven en su body. El CONTENIDO que se pinta es tu árbol de contextos
// (ver PizarraView global), no los hijos de este nodo.
import { store } from '../store/nodeStore'
import type { Node } from '../types'
import { parseExtraData } from './papeleraHelper'
import { structuralId } from './deterministicId'

export const CANVAS_ROOT_NAME = '🌍 Lienzo'

/** Devuelve (creándolo si hace falta) el nodo-lienzo raíz, en modo pizarra. */
export function ensureCanvasRoot(): Node {
  const existing = [...store.nodes.values()].find(n => !n.deletedAt && n.text === CANVAS_ROOT_NAME)
  if (existing) {
    const ed = parseExtraData(existing.extraData)
    if (ed.viewBlock !== 'pizarra') {
      ed.viewBlock = 'pizarra'
      store.updateNode(existing.id, { extraData: JSON.stringify(ed) })
    }
    return existing
  }
  const node = store.createNode({
    text: CANVAS_ROOT_NAME,
    parentId: null,
    predefinedId: structuralId('canvas') ?? undefined, // id determinista → no duplica
  })
  store.updateNode(node.id, { extraData: JSON.stringify({ viewBlock: 'pizarra' }) })
  return store.getNode(node.id) ?? node
}

/** ¿Es este nodo la raíz-lienzo? (para que abra pizarra global aunque esté "vacío"). */
export function isCanvasRoot(node: Node | null | undefined): boolean {
  return !!node && !node.deletedAt && node.text === CANVAS_ROOT_NAME
}
