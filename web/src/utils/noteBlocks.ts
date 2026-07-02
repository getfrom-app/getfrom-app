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

/** Tipos que NO se pueden aplanar en un bloque (rompen la conversión): contexto, doc, recurso,
 *  vista, evento, diaria, agente/prompt/tag/perfil, estructura temporal. (Una TAREA sí vale.) */
function isBlockingKind(n: Node): boolean {
  if (isMarkedContext(n) || isDocNode(n)) return true
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
function walkSubtree(id: string, depth: number, parts: string[], absorb: string[], tasks: string[]): void {
  for (const k of activeChildren(id)) {
    const isTask = k.status !== null
    const kids = activeChildren(k.id)
    if (isTask) {
      parts.push(taskToHtml(k))
      tasks.push(k.id)
      if (kids.length) walkSubtree(k.id, depth + 1, parts, absorb, tasks)
    } else if (kids.length) {
      // Sub-sección: su título = encabezado, y su contenido se aplana debajo.
      parts.push(headingHtml(k.text || '', depth))
      absorb.push(k.id)
      walkSubtree(k.id, depth + 1, parts, absorb, tasks)
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
  if ((n.text || '').trim()) parts.push(`<h2>${renderInlineToHtml((n.text || '').trim())}</h2>`)
  walkSubtree(id, 0, parts, absorb, tasks)
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
