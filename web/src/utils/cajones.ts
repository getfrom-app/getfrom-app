/**
 * Contextos (árbol bajo 🧠 Contexto).
 *
 * SOLO hay CONTEXTOS: nodos del árbol 🧠 Contexto. No existe ya el concepto de
 * "área" ni "proyecto" (eran nombres antiguos). Lo único que distinguimos es:
 *  - Cómo se identifica un contexto: por estar marcado (`extraData._ctx='1'`,
 *    `isMarkedContext`) o por ser hijo directo de la raíz (`isRootContext`).
 *    `isContextNode` = cualquiera de los dos. El resto de nodos del árbol son
 *    CONTENIDO interno, no contextos.
 *  - Estado: ABIERTO · CERRADO (`_closed`). Los cerrados desaparecen de pickers y
 *    ghost-text pero conservan su contenido. (Ya no existe «algún día»: lo que se
 *    quiera hacer más adelante se crea como TAREA, no como contexto.)
 *
 * El contenido (tareas, notas) vive en la AGENDA y se le asigna el contexto por
 * referencia (`extraData._ctxRefs = [contextNodeId]`, por ID, robusto a renombrados
 * y a la jerarquía). El nodo NO se mueve. El propio contexto es un nodo: su
 * body/hijos/lienzo son su "nota".
 */
import { store } from '../store/nodeStore'
import type { Node } from '../types'
import { findContextRoot } from './rootLookup'
import { ensureTagDefinition, getNodeTagSlug, textToTagSlug } from './tagsHelper'
import { CONTEXT_KNOWLEDGE, isContextKnowledge } from './knowledgeNodes'
import { isInPapelera } from './papeleraHelper'

const CONTEXT_DEFAULT_COLOR = '#7c3aed'

function ed(n: Node | null | undefined): Record<string, unknown> {
  if (!n) return {}
  try { return JSON.parse(n.extraData || '{}') } catch { return {} }
}

/** ¿Es un contexto MARCADO explícitamente? Lleva `extraData._ctx='1'` (lo ponen
 *  createContext/convertToContext). Distingue un contexto real del CONTENIDO que
 *  cuelga dentro de un contexto (p. ej. guiones filtrados bajo un contexto raíz). */
export function isMarkedContext(n: Node | null | undefined): boolean {
  if (!n) return false
  // Una TAREA (o evento) nunca es un contexto, aunque arrastre un `_ctx` residual
  // (p. ej. una tarea creada a partir de un contexto). Lo que se agenda es tarea.
  if (n.status != null || n.isEvent) return false
  return ed(n)._ctx === '1'
}

/** ¿Es un contexto RAÍZ? = hijo DIRECTO de la raíz 🧠 Contexto (contextos de base). */
export function isRootContext(nodeId: string): boolean {
  const root = findContextRoot()
  if (!root) return false
  const n = store.getNode(nodeId)
  return !!n && !n.deletedAt && n.parentId === root.id
}

/** ¿El nodo es un contexto REAL (marcado o raíz)? NO el contenido interno. */
export function isContextNode(nodeId: string): boolean {
  const n = store.getNode(nodeId)
  return isRootContext(nodeId) || isMarkedContext(n)
}

export function isContextClosed(n: Node | null | undefined): boolean {
  return ed(n)._closed === '1'
}

export type ContextState = 'open' | 'closed'

/** Estado de un contexto: abierto · cerrado (ya no existe «algún día»). Los contextos
 *  RAÍZ no tienen estado (entidad superior) → siempre 'open'. Lo que se quiera hacer
 *  «más adelante» se crea como TAREA, no como contexto. */
export function contextState(n: Node | null | undefined): ContextState {
  if (n && isRootContext(n.id)) return 'open'
  return isContextClosed(n) ? 'closed' : 'open'
}

/** Fija el estado del contexto (abierto/cerrado, excluyentes). SOLO subcontextos
 *  (con contexto padre): los contextos RAÍZ no se abren/cierran. */
export function setContextState(nodeId: string, state: ContextState): void {
  const n = store.getNode(nodeId)
  if (!n) return
  if (!contextParent(nodeId)) return
  const e = ed(n)
  delete e._closed; delete e._future // limpia el flag legacy «algún día»
  if (state === 'closed') e._closed = '1'
  e._ctx = '1'
  store.updateNode(nodeId, { extraData: JSON.stringify(e) })
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
  return CONTEXT_DEFAULT_COLOR
}

