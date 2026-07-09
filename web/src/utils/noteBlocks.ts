// noteBlocks — convertir NOTAS antiguas (un nodo con contenido jerárquico: sub-secciones +
// líneas + tareas) en un ÚNICO bloque de texto `_doc` (TipTap). Se aplana RECURSIVAMENTE:
// las sub-secciones (nodos con hijos) → encabezados, las líneas → párrafos, las tareas →
// casillas enlazadas (tarea-From real). Solo convierte la nota de MÁS ALTO NIVEL de una
// cadena de texto (no sus sub-secciones por separado).
//
// ⚠️ Toca datos. `findConvertibleNotes()` = DRY-RUN (solo lee). `convertNoteToBlock()` =
// modifica pero es REVERSIBLE (líneas ocultas con `_absorbedBy`, NUNCA borradas).

import { store } from '../store/nodeStore'
import type { Node } from '../types'
import { isMarkedContext } from './cajones'
import { isDocNode, DOC, CTEXT } from './docNode'
import { renderInlineToHtml } from '../components/outliner/InlineRenderer'

function ed(n: Node): Record<string, unknown> {
  try { return JSON.parse(n.extraData || '{}') } catch { return {} }
}
function activeChildren(id: string): Node[] {
  return store.children(id).filter(k => !k.deletedAt)
}

/** ¿Es un sub-bloque venido de una nota (`_fromNote`)? Estos SÍ se pueden re-aplanar dentro
 *  de su nota madre (deshacen su conversión y su contenido se integra). Un `_doc` PROPIO del
 *  usuario (creado a mano en el lienzo, sin `_fromNote`) NO se toca. */
function isFromNoteBlock(n: Node): boolean {
  if (!isDocNode(n)) return false
  if (ed(n)._fromNote === '1') return true
  // Retro-compat: bloques convertidos ANTES de la marca `_fromNote` se reconocen porque
  // tienen líneas absorbidas (`_absorbedBy === suId`). Un `_doc` propio del usuario no.
  return store.children(n.id).some(k => !k.deletedAt && ed(k)._absorbedBy === n.id)
}

/** Tipos que NO se pueden aplanar en un bloque (rompen la conversión): contexto, doc PROPIO,
 *  recurso, vista, evento, diaria, agente/prompt/tag/perfil, temporal. (Tarea y sub-bloque
 *  `_fromNote` sí valen.) */
function isBlockingKind(n: Node): boolean {
  if (isMarkedContext(n)) return true
  if (isDocNode(n) && !isFromNoteBlock(n)) return true // _doc propio = blocking; _fromNote = aplanable
  if (n.isResource || n.isEvent || n.isDiaryEntry) return true
  const e = ed(n)
  // `viewBlock:'lista'` NO bloquea: es una NOTA mostrada como lista/outline (se convierte a
  // texto). Las demás vistas (kanban/tabla/pizarra/calendario/documento) sí son estructuras.
  if (e._resource || (e.viewBlock && e.viewBlock !== 'lista') || e._agentDef === '1' || e._promptDef === '1' || e._tagDefinition || e._perfilIA === '1' || e.temporalType) return true
  return false
}

/** Elementos que NO son texto pero SÍ se conservan como su PROPIA tarjeta/elemento del lienzo
 *  cuando aparecen dentro de una nota: evento, recurso (PDF/imagen/archivo), vista (kanban/
 *  tabla/lista/pizarra) y sub-documento PROPIO del usuario. Al convertir la nota, estos se
 *  EXTRAEN (se reparentan como hermanos de la tarjeta), no se aplanan → no se pierden.
 *  Un contexto/diaria/agente/prompt/tag/perfil/temporal NO es extraíble → su nota madre no se
 *  convierte (son estructura especial, no se tocan). */
function isExtractable(n: Node): boolean {
  if (isMarkedContext(n) || n.isDiaryEntry) return false
  const e = ed(n)
  if (e._agentDef === '1' || e._promptDef === '1' || e._tagDefinition || e._perfilIA === '1' || e.temporalType) return false
  if (e.viewBlock === 'lista') return false // vista de lista = nota → se aplana, no se extrae
  if (n.isResource || n.isEvent || e._resource || e._resourceUrl || e.viewBlock) return true
  if (isDocNode(n)) return !isFromNoteBlock(n) // sub-doc PROPIO → aparte; `_fromNote` → se aplana
  return false
}

