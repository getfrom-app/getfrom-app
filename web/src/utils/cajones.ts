/**
 * Contextos y proyectos (modelo unificado).
 *
 * TODO es un CONTEXTO: un nodo bajo 🧠 Contexto.
 *  - Un "área" = contexto de nivel superior (Media Sector, La Isla…).
 *  - Un "proyecto" = SUBCONTEXTO (un contexto con un contexto padre, p. ej.
 *    «Locución Laco» dentro de «Media Sector»). Vive en el árbol de Contextos.
 *  - Cualquier contexto puede estar ABIERTO o CERRADO (`extraData._closed`). Los
 *    cerrados desaparecen de pickers y ghost-text, pero conservan su contenido.
 *
 * El contenido de un proyecto (tareas, notas) vive en la AGENDA y se le asigna el
 * contexto por referencia (`extraData._ctxRefs = [contextNodeId]`, por ID, robusto
 * a renombrados y a la jerarquía). El nodo NO se mueve. El propio contexto es un
 * nodo: su body/hijos/lienzo son su "nota".
 *
 * (Antes existían los "cajones" como concepto aparte — ya unificados aquí.)
 */
import { store } from '../store/nodeStore'
import type { Node } from '../types'
import { findContextRoot } from './rootLookup'
import { ensureTagDefinition, getNodeTagSlug } from './tagsHelper'

const PROJECT_DEFAULT_COLOR = '#7c3aed'

function ed(n: Node | null | undefined): Record<string, unknown> {
  if (!n) return {}
  try { return JSON.parse(n.extraData || '{}') } catch { return {} }
}

/** ¿Es un PROYECTO (contexto creado/designado explícitamente)? Marcado `_ctx='1'`.
 *  Distingue un contexto real del CONTENIDO que cuelga dentro de un contexto
 *  (p. ej. los guiones diarios filtrados bajo un área). */
export function isProject(n: Node | null | undefined): boolean {
  return ed(n)._ctx === '1'
}

/** ¿Es un ÁREA? = hijo DIRECTO de la raíz 🧠 Contexto (los contextos de base). */
export function isArea(nodeId: string): boolean {
  const root = findContextRoot()
  if (!root) return false
  const n = store.getNode(nodeId)
  return !!n && !n.deletedAt && n.parentId === root.id
}

/** ¿El nodo es un contexto REAL (área o proyecto)? NO el contenido interno. */
export function isContextNode(nodeId: string): boolean {
  const n = store.getNode(nodeId)
  return isArea(nodeId) || isProject(n)
}

export function isContextClosed(n: Node | null | undefined): boolean {
  return ed(n)._closed === '1'
}

/** Contexto padre (no la raíz) más cercano hacia arriba. null si es de nivel superior. */
export function contextParent(nodeId: string): Node | null {
  const root = findContextRoot()
  if (!root) return null
  let cur: Node | null | undefined = store.getNode(nodeId)
  cur = cur?.parentId ? store.getNode(cur.parentId) : null
  let guard = 0
  while (cur && cur.id !== root.id && guard++ < 60) {
    return cur // primer ancestro que no es la raíz = contexto padre
  }
  return null
}

/** Color por defecto = el acento del tema elegido por el usuario en Ajustes. */
function defaultAccentHex(): string {
  try {
    const v = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim()
    if (v) return v
  } catch { /* sin DOM */ }
  return PROJECT_DEFAULT_COLOR
}

/** Color del contexto: lo HEREDA de su contexto padre (recursivo). Si es un área
 *  raíz, usa su `_tagColor` propio si lo tiene, o el color por defecto de Ajustes.
 *  (Ya no hay selector de color por contexto.) */
export function contextColor(nodeId: string): string {
  const p = contextParent(nodeId)
  if (p) return contextColor(p.id)
  const own = ed(store.getNode(nodeId))._tagColor
  if (typeof own === 'string' && own) return own
  return defaultAccentHex()
}

/** Marca de última actividad (para ordenar). Usa `_ctxUsedAt` o el updatedAt. */
function activityTs(n: Node): number {
  const u = ed(n)._ctxUsedAt
  if (typeof u === 'string') { const t = Date.parse(u); if (!isNaN(t)) return t }
  if (n.updatedAt) { const t = Date.parse(n.updatedAt); if (!isNaN(t)) return t }
  return 0
}

export function touchContext(nodeId: string, isoNow: string): void {
  const n = store.getNode(nodeId)
  if (!n) return
  const e = ed(n)
  e._ctxUsedAt = isoNow
  store.updateNode(nodeId, { extraData: JSON.stringify(e) })
}

/** PROYECTOS (contextos creados, `_ctx='1'`). Por defecto solo los ABIERTOS.
 *  `onlySub` se mantiene por compatibilidad pero ya no cambia nada (todos los
 *  proyectos son contextos designados, no contenido). */
export function listContexts(opts?: { includeClosed?: boolean; onlySub?: boolean }): Node[] {
  void opts?.onlySub
  return store.allActive()
    .filter(n => !n.deletedAt && isProject(n) && (opts?.includeClosed || !isContextClosed(n)))
    .sort((a, b) => activityTs(b) - activityTs(a)) // última actividad primero
}