/** Color del contexto: lo HEREDA de su contexto padre (recursivo). Si es raíz, usa
 *  su `_tagColor` propio si lo tiene, o el color por defecto de Ajustes.
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

/** Contextos MARCADOS (`_ctx='1'`). Por defecto solo los ABIERTOS. OJO: NO incluye
 *  los contextos raíz que no estén marcados — para "todos los contextos del árbol"
 *  usa `listContextsForParent`. `onlySub` se mantiene por compatibilidad (no-op). */
export function listMarkedContexts(opts?: { includeClosed?: boolean; onlySub?: boolean }): Node[] {
  void opts?.onlySub
  return store.allActive()
    .filter(n => !n.deletedAt && isMarkedContext(n) && (opts?.includeClosed || !isContextClosed(n)) && !isInPapelera(n.id))
    .sort((a, b) => activityTs(b) - activityTs(a)) // última actividad primero
}

/** TODOS los contextos del árbol (raíz + marcados, abiertos). Es la lista buena
 *  para pickers/asignar/anidar. Nunca incluye nada que esté en la Papelera. */
export function listContextsForParent(): Node[] {
  const root = findContextRoot()
  const roots = root ? store.children(root.id).filter(n => !n.deletedAt && !(n.text || '').startsWith('🧠') && !isInPapelera(n.id)) : []
  const marked = listMarkedContexts()
  const seen = new Set<string>()
  const out: Node[] = []
  for (const n of [...roots, ...marked]) { if (!seen.has(n.id)) { seen.add(n.id); out.push(n) } }
  return out
}

/** Crea un contexto (marcado `_ctx='1'`) bajo el padre dado (o la raíz). */
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

/** Convierte un nodo (tarea/nota) EN un contexto: lo marca `_ctx`, le quita el
 *  estado de tarea y lo cuelga del contexto al que PERTENECÍA (subcontexto); si no
 *  tenía contexto, queda como contexto raíz bajo 🧠 Contexto. Devuelve true si se hizo. */
export function convertToContext(nodeId: string): boolean {
  const node = store.getNode(nodeId)
  const root = findContextRoot()
  if (!node || !root) return false
  // Padre = el contexto al que pertenece la tarea (subcontexto); si no, la raíz.
  const parentCtx = firstContextOf(node)
  const parentId = parentCtx && parentCtx.id !== nodeId ? parentCtx.id : root.id
  const sibs = store.children(parentId).filter(n => !n.deletedAt)
  const maxOrder = sibs.reduce((m, n) => Math.max(m, n.siblingOrder), 0)
  let ed: Record<string, unknown> = {}
  try { ed = JSON.parse(node.extraData || '{}') } catch { /* ignore */ }
  ed._ctx = '1'
  delete ed._ctxRefs // ya no es un nodo ASIGNADO a un contexto, ahora ES un contexto (su sitio lo da el parentId)
  store.updateNode(node.id, { parentId, siblingOrder: maxOrder + 1000, status: null, extraData: JSON.stringify(ed) })
  ensureTagDefinition(node.id)
  return true
}

export function setContextClosed(nodeId: string, closed: boolean): void {
  const n = store.getNode(nodeId)
  if (!n) return
  // SOLO subcontextos (con contexto padre). Los contextos RAÍZ son entidades
  // superiores: no se abren/cierran ni participan de la columna del día.
  if (!contextParent(nodeId)) return
  const e = ed(n)
  delete e._future // cerrar/reabrir manda sobre el estado «algún día»
  if (closed) e._closed = '1'
  else delete e._closed
  e._ctx = '1' // al cerrar/reabrir, queda marcado como contexto de pleno derecho
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

/** Quita el contexto padre de un subcontexto: lo sube a contexto RAÍZ (hijo directo
 *  de 🧠 Contexto). El «×» del chip de contexto padre lo usa. */
export function clearContextParent(nodeId: string): void {
  const root = findContextRoot()
  const n = store.getNode(nodeId)
  if (!root || !n || n.parentId === root.id) return
  const sibs = store.children(root.id).filter(x => !x.deletedAt)
  const maxOrder = sibs.reduce((m, x) => Math.max(m, x.siblingOrder), 0)
  store.updateNode(nodeId, { parentId: root.id, siblingOrder: maxOrder + 1000 })
  ensureTagDefinition(nodeId)
}

// ── Asignación de contexto a tareas/notas (por ID) ───────────────────

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
  // Marcar el contexto destino como contexto (_ctx) si aún no lo está, para que
  // aparezca en los listados aunque se creara por una vía antigua.
  const c = store.getNode(contextId)
  if (c && !isMarkedContext(c)) {
    const ce = ed(c); ce._ctx = '1'
    store.updateNode(contextId, { extraData: JSON.stringify(ce) })
  }
  try { touchContext(contextId, new Date().toISOString()) } catch { /* ignore */ }
}

