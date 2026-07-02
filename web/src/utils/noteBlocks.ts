// noteBlocks — convertir NOTAS antiguas (un nodo con hijos-línea) en un ÚNICO bloque de
// texto `_doc` (TipTap), para el lienzo: se mueve/redimensiona como uno y no se amontona.
//
// ⚠️ Toca datos. Por eso hay DOS funciones separadas: `findConvertibleNotes()` (DRY-RUN,
// solo lee y reporta) y `convertNoteToBlock()` (modifica, reversible en Fase 1). El criterio
// es CONSERVADOR: solo notas cuyos hijos son TODOS líneas simples (hojas de texto). Si una
// nota tiene sub-notas, tareas, eventos, contextos o recursos dentro, NO se toca.

import { store } from '../store/nodeStore'
import type { Node } from '../types'
import { isMarkedContext } from './cajones'
import { isDocNode, DOC, CTEXT } from './docNode'
import { renderInlineToHtml } from '../components/outliner/InlineRenderer'

/** ¿Es una LÍNEA simple? = hoja de texto: sin hijos, y no tarea/evento/recurso/contexto/doc. */
function isSimpleLine(k: Node): boolean {
  if (k.deletedAt) return false
  if (k.status !== null || k.isEvent || k.isResource || k.isDiaryEntry) return false
  if (isMarkedContext(k) || isDocNode(k)) return false
  try {
    const e = JSON.parse(k.extraData || '{}')
    if (e._resource || e.temporalType || e._agentDef === '1' || e._promptDef === '1' || e._tagDefinition || e._perfilIA === '1') return false
    if (e.viewBlock) return false
  } catch { /* ignore */ }
  // Hoja: sin hijos activos.
  return !store.children(k.id).some(c => !c.deletedAt)
}

/** ¿Es una TAREA hoja? = tarea (status≠null) sin hijos, no evento/recurso/contexto/doc. Estas
 *  SÍ pueden ir dentro de un bloque: se mantienen como casilla enlazada (tarea-From real). */
function isTaskLeaf(k: Node): boolean {
  if (k.deletedAt) return false
  if (k.status === null || k.isEvent || k.isResource || k.isDiaryEntry) return false
  if (isMarkedContext(k) || isDocNode(k)) return false
  return !store.children(k.id).some(c => !c.deletedAt)
}

/** Un hijo es CONVERTIBLE dentro de un bloque si es una línea simple o una tarea hoja. */
function isConvertibleChild(k: Node): boolean {
  return isSimpleLine(k) || isTaskLeaf(k)
}

export interface ConvertibleNote { id: string; title: string; lines: string[] }

/** DRY-RUN: identifica las notas convertibles SIN modificar nada. */
export function findConvertibleNotes(): ConvertibleNote[] {
  const out: ConvertibleNote[] = []
  for (const n of store.allActive()) {
    if (!store.isNote(n)) continue        // debe ser nota (nodo con hijos, no tarea/evento/…)
    if (isMarkedContext(n)) continue      // un CONTEXTO no es una nota (puede contener varias)
    if (isDocNode(n)) continue            // ya es un bloque _doc
    const kids = store.children(n.id).filter(k => !k.deletedAt)
    if (kids.length === 0) continue
    if (!kids.every(isConvertibleChild)) continue   // hijos = líneas o tareas hoja; si no, NO tocar
    out.push({ id: n.id, title: (n.text || '').trim(), lines: kids.map(k => (k.text || '')) })
  }
  return out
}

