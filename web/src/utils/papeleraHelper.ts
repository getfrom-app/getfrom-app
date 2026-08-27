/**
 * papeleraHelper — Papelera como nodo del árbol de Fromly.
 *
 * Los nodos eliminados se mueven al nodo 🗑 Papelera en lugar de
 * ser soft-deleted. La jerarquía se preserva:
 *
 *   Si eliminas A (hijo de B):         Papelera → A
 *   Si luego eliminas B (padre de A):  Papelera → B → A  (jerarquía restaurada)
 *
 * Cada nodo movido a Papelera guarda su parentId original en extraData._trashedFromParentId
 * para poder restaurarlo y para reconectar jerarquías cuando el padre llega después.
 */

import { store } from '../store/nodeStore'
import type { Node } from '../types'
import { structuralId } from './deterministicId'
import { findRootByKey, isProtectedSystemRoot } from './rootLookup'

const PAPELERA_NAME = '🗑 Papelera'

/** Parsea extraData de forma robusta. Algunos nodos antiguos quedaron DOBLE-
 *  codificados (un JSON string dentro de otro): `JSON.parse` devuelve un string
 *  en vez de un objeto, y escribir una propiedad sobre él lanza. Aquí se re-parsea
 *  hasta obtener un objeto, o `{}` si no se puede. */
export function parseExtraData(raw: string | null | undefined): Record<string, unknown> {
  let v: unknown = raw || '{}'
  for (let i = 0; i < 3 && typeof v === 'string'; i++) {
    try { v = JSON.parse(v) } catch { return {} }
  }
  return v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : {}
}

/** Hijos DIRECTOS de un nodo, incluidos los borrados (`deletedAt` presente) —
 *  `store.children()` los excluye de su caché igual que a cualquier otro nodo
 *  borrado, y dentro de la Papelera TODO tiene `deletedAt` (la "lápida", 24 ago
 *  2026), así que ese helper nunca sirve aquí dentro. */
function childrenIncludingDeleted(parentId: string): Node[] {
  const out: Node[] = []
  for (const n of store.nodes.values()) if (n.parentId === parentId) out.push(n)
  return out
}

export function getPapeleraNode(): Node | undefined {
  // Papelera permanece en parentId=null (no se reparenta bajo 🏠 From), pero usamos
  // el lookup robusto por id determinista por consistencia.
  return findRootByKey('papelera', PAPELERA_NAME)
}

export function ensurePapeleraNode(): Node {
  const existing = getPapeleraNode()
  if (existing) return existing
  const node = store.createNode({
    text: PAPELERA_NAME,
    parentId: null,
    siblingOrder: 10000,  // siempre al final del árbol
    predefinedId: structuralId('papelera') ?? undefined,
  })
  return store.getNode(node.id)!
}

/**
 * Mueve un nodo (y sus descendientes activos) a la Papelera,
 * preservando la jerarquía con respecto a otros nodos ya en la papelera.
 */
export function trashNode(nodeId: string): void {
  const node = store.getNode(nodeId)
  if (!node) return

  // Las raíces de sistema (Agenda, Contexto, Prompts, Agentes, Plantillas, Papelera,
  // Perfil, 🏠 From) son estructura: no se pueden eliminar.
  if (isProtectedSystemRoot(nodeId)) {
    window.dispatchEvent(new CustomEvent('from:toast', { detail: { message: 'Este nodo del sistema no se puede eliminar', type: 'info' } }))
    return
  }

  const papelera = ensurePapeleraNode()
  const originalParentId = node.parentId

  // ── ¿El padre original ya está en la Papelera? ─────────────────────────
  // Si sí, este nodo pasa a ser hijo del padre en la papelera (jerarquía preservada).
  // Si no, va directamente como hijo de Papelera.
  const parentIsInPapelera = !!originalParentId && isInPapelera(originalParentId)
  const newParentId = parentIsInPapelera ? originalParentId : papelera.id

  // Guardar el parentId original para poder restaurar y reconectar
  const ed = parseExtraData(node.extraData)
  ed._trashedFromParentId = originalParentId
  ed._trashedAt = new Date().toISOString()

  store.updateNode(nodeId, {
    parentId:  newParentId,
    extraData: JSON.stringify(ed),
    // LÁPIDA. Antes el nodo seguía "vivo" bajo la Papelera y cada lista tenía que
    // acordarse de subir por los padres para descartarlo; la que se olvidaba —la
    // agenda del iPhone— enseñaba tareas borradas hace meses (Alberto, 24 ago 2026:
    // "que NADA en papelera se filtre en ningún lugar"). Ahora estar en la papelera
    // ES estar borrado: el `deletedAt == null` que ya filtra en todas partes basta.
    deletedAt: new Date().toISOString(),
  })

  // ── Reconectar hijos ya en Papelera que pertenecían a este nodo ─────────
  // Cuando borramos B después de haber borrado A (hijo de B):
  // A está en Papelera con _trashedFromParentId=B.id → A pasa a ser hijo de B.
  reconnectOrphanedChildren(nodeId)

  // Si el nodo borrado estaba ABIERTO en la ventana central, MainLayout navega al
  // padre (no tiene sentido quedarse en una página que ya está en la papelera).
  window.dispatchEvent(new CustomEvent('from:node-trashed', { detail: { id: nodeId, parentId: originalParentId } }))
}