/** Renombra un contexto SIN perder sus asociaciones. Los nodos que lo referencian
 *  por texto/slug en `types[]` (frágil ante renombrados) se migran a referencia por
 *  ID (`_ctxRefs`, robusta) y se les quita el token viejo. Luego renombra el nodo y
 *  recalcula su slug. Pasa `oldText` (el texto ANTES del cambio) para reconocer los
 *  tokens viejos aunque el texto del nodo ya se haya actualizado en vivo. */
export function renameContext(nodeId: string, oldText: string, newText: string): void {
  const c = store.getNode(nodeId)
  if (!c) return
  const oldTokens = new Set<string>()
  const oldDef = (ed(c)._tagDefinition as string) || ''   // slug viejo (aún sin recalcular)
  if (oldDef) { oldTokens.add(oldDef.toLowerCase()); const leaf = oldDef.split('/').pop(); if (leaf) oldTokens.add(leaf.toLowerCase()) }
  const ots = textToTagSlug(oldText); if (ots) oldTokens.add(ots.toLowerCase())
  if (oldText) oldTokens.add(oldText.trim().toLowerCase())
  // Migrar referencias por texto/slug → por ID.
  for (const n of store.allActive()) {
    if (n.deletedAt || n.id === nodeId) continue
    const types = n.types || []
    if (!types.some(t => oldTokens.has(t.toLowerCase()))) continue
    const e = ed(n)
    const refs = nodeCtxRefs(n)
    if (!refs.includes(nodeId)) e._ctxRefs = [...refs, nodeId]
    store.updateNode(n.id, { types: types.filter(t => !oldTokens.has(t.toLowerCase())), extraData: JSON.stringify(e) })
  }
  if ((c.text || '') !== newText) store.updateNode(nodeId, { text: newText })
  ensureTagDefinition(nodeId)   // recalcula el slug nuevo
}

/** Fija el ÚNICO contexto de un nodo (o lo quita con null). Reemplaza cualquier
 *  asignación previa: `_ctxRefs = [ctxId]` y elimina de types[] los tokens que sean
 *  contextos (@slug/texto). Un nodo = un contexto. */
export function setNodeContext(nodeId: string, contextId: string | null): void {
  const n = store.getNode(nodeId)
  if (!n) return
  // Slugs/textos de TODOS los contextos → para limpiar los que hubiera en types[].
  const ctxTokens = new Set<string>()
  for (const c of listContextsForParent()) {
    const full = getNodeTagSlug(c.id)
    if (full) { ctxTokens.add(full); const leaf = full.split('/').pop(); if (leaf) ctxTokens.add(leaf) }
    const ts = textToTagSlug(c.text || ''); if (ts) ctxTokens.add(ts)
    if (c.text) ctxTokens.add(c.text.toLowerCase())
  }
  const types = (n.types || []).filter(t => !ctxTokens.has(t) && !ctxTokens.has(t.toLowerCase()))
  const e = ed(n)
  if (contextId) e._ctxRefs = [contextId]; else delete e._ctxRefs
  store.updateNode(nodeId, { types, extraData: JSON.stringify(e) })
  if (contextId) {
    const c = store.getNode(contextId)
    if (c && !isMarkedContext(c)) { const ce = ed(c); ce._ctx = '1'; store.updateNode(contextId, { extraData: JSON.stringify(ce) }) }
    try { touchContext(contextId, new Date().toISOString()) } catch { /* ignore */ }
  }
}

/** Contextos a mostrar en listados de "en uso": contextos marcados (_ctx) +
 *  cualquier contexto referenciado por algún nodo (_ctxRefs). Solo ABIERTOS. */