/** ¿El subárbol contiene un bloqueante que NO sabemos extraer (contexto/diaria/agente/…)?
 *  Si lo tiene, la nota NO se convierte: se deja intacta (demasiado especial para tocarla). */
function hasUnhandledBlocker(n: Node): boolean {
  for (const k of activeChildren(n.id)) {
    if (isBlockingKind(k) && !isExtractable(k)) return true
    if (hasUnhandledBlocker(k)) return true
  }
  return false
}

/** ¿Es una nota convertible de ALTO NIVEL? Tiene hijos, no es ella misma un tipo especial,
 *  no contiene bloqueantes no-extraíbles, y su padre NO es a su vez una nota convertible
 *  (para no partir la jerarquía: la sub-sección se aplana dentro del padre, sus elementos no
 *  texto se extraen). Con `force` (acción EXPLÍCITA del usuario sobre ESTA nota concreta, no
 *  una migración masiva) se salta SOLO esa comprobación del padre: convertir la nota que se
 *  está mirando, aunque cuelgue de un contenedor plano no-contexto. Los bloqueantes reales
 *  (la propia nota es un tipo especial, o contiene uno no extraíble) siguen aplicando siempre. */
function isTopConvertible(n: Node, force = false): boolean {
  if (isDocNode(n)) return false // YA es un bloque (aunque sea `_fromNote`): no se re-convierte
  if (ed(n)._absorbedBy != null) return false // ya está OCULTO dentro de un bloque → no es nota suelta
  if (isBlockingKind(n)) return false
  const kids = activeChildren(n.id)
  if (kids.length === 0) return false            // hoja: no es nota
  if (hasUnhandledBlocker(n)) return false
  if (force) return true
  const parent = n.parentId ? store.getNode(n.parentId) : null
  if (parent && !parent.deletedAt && !isDocNode(parent) && !isBlockingKind(parent) && !hasUnhandledBlocker(parent) && activeChildren(parent.id).length > 0) {
    return false // el padre se convertirá y aplanará esta sub-sección dentro
  }
  return true
}

export interface ConvertibleNote { id: string; title: string; lines: string[] }

/** DRY-RUN: identifica las notas convertibles SIN modificar nada. */
export function findConvertibleNotes(): ConvertibleNote[] {
  const out: ConvertibleNote[] = []
  for (const n of store.allActive()) {
    if (!store.isNote(n)) continue
    if (!isTopConvertible(n)) continue
    out.push({ id: n.id, title: (n.text || '').trim(), lines: activeChildren(n.id).map(k => (k.text || '')) })
  }
  return out
}

/** Tipo legible de un nodo (para el diagnóstico). */
function kindOf(n: Node): string {
  if (isMarkedContext(n)) return 'contexto'
  if (isDocNode(n)) return 'bloque-doc'
  if (n.isResource) return 'recurso'
  if (n.isEvent) return 'evento'
  if (n.isDiaryEntry) return 'diaria'
  const e = ed(n)
  if (e._resource) return 'recurso'
  if (e.viewBlock) return 'vista(' + String(e.viewBlock) + ')'
  if (e._agentDef === '1') return 'agente'
  if (e._promptDef === '1') return 'prompt'
  if (e._tagDefinition) return 'tag'
  if (e._perfilIA === '1') return 'perfil-IA'
  if (e.temporalType) return 'temporal'
  return 'texto'
}
function findBlockingDescendant(n: Node): Node | null {
  // Solo bloqueantes NO extraíbles (contexto/diaria/agente/…): esos son los que impiden
  // convertir. Eventos/recursos/vistas/sub-docs YA no bloquean (se extraen).
  for (const k of activeChildren(n.id)) {
    if (isBlockingKind(k) && !isExtractable(k)) return k
    const deep = findBlockingDescendant(k)
    if (deep) return deep
  }
  return null
}
/** DIAGNÓSTICO: por qué una nota NO se convierte (cuenta razones + ejemplos). No modifica. */
export function diagnoseNotes(): { convertible: number; reasons: Record<string, number>; examples: string[] } {
  let convertible = 0
  const reasons: Record<string, number> = {}
  const examples: string[] = []
  for (const n of store.allActive()) {
    if (!store.isNote(n)) continue
    if (isTopConvertible(n)) { convertible++; continue }
    let reason: string
    if (isDocNode(n)) reason = 'ya-es-bloque'
    else if (isBlockingKind(n)) reason = 'la-nota-es-' + kindOf(n)
    else {
      const parent = n.parentId ? store.getNode(n.parentId) : null
      if (parent && !parent.deletedAt && !isDocNode(parent) && !isBlockingKind(parent) && !hasUnhandledBlocker(parent) && activeChildren(parent.id).length > 0) reason = 'es-subseccion (se aplana en su nota padre)'
      else { const b = findBlockingDescendant(n); reason = b ? 'contiene-no-extraible-' + kindOf(b) : 'otro' }
    }
    reasons[reason] = (reasons[reason] || 0) + 1
    if (examples.length < 10 && !reason.startsWith('es-subseccion')) examples.push(`${(n.text || '(sin título)').slice(0, 32)} → ${reason}`)
  }
  return { convertible, reasons, examples }
}