/**
 * Restaura un nodo de la papelera a su ubicación original — o, si esa ubicación ya
 * no es válida (no existe, está borrada, sigue en la papelera, o era la raíz null que
 * con 🏠 From ya no se ve), a 📅 Agenda para que SIEMPRE quede visible. Devuelve el id
 * del padre final y emite `from:node-restored` para que MainLayout navegue al nodo.
 */
export function restoreNode(nodeId: string): string | null {
  const node = store.getNode(nodeId)
  if (!node) return null

  const ed = parseExtraData(node.extraData)

  const originalParentId = (ed._trashedFromParentId as string | null | undefined) ?? null
  delete ed._trashedFromParentId
  delete ed._trashedAt

  // El destino es válido solo si existe, no está borrado y NO está en la papelera.
  const parentValid = !!originalParentId && (() => {
    const p = store.getNode(originalParentId)
    return !!p && !p.deletedAt && !isInPapelera(originalParentId)
  })()
  const targetParent = parentValid
    ? originalParentId!
    : (findRootByKey('agenda', '📅 Agenda')?.id ?? null)

  store.updateNode(nodeId, { parentId: targetParent, extraData: JSON.stringify(ed), deletedAt: null })
  window.dispatchEvent(new CustomEvent('from:node-restored', { detail: { id: nodeId, parentId: targetParent } }))
  return targetParent
}

/**
 * Vaciar papelera: elimina permanentemente todos los nodos en la Papelera.
 */
export function emptyTrash(): void {
  const papelera = getPapeleraNode()
  if (!papelera) return
  const now = new Date().toISOString()

  // Con la papelera-por-lápida, "borrar" y "vaciar" escriben el mismo `deletedAt`.
  // Lo que los distingue es `_purgedAt`: vaciado = ya no se puede restaurar y deja
  // de listarse en la papelera. El nodo se conserva en la base por si hace falta
  // recuperarlo desde un backup, pero para la app no existe.
  function purgeRecursive(id: string) {
    for (const child of childrenIncludingDeleted(id)) purgeRecursive(child.id)
    const n = store.getNode(id)
    if (!n) return
    const ed = parseExtraData(n.extraData)
    ed._purgedAt = now
    store.updateNode(id, { deletedAt: n.deletedAt ?? now, extraData: JSON.stringify(ed) })
  }

  for (const child of childrenIncludingDeleted(papelera.id)) purgeRecursive(child.id)
}

/** Lo que debe verse en la Papelera: con lápida y todavía recuperable.
 *  NO usa `store.children()` — desde que la papelera pasó a marcar `deletedAt`
 *  en el propio nodo (24 ago 2026, la "lápida"), `children()` los excluye de su
 *  caché como a cualquier otro nodo borrado, así que esta lista salía SIEMPRE
 *  vacía aunque hubiera elementos recién eliminados (Alberto, 27 ago 2026:
 *  "dice que la papelera esta vacia... he borrado elementos hace poco"). */
export function trashItems(): Node[] {
  const papelera = getPapeleraNode()
  if (!papelera) return []
  return childrenIncludingDeleted(papelera.id).filter(n => !!n.deletedAt && !parseExtraData(n.extraData)._purgedAt)
}

/** Comprueba si un nodo está en la Papelera (él o algún ancestro) */
export function isInPapelera(nodeId: string): boolean {
  const papelera = getPapeleraNode()
  if (!papelera) return false

  let current = store.getNode(nodeId)
  let depth = 0
  while (current && depth < 20) {
    if (current.parentId === papelera.id || current.id === papelera.id) return true
    if (!current.parentId) return false
    current = store.getNode(current.parentId)
    depth++
  }
  return false
}

/**
 * Cuando un nodo B llega a la Papelera, busca si ya había hijos suyos
 * en la Papelera (con _trashedFromParentId=B.id) y los vuelve a poner bajo B.
 */
function reconnectOrphanedChildren(parentId: string): void {
  const papelera = getPapeleraNode()
  if (!papelera) return

  // Buscar nodos en Papelera (hijos directos) que pertenecían a parentId
  const papeleraChildren = childrenIncludingDeleted(papelera.id)
  for (const child of papeleraChildren) {
    const ed = parseExtraData(child.extraData)
    if (ed._trashedFromParentId === parentId) {
      store.updateNode(child.id, { parentId })
    }
  }
}