/** Contextos donde se puede anidar (como padre): ÁREAS + PROYECTOS abiertos. */
export function listContextsForParent(): Node[] {
  const root = findContextRoot()
  const areas = root ? store.children(root.id).filter(n => !n.deletedAt && !(n.text || '').startsWith('🧠')) : []
  const projects = listContexts()
  const seen = new Set<string>()
  const out: Node[] = []
  for (const n of [...areas, ...projects]) { if (!seen.has(n.id)) { seen.add(n.id); out.push(n) } }
  return out
}

/** Crea un PROYECTO (contexto designado `_ctx='1'`) bajo el padre dado (o la raíz). */
export function createContext(name: string, parentContextId?: string | null): Node {
  const root = findContextRoot()
  const parentId = (parentContextId && store.getNode(parentContextId)) ? parentContextId : (root?.id ?? null)
  const sibs = parentId ? store.children(parentId).filter(n => !n.deletedAt) : []
  const maxOrder = sibs.reduce((m, n) => Math.max(m, n.siblingOrder), 0)
  const node = store.createNode({
    text: name.trim(),
    parentId,
    siblingOrder: maxOrder + 1000,
    extraData: { _ctx: '1' },
  })
  ensureTagDefinition(node.id)
  return node
}

export function setContextClosed(nodeId: string, closed: boolean): void {
  const n = store.getNode(nodeId)
  if (!n) return
  // Se cierran los SUBCONTEXTOS (proyectos): un contexto con contexto padre, o ya
  // marcado como proyecto. Las áreas raíz son la base y no se cierran.
  if (!isProject(n) && !contextParent(nodeId)) return
  const e = ed(n)
  if (closed) e._closed = '1'
  else delete e._closed
  e._ctx = '1' // al cerrar/reabrir, queda marcado como proyecto de pleno derecho
  store.updateNode(nodeId, { extraData: JSON.stringify(e) })
}

/** Reparenta un contexto bajo otro (lo convierte en su subcontexto). */
export function reparentContext(nodeId: string, newParentContextId: string): void {
  const n = store.getNode(nodeId)
  const p = store.getNode(newParentContextId)
  if (!n || !p || nodeId === newParentContextId) return
  // Evitar ciclos: el nuevo padre no puede estar dentro del propio nodo.
  let cur: Node | null | undefined = p
  let guard = 0
  while (cur && guard++ < 60) {
    if (cur.id === nodeId) return // ciclo → abortar
    cur = cur.parentId ? store.getNode(cur.parentId) : null
  }
  const sibs = store.children(newParentContextId).filter(x => !x.deletedAt)
  const maxOrder = sibs.reduce((m, x) => Math.max(m, x.siblingOrder), 0)
  store.updateNode(nodeId, { parentId: newParentContextId, siblingOrder: maxOrder + 1000 })
  ensureTagDefinition(nodeId) // recalcula el slug jerárquico
}

// ── Asignación de contexto/proyecto a tareas/notas (por ID) ───────────────────

export function nodeCtxRefs(n: Node | null | undefined): string[] {
  const v = ed(n)._ctxRefs
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []
}

export function assignContext(nodeId: string, contextId: string): void {
  const n = store.getNode(nodeId)
  if (!n) return
  const e = ed(n)
  const cur = nodeCtxRefs(n)
  if (!cur.includes(contextId)) e._ctxRefs = [...cur, contextId]
  store.updateNode(nodeId, { extraData: JSON.stringify(e) })
  // Marcar el contexto destino como proyecto (_ctx) si aún no lo está, para que
  // aparezca en los listados aunque se creara por una vía antigua.
  const c = store.getNode(contextId)
  if (c && !isProject(c)) {
    const ce = ed(c); ce._ctx = '1'
    store.updateNode(contextId, { extraData: JSON.stringify(ce) })
  }
  try { touchContext(contextId, new Date().toISOString()) } catch { /* ignore */ }
}

/** Contextos a mostrar en listados de "en uso": proyectos marcados (_ctx) +
 *  cualquier contexto referenciado por algún nodo (_ctxRefs). Solo ABIERTOS. */
export function listActiveContexts(): Node[] {
  const ids = new Set<string>()
  for (const n of store.allActive()) {
    if (n.deletedAt) continue
    if (isProject(n) && !isContextClosed(n)) ids.add(n.id)
    for (const cid of nodeCtxRefs(n)) ids.add(cid)
  }
  const out: Node[] = []
  for (const id of ids) {
    const c = store.getNode(id)
    if (c && !c.deletedAt && !isContextClosed(c)) out.push(c)
  }
  return out.sort((a, b) => activityTs(b) - activityTs(a))
}

export function unassignContext(nodeId: string, contextId: string): void {
  const n = store.getNode(nodeId)
  if (!n) return
  const e = ed(n)
  const next = nodeCtxRefs(n).filter(id => id !== contextId)
  if (next.length) e._ctxRefs = next
  else delete e._ctxRefs
  store.updateNode(nodeId, { extraData: JSON.stringify(e) })
}

/** Nodos asignados a un contexto: por ID (_ctxRefs) O por slug clásico (@contexto
 *  en types[]). Para mostrar el contenido en la página del contexto. */
export function nodesInContext(contextId: string): Node[] {
  const slug = getNodeTagSlug(contextId)
  return store.allActive().filter(n => {
    if (n.deletedAt || n.id === contextId) return false
    if (nodeCtxRefs(n).includes(contextId)) return true
    if (slug && (n.types || []).includes(slug)) return true
    return false
  })
}