/** INSPECCIÓN: bloques `_doc` que tienen hijos SUELTOS (sin `_absorbedBy`/`_taskEmbed`) → esas
 *  líneas se ven fuera del recuadro. Revela por qué no se absorbieron. No modifica. */
export function inspectUnabsorbed(): string {
  const out: string[] = []
  for (const n of store.allActive()) {
    if (!isDocNode(n)) continue
    const kids = store.children(n.id).filter(k => !k.deletedAt)
    const loose = kids.filter(k => { const e = ed(k); return !e._absorbedBy && !e._taskEmbed })
    if (loose.length === 0) continue
    out.push(`▸ «${(n.text || '(sin título)').slice(0, 28)}» — ${loose.length}/${kids.length} hijos SUELTOS · body ${(n.body || '').length}c · _fromNote=${ed(n)._fromNote === '1' ? 'sí' : 'NO'}`)
    for (const l of loose.slice(0, 3)) out.push(`    └ ${isDocNode(l) ? '[bloque]' : l.status != null ? '[tarea]' : '[texto]'} «${(l.text || '').slice(0, 34)}» hijos:${store.children(l.id).filter(c => !c.deletedAt).length}`)
  }
  return out.slice(0, 40).join('\n') || 'No hay bloques con hijos sueltos ✓'
}

