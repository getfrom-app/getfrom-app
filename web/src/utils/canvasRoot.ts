// Nodo-lienzo raíz único (singleton) = el lienzo infinito de la app.
// Es un nodo normal en modo pizarra: NodeView le da el lienzo (PizarraView) con
// toda su barra (escribir/dibujar/tareas/guardar-vista) + la columna derecha,
// reutilizando TODO. Su cámara se persiste en su body (ya lo hace PizarraView) →
// abre donde lo dejaste. El contenido que creas son sus hijos; las zonas que
// guardas con «guardar vista» serán subcontextos hijos de él.
import { store } from '../store/nodeStore'
import type { Node } from '../types'
import { parseExtraData } from './papeleraHelper'
import { structuralId } from './deterministicId'

export const CANVAS_ROOT_NAME = '🌍 Lienzo'

/** Devuelve (creándolo si hace falta) el nodo-lienzo raíz, en modo pizarra. */
export function ensureCanvasRoot(): Node {
  const existing = [...store.nodes.values()].find(n => !n.deletedAt && n.text === CANVAS_ROOT_NAME)
  if (existing) {
    // Asegurar que abre en pizarra
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

/** ¿Es este nodo la raíz-lienzo? (para que abra pizarra aunque esté vacío). */
export function isCanvasRoot(node: Node | null | undefined): boolean {
  return !!node && !node.deletedAt && node.text === CANVAS_ROOT_NAME
}
