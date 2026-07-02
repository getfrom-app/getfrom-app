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
  if (e._resource || e.viewBlock || e._agentDef === '1' || e._promptDef === '1' || e._tagDefinition || e._perfilIA === '1' || e.temporalType) return true
  return false
}

/** ¿Todo el subárbol de `n` es texto/tareas (nada «blocking»)? → aplanable en un bloque. */
function subtreeConvertible(n: Node): boolean {
  if (isBlockingKind(n)) return false
  for (const k of activeChildren(n.id)) if (!subtreeConvertible(k)) return false
  return true
}

/** ¿Es una nota convertible de ALTO NIVEL? Tiene contenido, todo su subárbol es texto/tareas,
 *  y su padre NO es a su vez una nota convertible (para no partir la jerarquía). */
function isTopConvertible(n: Node): boolean {
  if (isBlockingKind(n)) return false
  const kids = activeChildren(n.id)
  if (kids.length === 0) return false            // hoja: no es nota
  if (!kids.every(subtreeConvertible)) return false
  const parent = n.parentId ? store.getNode(n.parentId) : null
  if (parent && !parent.deletedAt && !isBlockingKind(parent) && activeChildren(parent.id).length > 0 && activeChildren(parent.id).every(subtreeConvertible)) {
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
  for (const k of activeChildren(n.id)) {
    if (isBlockingKind(k)) return k
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
    if (isBlockingKind(n)) reason = 'la-nota-es-' + kindOf(n)
    else {
      const parent = n.parentId ? store.getNode(n.parentId) : null
      if (parent && !parent.deletedAt && !isBlockingKind(parent) && activeChildren(parent.id).length > 0 && activeChildren(parent.id).every(subtreeConvertible)) reason = 'es-subseccion (se aplana en su nota padre)'
      else { const b = findBlockingDescendant(n); reason = b ? 'contiene-' + kindOf(b) : 'otro' }
    }
    reasons[reason] = (reasons[reason] || 0) + 1
    if (examples.length < 10 && !reason.startsWith('es-subseccion')) examples.push(`${(n.text || '(sin título)').slice(0, 32)} → ${reason}`)
  }
  return { convertible, reasons, examples }
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
function walkSubtree(id: string, depth: number, parts: string[], absorb: string[], tasks: string[], undoc: string[]): void {
  for (const k of activeChildren(id)) {
    const isTask = k.status !== null
    const kids = activeChildren(k.id)
    if (isTask) {
      parts.push(taskToHtml(k))
      tasks.push(k.id)
      if (kids.length) walkSubtree(k.id, depth + 1, parts, absorb, tasks, undoc)
    } else if (isFromNoteBlock(k)) {
      // Sub-bloque YA convertido (de una nota): título = encabezado, se DES-CONVIERTE y su
      // contenido (líneas ya absorbidas) se re-aplana dentro de esta nota madre.
      parts.push(headingHtml(k.text || '', depth))
      undoc.push(k.id)
      walkSubtree(k.id, depth + 1, parts, absorb, tasks, undoc)
    } else if (kids.length) {
      // Sub-sección: su título = encabezado, y su contenido se aplana debajo.
      parts.push(headingHtml(k.text || '', depth))
      absorb.push(k.id)
      walkSubtree(k.id, depth + 1, parts, absorb, tasks, undoc)
    } else {
      parts.push(lineToHtml(k.text || ''))
      absorb.push(k.id)
    }
  }
}

/** Convierte UNA nota (con toda su jerarquía) en bloque `_doc`. REVERSIBLE. */
export function convertNoteToBlock(id: string): boolean {
  const n = store.getNode(id)
  if (!n || n.deletedAt || !store.isNote(n) || !isTopConvertible(n)) return false

  const parts: string[] = []
  const absorb: string[] = []
  const tasks: string[] = []
  const undoc: string[] = []
  if ((n.text || '').trim()) parts.push(`<h2>${renderInlineToHtml((n.text || '').trim())}</h2>`)
  walkSubtree(id, 0, parts, absorb, tasks, undoc)
  const body = parts.join('') || '<p></p>'

  store.beginBatch?.()
  try {
    const e = ed(n)
    e[DOC] = '1'; e[CTEXT] = '1'; e._fromNote = '1'
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
  } finally {
    store.endBatch?.()
  }
  return true
}

/** Convierte TODAS las notas convertibles. Devuelve cuántas convirtió. */
export function convertAllNotesToBlocks(): number {
  const notes = findConvertibleNotes()
  let n = 0
  store.beginBatch?.()
  try { for (const note of notes) if (convertNoteToBlock(note.id)) n++ }
  finally { store.endBatch?.() }
  return n
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
    for (const node of store.allActive()) {
      const e = ed(node)
      if (e._fromNote !== '1') continue
      delete e[DOC]; delete e[CTEXT]; delete e._fromNote
      store.updateNode(node.id, { extraData: JSON.stringify(e), body: null })
      clearSubtree(node.id)
      n++
    }
  } finally { store.endBatch?.() }
  return n
}