/** Texto de una línea → HTML de bloque (respeta encabezados/citas/listas markdown). */
function lineToHtml(text: string): string {
  const t = (text || '').trim()
  if (!t) return '<p></p>'
  if (/^#\s/.test(t)) return `<h1>${renderInlineToHtml(t.replace(/^#\s+/, ''))}</h1>`
  if (/^##\s/.test(t)) return `<h2>${renderInlineToHtml(t.replace(/^##\s+/, ''))}</h2>`
  if (/^###\s/.test(t)) return `<h3>${renderInlineToHtml(t.replace(/^###\s+/, ''))}</h3>`
  if (/^[-*]\s/.test(t)) return `<ul><li><p>${renderInlineToHtml(t.replace(/^[-*]\s+/, ''))}</p></li></ul>`
  if (/^>\s/.test(t)) return `<blockquote><p>${renderInlineToHtml(t.replace(/^>\s+/, ''))}</p></blockquote>`
  return `<p>${renderInlineToHtml(t)}</p>`
}

/** Sub-sección (nodo con hijos) → encabezado según profundidad. */
function headingHtml(text: string, depth: number): string {
  const t = (text || '').trim()
  if (!t) return ''
  const tag = depth <= 0 ? 'h2' : depth === 1 ? 'h3' : 'h4'
  return `<${tag}>${renderInlineToHtml(t)}</${tag}>`
}

/** Tarea hoja → casilla enlazada (taskItem con su `data-node-id`) dentro del bloque. */
function taskToHtml(k: Node): string {
  const checked = k.status === 'done'
  const text = (k.text || '').trim()
  return `<ul data-type="taskList"><li data-type="taskItem" data-checked="${checked}" data-node-id="${k.id}"><label><input type="checkbox"${checked ? ' checked="checked"' : ''}><span></span></label><div><p>${renderInlineToHtml(text)}</p></div></li></ul>`
}

/** Recorre el subárbol construyendo el body y recogiendo qué nodos ocultar (líneas) o
 *  enlazar como tarea (`_taskEmbed`). */
function walkSubtree(id: string, depth: number, parts: string[], absorb: string[], tasks: string[], undoc: string[], extract: string[]): void {
  for (const k of activeChildren(id)) {
    // Elemento NO texto (evento/recurso/vista/sub-doc propio) → se EXTRAE como elemento
    // aparte del lienzo; no se aplana ni se recorre (se conserva íntegro con su subárbol).
    if (isExtractable(k)) { extract.push(k.id); continue }
    const isTask = k.status !== null
    const kids = activeChildren(k.id)
    if (isTask) {
      parts.push(taskToHtml(k))
      tasks.push(k.id)
      if (kids.length) walkSubtree(k.id, depth + 1, parts, absorb, tasks, undoc, extract)
    } else if (isFromNoteBlock(k)) {
      // Sub-bloque YA convertido (de una nota): título = encabezado, se DES-CONVIERTE y su
      // contenido (líneas ya absorbidas) se re-aplana dentro de esta nota madre.
      parts.push(headingHtml(k.text || '', depth))
      undoc.push(k.id)
      walkSubtree(k.id, depth + 1, parts, absorb, tasks, undoc, extract)
    } else if (kids.length) {
      // Sub-sección: su título = encabezado, y su contenido se aplana debajo.
      parts.push(headingHtml(k.text || '', depth))
      absorb.push(k.id)
      walkSubtree(k.id, depth + 1, parts, absorb, tasks, undoc, extract)
    } else {
      parts.push(lineToHtml(k.text || ''))
      absorb.push(k.id)
    }
  }
}

/** Convierte UNA nota (con toda su jerarquía) en bloque `_doc`. REVERSIBLE.
 *  `force=true` = acción explícita del usuario sobre ESTA nota (botón «Convertir a
 *  documento» en su propio detalle): convierte aunque cuelgue de un contenedor plano
 *  que en teoría "la absorbería" si se migrara en bloque (ver `isTopConvertible`). */
export function convertNoteToBlock(id: string, force = false): boolean {
  const n = store.getNode(id)
  if (!n || n.deletedAt || !store.isNote(n) || !isTopConvertible(n, force)) return false

  const parts: string[] = []
  const absorb: string[] = []
  const tasks: string[] = []
  const undoc: string[] = []
  const extract: string[] = []
  if ((n.text || '').trim()) parts.push(`<h2>${renderInlineToHtml((n.text || '').trim())}</h2>`)
  walkSubtree(id, 0, parts, absorb, tasks, undoc, extract)
  const body = parts.join('') || '<p></p>'

  store.beginBatch?.()
  try {
    const e = ed(n)
    e[DOC] = '1'; e[CTEXT] = '1'; e._fromNote = '1'
    if (e.viewBlock === 'lista') { e._prevViewBlock = 'lista'; delete e.viewBlock } // deja de ser vista de lista
    // Si la nota YA tenía un body (p. ej. trazos de pizarra en una nota-lista), lo guardamos
    // antes de sobrescribirlo con el texto aplanado → NADA se pierde (revert lo restaura).
    if ((n.body || '').trim()) e._prevBody = n.body
    if (e._pinW == null) e._pinW = '360'
    store.updateNode(id, { body, extraData: JSON.stringify(e) })
    for (const lid of absorb) {
      const le = (() => { const x = store.getNode(lid); return x ? ed(x) : {} })()
      le._absorbedBy = id
      store.updateNode(lid, { extraData: JSON.stringify(le) })
    }
    // Sub-bloques `_fromNote`: dejan de ser bloque (des-convertir) y se absorben en la madre.
    for (const did of undoc) {
      const de = (() => { const x = store.getNode(did); return x ? ed(x) : {} })()
      delete de[DOC]; delete de[CTEXT]; delete de._fromNote; delete de._pinW
      de._absorbedBy = id
      store.updateNode(did, { extraData: JSON.stringify(de), body: null })
    }
    for (const tid of tasks) {
      const te = (() => { const x = store.getNode(tid); return x ? ed(x) : {} })()
      te._taskEmbed = '1'; te._absorbedBy = id // oculta la tarea suelta; el body la muestra como casilla
      store.updateNode(tid, { extraData: JSON.stringify(te) })
    }
    // Elementos NO texto (evento/recurso/vista/sub-doc): se EXTRAEN como HERMANOS de la
    // tarjeta (mismo padre que la nota) para que sigan siendo su propio elemento del lienzo
    // y no se pierdan. `_extractedFrom`+`_prevParent` = reversible.
    for (const xid of extract) {
      const x = store.getNode(xid); if (!x) continue
      const xe = ed(x)
      xe._extractedFrom = id
      xe._prevParent = x.parentId ?? ''
      store.updateNode(xid, { parentId: n.parentId ?? null, extraData: JSON.stringify(xe) })
    }
  } finally {
    store.endBatch?.()
  }
  return true
}

/** UNIR MANUAL: fusiona los nodos SELECCIONADOS (líneas/tareas sueltas) en UN bloque `_doc`.
 *  El bloque nace en la posición del primer nodo; los originales se ocultan (`_absorbedBy`) o
 *  se enlazan como casilla (tareas). Devuelve el id del bloque nuevo, o null. */
export function mergeNodesToBlock(ids: string[]): string | null {
  const nodes = ids.map(id => store.getNode(id)).filter((n): n is Node => !!n && !n.deletedAt)
  if (nodes.length === 0) return null
  // Orden visual: por su posición en el padre común (o por _pinY si están sueltos).
  const firstParent = nodes[0].parentId
  const siblings = firstParent ? store.children(firstParent).map(c => c.id) : []
  nodes.sort((a, b) => {
    const ia = siblings.indexOf(a.id), ib = siblings.indexOf(b.id)
    if (ia !== -1 && ib !== -1) return ia - ib
    const ya = Number(ed(a)._pinY ?? 0), yb = Number(ed(b)._pinY ?? 0)
    return ya - yb
  })

  const parts: string[] = []
  const absorb: string[] = []
  const tasks: string[] = []
  const undoc: string[] = []
  const process = (list: Node[], depth: number) => {
    for (const k of list) {
      const kids = activeChildren(k.id)
      if (isFromNoteBlock(k)) { parts.push(k.body || ''); undoc.push(k.id); process(kids, depth + 1) }
      else if (k.status !== null) { parts.push(taskToHtml(k)); tasks.push(k.id); if (kids.length) process(kids, depth + 1) }
      else if (kids.length) { parts.push(headingHtml(k.text || '', depth)); absorb.push(k.id); process(kids, depth + 1) }
      else { parts.push(lineToHtml(k.text || '')); absorb.push(k.id) }
    }
  }
  process(nodes, 0)
  const body = parts.join('') || '<p></p>'

  const first = nodes[0]
  const fe = ed(first)
  const extra: Record<string, string> = { [DOC]: '1', [CTEXT]: '1', _fromNote: '1', _pinW: '360' }
  for (const key of ['_pinX', '_pinY', '_pinScale', '_cardScale', '_gx', '_gy'] as const) {
    if (fe[key] != null) extra[key] = String(fe[key])
  }
  let docId: string | null = null
  store.beginBatch?.()
  try {
    const doc = store.createNode({ text: (first.text || 'Texto').slice(0, 80), parentId: first.parentId ?? null, extraData: extra })
    docId = doc.id
    store.updateNode(doc.id, { body })
    for (const lid of absorb) { const e = (() => { const x = store.getNode(lid); return x ? ed(x) : {} })(); e._absorbedBy = doc.id; store.updateNode(lid, { extraData: JSON.stringify(e) }) }
    for (const did of undoc) { const e = (() => { const x = store.getNode(did); return x ? ed(x) : {} })(); delete e[DOC]; delete e[CTEXT]; delete e._fromNote; delete e._pinW; e._absorbedBy = doc.id; store.updateNode(did, { extraData: JSON.stringify(e), body: null }) }
    for (const tid of tasks) { const e = (() => { const x = store.getNode(tid); return x ? ed(x) : {} })(); e._taskEmbed = '1'; e._absorbedBy = doc.id; store.updateNode(tid, { extraData: JSON.stringify(e) }) }
  } finally {
    store.endBatch?.()
  }
  return docId
}

/** Convierte TODAS las notas convertibles, EN CASCADA: al fusionar una nota madre, su
 *  «abuela» pasa a ser convertible → se repite hasta que no queda ninguna. Devuelve el total. */
export function convertAllNotesToBlocks(): number {
  let total = 0
  store.beginBatch?.()
  try {
    for (let iter = 0; iter < 30; iter++) {
      const notes = findConvertibleNotes()
      if (notes.length === 0) break
      let did = 0
      for (const note of notes) if (convertNoteToBlock(note.id)) did++
      total += did
      if (did === 0) break
    }
  } finally { store.endBatch?.() }
  return total
}

// DEV-only: exponer el motor en `window.__noteBlocks` para inspección/pruebas en el navegador
// (dry-run, convertir una nota, deshacer). NO se incluye en producción (`import.meta.env.DEV`).
if (import.meta.env.DEV && typeof window !== 'undefined') {
  ;(window as unknown as Record<string, unknown>).__noteBlocks = {
    findConvertibleNotes, diagnoseNotes, convertNoteToBlock, convertAllNotesToBlocks, revertAllNoteBlocks, inspectUnabsorbed,
    why(id: string) {
      const n = store.getNode(id)
      if (!n) return { err: 'no node' }
      const kids = activeChildren(n.id)
      const parent = n.parentId ? store.getNode(n.parentId) : null
      return {
        isNote: store.isNote(n), isDoc: isDocNode(n), isBlocking: isBlockingKind(n),
        kids: kids.length, hasUnhandledBlocker: hasUnhandledBlocker(n),
        parentTitle: (parent?.text || '').slice(0, 24), parentBlocking: parent ? isBlockingKind(parent) : null,
        parentIsDoc: parent ? isDocNode(parent) : null,
        top: isTopConvertible(n),
      }
    },
  }
}

/** DESHACER: revierte todos los bloques venidos de notas (`_fromNote`). Recorre TODO el
 *  subárbol quitando `_absorbedBy`/`_taskEmbed` → vuelven las líneas y tareas. Nada se pierde. */
export function revertAllNoteBlocks(): number {
  let n = 0
  const clearSubtree = (id: string) => {
    for (const k of store.children(id)) {
      if (k.deletedAt) continue
      const ke = ed(k)
      let changed = false
      if (ke._absorbedBy) { delete ke._absorbedBy; changed = true }
      if (ke._taskEmbed) { delete ke._taskEmbed; changed = true }
      if (changed) store.updateNode(k.id, { extraData: JSON.stringify(ke) })
      clearSubtree(k.id)
    }
  }
  store.beginBatch?.()
  try {
    // 1) Restaurar los elementos EXTRAÍDOS a su padre original (reparentar de vuelta).
    for (const node of store.allActive()) {
      const e = ed(node)
      if (e._extractedFrom == null) continue
      const prev = typeof e._prevParent === 'string' ? e._prevParent : ''
      delete e._extractedFrom; delete e._prevParent
      store.updateNode(node.id, { parentId: prev || null, extraData: JSON.stringify(e) })
    }
    // 2) Des-convertir los bloques de nota: `_fromNote` Y los antiguos (con líneas absorbidas).
    for (const node of store.allActive()) {
      if (!isFromNoteBlock(node)) continue
      const e = ed(node)
      delete e[DOC]; delete e[CTEXT]; delete e._fromNote
      if (e._prevViewBlock) { e.viewBlock = e._prevViewBlock; delete e._prevViewBlock } // restaurar vista de lista
      const restoreBody = typeof e._prevBody === 'string' ? e._prevBody : null // restaurar body previo (pizarra…)
      delete e._prevBody
      store.updateNode(node.id, { extraData: JSON.stringify(e), body: restoreBody })
      clearSubtree(node.id)
      n++
    }
  } finally { store.endBatch?.() }
  return n
}