/** Una línea de texto → HTML de bloque (respeta encabezados/citas/listas via renderInlineToHtml). */
function lineToHtml(text: string): string {
  const t = (text || '').trim()
  if (!t) return '<p></p>'
  const inner = renderInlineToHtml(t)
  if (/^#\s/.test(t)) return `<h1>${renderInlineToHtml(t.replace(/^#\s+/, ''))}</h1>`
  if (/^##\s/.test(t)) return `<h2>${renderInlineToHtml(t.replace(/^##\s+/, ''))}</h2>`
  if (/^###\s/.test(t)) return `<h3>${renderInlineToHtml(t.replace(/^###\s+/, ''))}</h3>`
  if (/^[-*]\s/.test(t)) return `<ul><li><p>${renderInlineToHtml(t.replace(/^[-*]\s+/, ''))}</p></li></ul>`
  if (/^>\s/.test(t)) return `<blockquote><p>${renderInlineToHtml(t.replace(/^>\s+/, ''))}</p></blockquote>`
  return `<p>${inner}</p>`
}

/** Una TAREA hoja → casilla enlazada (taskItem con su `data-node-id`) dentro del bloque. */
function taskToHtml(k: Node): string {
  const checked = k.status === 'done'
  const text = (k.text || '').trim()
  return `<ul data-type="taskList"><li data-type="taskItem" data-checked="${checked}" data-node-id="${k.id}"><label><input type="checkbox"${checked ? ' checked="checked"' : ''}><span></span></label><div><p>${renderInlineToHtml(text)}</p></div></li></ul>`
}

/**
 * Convierte UNA nota en bloque `_doc`. Fase 1 REVERSIBLE: fusiona el título + las líneas en
 * el `body` HTML del propio nodo, lo marca como `_doc`, y OCULTA las líneas-hijas con
 * `_absorbedBy` (NO las borra) → el lienzo deja de pintarlas sueltas y se conserva el dato.
 * Devuelve true si convirtió.
 */
export function convertNoteToBlock(id: string): boolean {
  const n = store.getNode(id)
  if (!n || n.deletedAt) return false
  if (!store.isNote(n) || isMarkedContext(n) || isDocNode(n)) return false
  const kids = store.children(id).filter(k => !k.deletedAt)
  if (kids.length === 0 || !kids.every(isConvertibleChild)) return false

  const parts: string[] = []
  if ((n.text || '').trim()) parts.push(`<h2>${renderInlineToHtml((n.text || '').trim())}</h2>`)
  for (const k of kids) parts.push(isTaskLeaf(k) ? taskToHtml(k) : lineToHtml(k.text || ''))
  const body = parts.join('') || '<p></p>'

  store.beginBatch?.()
  try {
    const ed = (() => { try { return JSON.parse(n.extraData || '{}') } catch { return {} } })()
    ed[DOC] = '1'; ed[CTEXT] = '1'; ed._fromNote = '1' // marca de «bloque venido de una nota» → deshacer seguro
    if (ed._pinW == null) ed._pinW = '360'
    store.updateNode(id, { body, extraData: JSON.stringify(ed) })
    for (const k of kids) {
      const ke = (() => { try { return JSON.parse(k.extraData || '{}') } catch { return {} } })()
      if (isTaskLeaf(k)) {
        // TAREA: se mantiene como tarea-From real, enlazada al body (casilla). No se oculta.
        ke._taskEmbed = '1'
      } else {
        // LÍNEA: Fase 1 → ocultar (no borrar) = reversible.
        ke._absorbedBy = id
      }
      store.updateNode(k.id, { extraData: JSON.stringify(ke) })
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

/**
 * DESHACER: revierte todas las notas convertidas. Un bloque convertido se reconoce porque
 * tiene hijos con `_absorbedBy === suId`. Al padre le quita `_doc`/`_ctext` y el body (vuelve
 * a ser nota normal con su `text`); a las líneas les quita `_absorbedBy` (vuelven a pintarse).
 * No se pierde nada porque en la conversión NUNCA se borró: solo se ocultó.
 */
export function revertAllNoteBlocks(): number {
  let n = 0
  store.beginBatch?.()
  try {
    for (const node of store.allActive()) {
      const e = (() => { try { return JSON.parse(node.extraData || '{}') } catch { return {} } })()
      if (e._fromNote !== '1') continue // solo bloques venidos de una NOTA (no los textos propios)
      const kids = store.children(node.id).filter(k => !k.deletedAt)
      delete e[DOC]; delete e[CTEXT]; delete e._fromNote
      store.updateNode(node.id, { extraData: JSON.stringify(e), body: null })
      for (const k of kids) {
        const ke = (() => { try { return JSON.parse(k.extraData || '{}') } catch { return {} } })()
        if (ke._absorbedBy === node.id) delete ke._absorbedBy // línea → vuelve a verse
        else if (ke._taskEmbed === '1') delete ke._taskEmbed   // tarea → vuelve a suelta
        else continue
        store.updateNode(k.id, { extraData: JSON.stringify(ke) })
      }
      n++
    }
  } finally { store.endBatch?.() }
  return n
}
