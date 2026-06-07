/**
 * papeleraHelper — Papelera como nodo del árbol de From.
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
  let ed: Record<string, unknown> = {}
  try { ed = JSON.parse(node.extraData || '{}') } catch { /* ignore */ }
  ed._trashedFromParentId = originalParentId
  ed._trashedAt = new Date().toISOString()

  store.updateNode(nodeId, {
    parentId:  newParentId,
    extraData: JSON.stringify(ed),
    // No ponemos deletedAt — el nodo sigue "vivo" pero bajo Papelera
  })

  // ── Reconectar hijos ya en Papelera que pertenecían a este nodo ─────────
  // Cuando borramos B después de haber borrado A (hijo de B):
  // A está en Papelera con _trashedFromParentId=B.id → A pasa a ser hijo de B.
  reconnectOrphanedChildren(nodeId)
}

/**
 * Restaura un nodo a su ubicación original.
 */
export function restoreNode(nodeId: string): void {
  const node = store.getNode(nodeId)
  if (!node) return

  let ed: Record<string, unknown> = {}
  try { ed = JSON.parse(node.extraData || '{}') } catch { /* ignore */ }

  const originalParentId = ed._trashedFromParentId as string | null | undefined
  delete ed._trashedFromParentId
  delete ed._trashedAt

  store.updateNode(nodeId, {
    parentId:  originalParentId ?? null,
    extraData: JSON.stringify(ed),
  })
}

/**
 * Vaciar papelera: elimina permanentemente todos los nodos en la Papelera.
 */
export function emptyTrash(): void {
  const papelera = getPapeleraNode()
  if (!papelera) return

  function deleteRecursive(id: string) {
    const children = store.children(id)
    for (const child of children) deleteRecursive(child.id)
    store.updateNode(id, { deletedAt: new Date().toISOString() })
  }

  const children = store.children(papelera.id)
  for (const child of children) deleteRecursive(child.id)
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
  const papeleraChildren = store.children(papelera.id)
  for (const child of papeleraChildren) {
    try {
      const ed = JSON.parse(child.extraData || '{}')
      if (ed._trashedFromParentId === parentId) {
        store.updateNode(child.id, { parentId })
      }
    } catch { /* ignore */ }
  }
}
