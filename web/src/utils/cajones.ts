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

/** ¿El nodo es un contexto (descendiente de 🧠 Contexto)? */
export function isContextNode(nodeId: string): boolean {
  const root = findContextRoot()
  if (!root) return false
  let cur: Node | null | undefined = store.getNode(nodeId)
  let guard = 0
  while (cur && guard++ < 60) {
    if (cur.id === root.id) return false      // la raíz no es un contexto
    if (cur.parentId === root.id) return true // hijo directo o más abajo
    if (cur.parentId == null) return false
    const parent = store.getNode(cur.parentId)
    if (parent && parent.id === root.id) return true
    cur = parent
  }
  return false
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

/** Color del contexto: su `_tagColor`, o el heredado del padre, o lila por defecto. */
export function contextColor(nodeId: string): string {
  const own = ed(store.getNode(nodeId))._tagColor
  if (typeof own === 'string' && own) return own
  const p = contextParent(nodeId)
  if (p) { const c = ed(p)._tagColor; if (typeof c === 'string' && c) return c }
  return PROJECT_DEFAULT_COLOR
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

/** Todos los contextos del árbol. Opciones: solo abiertos, solo subcontextos. */
export function listContexts(opts?: { includeClosed?: boolean; onlySub?: boolean }): Node[] {
  const root = findContextRoot()
  if (!root) return []
  const out: Node[] = []
  const walk = (parentId: string, depth: number, guard = 0) => {
    if (guard > 60) return
    for (const c of store.children(parentId)) {
      if (c.deletedAt) continue
      // Excluir el nodo de conocimiento «🧠 Lo que From sabe» y similares de config.
      if ((c.text || '').startsWith('🧠')) { continue }
      if (!opts?.onlySub || depth >= 1) {
        if (opts?.includeClosed || !isContextClosed(c)) out.push(c)
      }
      walk(c.id, depth + 1, guard + 1)
    }
  }
  walk(root.id, 0)
  return out.sort((a, b) => activityTs(b) - activityTs(a)) // última actividad primero
}

/** Crea un contexto bajo el padre dado (o la raíz de Contexto). */
export function createContext(name: string, parentContextId?: string | null): Node {
  const root = findContextRoot()
  const parentId = (parentContextId && store.getNode(parentContextId)) ? parentContextId : (root?.id ?? null)
  const sibs = parentId ? store.children(parentId).filter(n => !n.deletedAt) : []
  const maxOrder = sibs.reduce((m, n) => Math.max(m, n.siblingOrder), 0)
  const node = store.createNode({
    text: name.trim(),
    parentId,
    siblingOrder: maxOrder + 1000,
  })
  ensureTagDefinition(node.id)
  return node
}

export function setContextClosed(nodeId: string, closed: boolean): void {
  const n = store.getNode(nodeId)
  if (!n) return
  // Los contextos RAÍZ (sin contexto padre) son la base: no se cierran.
  if (!contextParent(nodeId)) return
  const e = ed(n)
  if (closed) e._closed = '1'
  else delete e._closed
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
  try { touchContext(contextId, new Date().toISOString()) } catch { /* ignore */ }
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
