// nestedCanvasLayout — layout ANIDADO y AUTO-CALCULADO del lienzo único.
//
// UNA sola región: CONTEXTOS (cajas anidadas con forma de pantalla):
//   · 🧠 Contexto → contexto → subcontexto → … (caja = contexto marcado).
// El calendario/AGENDA ya NO vive en este lienzo infinito: es una superficie DISCRETA
// aparte (`TemporalCanvasView`, la raíz 📅 Agenda, con niveles año→mes→día y celdas
// uniformes) donde cada día se abre como su propio espacio. Mezclar el zoom continuo del
// lienzo con la rejilla discreta del calendario hacía que un texto escrito con zoom alejado
// abarcase muchos días y que las celdas crecieran con el contenido → se separaron (v9.6.705).
// El contenido de una caja se pinta como esquema vertical con el texto COMPLETO (sin truncar).
// Todo en memoria (no escribe nada). El `_area` propio de un nodo (movido a mano) manda
// sobre la caja calculada.
import { store } from '../store/nodeStore'
import type { Node } from '../types'
import { isMarkedContext } from './cajones'
import { isContextKnowledge } from './knowledgeNodes'
import { findContextRoot } from './rootLookup'

export interface NRect { x: number; y: number; w: number; h: number }
export interface NestedLayout {
  boxes: Map<string, NRect>      // marcos de CONTEXTO (se dibujan como rectángulo)
  items: Map<string, NRect>      // contenido (tarjetas) de los contextos
  dayCells: Map<string, NRect>   // (obsoleto) el calendario ya no vive en el lienzo → SIEMPRE vacío
  contextIds: Set<string>
  contentIds: Set<string>
  dayContentIds: Set<string>     // (obsoleto) SIEMPRE vacío
  todayId: string | null         // (obsoleto) SIEMPRE null
}

export const CONTENT_W = 600
const INDENT = 24
const LINE_H = 25
const ROW_PAD = 12
const TEXT_W = CONTENT_W - 60
const TEXT_FONT = '15px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
const HEADER = 46
const PAD = 36
const SUB_GAP = 120       // aire generoso entre subcontextos
const CONTENT_SUB_GAP = 140 // aire entre el texto y los subcontextos
const TOP_GAP = 500       // separación entre cajas de contexto de nivel superior
const BASE_H = 1300       // alto MÍNIMO de un contexto (aunque tenga poco) → grande
const EMPTY_RIGHT = 1400  // espacio libre a la derecha del contenido dentro de la caja
const EMPTY_BOTTOM = 1000 // espacio libre bajo el contenido dentro de la caja
const DEFAULT_ASPECT = 1.6

let _ctx: CanvasRenderingContext2D | null = null
// CACHÉ de líneas por texto: mismo texto = medir una sola vez (measureText es lo caro).
// El font y TEXT_W son fijos → el resultado es determinista y reutilizable. Acotada por
// nº de textos distintos; se limpia si crece demasiado (evita fuga de memoria).
const _lineCache = new Map<string, number>()
function countLines(text: string): number {
  const t = (text || '').trim()
  if (!t) return 1
  const cached = _lineCache.get(t)
  if (cached !== undefined) return cached
  if (!_ctx) { try { _ctx = document.createElement('canvas').getContext('2d') } catch { _ctx = null } }
  let lines = 1
  if (!_ctx) { lines = Math.max(1, Math.ceil(t.length / 52)) }
  else {
    _ctx.font = TEXT_FONT
    let line = ''
    for (const word of t.split(/\s+/)) {
      const test = line ? line + ' ' + word : word
      if (_ctx.measureText(test).width > TEXT_W && line) { lines++; line = word } else line = test
    }
  }
  if (_lineCache.size > 20000) _lineCache.clear()
  _lineCache.set(t, lines)
  return lines
}
export function rowHeight(text: string | null | undefined): number {
  return countLines(text || '') * LINE_H + ROW_PAD
}

/** Altura estimada de un BLOQUE de texto (`_doc`) por su `body` HTML: cada bloque
 *  (p/h/li/quote) cuenta sus líneas con salto de línea real → el layout reserva el alto
 *  correcto y los bloques NO se solapan. */
