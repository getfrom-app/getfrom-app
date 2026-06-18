/**
 * cajones — "Cajones" (contenedores temporales de proyecto).
 *
 * Un cajón es un PROYECTO pequeño y temporal que vive DENTRO de un contexto amplio
 * (p. ej. «Locución Laco» dentro de «Media Sector»). A diferencia de un contexto:
 *  - es temporal: tiene estado abierto/cerrado (`_cajonClosed`), se cierra al acabar
 *    y deja de aparecer en búsquedas/ghost-text, pero conserva todo su contenido.
 *  - se asigna rápido a tareas/notas con `#` (o ghost-text) — la asignación se guarda
 *    en `extraData._cajones = [cajonId]` del nodo asignado (por ID, robusto, separado
 *    de los `types[]` de los contextos → no interfiere con el auto-sync de `@`).
 *
 * El cajón ES un nodo normal: su body/hijos/lienzo son "la nota del proyecto" donde
 * caben comentarios, logs, tablas, PDFs, imágenes, etc.
 *
 * Vive bajo el árbol 🧠 Contexto (hijo de un contexto/subcontexto, o de la raíz) →
 * hereda gratis slug jerárquico, herencia de contexto para Magic y filtrado.
 */
import { store } from '../store/nodeStore'
import type { Node } from '../types'
import { findContextRoot } from './rootLookup'
import { ensureTagDefinition } from './tagsHelper'

const CAJON_DEFAULT_COLOR = '#0ea5a4' // teal — distinto del lila de los contextos

function ed(n: Node | null | undefined): Record<string, unknown> {
  if (!n) return {}
  try { return JSON.parse(n.extraData || '{}') } catch { return {} }
}

export function isCajon(n: Node | null | undefined): boolean {
  return ed(n)._cajon === '1'
}

export function isCajonClosed(n: Node | null | undefined): boolean {
  return ed(n)._cajonClosed === '1'
}

/** Contexto (no-cajón) más cercano hacia arriba del cajón. null si cuelga de la raíz. */
export function cajonParentContext(cajonId: string): Node | null {
  const root = findContextRoot()
  if (!root) return null
  let cur: Node | null | undefined = store.getNode(cajonId)
  cur = cur?.parentId ? store.getNode(cur.parentId) : null
  let guard = 0
  while (cur && cur.id !== root.id && guard++ < 50) {
    if (!isCajon(cur)) return cur
    cur = cur.parentId ? store.getNode(cur.parentId) : null
  }
  return null
}

/** Color del cajón: hereda el del contexto padre; si no, el suyo; si no, teal. */
export function cajonColor(cajonId: string): string {
  const ctx = cajonParentContext(cajonId)
  if (ctx) { const c = ed(ctx)._tagColor; if (typeof c === 'string' && c) return c }
  const own = ed(store.getNode(cajonId))._tagColor
  if (typeof own === 'string' && own) return own
  return CAJON_DEFAULT_COLOR
}

/** Todos los cajones (CUALQUIER nodo con flag `_cajon`, viva donde viva en el
 *  árbol). Por defecto, solo los ABIERTOS. Excluye la papelera. */
export function listCajones(opts?: { includeClosed?: boolean }): Node[] {
  const out: Node[] = []
  for (const n of store.allActive()) {
    if (!isCajon(n)) continue
    if (!opts?.includeClosed && isCajonClosed(n)) continue
    out.push(n)
  }
  return out
}

/** Crea un cajón bajo el contexto dado (o la raíz de contexto si no se indica). */
export function createCajon(name: string, parentContextId?: string | null): Node {
  const root = findContextRoot()
  const parentId = (parentContextId && store.getNode(parentContextId)) ? parentContextId : (root?.id ?? null)
  const sibs = parentId ? store.children(parentId).filter(n => !n.deletedAt) : []
  const maxOrder = sibs.reduce((m, n) => Math.max(m, n.siblingOrder), 0)
  const node = store.createNode({
    text: name.trim(),
    parentId,
    siblingOrder: maxOrder + 1000,
    extraData: { _cajon: '1' },
  })
  ensureTagDefinition(node.id)
  return node
}

/** Convierte CUALQUIER nodo en cajón (o le quita el flag), sin moverlo. */
export function setCajon(nodeId: string, on: boolean): void {
  const n = store.getNode(nodeId)
  if (!n) return
  const e = ed(n)
  if (on) { e._cajon = '1' }
  else { delete e._cajon; delete e._cajonClosed }
  store.updateNode(nodeId, { extraData: JSON.stringify(e) })
}

export function setCajonClosed(cajonId: string, closed: boolean): void {
  const n = store.getNode(cajonId)
  if (!n) return
  const e = ed(n)
  if (closed) e._cajonClosed = '1'
  else delete e._cajonClosed
  store.updateNode(cajonId, { extraData: JSON.stringify(e) })
}

// ── Asignación a tareas/notas (extraData._cajones = [cajonId]) ─────────────────

export function nodeCajones(n: Node | null | undefined): string[] {
  const v = ed(n)._cajones
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []
}

export function assignCajon(nodeId: string, cajonId: string): void {
  const n = store.getNode(nodeId)
  if (!n) return
  const e = ed(n)
  const cur = nodeCajones(n)
  if (!cur.includes(cajonId)) e._cajones = [...cur, cajonId]
  store.updateNode(nodeId, { extraData: JSON.stringify(e) })
}

export function unassignCajon(nodeId: string, cajonId: string): void {
  const n = store.getNode(nodeId)
  if (!n) return
  const e = ed(n)
  const next = nodeCajones(n).filter(id => id !== cajonId)
  if (next.length) e._cajones = next
  else delete e._cajones
  store.updateNode(nodeId, { extraData: JSON.stringify(e) })
}

/** Nodos (tareas/notas) asignados a un cajón — para mostrar su contenido en la página. */
export function nodesInCajon(cajonId: string): Node[] {
  return store.allActive().filter(n => !n.deletedAt && nodeCajones(n).includes(cajonId))
}
