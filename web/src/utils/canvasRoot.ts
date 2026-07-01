// El lienzo único = tu árbol de CONTENIDO real (la raíz 🧠 Contexto). No es un
// nodo nuevo vacío: es donde ya viven tus contextos/subcontextos. Se renderiza en
// modo pizarra (globalCanvas) como UN plano; los nodos sin posición se auto-colocan
// (utils/canvasLayout), sin tocar datos. No se navega: es la superficie fija.
import { store } from '../store/nodeStore'
import type { Node } from '../types'
import { parseExtraData } from './papeleraHelper'
import { findContextRoot } from './rootLookup'

/** Devuelve (asegurando modo pizarra) la raíz del lienzo = raíz 🧠 Contexto. */
export function ensureCanvasRoot(): Node {
  const root = findContextRoot()
  if (!root) {
    // Fallback defensivo: si aún no cargó la raíz de contexto, no crear nada raro;
    // devolver un placeholder mínimo (el caller navega y reintenta al cargar).
    return store.allActive()[0] ?? ({ id: '', text: '', extraData: null } as unknown as Node)
  }
  const ed = parseExtraData(root.extraData)
  if (ed.viewBlock !== 'pizarra') {
    ed.viewBlock = 'pizarra'
    store.updateNode(root.id, { extraData: JSON.stringify(ed) })
  }
  return root
}

/** ¿Es este nodo la raíz del lienzo (raíz de contexto)? */
export function isCanvasRoot(node: Node | null | undefined): boolean {
  if (!node || node.deletedAt) return false
  const root = findContextRoot()
  return !!root && root.id === node.id
}
