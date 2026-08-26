// Historial de conversaciones + contextos ordenados por uso — la fuente de datos
// del tab «Historial» de la columna derecha y de las tarjetas de contexto del
// estado vacío del chat (rediseño 5 ago 2026, Alberto: "la vista de chat tiene
// que tener el historial con los últimos chats, como cualquier IA... y que
// aparezca la opción de contextos al estilo de Claude").
//
// Modelo: una CONVERSACIÓN es un nodo `extraData._aiSession='1'` (ver
// aiChatStore.ts); su contexto es el que resuelve `firstContextOf` (la misma
// regla que usa la ficha del contexto, no un campo aparte). No hay tabla ni
// índice: se recorre el árbol activo, que ya está en memoria.
import { store } from '../store/nodeStore'
import { parseExtraData, isInPapelera } from '../utils/papeleraHelper'
import { firstContextOf, isContextClosed, isMarkedContext, isRootContext, contextParent, listContextsForParent } from '../utils/cajones'
import { displayTitle } from '../utils/displayText'
import type { Node } from '../types'

/** ¿Es este nodo una conversación real y visible (no en papelera/borrada)? */
export function isConversationNode(n: Node): boolean {
  if (n.deletedAt) return false
  if (parseExtraData(n.extraData)._aiSession !== '1') return false
  return !isInPapelera(n.id)
}

/** Título limpio de una conversación — sin el emoji decorativo que algunos nodos
 *  llevan escrito EN EL DATO (`✦ …`, `💬 …`, o el del agente que la originó,
 *  `🤖 ¿Cómo fue la semana…`). Ver utils/displayText.ts. */
export function conversationTitle(n: Node, fallback: string): string {
  return displayTitle(n.text, fallback)
}

/** Todas las conversaciones, de la más reciente a la más antigua.
 *  `contextId`: solo las de ese contexto · `null` explícito: solo las que no
 *  pertenecen a ninguno (General) · `undefined`: todas. */
export function listConversations(contextId?: string | null, limit?: number): Node[] {
  const out: Node[] = []
  for (const n of store.allActive()) {
    if (!isConversationNode(n)) continue
    if (contextId !== undefined) {
      const ctx = firstContextOf(n)
      if (contextId === null ? !!ctx : ctx?.id !== contextId) continue
    }
    out.push(n)
  }
  out.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''))
  return limit != null ? out.slice(0, limit) : out
}

/** Este contexto + TODOS sus subcontextos, recursivo (26 ago 2026 — la tab
 *  «Chat» de un contexto muestra también las conversaciones de sus
 *  subcontextos, ver `listConversationsWithSubcontexts`). Barrido por
 *  capas sobre `listContextsForParent()` en vez de recorrer children()
 *  directamente: un contexto puede colgar de otro por `_ctxRefs`/estructura
 *  variada, y `contextParent` ya sabe resolver eso de forma consistente con
 *  el resto de la app (mismo criterio que el picker de contexto padre). */
export function contextAndDescendantIds(contextId: string): string[] {
  const all = listContextsForParent()
  const out = new Set<string>([contextId])
  let changed = true
  while (changed) {
    changed = false
    for (const c of all) {
      if (out.has(c.id)) continue
      const p = contextParent(c.id)
      if (p && out.has(p.id)) { out.add(c.id); changed = true }
    }
  }
  return [...out]
}

/** Conversaciones de un contexto Y de todos sus subcontextos, más recientes
 *  primero (Alberto, 26 ago 2026: "un contexto puede tener varias
 *  conversaciones y además mostrará todas las de sus subcontextos"). */
export function listConversationsWithSubcontexts(contextId: string, limit?: number): Node[] {
  const ids = new Set(contextAndDescendantIds(contextId))
  const out: Node[] = []
  for (const n of store.allActive()) {
    if (!isConversationNode(n)) continue
    const ctx = firstContextOf(n)
    if (!ctx || !ids.has(ctx.id)) continue
    out.push(n)
  }
  out.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''))
  return limit != null ? out.slice(0, limit) : out
}

/** Cuántas conversaciones tiene cada contexto, en UNA sola pasada — llamar a
 *  `listConversations(id)` por tarjeta sería O(contextos × nodos). */
export function conversationCountsByContext(): Map<string, number> {
  const counts = new Map<string, number>()
  for (const n of store.allActive()) {
    if (!isConversationNode(n)) continue
    const ctx = firstContextOf(n)
    if (!ctx) continue
    counts.set(ctx.id, (counts.get(ctx.id) || 0) + 1)
  }
  return counts
}

/** Marca de última actividad de un contexto: `_ctxUsedAt` (lo escribe
 *  `touchContext` al trabajar en él) o, si no lo tiene, su `updatedAt`.
 *  Copia deliberada de `activityTs` de utils/cajones.ts (allí es privada). */
function activityTs(n: Node): number {
  const u = parseExtraData(n.extraData)._ctxUsedAt
  if (typeof u === 'string') { const t = Date.parse(u); if (!isNaN(t)) return t }
  if (n.updatedAt) { const t = Date.parse(n.updatedAt); if (!isNaN(t)) return t }
  return 0
}

export interface ContextCard {
  node: Node
  /** Nº de conversaciones del contexto (para el subtítulo de la tarjeta). */
  conversations: number
}

/** Contextos (áreas + proyectos abiertos) ordenados por USO reciente — el orden
 *  con el que Claude lista sus proyectos, y el que pidió Alberto para las
 *  tarjetas del chat ("según se han ido utilizando"). */
export function listContextCards(limit?: number): ContextCard[] {
  const counts = conversationCountsByContext()
  const seen = new Set<string>()
  const out: ContextCard[] = []
  for (const n of store.allActive()) {
    if (n.deletedAt || isInPapelera(n.id) || seen.has(n.id)) continue
    // Áreas (hijos directos de la raíz de contexto, sin el Perfil de IA) +
    // proyectos marcados que no estén archivados — mismo criterio que la sidebar.
    const isArea = isRootContext(n.id) && !(n.text || '').startsWith('🧠')
    if (!isArea && !(isMarkedContext(n) && !isContextClosed(n))) continue
    seen.add(n.id)
    out.push({ node: n, conversations: counts.get(n.id) || 0 })
  }
  out.sort((a, b) => activityTs(b.node) - activityTs(a.node))
  return limit != null ? out.slice(0, limit) : out
}
