// Lente de contexto: utilidades para filtrar nodos por el contexto activo.
// Un nodo "pertenece" a un contexto si su types[] incluye el TEXTO del contexto
// (p.ej. "Media Sector") o su slug (p.ej. "media-sector"). Un nodo SIN ningún
// contexto SIEMPRE pasa la lente (así no se pierde lo mal etiquetado).
import { store } from '../store/nodeStore'
import { findContextRoot } from './rootLookup'
import { textToTagSlug } from './tagsHelper'
import { getLensContextId } from '../store/contextLensStore'
import type { Node } from '../types'

/** Contextos reales = hijos directos de 🧠 Contexto (excluye Perfil y borrados). */
export function listContexts(): Node[] {
  const root = findContextRoot(); if (!root) return []
  return store.children(root.id)
    .filter(n => !n.deletedAt && !/^👤|perfil/i.test((n.text || '').trim()))
    .sort((a, b) => (a.text || '').localeCompare(b.text || ''))
}

/** Claves (texto + slug, en minúsculas) de TODOS los contextos. Para detectar "sin contexto". */
export function allContextKeys(): Set<string> {
  const set = new Set<string>()
  for (const c of listContexts()) {
    const txt = (c.text || '').trim()
    if (txt) { set.add(txt.toLowerCase()); set.add(textToTagSlug(txt)) }
  }
  return set
}

/** ¿El nodo pertenece a este contexto? (compara types[] con texto o slug). */
export function nodeInContext(node: Node, ctx: Node): boolean {
  const types = (node.types || []).map(t => t.toLowerCase())
  if (types.length === 0) return false
  const name = (ctx.text || '').trim().toLowerCase()
  const slug = textToTagSlug(ctx.text || '')
  return types.includes(name) || types.includes(slug)
}

/** ¿El nodo tiene ALGÚN contexto asignado? */
export function nodeHasAnyContext(node: Node, keys: Set<string>): boolean {
  return (node.types || []).some(t => keys.has(t.trim().toLowerCase()))
}

/**
 * ¿El nodo pasa la lente activa? Sin lente → siempre. Con lente → pasa si está en
 * ese contexto O si no tiene ningún contexto. `keys` se pasa para no recalcularlo
 * por fila (rendimiento); si se omite, se calcula.
 */
export function passesLens(node: Node, keys?: Set<string>): boolean {
  const id = getLensContextId()
  if (!id) return true
  const ctx = store.getNode(id)
  if (!ctx || ctx.deletedAt) return true
  if (nodeInContext(node, ctx)) return true
  return !nodeHasAnyContext(node, keys ?? allContextKeys())
}