function docBodyHeight(n: Node): number {
  const body = n.body || ''
  if (!body.trim()) return rowHeight(n.text)
  const text = body
    .replace(/<\/(p|h1|h2|h3|li|blockquote|div|tr)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
  let lines = 0
  for (const l of text.split('\n')) if (l.trim()) lines += countLines(l.trim())
  return Math.max(1, lines) * LINE_H + ROW_PAD
}

function ed(n: Node): Record<string, unknown> {
  try { return JSON.parse(n.extraData || '{}') } catch { return {} }
}

/** Posición LIBRE (absoluta) de un contexto movido a mano (`_gx/_gy`). null = auto-flujo. */
function freePos(n: Node | null | undefined): { x: number; y: number } | null {
  if (!n) return null
  const e = ed(n)
  const x = Number(e._gx), y = Number(e._gy)
  return (Number.isFinite(x) && Number.isFinite(y)) ? { x, y } : null
}

// ── Predicados de CAJA (sub-área) por región ─────────────────────────────────
/** Contextos: una caja es un contexto marcado (`_ctx='1'`). */
function isContextBox(n: Node): boolean { return isMarkedContext(n) }

/** ¿Es CONTENIDO (fila) y no una sub-caja? Excluye conocimiento, capturas y logs. */
function isContent(n: Node, isBox: (n: Node) => boolean): boolean {
  if (n.deletedAt) return false
  if (isBox(n)) return false
  if (isContextKnowledge(n.text)) return false
  const e = ed(n)
  if (e._capture === '1' || e._logAt) return false
  if (e._absorbedBy) return false // línea ABSORBIDA en un bloque _doc → no se pinta suelta
  if (e._tagDefinition != null && e._aiVisible !== '1') return false // memoria IA ANTIGUA → oculta; la NUEVA (_aiVisible) se ve como tarjeta normal
  return true
}
function contentChildren(id: string, isBox: (n: Node) => boolean): Node[] {
  return store.children(id).filter(n => isContent(n, isBox))
}

interface Plan { box: { w: number; h: number }; content: { id: string; x: number; y: number; h: number }[]; subs: { id: string; x: number; y: number }[] }

function layoutContent(boxId: string, isBox: (n: Node) => boolean): { rows: Plan['content']; w: number; h: number } {
  const rows: Plan['content'] = []
  let y = 0, w = CONTENT_W
  const walk = (id: string, depth: number) => {
    const n = store.getNode(id)
    // Bloque de texto (`_doc`): alto = su body completo, y NO se recorren sus hijos (las
    // líneas están absorbidas dentro del bloque). Un nodo normal: 1 fila + sus hijos.
    const isDoc = !!n && (() => { try { return JSON.parse(n.extraData || '{}')._doc === '1' } catch { return false } })()
    const h = isDoc ? docBodyHeight(n!) : rowHeight(n?.text)
    rows.push({ id, x: depth * INDENT, y, h })
    y += h
    const right = depth * INDENT + CONTENT_W
    if (right > w) w = right
    if (!isDoc) for (const c of contentChildren(id, isBox)) walk(c.id, depth + 1)
  }
  for (const c of contentChildren(boxId, isBox)) walk(c.id, 0)
  return { rows, w, h: y }
}

function measureBox(boxId: string, aspect: number, isBox: (n: Node) => boolean, meta: Map<string, Plan>): { w: number; h: number } {
  const cached = meta.get(boxId)
  if (cached) return cached.box
  const content = layoutContent(boxId, isBox)
  const subNodes = store.children(boxId).filter(n => !n.deletedAt && isBox(n))
  const subBoxes = subNodes.map(sc => ({ id: sc.id, ...measureBox(sc.id, aspect, isBox, meta) }))

  const screenW = Math.round(BASE_H * aspect)
  const subs: Plan['subs'] = []
  const subTop = content.h > 0 ? content.h + CONTENT_SUB_GAP : 0
  let sy = subTop, subW = 0
  for (const s of subBoxes) {
    subs.push({ id: s.id, x: 0, y: sy })
    sy += s.h + SUB_GAP
    if (s.w > subW) subW = s.w
  }
  const subBottom = subBoxes.length ? sy - SUB_GAP : subTop
  const innerW = Math.max(content.w, subW)
  const innerH = Math.max(content.h, subBottom)
  // Mínimo para contener el contenido sin recortarlo (el texto NUNCA se sale).
  const minW = innerW + PAD * 2
  const minH = HEADER + PAD + innerH + PAD
  // Tamaño MANUAL (redimensionado a mano) si existe (`_ctxW/_ctxH`), acotado al mínimo.
  // Si no, tamaño AUTO grande y generoso (el texto ~5-10% del área; resto libre).
  const eo = ed(store.getNode(boxId) as Node)
  const ovW = Number(eo._ctxW), ovH = Number(eo._ctxH)
  const box = {
    w: ovW > 0 ? Math.max(ovW, minW) : Math.max(screenW, innerW + EMPTY_RIGHT),
    h: ovH > 0 ? Math.max(ovH, minH) : Math.max(BASE_H, minH + EMPTY_BOTTOM),
  }
  meta.set(boxId, { box, content: content.rows, subs })
  return box
}

function placeBox(boxId: string, x: number, y: number, meta: Map<string, Plan>, out: { boxes: Map<string, NRect>; items: Map<string, NRect> }): void {
  const plan = meta.get(boxId)!
  out.boxes.set(boxId, { x, y, w: plan.box.w, h: plan.box.h })
  const ox = x + PAD, oy = y + HEADER + PAD
  for (const c of plan.content) out.items.set(c.id, { x: ox + c.x, y: oy + c.y, w: CONTENT_W, h: c.h })
  for (const s of plan.subs) {
    // Subcontexto MOVIDO a mano → posición absoluta libre; si no, anidado (auto).
    const fp = freePos(store.getNode(s.id))
    if (fp) placeBox(s.id, fp.x, fp.y, meta, out)
    else placeBox(s.id, ox + s.x, oy + s.y, meta, out)
  }
}

/** Coloca una REGIÓN (los hijos-caja de `rootId`) en una fila horizontal desde `startX`.
 *  Devuelve el borde derecho alcanzado. */
function placeRegion(rootId: string, aspect: number, isBox: (n: Node) => boolean, startX: number, meta: Map<string, Plan>, out: { boxes: Map<string, NRect>; items: Map<string, NRect> }): number {
  const tops = store.children(rootId).filter(c => !c.deletedAt && !isContextKnowledge(c.text))
  for (const tc of tops) measureBox(tc.id, aspect, isBox, meta)
  let x = startX
  for (const tc of tops) {
    // Contexto MOVIDO a mano → posición absoluta libre (no avanza el flujo); si no, fluye.
    const fp = freePos(store.getNode(tc.id))
    if (fp) { placeBox(tc.id, fp.x, fp.y, meta, out) }
    else { placeBox(tc.id, x, 0, meta, out); x += (meta.get(tc.id)?.box.w ?? CONTENT_W) + TOP_GAP }
  }
  return x
}

/**
 * Layout del lienzo infinito: SOLO la región de CONTEXTOS (cajas anidadas). El calendario
 * es una superficie discreta aparte (`TemporalCanvasView`), no vive aquí. `aspect` =
 * ancho/alto del viewport. Los campos `dayCells`/`dayContentIds`/`todayId` se conservan
 * vacíos por compatibilidad con quien aún los lea (siempre vacíos).
 */
export function computeNestedLayout(rootId: string, aspect = DEFAULT_ASPECT): NestedLayout {
  const asp = aspect > 0.2 && aspect < 6 ? aspect : DEFAULT_ASPECT
  const meta = new Map<string, Plan>()
  const boxes = new Map<string, NRect>()
  const items = new Map<string, NRect>()

  // Región de CONTEXTOS (cajas anidadas). Única región del lienzo.
  const ctxRoot = findContextRoot()?.id ?? rootId
  placeRegion(ctxRoot, asp, isContextBox, 0, meta, { boxes, items })

  return {
    boxes, items,
    dayCells: new Map(), dayContentIds: new Set(), todayId: null, // agenda fuera del lienzo
    contextIds: new Set(boxes.keys()), contentIds: new Set(items.keys()),
  }
}