export function listActiveContexts(): Node[] {
  const ids = new Set<string>()
  for (const n of store.allActive()) {
    if (n.deletedAt || isInPapelera(n.id)) continue   // la Papelera no cuenta
    if (isMarkedContext(n) && !isContextClosed(n)) ids.add(n.id)
    for (const cid of nodeCtxRefs(n)) ids.add(cid)
  }
  const out: Node[] = []
  for (const id of ids) {
    const c = store.getNode(id)
    if (c && !c.deletedAt && !isContextClosed(c) && !isInPapelera(c.id)) out.push(c)
  }
  return out.sort((a, b) => activityTs(b) - activityTs(a))
}

/** Convierte un contexto EN una tarea: le quita las marcas de contexto (`_ctx`,
 *  `_future`, `_closed`), lo asigna por referencia al contexto al que pertenecía
 *  (para que siga viéndose dentro de él) y le pone estado de tarea pendiente. No lo
 *  mueve del árbol: deja de comportarse como contexto (no sale en listas ni abre el
 *  panel de contexto). Inverso de `convertToContext`. */
export function convertToTask(nodeId: string): boolean {
  const node = store.getNode(nodeId)
  if (!node) return false
  const parentCtx = contextParent(nodeId) // el contexto bajo el que vivía
  const e = ed(node) as Record<string, unknown>
  delete e._ctx; delete e._future; delete e._closed
  if (parentCtx && parentCtx.id !== nodeId) e._ctxRefs = [parentCtx.id]
  store.updateNode(nodeId, { status: node.status ?? 'pending', extraData: JSON.stringify(e) })
  return true
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

/** ¿El nodo está creado DENTRO de la nota de este contexto? = el contexto es un
 *  ancestro y no hay otro contexto marcado más cercano entre medias, ni vive
 *  dentro del nodo de conocimiento. Así, una tarea escrita en la nota del contexto
 *  pertenece a él sin necesidad de asignarle el contexto manualmente. */
export function ownedByContext(n: Node, contextId: string): boolean {
  let cur: Node | null | undefined = n.parentId ? store.getNode(n.parentId) : null
  let guard = 0
  while (cur && guard++ < 80) {
    if (isContextKnowledge(cur.text)) return false   // dentro de "🧠 Lo que Fromly sabe"
    if (cur.id === contextId) return true
    if (isMarkedContext(cur)) return false                  // un subcontexto más cercano se lo queda
    cur = cur.parentId ? store.getNode(cur.parentId) : null
  }
  return false
}

/** Contexto (nodo) al que pertenece un nodo, o null. Orden: _ctxRefs → creado
 *  dentro de la nota del contexto (ownership) → @slug/texto en types[]. Ignora
 *  contextos cerrados. Sirve para agrupar tareas bajo su contexto en la columna. */
export function firstContextOf(n: Node): Node | null {
  for (const id of nodeCtxRefs(n)) {
    const c = store.getNode(id)
    if (c && !c.deletedAt && !isContextClosed(c)) return c
  }
  // Ownership: subir hasta el primer contexto.
  let cur: Node | null | undefined = n.parentId ? store.getNode(n.parentId) : null
  let guard = 0
  while (cur && guard++ < 80) {
    if (isContextKnowledge(cur.text)) break
    if ((isMarkedContext(cur) || isRootContext(cur.id)) && !cur.text?.startsWith('🧠')) {
      return isContextClosed(cur) ? null : cur
    }
    cur = cur.parentId ? store.getNode(cur.parentId) : null
  }
  // Por slug/texto en types[] (contextos @-mencionados): raíz + marcados.
  const types = (n.types || []).map(t => t.toLowerCase())
  if (types.length) {
    for (const c of listContextsForParent()) {
      if (isContextClosed(c)) continue
      const name = (c.text || '').trim().toLowerCase()
      const ts = textToTagSlug(c.text || '')
      if (types.includes(name) || (ts && types.includes(ts))) return c
    }
  }
  return null
}

/** Nodos asignados a un contexto: por ID (_ctxRefs), por slug clásico (@contexto
 *  en types[]) o creados DENTRO de la nota del contexto (ownership). Para mostrar
 *  el contenido en la página del contexto. Excluye la memoria interna y los
 *  subcontextos (que tienen su propia sección). */
export function nodesInContext(contextId: string): Node[] {
  // Acepta slug COMPLETO (media-sector/app…), slug HOJA (app…, como en las @menciones
  // del texto) y el slug del texto — robusto ante reparentados.
  // Tokens reconocidos (slug completo, hoja, slug del texto y el NOMBRE), todos en
  // minúscula: los types[] pueden venir como slug «piloto» o como texto «Piloto».
  const full = getNodeTagSlug(contextId)
  const c = store.getNode(contextId)
  const slugs = new Set<string>()
  if (full) { slugs.add(full.toLowerCase()); const leaf = full.split('/').pop(); if (leaf) slugs.add(leaf.toLowerCase()) }
  if (c) { const ts = textToTagSlug(c.text || ''); if (ts) slugs.add(ts.toLowerCase()); if (c.text) slugs.add(c.text.trim().toLowerCase()) }
  return store.allActive().filter(n => {
    if (n.deletedAt || n.id === contextId) return false
    if (isContextKnowledge(n.text)) return false   // memoria interna, no contenido
    if (isMarkedContext(n)) return false                  // subcontextos → su propia sección
    const member =
      nodeCtxRefs(n).includes(contextId) ||
      (n.types || []).some(t => slugs.has(t.toLowerCase())) ||
      // Tareas/eventos escritos en la nota del contexto (sin asignación explícita).
      ((n.status != null || n.isEvent) && ownedByContext(n, contextId))
    if (!member) return false
    if (isInPapelera(n.id)) return false            // la Papelera nunca aparece
    return true
  })
}

// ── Conocimiento del contexto ("🧠 Lo que Fromly sabe") ───────────────────────
// Memoria que Fromly acumula de cada contexto. NO se muestra como un nodo dentro
// del lienzo del contexto: vive como un bloque editable en la columna derecha
// (ContextPropertiesPanel). Internamente sigue siendo un nodo hijo + sublíneas,
// porque así lo lee el chat (aiChatStore.enrichTag) y lo escribe el extractor IA.

/** Nodo "🧠 Lo que Fromly sabe" de un contexto, o null si aún no existe. */
export function contextKnowledgeNode(contextId: string): Node | null {
  return store.children(contextId).find(n => !n.deletedAt && isContextKnowledge(n.text)) ?? null
}

/** ¿La línea es un andamio vacío («Palabras clave:», «Personas: —»…)? = una
 *  etiqueta «Algo:» sin valor real detrás. No debe mostrarse. */
function isEmptyKnowledgeLine(text: string): boolean {
  const t = (text || '').trim()
  if (!t) return true
  const colon = t.indexOf(':')
  const value = (colon >= 0 ? t.slice(colon + 1) : t).trim()
  return value === '' || value === '—' || value === '-'
}

/** Conocimiento del contexto como texto (una línea por sublínea hija). Omite los
 *  andamios vacíos: si no hay contenido real, devuelve cadena vacía. */
export function readContextKnowledge(contextId: string): string {
  const kn = contextKnowledgeNode(contextId)
  if (!kn) return ''
  return store.children(kn.id)
    .filter(n => !n.deletedAt && !isEmptyKnowledgeLine(n.text || ''))
    .map(n => (n.text || '').trim())
    .join('\n')
}

/** Sobrescribe el conocimiento del contexto: una línea = un nodo hijo. Crea el
 *  nodo "🧠 Lo que Fromly sabe" si hace falta; lo elimina si queda vacío. */
export function writeContextKnowledge(contextId: string, text: string): void {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
  let kn = contextKnowledgeNode(contextId)
  if (lines.length === 0) {
    if (kn) store.deleteNode(kn.id)
    return
  }
  if (!kn) {
    const sibs = store.children(contextId).filter(n => !n.deletedAt)
    const maxOrder = sibs.length > 0 ? Math.max(...sibs.map(c => c.siblingOrder)) : 0
    kn = store.createNode({ text: CONTEXT_KNOWLEDGE, parentId: contextId, siblingOrder: maxOrder + 1000 })
  }
  // Reconciliar hijos con las líneas: actualizar, crear los que falten, borrar el resto.
  const existing = store.children(kn.id).filter(n => !n.deletedAt)
  let order = 1000
  for (let i = 0; i < lines.length; i++) {
    if (existing[i]) store.updateNode(existing[i].id, { text: lines[i] })
    else store.createNode({ text: lines[i], parentId: kn.id, siblingOrder: order })
    order += 1000
  }
  for (let i = lines.length; i < existing.length; i++) store.deleteNode(existing[i].id)
}
